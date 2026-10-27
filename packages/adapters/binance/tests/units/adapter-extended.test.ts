import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BinanceWalletAdapter } from '../../src/index.js';
import {
    AdapterState,
    NetworkType,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

function makeProvider(address: string = ADDRESS) {
    return {
        signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
        signTransaction: vi.fn().mockResolvedValue({ signature: 'tx-sig', transaction: { txID: '0x1' } }),
        signAndSendTransaction: vi.fn().mockResolvedValue({
            signature: 'sas-sig',
            txHash: '0xabc',
            transaction: { txID: '0x1' },
        }),
        disconnect: vi.fn().mockResolvedValue(undefined),
        getChainId: vi.fn().mockReturnValue('0x2b6653dc'),
        on: vi.fn(),
        removeListener: vi.fn(),
        defaultAddress: { base58: address },
    };
}

describe('BinanceWalletAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (window as any).binancew3w = undefined;
        (window as any).isBinance = undefined;
        Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
        Object.defineProperty(window.location, 'href', {
            value: 'http://localhost:3000/dapp',
            writable: true,
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        (window as any).binancew3w = undefined;
        (window as any).isBinance = undefined;
    });

    function makeConnected(provider: any = makeProvider()) {
        const adapter = new BinanceWalletAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._provider = provider;
        adapter.on('error', () => {});
        return adapter;
    }

    describe('signing with the in-page provider', () => {
        test('signMessage delegates to provider.signMessageV2', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            const sig = await adapter.signMessage('hi');
            expect(sig).toBe('msg-sig');
            expect(provider.signMessageV2).toHaveBeenCalledWith('hi');
        });

        test('signMessage wraps provider failures', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            provider.signMessageV2.mockRejectedValueOnce(new Error('denied'));
            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });

        test('signTransaction delegates to provider.signTransaction', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            const res = await adapter.signTransaction({} as any);
            expect(res).toEqual({ signature: 'tx-sig', transaction: { txID: '0x1' } });
            expect(provider.signTransaction).toHaveBeenCalled();
        });

        test('signTransaction wraps provider failures', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            provider.signTransaction.mockRejectedValueOnce(new Error('denied'));
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('signAndSendTransaction parses a JSON-stringified transaction', async () => {
            const provider = makeProvider();
            provider.signAndSendTransaction.mockResolvedValueOnce({
                signature: 'sas-sig',
                txHash: '0xabc',
                transaction: JSON.stringify({ txID: '0x2' }),
            });
            const adapter = makeConnected(provider);
            const res = await adapter.signAndSendTransaction({} as any);
            expect(res.transaction).toEqual({ txID: '0x2' });
        });

        test('signAndSendTransaction keeps the object transaction as-is', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            const res = await adapter.signAndSendTransaction({} as any);
            expect(res.transaction).toEqual({ txID: '0x1' });
        });

        test('signAndSendTransaction refuses the WalletConnect fallback', async () => {
            const adapter = makeConnected(makeProvider());
            (adapter as any)._walletConnectAdapter = { signAndSendTransaction: vi.fn() };
            await expect(adapter.signAndSendTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
    });

    describe('signing rejects when not connected', () => {
        test.each([
            ['signMessage', 'signMessageV2', (a: any) => a.signMessage('hi')],
            ['signTransaction', 'signTransaction', (a: any) => a.signTransaction({} as any)],
        ])('%s throws WalletDisconnectedError', async (_name, _method, call) => {
            const adapter = new BinanceWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = makeProvider();
            adapter.on('error', () => {});
            await expect(call(adapter)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#network()', () => {
        test('returns chain info from the provider', async () => {
            const provider = makeProvider();
            provider.getChainId.mockReturnValue('0x2b6653dc');
            const adapter = makeConnected(provider);
            const info = await adapter.network();
            expect(info.chainId).toBe('0x2b6653dc');
            expect(provider.getChainId).toHaveBeenCalled();
        });

        test('falls back to the walletConnectConfig network on the WalletConnect path', async () => {
            const adapter = new BinanceWalletAdapter({
                openAppWithDeeplink: false,
                walletConnectConfig: { network: 'Mainnet' } as any,
            });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = null;
            (adapter as any)._walletConnectAdapter = { signAndSendTransaction: vi.fn() };
            adapter.on('error', () => {});

            const info = await adapter.network();
            expect(info.networkType).toBe(NetworkType.Mainnet);
            expect(info.chainId).toBe('0x2b6653dc');
        });

        test('wraps provider.getChainId failures', async () => {
            const provider = makeProvider();
            provider.getChainId.mockImplementation(() => {
                throw new Error('chain down');
            });
            const adapter = makeConnected(provider);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });

        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new BinanceWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#_onAccountsChanged (provider.accountsChanged listener)', () => {
        test('updates the address and emits connect when switching from empty', async () => {
            const provider = makeProvider('');
            const adapter = new BinanceWalletAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = provider;
            (adapter as any)._address = null;
            adapter.on('error', () => {});
            (adapter as any)._listenEvent();

            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            // The provider callback registered via provider.on(...)
            const accountsChangedCb = provider.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            expect(accountsChangedCb).toBeTypeOf('function');
            accountsChangedCb(ADDRESS);
            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('emits disconnect and clears the address on an empty account', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(provider);
            (adapter as any)._listenEvent();

            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            const accountsChangedCb = provider.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            accountsChangedCb(null);
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });
    });

    describe('#_checkWallet() retry semantics', () => {
        test('after a first failure the second call resolves immediately', async () => {
            const adapter = new BinanceWalletAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);

            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });

    describe('openBinanceWallet deeplink', () => {
        test('returns false on desktop', () => {
            // happy-dom default non-mobile UA, no isBinance flag.
            const adapter = new BinanceWalletAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });
    });
});
