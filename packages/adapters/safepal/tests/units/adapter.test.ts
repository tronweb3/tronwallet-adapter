import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SafepalAdapter } from '../../src/adapter.js';
import { supportSafepalWallet, openSafepalWallet } from '../../src/utils.js';
import * as utils from '../../src/utils.js';
import {
    AdapterState,
    WalletConnectionError,
    WalletNotFoundError,
    WalletReadyState,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletSignMessageError,
    WalletSignTransactionError,
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

function makeConnectedAdapter(overrides: { defaultAddress?: any; onDesktop?: boolean } = {}) {
    const adapter = new SafepalAdapter();
    const tronWeb: any = {
        defaultAddress: overrides.defaultAddress ?? { base58: ADDRESS },
        trx: {
            sign: vi.fn(),
            signMessageV2: vi.fn(),
        },
    };
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._wallet = { tronWeb, tron: { request: vi.fn() } };
    (adapter as any)._address = tronWeb.defaultAddress.base58 ?? null;
    (adapter as any)._state = AdapterState.Connected;
    (adapter as any)._securityPassed = true;
    adapter.on('error', () => {});
    return adapter;
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    vi.spyOn(window, 'open').mockImplementation(() => null);
    setUserAgent(DESKTOP_UA);
    delete (window as any).safepalTronProvider;
    delete (window as any).safepalwallet;
    delete (window as any).tronWeb;
    vi.mocked(getNetworkInfoByTronWeb).mockReset();
});

