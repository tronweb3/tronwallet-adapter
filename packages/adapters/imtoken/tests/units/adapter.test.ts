import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImTokenAdapter } from '../../src/adapter.js';
import { supportImToken, openImTokenApp } from '../../src/utils.js';
import * as utils from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletGetNetworkError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletSignTypedDataError,
    WalletError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';

vi.mock('@tronweb3/tronwallet-adapter-tronlink', async (importOriginal) => {
    const mod: any = await importOriginal();
    return {
        ...mod,
        getNetworkInfoByTronWeb: vi.fn(),
    };
});

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const realUserAgent = navigator.userAgent;

function setUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function makeConnectedAdapter(overrides: { defaultAddress?: any } = {}) {
    const adapter = new ImTokenAdapter();
    const tronWeb: any = {
        defaultAddress: overrides.defaultAddress ?? { base58: ADDRESS },
        trx: {
            sign: vi.fn(),
            multiSign: vi.fn(),
            signMessageV2: vi.fn(),
            _signTypedData: vi.fn(),
        },
    };
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._wallet = { tronWeb };
    (adapter as any)._address = tronWeb.defaultAddress.base58 ?? null;
    (adapter as any)._state = AdapterState.Connected;
    adapter.on('error', () => {});
    return adapter;
}

beforeEach(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
    setUserAgent(DESKTOP_UA);
    delete (window as any).imToken;
    delete (window as any).tronWeb;
    delete (window as any).safepalTronProvider;
    vi.mocked(getNetworkInfoByTronWeb).mockReset();
});

afterEach(() => {
    setUserAgent(realUserAgent);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ImTokenAdapter', () => {
    test('should be defined', () => {
        expect(ImTokenAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new ImTokenAdapter();
        expect(adapter.name).toEqual('imToken Wallet');
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
});

describe('#network()', () => {
    test('returns network info on the happy path', async () => {
        const adapter = makeConnectedAdapter();
        vi.mocked(getNetworkInfoByTronWeb).mockResolvedValue({
            networkType: 'mainnet',
            chainId: '0x2b6653dc',
            fullNode: '',
            solidityNode: '',
            eventServer: '',
        } as any);

        const network = await adapter.network();

        expect(network).toEqual({
            networkType: 'mainnet',
            chainId: '0x2b6653dc',
            fullNode: '',
            solidityNode: '',
            eventServer: '',
        });
        expect(vi.mocked(getNetworkInfoByTronWeb)).toHaveBeenCalledWith((adapter as any)._wallet.tronWeb);
    });

    test('throws WalletDisconnectedError when state is not Connected', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: {} };
        (adapter as any)._state = AdapterState.Disconnect;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when _wallet is null', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = null;
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalledWith(expect.any(WalletDisconnectedError));
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('wraps getNetworkInfoByTronWeb failures as WalletGetNetworkError and emits error', async () => {
        const adapter = makeConnectedAdapter();
        vi.mocked(getNetworkInfoByTronWeb).mockRejectedValue(new Error('boom'));
        const onError = vi.fn();
        adapter.on('error', onError);

        const err = await adapter.network().then(
            () => null,
            (e) => e
        );

        expect(err).toBeInstanceOf(WalletGetNetworkError);
        expect(err.message).toBe('boom');
        expect(onError).toHaveBeenCalledWith(err);
    });

    test('emits error with the original exception type when it is not a WalletError', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = null;
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await adapter.network().catch(() => undefined);
        expect(onError).toHaveBeenCalledWith(expect.any(WalletDisconnectedError));
    });
});

describe('#_connect()', () => {
    test('short-circuits silently when _beforeConnect returns false (already connected)', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        adapter.on('error', () => {});
        const onError = vi.fn();
        adapter.on('error', onError);

        await adapter.connect();

        expect(onError).not.toHaveBeenCalled();
        expect(adapter.address).toBe(ADDRESS);
    });

    test('wraps a non-WalletError thrown as WalletConnectionError and emits error', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tronWeb: { defaultAddress: { base58: '' } },
        };
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(onError).toHaveBeenCalledWith(expect.any(WalletConnectionError));
    });

    test('rethrows an existing WalletError without rewrapping', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const original = new WalletDisconnectedError();
        vi.spyOn(adapter as any, '_beforeConnect').mockRejectedValue(original);
        const onError = vi.fn();
        adapter.on('error', onError);

        const err = await adapter.connect().then(
            () => null,
            (e) => e
        );
        expect(err).toBe(original);
        expect(onError).toHaveBeenCalledWith(original);
    });

    test('clears _connecting in finally when assertConnectAddress fails', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tronWeb: { defaultAddress: { base58: '' } },
        };
        adapter.on('error', () => {});

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.connecting).toBe(false);
    });

    test('rejects each assertConnectAddress failure case', async () => {
        const cases: unknown[] = [
            ['base58 missing', {}],
            ['base58 empty string', { base58: '' }],
            ['base58 is false', { base58: false }],
            ['defaultAddress is undefined', undefined],
        ];
        for (const [_label, defaultAddress] of cases) {
            const adapter = new ImTokenAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._wallet = { tronWeb: { defaultAddress } };
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect(adapter.address).toBeNull();
            expect(adapter.connected).toBe(false);
        }
    });

    test('emits connect and sets Connected when a real address is available', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tronWeb: { defaultAddress: { base58: ADDRESS } },
        };
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await adapter.connect();
        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });
});

