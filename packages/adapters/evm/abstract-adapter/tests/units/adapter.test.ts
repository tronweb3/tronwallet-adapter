import { vi, describe, beforeEach, test, expect, afterEach } from 'vitest';
import { Adapter, WalletReadyState, WalletDisconnectedError, WalletNotFoundError } from '../../src/index.js';
import type { Asset, Chain, AdapterName, Transaction } from '../../src/adapter.js';
import type { EIP1193Provider } from '../../src/eip1193-provider.js';

const provider = {
    request: vi.fn(),
} as unknown as EIP1193Provider;

class TestAdapter extends Adapter {
    name = 'Test' as AdapterName<'Test'>;
    icon = 'https://icon.com/test-icon.png';
    url = 'https://test-wallet.com';
    address: null | string = null;
    readyState = WalletReadyState.Found;

    constructor() {
        super();
    }

    getProvider = vi.fn(() => Promise.resolve(provider));
    async connect() {
        return Promise.resolve('address1');
    }
    // Intentionally do NOT override signTypedData() / signMessage() here — the abstract
    // implementation is what we want to exercise in the disconnected-guard tests.
}

class DetectAdapter extends Adapter {
    name = 'Detect' as AdapterName<'Detect'>;
    icon = 'https://icon.com/test-icon.png';
    url = 'https://test-wallet.com';
    address: null | string = null;
    readyState = WalletReadyState.Found;

    constructor(private readonly injectedProvider: EIP1193Provider | null = null) {
        super();
        this.eip6963Info.support = true;
        this.eip6963Info.name = 'Detect';
    }

    protected getInjectedProvider(): EIP1193Provider | null {
        return this.injectedProvider;
    }

    async connect() {
        return Promise.resolve('address1');
    }

    async signTypedData(): Promise<string> {
        return Promise.resolve('signature');
    }
}

function installEIP6963Provider(provider: EIP1193Provider, name = 'Detect') {
    const detail = {
        info: {
            uuid: `io.test.${name}`,
            name,
            icon: '',
            rdns: `io.test.${name}`,
        },
        provider,
    };

    const onRequestProvider = () => {
        window.dispatchEvent(
            new CustomEvent('eip6963:announceProvider', {
                detail,
            })
        );
    };

    window.addEventListener('eip6963:requestProvider', onRequestProvider);

    return () => {
        window.removeEventListener('eip6963:requestProvider', onRequestProvider);
    };
}