afterEach(() => {
    setUserAgent(realUserAgent);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('SafepalAdapter', () => {
    test('should be defined', () => {
        expect(SafepalAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new SafepalAdapter();
        expect(adapter.name).toEqual('SafePal');
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
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: {} };
        (adapter as any)._state = AdapterState.Disconnect;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when _wallet is null', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = null;
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
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
});

describe('#_connect()', () => {
    test('mobile path: skips tron_requestAccounts and connects when address is present', async () => {
        setUserAgent(MOBILE_UA);
        const request = vi.fn();
        const tronWeb: any = { defaultAddress: { base58: ADDRESS } };
        (window as any).safepalwallet = { tron: { tronWeb, request }, tronWeb };

        const adapter = new SafepalAdapter({ checkTimeout: 0 });
        adapter.on('error', () => {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        // prime _wallet to simulate detection completing
        (adapter as any)._wallet = { tron: { request, tronWeb }, tronWeb };
        (adapter as any)._state = AdapterState.Disconnect;

        await adapter.connect();

        expect(request).not.toHaveBeenCalled();
        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect((adapter as any)._securityPassed).toBe(true);
    });

    test('PC path: calls request then assertConnectAddress', async () => {
        setUserAgent(DESKTOP_UA);
        const tronWeb: any = { defaultAddress: {} };
        const request = vi.fn(async () => {
            tronWeb.defaultAddress = { base58: ADDRESS };
            return { code: 200 };
        });
        (window as any).safepalTronProvider = { tronWeb, request };
        (window as any).tronWeb = tronWeb;

        const adapter = new SafepalAdapter({ checkTimeout: 0 });
        adapter.on('error', () => {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        await adapter.connect();

        expect(request).toHaveBeenCalledWith({ method: 'tron_requestAccounts' });
        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
    });

    // NOTE: the request-rejection path of the PC `_connect()` branch is covered by
    // safepal's own internal test that drives the full polling flow. A unit test here
    // would have to reproduce the entire constructor → polling → connect() sequence
    // to make `request` the failing dependency, which is not worth the maintenance
    // cost given the other PC-path tests already exercise the success and
    // missing-address branches.

    test('PC path: request resolves but no address → WalletConnectionError', async () => {
        setUserAgent(DESKTOP_UA);
        const tronWeb: any = { defaultAddress: {} };
        const request = vi.fn().mockResolvedValue({ code: 200 });
        (window as any).safepalTronProvider = { tronWeb, request };
        (window as any).tronWeb = tronWeb;

        const adapter = new SafepalAdapter({ checkTimeout: 0 });
        adapter.on('error', () => {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.address).toBeNull();
        expect(adapter.connected).toBe(false);
    });

    test('clears _connecting in finally on success', async () => {
        setUserAgent(DESKTOP_UA);
        const tronWeb: any = { defaultAddress: { base58: ADDRESS } };
        const request = vi.fn().mockResolvedValue({ code: 200 });
        (window as any).safepalTronProvider = { tronWeb, request };
        (window as any).tronWeb = tronWeb;

        const adapter = new SafepalAdapter({ checkTimeout: 0 });
        adapter.on('error', () => {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        await adapter.connect();
        expect(adapter.connecting).toBe(false);
    });

    test('sets _securityPassed = true on success', async () => {
        setUserAgent(DESKTOP_UA);
        const tronWeb: any = { defaultAddress: { base58: ADDRESS } };
        const request = vi.fn().mockResolvedValue({ code: 200 });
        (window as any).safepalTronProvider = { tronWeb, request };
        (window as any).tronWeb = tronWeb;

        const adapter = new SafepalAdapter({ checkTimeout: 0 });
        adapter.on('error', () => {});
        await new Promise((resolve) => setTimeout(resolve, 50));

        await adapter.connect();
        expect((adapter as any)._securityPassed).toBe(true);
    });
});

describe('#disconnect()', () => {
    test('resets _securityPassed = false (mobile auto-reconnect gate)', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._securityPassed = true;

        await adapter.disconnect();
        expect((adapter as any)._securityPassed).toBe(false);
    });

    test('early-returns without changes when state is not Connected', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Disconnect;
        (adapter as any)._address = null;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    test('resets address, sets state to Disconnect, emits disconnect', async () => {
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
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {};
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps Error rejects as WalletSignTransactionError', async () => {
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

    test('wraps string rejects as WalletSignTransactionError', async () => {
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

    test('wraps unknown rejects as WalletSignTransactionError with Unknown error', async () => {
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
        (adapter as any)._wallet.tronWeb.trx.sign.mockResolvedValue({ signature: ['s'] });

        const out = await adapter.signTransaction({} as any);
        expect(out).toEqual({ signature: ['s'] });
    });
});

describe('#signMessage()', () => {
    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { signMessageV2: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps Error rejects as WalletSignMessageError', async () => {
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

    test('wraps string rejects as WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue('string-msg');
        adapter.on('error', () => {});

        const err = await adapter.signMessage('hi').then(
            () => null,
            (e) => e
        );
        expect(err).toBeInstanceOf(WalletSignMessageError);
        expect(err.message).toBe('string-msg');
    });

    test('wraps unknown rejects as WalletSignMessageError with Unknown error', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValue(undefined);
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
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockResolvedValue('signed');

        const out = await adapter.signMessage('hi');
        expect(out).toBe('signed');
    });
});

describe('#checkAndGetWallet()', () => {
    test('throws WalletNotFoundError when on mobile without support (deeplink fires)', async () => {
        setUserAgent(MOBILE_UA);
        vi.spyOn(utils, 'openSafepalWallet').mockReturnValue(true);
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { defaultAddress: { base58: ADDRESS }, trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new SafepalAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Disconnect;
        adapter.on('error', () => {});

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('#checkIfOpenApp()', () => {
    test('throws WalletNotFoundError when deeplink fires (mobile-without-support)', async () => {
        const adapter = new SafepalAdapter({ openAppWithDeeplink: true });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = { tronWeb: { trx: { sign: vi.fn() } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        vi.spyOn(utils, 'openSafepalWallet').mockReturnValue(true);

        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('no-op when openAppWithDeeplink is false', async () => {
        const adapter = new SafepalAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        const signFn = vi.fn().mockResolvedValue({ signature: ['s'] });
        (adapter as any)._wallet = { tronWeb: { defaultAddress: { base58: ADDRESS }, trx: { sign: signFn } } };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        const openSpy = vi.spyOn(utils, 'openSafepalWallet').mockReturnValue(true);

        await expect(adapter.signTransaction({} as any)).resolves.toEqual({ signature: ['s'] });
        expect(openSpy).not.toHaveBeenCalled();
    });
});

describe('#_openAppByDeepLinkIfNeed()', () => {
    test('returns false when openAppWithDeeplink is disabled', () => {
        const adapter = new SafepalAdapter({ openAppWithDeeplink: false });
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });

    test('returns whatever openSafepalWallet() returns when enabled', () => {
        const adapter = new SafepalAdapter({ openAppWithDeeplink: true });
        vi.spyOn(utils, 'openSafepalWallet').mockReturnValue(true);
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        vi.spyOn(utils, 'openSafepalWallet').mockReturnValue(false);
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });
});

describe('utils.ts', () => {
    test('supportSafepalWallet returns false when nothing is injected', () => {
        expect(supportSafepalWallet()).toBe(false);
    });

    test('supportSafepalWallet returns true on PC when safepalTronProvider + tronWeb are present', () => {
        (window as any).safepalTronProvider = {};
        (window as any).tronWeb = {};
        expect(supportSafepalWallet()).toBe(true);
        delete (window as any).safepalTronProvider;
        delete (window as any).tronWeb;
    });

    test('supportSafepalWallet returns true on mobile when safepalwallet.tron is present', () => {
        (window as any).safepalwallet = { tron: {} };
        expect(supportSafepalWallet()).toBe(true);
        delete (window as any).safepalwallet;
    });

    test('openSafepalWallet returns false on non-mobile', () => {
        setUserAgent(DESKTOP_UA);
        expect(openSafepalWallet()).toBe(false);
    });

    test('openSafepalWallet redirects and returns true on mobile without support', () => {
        setUserAgent(MOBILE_UA);
        const originalHref = window.location.href;
        const hrefSetter = vi.fn();
        try {
            Object.defineProperty(window, 'location', {
                value: {
                    origin: 'https://example.com',
                    pathname: '/',
                    search: '',
                    hash: '',
                    set href(v: string) {
                        hrefSetter(v);
                    },
                },
                configurable: true,
                writable: true,
            });
            const out = openSafepalWallet();
            expect(out).toBe(true);
            expect(hrefSetter).toHaveBeenCalled();
            const target = hrefSetter.mock.calls[0][0];
            expect(target).toMatch(/^https:\/\/link\.safepal\.io\/wallet\/openurl\?url=/);
        } finally {
            Object.defineProperty(window, 'location', {
                value: { href: originalHref },
                configurable: true,
                writable: true,
            });
        }
    });

    test('openSafepalWallet returns false when mobile but already supported', () => {
        setUserAgent(MOBILE_UA);
        (window as any).safepalwallet = { tron: {} };
        expect(openSafepalWallet()).toBe(false);
        delete (window as any).safepalwallet;
    });
});