describe('#disconnect()', () => {
    test('early-returns without changes when state is not Connected', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Disconnect;
        (adapter as any)._address = null;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
        expect(adapter.address).toBeNull();
    });

    test('resets address and state and emits disconnect when Connected', async () => {
        const adapter = makeConnectedAdapter();
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();

        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
});

describe('#signTransaction()', () => {
    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps Error rejects as WalletSignTransactionError (Error branch)', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValue(new Error('sign failed'));
        const onError = vi.fn();
        adapter.on('error', onError);

        const err = await adapter.signTransaction({} as any).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('sign failed');
        expect(onError).toHaveBeenCalled();
    });

    test('wraps object with .message as WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValue({ message: 'object-fail' });
        adapter.on('error', () => {});

        const err = await adapter.signTransaction({} as any).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('object-fail');
    });

    test('wraps string rejects as WalletSignTransactionError (string branch)', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValue('plain string');
        adapter.on('error', () => {});

        const err = await adapter.signTransaction({} as any).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('plain string');
    });

    test('wraps unknown rejects as WalletSignTransactionError with "Unknown error"', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValue(123);
        adapter.on('error', () => {});

        const err = await adapter.signTransaction({} as any).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('Unknown error');
    });

    test('happy path returns the signed transaction', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockResolvedValue({ signature: ['sig'] });

        const out = await adapter.signTransaction({} as any);
        expect(out).toEqual({ signature: ['sig'] });
    });
});

describe('#multiSign()', () => {
    test('forwards permissionId to trx.multiSign when provided', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockResolvedValue({ signature: ['ms'] });

        await adapter.multiSign({} as any, { permissionId: 7 });

        expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith({}, undefined, 7);
    });

    test('passes undefined permissionId when no options are provided', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockResolvedValue({ signature: ['ms'] });

        await adapter.multiSign({} as any);

        expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith({}, undefined, undefined);
    });

    test('wraps errors with WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValue(new Error('multisign failed'));
        adapter.on('error', () => {});

        const err = await adapter.multiSign({} as any, { permissionId: 1 }).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTransactionError);
        expect(err.message).toBe('multisign failed');
    });
});

describe('#signMessage()', () => {
    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { signMessageV2: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signMessage('hello')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps Error rejects as WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue(new Error('msg failed'));
        adapter.on('error', () => {});

        const err = await adapter.signMessage('hi').then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignMessageError);
        expect(err.message).toBe('msg failed');
    });

    test('wraps string rejects as WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue('boom-string');
        adapter.on('error', () => {});

        const err = await adapter.signMessage('hi').then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignMessageError);
        expect(err.message).toBe('boom-string');
    });

    test('wraps unknown rejects as WalletSignMessageError with Unknown error', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue(42);
        adapter.on('error', () => {});

        const err = await adapter.signMessage('hi').then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignMessageError);
        expect(err.message).toBe('Unknown error');
    });

    test('happy path returns the signature', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockResolvedValue('signed-hi');

        const out = await adapter.signMessage('hi');
        expect(out).toBe('signed-hi');
    });
});

