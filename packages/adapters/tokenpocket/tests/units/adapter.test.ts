import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    AdapterState,
    WalletReadyState,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { TokenPocketAdapter } from '../../src/adapter.js';
import { isInTokenPocket, openTokenPocket, supportTokenPocket } from '../../src/utils.js';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

beforeEach(function () {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ wallets: {} }) }));
    delete (window as any).tokenpocket;
    delete (window as any).tronWeb;
});
afterEach(function () {
    vi.unstubAllGlobals();
});

describe('utils', () => {
    test('supportTokenPocket returns true when both tronWeb and tokenpocket are present', () => {
        (window as any).tronWeb = {};
        (window as any).tokenpocket = {};
        expect(supportTokenPocket()).toBe(true);
    });
    test('supportTokenPocket returns false when tronWeb is missing', () => {
        (window as any).tokenpocket = {};
        expect(supportTokenPocket()).toBe(false);
    });
    test('supportTokenPocket returns false when tokenpocket is missing', () => {
        (window as any).tronWeb = {};
        expect(supportTokenPocket()).toBe(false);
    });
    test('isInTokenPocket returns true when window.tokenpocket is defined in browser', () => {
        (window as any).tokenpocket = {};
        expect(isInTokenPocket()).toBe(true);
    });
    test('isInTokenPocket returns false when window.tokenpocket is undefined', () => {
        expect(isInTokenPocket()).toBe(false);
    });
    test('openTokenPocket returns false when supportTokenPocket is true', () => {
        (window as any).tronWeb = {};
        (window as any).tokenpocket = {};
        expect(openTokenPocket()).toBe(false);
    });
    test('openTokenPocket returns false when not on a mobile browser', () => {
        // happy-dom's navigator.userAgent is non-mobile by default.
        expect(openTokenPocket()).toBe(false);
    });
});

describe('TokenPocketAdapter', () => {
    test('should be defined', () => {
        expect(TokenPocketAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new TokenPocketAdapter();
        expect(adapter.name).toEqual('TokenPocket');
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

    function makeConnectedAdapter() {
        const adapter = new TokenPocketAdapter();
        // Short-circuit the constructor's wallet discovery so tests are deterministic.
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = {
            tron: {
                request: vi.fn().mockResolvedValue([ADDRESS]),
                on: vi.fn(),
                removeListener: vi.fn(),
            },
            tronWeb: {
                defaultAddress: { base58: ADDRESS },
                trx: {
                    sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                    signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                    multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
                },
            },
            ready: true,
        };
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#disconnect()', () => {
        test('is a no-op when not connected', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);
            await adapter.disconnect();
            expect(onDisconnect).not.toHaveBeenCalled();
        });
        test('clears address, sets Disconnect, and emits disconnect when connected', async () => {
            const adapter = makeConnectedAdapter();
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);
            await adapter.disconnect();
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });
        test('resets _securityPassed so accountsChanged stops auto-connecting', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._securityPassed = true;
            await adapter.disconnect();
            expect((adapter as any)._securityPassed).toBe(false);
        });
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when state is not Connected', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = { tronWeb: {} };
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });
        test('throws WalletDisconnectedError when wallet is missing', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = null;
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps provider error in WalletGetNetworkError and emits error event', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = { tronWeb: { fullNode: { host: 'https://broken' } } };
            // Make fetch (used by getNetworkInfoByTronWeb) fail.
            vi.unstubAllGlobals();
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('#signTransaction()', () => {
        test('returns the signed transaction on success', async () => {
            const adapter = makeConnectedAdapter();
            const signed = await adapter.signTransaction({} as any);
            expect(signed).toEqual({ signature: 'tx-sig' });
        });
        test('wraps an Error instance in WalletSignTransactionError with its message', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('boom'));
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });
        test('wraps a string error in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce('plain string');
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = null;
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#multiSign()', () => {
        test('passes permissionId from options to trx.multiSign', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            const result = await adapter.multiSign(tx, { permissionId: 7 });
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, 7);
            expect(result).toEqual({ signature: 'multi-sig' });
        });
        test('defaults permissionId to undefined when omitted', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            await adapter.multiSign(tx);
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, undefined);
        });
        test('wraps errors in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(new Error('multi-fail'));
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
    });

    describe('#signMessage()', () => {
        test('returns the signature on success', async () => {
            const adapter = makeConnectedAdapter();
            const sig = await adapter.signMessage('hello');
            expect(sig).toBe('msg-sig');
        });
        test('wraps errors in WalletSignMessageError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('msg-fail'));
            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });
    });

    describe('#checkIfOpenApp() / openAppWithDeeplink', () => {
        test('signTransaction throws WalletDisconnectedError (not WalletNotFoundError) when deeplink is disabled', async () => {
            // openAppWithDeeplink=false must short-circuit checkIfOpenApp so it does NOT
            // attempt to redirect or throw WalletNotFoundError.
            const adapter = new TokenPocketAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = null;
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('_openAppByDeepLinkIfNeed returns false when deeplink is disabled', () => {
            const adapter = new TokenPocketAdapter({ openAppWithDeeplink: false });
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });
    });

    describe('setState guard', () => {
        test('does NOT emit stateChanged when state is unchanged', () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Loading;
            const onState = vi.fn();
            adapter.on('stateChanged', onState);
            (adapter as any).setState(AdapterState.Loading);
            expect(onState).not.toHaveBeenCalled();
        });
    });
});
