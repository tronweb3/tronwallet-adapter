import { OneKeyAdapter } from '../../src/index.js';
import { supportOneKey } from '../../src/utils.js';
import * as utils from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@tronweb3/tronwallet-adapter-tronlink', async (importOriginal) => {
    const mod: any = await importOriginal();
    return {
        ...mod,
        getNetworkInfoByTronWeb: vi.fn(),
    };
});

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

window.open = vi.fn();

function setUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function makeConnectedAdapter(overrides: { defaultAddress?: any } = {}) {
    const adapter = new OneKeyAdapter();
    const onAccountsChanged = vi.fn();
    const onChainChanged = vi.fn();
    const removeListener = vi.fn();
    const tronWeb: any = {
        defaultAddress: overrides.defaultAddress ?? { base58: ADDRESS },
        trx: {
            sign: vi.fn(),
            signMessageV2: vi.fn(),
        },
    };
    const wallet = {
        request: vi.fn().mockResolvedValue({ code: 200 }),
        tronWeb,
        on: onAccountsChanged.mockImplementation((event: string, cb: unknown) => {
            if (event === 'accountsChanged') (wallet as any)._onAccountsChanged = cb;
            if (event === 'chainChanged') (wallet as any)._onChainChanged = cb;
        }),
        removeListener,
    };
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._wallet = wallet;
    (adapter as any)._address = tronWeb.defaultAddress.base58 ?? null;
    (adapter as any)._state = AdapterState.Connected;
    adapter.on('error', () => {});
    return adapter;
}

beforeEach(() => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    delete (window as any).$onekey;
    delete (window as any).tronWeb;
    delete (window as any).safepalTronProvider;
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
    vi.mocked(getNetworkInfoByTronWeb).mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('OneKeyAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new OneKeyAdapter();
            expect(adapter.name).toEqual('OneKey');
            expect(adapter).toHaveProperty('icon');
            expect(adapter).toHaveProperty('url');
            expect(adapter).toHaveProperty('readyState');
            expect(adapter).toHaveProperty('address');
            expect(adapter).toHaveProperty('connecting');
            expect(adapter).toHaveProperty('connected');
            expect(adapter).toHaveProperty('connect');
            expect(adapter).toHaveProperty('disconnect');
            expect(adapter).toHaveProperty('signMessage');
            expect(adapter).toHaveProperty('signTransaction');
            expect(adapter).toHaveProperty('on');
            expect(adapter).toHaveProperty('off');
        });

        test('falls back to the default checkTimeout when it is explicitly undefined', async () => {
            const adapter = new OneKeyAdapter({ checkTimeout: undefined });
            adapter.on('error', () => {});
            expect(typeof (adapter as any).config.checkTimeout).toBe('number');
            expect(Number.isNaN((adapter as any).config.checkTimeout)).toBe(false);
        });
    });
});

describe('#network()', () => {
    test('returns network info on the happy path', async () => {
        const adapter = makeConnectedAdapter();
        const networkInfo = {
            networkType: 'mainnet',
            chainId: '0x2b6653dc',
            fullNode: 'https://example.com',
            solidityNode: 'https://example.com',
            eventServer: 'https://example.com',
        };
        vi.mocked(getNetworkInfoByTronWeb).mockResolvedValue(networkInfo as any);

        const network = await adapter.network();
        expect(network).toEqual(networkInfo);
        expect(vi.mocked(getNetworkInfoByTronWeb)).toHaveBeenCalledWith((adapter as any)._wallet.tronWeb);
    });

    test('throws WalletDisconnectedError when state is not Connected', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: {} };
        (adapter as any)._state = AdapterState.Disconnect;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when _wallet is null', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = null;
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps non-WalletError failures as WalletGetNetworkError and emits error', async () => {
        const adapter = makeConnectedAdapter();
        vi.mocked(getNetworkInfoByTronWeb).mockRejectedValue(new Error('network boom'));
        const onError = vi.fn();
        adapter.on('error', onError);

        const err = await adapter.network().then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletGetNetworkError);
        expect(err.message).toBe('network boom');
        expect(onError).toHaveBeenCalledWith(err);
    });

    test('rethrows a WalletError from the inner call without rewrapping', async () => {
        const adapter = makeConnectedAdapter();
        const original = new WalletDisconnectedError();
        vi.mocked(getNetworkInfoByTronWeb).mockRejectedValue(original);
        const onError = vi.fn();
        adapter.on('error', onError);

        const err = await adapter.network().then(
            () => null,
            (e) => e
        );
        expect(err).toBe(original);
    });
});

describe('#_connect()', () => {
    test('short-circuits silently when _beforeConnect returns false (already connected)', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        adapter.on('error', () => {});

        await adapter.connect();

        expect(adapter.address).toBe(ADDRESS);
    });

    test('code 200 with empty defaultAddress → console.error + WalletConnectionError', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockResolvedValue({ code: 200 }),
            tronWeb: { defaultAddress: { base58: '' } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );

        expect(errorSpy).toHaveBeenCalled();
        expect(err).toBeInstanceOf(WalletConnectionError);
        expect(err.message).toMatch(/no address was found/i);
        errorSpy.mockRestore();
    });

    test('null res → "Request connect error."', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockResolvedValue(null),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletConnectionError);
        expect(err.message).toBe('Request connect error.');
    });

    test('code 4000 → "user rejected"', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockResolvedValue({ code: 4000 }),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletConnectionError);
        expect(err.message).toBe('The user rejected connection.');
    });

    test('code 4001 → "pending request"', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockResolvedValue({ code: 4001 }),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletConnectionError);
        expect(err.message).toMatch(/already initiated a request/i);
    });

    test('other code → "Request connect error."', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockResolvedValue({ code: 5000 }),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletConnectionError);
        expect(err.message).toBe('Request connect error.');
    });

    test('clears _connecting in finally when request rejects', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet = {
            request: vi.fn().mockRejectedValue(new Error('request fail')),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.connecting).toBe(false);
    });

    test('rethrows an existing WalletError without rewrapping', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const original = new WalletDisconnectedError();
        vi.spyOn(adapter as any, '_beforeConnect').mockRejectedValue(original);
        adapter.on('error', () => {});

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBe(original);
    });

    test('success path registers both accountsChanged and chainChanged listeners', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const onMock = vi.fn();
        const wallet = {
            request: vi.fn().mockResolvedValue({ code: 200 }),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: onMock,
            removeListener: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});

        await adapter.connect();

        expect(onMock).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
        expect(onMock).toHaveBeenCalledWith('chainChanged', expect.any(Function));
    });
});