describe('#_signTypedData()', () => {
    const TYPED = {
        domain: { name: 'Test', version: '1', chainId: 1 },
        types: { Mail: [{ name: 'contents', type: 'string' }] },
        message: { contents: 'hello' },
    } as any;

    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { _signTypedData: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTypedData(TYPED)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps Error rejects as WalletSignTypedDataError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx._signTypedData.mockRejectedValue(new Error('typed-fail'));
        adapter.on('error', () => {});

        const err = await adapter.signTypedData(TYPED).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTypedDataError);
        expect(err.message).toBe('typed-fail');
    });

    test('wraps string rejects as WalletSignTypedDataError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx._signTypedData.mockRejectedValue('string-fail');
        adapter.on('error', () => {});

        const err = await adapter.signTypedData(TYPED).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTypedDataError);
        expect(err.message).toBe('string-fail');
    });

    test('wraps unknown rejects with Unknown error', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx._signTypedData.mockRejectedValue(undefined);
        adapter.on('error', () => {});

        const err = await adapter.signTypedData(TYPED).then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignTypedDataError);
        expect(err.message).toBe('Unknown error');
    });

    test('happy path forwards domain/types/message to trx._signTypedData', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx._signTypedData.mockResolvedValue('signed-typed');

        const out = await adapter.signTypedData(TYPED);

        expect(out).toBe('signed-typed');
        expect((adapter as any)._wallet.tronWeb.trx._signTypedData).toHaveBeenCalledWith(
            TYPED.domain,
            TYPED.types,
            TYPED.message
        );
    });
});

describe('#checkAndGetWallet()', () => {
    test('throws WalletNotFoundError when on mobile without support (deeplink fires)', async () => {
        setUserAgent(MOBILE_UA);
        const adapter = new ImTokenAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { defaultAddress: { base58: ADDRESS }, trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        // simulate mobile-without-support: openImTokenApp returns true (deeplink fires)
        vi.spyOn(utils, 'openImTokenApp').mockReturnValue(true);

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('throws WalletDisconnectedError when not connected', async () => {
        setUserAgent(DESKTOP_UA);
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        setUserAgent(DESKTOP_UA);
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('#checkIfOpenApp()', () => {
    test('throws WalletNotFoundError when deeplink fires (mobile-without-support)', async () => {
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: true });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        vi.spyOn(utils, 'openImTokenApp').mockReturnValue(true);

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('no-op when openAppWithDeeplink is false', async () => {
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        const signFn = vi.fn().mockResolvedValue({ signature: ['s'] });
        (adapter as any)._wallet = { tronWeb: { defaultAddress: { base58: ADDRESS }, trx: { sign: signFn } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        const openSpy = vi.spyOn(utils, 'openImTokenApp').mockReturnValue(true);

        await expect(adapter.signTransaction({} as any)).resolves.toEqual({ signature: ['s'] });
        expect(openSpy).not.toHaveBeenCalled();
    });
});

describe('#_openAppByDeepLinkIfNeed()', () => {
    test('returns false when openAppWithDeeplink is disabled', () => {
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: false });
        const out = (adapter as any)._openAppByDeepLinkIfNeed();
        expect(out).toBe(false);
    });

    test('returns whatever openImTokenApp() returns when enabled', () => {
        const adapter = new ImTokenAdapter({ openAppWithDeeplink: true });
        vi.spyOn(utils, 'openImTokenApp').mockReturnValue(true);
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        vi.spyOn(utils, 'openImTokenApp').mockReturnValue(false);
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });
});

describe('utils.ts', () => {
    test('supportImToken requires both window.imToken AND window.tronWeb', () => {
        delete (window as any).imToken;
        delete (window as any).tronWeb;
        expect(supportImToken()).toBe(false);
        (window as any).imToken = {};
        expect(supportImToken()).toBe(false);
        (window as any).tronWeb = {};
        expect(supportImToken()).toBe(true);
    });

    test('openImTokenApp returns false on non-mobile', () => {
        setUserAgent(DESKTOP_UA);
        const out = openImTokenApp();
        expect(out).toBe(false);
    });

    // NOTE: happy-dom's `navigator.userAgent` is not consistently overridable across
    // versions, so the mobile-branch redirect path is asserted indirectly via the
    // `checkIfOpenApp()` test above (which spies on `openImTokenApp`).

    test('openImTokenApp returns false when mobile but wallet already supported', () => {
        setUserAgent(MOBILE_UA);
        (window as any).imToken = {};
        (window as any).tronWeb = {};
        const out = openImTokenApp();
        expect(out).toBe(false);
        delete (window as any).imToken;
        delete (window as any).tronWeb;
    });
});