let adapter: TestAdapter;
beforeEach(() => {
    adapter = new TestAdapter();
    adapter.address = '0xsome address';
    provider.request = vi.fn();
    vi.clearAllMocks();
});
describe('#AbstractAdapter', () => {
    test('#getProvider() should resolve provider via EIP-6963', async () => {
        const detectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const cleanup = installEIP6963Provider(detectedProvider);
        const detectAdapter = new DetectAdapter();

        await expect(detectAdapter.getProvider()).resolves.toBe(detectedProvider);

        cleanup();
    });
    test('#getProvider() should prefer injected provider', async () => {
        const injectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const detectAdapter = new DetectAdapter(injectedProvider);

        await expect(detectAdapter.getProvider()).resolves.toBe(injectedProvider);
    });
    test('#getProvider() should leave no timer behind when a wallet announces synchronously', async () => {
        const detectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const cleanup = installEIP6963Provider(detectedProvider);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter();
            await expect(detectAdapter.getProvider()).resolves.toBe(detectedProvider);

            // Detection already succeeded, so neither the poll nor the timeout may survive.
            expect(vi.getTimerCount()).toBe(0);

            await vi.advanceTimersByTimeAsync(3001);
            expect(consoleError).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
            consoleError.mockRestore();
            cleanup();
        }
    });
    test('#getProvider() should leave no timer behind when polling finds the injected provider', async () => {
        const injectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(injectedProvider);
            const pending = detectAdapter.getProvider();
            // No wallet announces, so the 100ms poll is what finds the provider.
            await vi.advanceTimersByTimeAsync(100);

            await expect(pending).resolves.toBe(injectedProvider);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
    test('#getProvider() should leave no timer behind without EIP-6963 support', async () => {
        const injectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(injectedProvider);
            detectAdapter.eip6963Info.support = false;

            await expect(detectAdapter.getProvider()).resolves.toBe(injectedProvider);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
    test('#getProvider() should retry after a failed detection', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let cleanup: (() => void) | undefined;
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(null);
            const first = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(3001);
            await expect(first).resolves.toBeNull();

            // The wallet appears afterwards: a late extension, the user enabling it, a mobile
            // WebView still starting up. The adapter must not stay stuck on the failed result.
            const lateProvider = { request: vi.fn() } as unknown as EIP1193Provider;
            cleanup = installEIP6963Provider(lateProvider);

            await expect(detectAdapter.getProvider()).resolves.toBe(lateProvider);
        } finally {
            // Registered on `window`, so it has to come off even when an assertion fails,
            // otherwise the announcer leaks into the tests that follow.
            cleanup?.();
            vi.useRealTimers();
            consoleError.mockRestore();
        }
    });
    test('#getProvider() should not wait out the grace period again on a retry', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(null);
            const first = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(3000);
            await expect(first).resolves.toBeNull();
            expect(consoleError).toHaveBeenCalledTimes(1);

            // The wallet is still missing. A retry must settle immediately rather than making
            // the caller sit through another 3s window, and must not log again.
            const retry = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(0);
            await expect(retry).resolves.toBeNull();
            expect(consoleError).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
            consoleError.mockRestore();
        }
    });
    test('#getProvider() should still find a provider on an immediate retry', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let cleanup: (() => void) | undefined;
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(null);
            const first = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(3000);
            await expect(first).resolves.toBeNull();

            const lateProvider = { request: vi.fn() } as unknown as EIP1193Provider;
            cleanup = installEIP6963Provider(lateProvider);

            // No grace period on the retry, but a synchronous announce still lands.
            const retry = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(0);
            await expect(retry).resolves.toBe(lateProvider);
        } finally {
            cleanup?.();
            vi.useRealTimers();
            consoleError.mockRestore();
        }
    });
    test('#getProvider() should keep caching a successful detection', async () => {
        const detectedProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const cleanup = installEIP6963Provider(detectedProvider);

        try {
            const detectAdapter = new DetectAdapter();
            await expect(detectAdapter.getProvider()).resolves.toBe(detectedProvider);

            // The successful result stays cached, so a second call answers from it.
            expect((detectAdapter as unknown as { getProviderPromise: unknown }).getProviderPromise).not.toBeNull();
            await expect(detectAdapter.getProvider()).resolves.toBe(detectedProvider);
        } finally {
            cleanup();
        }
    });
    test('#getProvider() should still report an undetected provider after the timeout', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.useFakeTimers();

        try {
            const detectAdapter = new DetectAdapter(null);
            const pending = detectAdapter.getProvider();
            await vi.advanceTimersByTimeAsync(3001);

            await expect(pending).resolves.toBeNull();
            expect(consoleError).toHaveBeenCalledWith('[Detect]: Unable to detect provider.');
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
            consoleError.mockRestore();
        }
    });
    test('#autoConnect() should swallow eth_accounts errors and reset address', async () => {
        provider.request = vi.fn(() => Promise.reject(new Error('eth_accounts failed')));

        await expect((adapter as any).autoConnect(provider)).resolves.toBeUndefined();
        expect(adapter.address).toBeNull();
    });
    test('#connected should be correct', () => {
        expect(adapter.connected).toEqual(true);
        adapter.address = '';
        expect(adapter.connected).toEqual(false);
    });
    test('#signMessage() should work fine', async () => {
        const message = 'Hello';
        await adapter.signMessage({ message });
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'personal_sign', params: [message, adapter.address] });
    });
    test('#signMessage() with address should work fine', async () => {
        const message = 'Hello';
        const address = 'address';
        await adapter.signMessage({ message, address });
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'personal_sign', params: [message, address] });
    });
    test('#signMessage() should throw error when provider.request throw error', async () => {
        const error: any = new Error('user rejected');
        error.code = '30003';
        error.data = 'some data';
        provider.request = vi.fn(() => {
            throw error;
        });
        await expect(adapter.signMessage({ message: 'hello' })).rejects.toEqual(error);
    });
    test('#sendTransaction() should work fine', async () => {
        const transaction = {
            from: 'address from',
            to: 'address to',
            value: '0x03',
        };
        await adapter.sendTransaction(transaction);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'eth_sendTransaction', params: [transaction] });
    });
    test('#addChain() should work fine', async () => {
        const chainInfo: Chain = {
            chainId: '0x539',
            chainName: 'Localhost',
            nativeCurrency: {
                name: 'Ethereum Token',
                symbol: 'ETH',
                decimals: 18,
            },
            rpcUrls: ['https://rpc-url.com'],
        };
        await adapter.addChain(chainInfo);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_addEthereumChain', params: [chainInfo] });
    });
    test('#addChain() should work fine', async () => {
        const chainId = '0x539';
        await adapter.switchChain(chainId);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    });
    test('#watchAsset() should work fine', async () => {
        const asset: Asset = {
            type: 'ERC20',
            options: {
                address: '0xtoken address',
                symbol: 'USDT',
                decimals: 18,
            },
        };
        await adapter.watchAsset(asset);
        expect(adapter.getProvider).toHaveBeenCalledTimes(1);
        expect(provider.request).toHaveBeenCalledWith({ method: 'wallet_watchAsset', params: asset });
    });

    // =================================================================
    // network()
    // =================================================================

    describe('#network()', () => {
        test('calls eth_chainId and returns the hex chainId', async () => {
            (provider.request as any).mockResolvedValue('0x1a4');
            const result = await adapter.network();
            expect(result).toBe('0x1a4');
            expect(provider.request).toHaveBeenCalledWith({ method: 'eth_chainId', params: [] });
        });

        test('throws WalletNotFoundError when getProvider returns null', async () => {
            const a = new TestAdapter();
            a.address = '0xabc';
            (a.getProvider as any).mockResolvedValueOnce(null);
            await expect(a.network()).rejects.toBeInstanceOf(WalletNotFoundError);
        });
    });

    // =================================================================
    // signMessage / signTypedData / sendTransaction — disconnected guard
    // =================================================================

    describe('#signMessage() — disconnected guard', () => {
        test('throws WalletDisconnectedError when not connected (address is null)', async () => {
            const a = new TestAdapter();
            a.address = null;
            await expect(a.signMessage({ message: 'hi' })).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        test('throws WalletDisconnectedError when address is empty string', async () => {
            const a = new TestAdapter();
            a.address = '';
            await expect(a.signMessage({ message: 'hi' })).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#signTypedData() — disconnected guard', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const a = new TestAdapter();
            a.address = null;
            await expect(
                a.signTypedData({
                    typedData: {
                        domain: {},
                        primaryType: 'X',
                        types: { X: [{ name: 'x', type: 'string' }] },
                        message: {},
                    } as any,
                })
            ).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        test('falls back to this.address when no address is supplied', async () => {
            const a = new TestAdapter();
            a.address = '0xfrom-this';
            (provider.request as any).mockResolvedValue('sig');
            await a.signTypedData({
                typedData: {
                    domain: {},
                    primaryType: 'X',
                    types: { X: [{ name: 'x', type: 'string' }] },
                    message: {},
                } as any,
            });
            expect(provider.request).toHaveBeenCalledWith({
                method: 'eth_signTypedData_v4',
                params: ['0xfrom-this', expect.objectContaining({ primaryType: 'X' })],
            });
        });
    });

    describe('#sendTransaction() — disconnected guard', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const a = new TestAdapter();
            a.address = null;
            await expect(a.sendTransaction({ from: '0xabc', to: '0xdef', value: '0x0' } as any)).rejects.toBeInstanceOf(
                WalletDisconnectedError
            );
        });
    });

    // =================================================================
    // addChain / switchChain / watchAsset — provider-missing guard
    // =================================================================

    describe('#addChain() — provider missing', () => {
        test('throws WalletNotFoundError when provider is null', async () => {
            const a = new TestAdapter();
            a.address = '0xabc';
            (a.getProvider as any).mockResolvedValueOnce(null);
            await expect(
                a.addChain({
                    chainId: '0x539',
                    chainName: 'Localhost',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://rpc-url.com'],
                } as any)
            ).rejects.toBeInstanceOf(WalletNotFoundError);
        });
    });

    describe('#switchChain() — provider missing', () => {
        test('throws WalletNotFoundError when provider is null', async () => {
            const a = new TestAdapter();
            a.address = '0xabc';
            (a.getProvider as any).mockResolvedValueOnce(null);
            await expect(a.switchChain('0x539' as any)).rejects.toBeInstanceOf(WalletNotFoundError);
        });
    });

    describe('#watchAsset() — provider missing', () => {
        test('throws WalletNotFoundError when provider is null', async () => {
            const a = new TestAdapter();
            a.address = '0xabc';
            (a.getProvider as any).mockResolvedValueOnce(null);
            await expect(
                a.watchAsset({
                    type: 'ERC20',
                    options: { address: '0xtoken' as any, symbol: 'USDT', decimals: 18 },
                } as any)
            ).rejects.toBeInstanceOf(WalletNotFoundError);
        });
    });

    // =================================================================
    // autoConnect() — full coverage
    // =================================================================

    describe('#autoConnect()', () => {
        test('success: sets address and emits accountsChanged with full array', async () => {
            const a = new TestAdapter();
            a.address = null;
            (provider.request as any).mockResolvedValue(['0xabc']);
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            await (a as any).autoConnect(provider);
            expect(a.address).toBe('0xabc');
            expect(onAccountsChanged).toHaveBeenCalledWith(['0xabc']);
        });

        test('success with multiple accounts: picks first and emits full array', async () => {
            const a = new TestAdapter();
            a.address = null;
            (provider.request as any).mockResolvedValue(['0xfirst', '0xsecond']);
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            await (a as any).autoConnect(provider);
            expect(a.address).toBe('0xfirst');
            expect(onAccountsChanged).toHaveBeenCalledWith(['0xfirst', '0xsecond']);
        });

        test('empty array: sets address null and emits nothing', async () => {
            const a = new TestAdapter();
            a.address = '0xstale';
            (provider.request as any).mockResolvedValue([]);
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            await (a as any).autoConnect(provider);
            expect(a.address).toBeNull();
            expect(onAccountsChanged).not.toHaveBeenCalled();
        });

        test('rejection: sets address null and emits nothing', async () => {
            const a = new TestAdapter();
            a.address = '0xstale';
            (provider.request as any).mockRejectedValue(new Error('rpc fail'));
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            await (a as any).autoConnect(provider);
            expect(a.address).toBeNull();
            expect(onAccountsChanged).not.toHaveBeenCalled();
        });
    });

    // =================================================================
    // getInjectedProvider()
    // =================================================================

    describe('#getInjectedProvider()', () => {
        test('returns window.ethereum when window exists', () => {
            const eth = { request: vi.fn() } as unknown as EIP1193Provider;
            (window as any).ethereum = eth;
            const a = new TestAdapter();
            expect((a as any).getInjectedProvider()).toBe(eth);
            delete (window as any).ethereum;
        });

        test('returns null when window.ethereum is not present', () => {
            delete (window as any).ethereum;
            const a = new TestAdapter();
            expect((a as any).getInjectedProvider()).toBeNull();
        });

        test('returns null when window is undefined', () => {
            const origWindow = globalThis.window;
            // @ts-expect-error — global delete for the test
            delete (globalThis as any).window;
            const a = new TestAdapter();
            try {
                expect((a as any).getInjectedProvider()).toBeNull();
            } finally {
                (globalThis as any).window = origWindow;
            }
        });
    });

    // =================================================================
    // isEIP6963Provider() — truth table
    // =================================================================

    describe('#isEIP6963Provider() — truth table', () => {
        const stubProvider = { request: vi.fn() } as unknown as EIP1193Provider;
        const stubInfo = (rdns: string, name: string) => ({ uuid: 'u', name, icon: '', rdns } as any);

        test('returns false when support=false', () => {
            const a = new TestAdapter();
            a.eip6963Info.support = false;
            expect((a as any).isEIP6963Provider(stubProvider, stubInfo('io.x', 'X'))).toBe(false);
        });

        test('returns true when rdns matches', () => {
            const a = new TestAdapter();
            a.eip6963Info.support = true;
            a.eip6963Info.rdns = 'io.test.Detect';
            a.eip6963Info.name = '';
            expect((a as any).isEIP6963Provider(stubProvider, stubInfo('io.test.Detect', 'Other'))).toBe(true);
        });

        test('returns true when rdns empty and name matches', () => {
            const a = new TestAdapter();
            a.eip6963Info.support = true;
            a.eip6963Info.rdns = '';
            a.eip6963Info.name = 'Detect';
            expect((a as any).isEIP6963Provider(stubProvider, stubInfo('different.rdns', 'Detect'))).toBe(true);
        });

        test('returns false when info is undefined and no rdns/name match', () => {
            const a = new TestAdapter();
            a.eip6963Info.support = true;
            a.eip6963Info.rdns = '';
            a.eip6963Info.name = '';
            expect((a as any).isEIP6963Provider(stubProvider, undefined)).toBe(false);
        });
    });

    // =================================================================
    // listenEvents() — wires all four handlers
    // =================================================================

    describe('#listenEvents()', () => {
        test('subscribes to connect, disconnect, accountsChanged, chainChanged', () => {
            const events: Record<string, any> = {};
            const prov = {
                request: vi.fn(),
                on: vi.fn((event: string, handler: any) => {
                    events[event] = handler;
                }),
                removeListener: vi.fn(),
            } as unknown as EIP1193Provider;
            const a = new TestAdapter();
            (a as any).listenEvents(prov);

            expect(prov.on).toHaveBeenCalledWith('connect', expect.any(Function));
            expect(prov.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
            expect(prov.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
            expect(prov.on).toHaveBeenCalledWith('chainChanged', expect.any(Function));
        });

        test('connect event re-emits connect with the connectInfo', () => {
            const events: Record<string, any> = {};
            const prov = {
                request: vi.fn(),
                on: vi.fn((event: string, handler: any) => {
                    events[event] = handler;
                }),
                removeListener: vi.fn(),
            } as unknown as EIP1193Provider;
            const a = new TestAdapter();
            (a as any).listenEvents(prov);
            const onConnect = vi.fn();
            a.on('connect', onConnect);
            events.connect({ chainId: '0x1' });
            expect(onConnect).toHaveBeenCalledWith({ chainId: '0x1' });
        });

        test('disconnect event re-emits disconnect with the error', () => {
            const events: Record<string, any> = {};
            const prov = {
                request: vi.fn(),
                on: vi.fn((event: string, handler: any) => {
                    events[event] = handler;
                }),
                removeListener: vi.fn(),
            } as unknown as EIP1193Provider;
            const a = new TestAdapter();
            (a as any).listenEvents(prov);
            const onDisconnect = vi.fn();
            a.on('disconnect', onDisconnect);
            const err = { code: 1013, message: 'disconnected' };
            events.disconnect(err);
            expect(onDisconnect).toHaveBeenCalledWith(err);
        });
    });

    // =================================================================
    // onAccountsChanged / onChainChanged
    // =================================================================

    describe('#onAccountsChanged()', () => {
        test('updates address and emits accountsChanged with full array (single account)', () => {
            const a = new TestAdapter();
            a.address = '0xold';
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            (a as any).onAccountsChanged(['0xnew']);
            expect(a.address).toBe('0xnew');
            expect(onAccountsChanged).toHaveBeenCalledWith(['0xnew']);
        });

        test('updates address to first account and emits full multi-account array', () => {
            const a = new TestAdapter();
            a.address = null;
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            (a as any).onAccountsChanged(['0xa', '0xb']);
            expect(a.address).toBe('0xa');
            expect(onAccountsChanged).toHaveBeenCalledWith(['0xa', '0xb']);
        });

        test('empty array → address=null, emits the empty array', () => {
            const a = new TestAdapter();
            a.address = '0xold';
            const onAccountsChanged = vi.fn();
            a.on('accountsChanged', onAccountsChanged);
            (a as any).onAccountsChanged([]);
            // The source always emits (so listeners can sync their own state), but the
            // adapter's own address is cleared because accounts[0] is undefined.
            expect(a.address).toBeNull();
            expect(onAccountsChanged).toHaveBeenCalledWith([]);
        });
    });

    describe('#onChainChanged()', () => {
        test('emits chainChanged with the raw string', () => {
            const a = new TestAdapter();
            const onChainChanged = vi.fn();
            a.on('chainChanged', onChainChanged);
            (a as any).onChainChanged('0x1');
            expect(onChainChanged).toHaveBeenCalledWith('0x1');
        });
    });

    // =================================================================
    // prepareProvider()
    // =================================================================

    describe('#prepareProvider()', () => {
        test('returns the provider when getProvider resolves a non-null provider', async () => {
            const a = new TestAdapter();
            (a.getProvider as any).mockResolvedValueOnce(provider);
            await expect((a as any).prepareProvider()).resolves.toBe(provider);
        });

        test('throws WalletNotFoundError when provider resolves null', async () => {
            const a = new TestAdapter();
            (a.getProvider as any).mockResolvedValueOnce(null);
            await expect((a as any).prepareProvider()).rejects.toBeInstanceOf(WalletNotFoundError);
        });
    });

    // =================================================================
    // connected getter — additional branches
    // =================================================================

    describe('#connected getter', () => {
        test('returns false for empty string', () => {
            const a = new TestAdapter();
            a.address = '';
            expect(a.connected).toBe(false);
        });

        test('returns false for null', () => {
            const a = new TestAdapter();
            a.address = null;
            expect(a.connected).toBe(false);
        });

        test('returns true for any non-empty string', () => {
            const a = new TestAdapter();
            a.address = '0xabc';
            expect(a.connected).toBe(true);
        });
    });
});