describe('#disconnect()', () => {
    test('calls _stopListenEvent first then early-returns when state is not Connected', async () => {
        const adapter = new OneKeyAdapter();
        const removeListener = vi.fn();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request: vi.fn(),
            tronWeb: {},
            on: vi.fn(),
            removeListener,
        };
        (adapter as any)._state = AdapterState.Disconnect;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();

        expect(removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function));
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    test('removes listeners, resets state, and emits disconnect when Connected', async () => {
        const adapter = makeConnectedAdapter();
        const removeListener = (adapter as any)._wallet.removeListener;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();

        expect(removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function));
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
});

describe('#signTransaction()', () => {
    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps rejection as WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValue(new Error('sign fail'));
        adapter.on('error', () => {});

        const err = await adapter.signTransaction({} as any).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('sign fail');
    });

    test('happy path returns the signed transaction', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockResolvedValue({ signature: ['s'] });

        const out = await adapter.signTransaction({} as any);
        expect(out).toEqual({ signature: ['s'] });
    });
});

describe('#signMessage()', () => {
    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new OneKeyAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { signMessageV2: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps rejection as WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue(new Error('msg fail'));
        adapter.on('error', () => {});

        const err = await adapter.signMessage('hi').then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignMessageError);
        expect(err.message).toBe('msg fail');
    });

    test('happy path returns the signature', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockResolvedValue('signed');

        const out = await adapter.signMessage('hi');
        expect(out).toBe('signed');
    });
});

describe('#_onAccountsChanged()', () => {
    test('empty curAddr → setAddress(null) + Disconnect', async () => {
        const adapter = makeConnectedAdapter({ defaultAddress: { base58: ADDRESS } });
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        (adapter as any)._wallet.tronWeb.defaultAddress = { base58: '' };

        await (adapter as any)._onAccountsChanged();

        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onDisconnect).toHaveBeenCalled();
    });

    test('non-empty curAddr + checkSecurity rejection → Disconnect, no connect emit', async () => {
        const adapter = makeConnectedAdapter({ defaultAddress: { base58: ADDRESS } });
        vi.spyOn(adapter as any, 'checkSecurity').mockRejectedValue(new Error('risk'));
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);
        (adapter as any)._wallet.tronWeb.defaultAddress = { base58: 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS' };

        await (adapter as any)._onAccountsChanged();

        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onConnect).not.toHaveBeenCalled();
    });

    test('address equal to previous → no accountsChanged emit', async () => {
        const adapter = makeConnectedAdapter({ defaultAddress: { base58: ADDRESS } });
        const onAccountsChanged = vi.fn();
        adapter.on('accountsChanged', onAccountsChanged);
        // address is the same as before        await (adapter as any)._onAccountsChanged();
        expect(onAccountsChanged).not.toHaveBeenCalled();
    });

    test('different new address → emit accountsChanged and connect when transitioning from no-address', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._address = null;
        (adapter as any)._state = AdapterState.Disconnect;
        (adapter as any)._wallet.tronWeb.defaultAddress = { base58: ADDRESS };
        const onAccountsChanged = vi.fn();
        const onConnect = vi.fn();
        adapter.on('accountsChanged', onAccountsChanged);
        adapter.on('connect', onConnect);

        await (adapter as any)._onAccountsChanged();

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onAccountsChanged).toHaveBeenCalledWith(ADDRESS, '');
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });
});

describe('#_onChainChanged()', () => {
    test('maps "0x00" → "0x94a9059e" (OneKey Shasta chain ID)', () => {
        const adapter = new OneKeyAdapter();
        const onChainChanged = vi.fn();
        adapter.on('chainChanged', onChainChanged);

        (adapter as any)._onChainChanged('0x00');

        expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x94a9059e' });
    });

    test('passes other chainIds through with the { chainId } wrapper', () => {
        const adapter = new OneKeyAdapter();
        const onChainChanged = vi.fn();
        adapter.on('chainChanged', onChainChanged);

        (adapter as any)._onChainChanged('0x2b6653dc');

        expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2b6653dc' });
    });
});

describe('#_openAppByDeepLinkIfNeed()', () => {
    test('returns false unconditionally', () => {
        const adapter = new OneKeyAdapter();
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });
});

describe('utils.ts', () => {
    test('supportOneKey returns false when window.$onekey.tron is missing', () => {
        delete (window as any).$onekey;
        expect(supportOneKey()).toBe(false);
    });

    test('supportOneKey returns true when window.$onekey.tron is present', () => {
        (window as any).$onekey = { tron: { tronWeb: {} } };
        expect(supportOneKey()).toBe(true);
        delete (window as any).$onekey;
    });
});
