import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GuardaAdapter } from '../../src/adapter.js';
import { supportGuarda } from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

beforeEach(function () {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ wallets: {} }) }));
    delete (window as any).guarda;
});
afterEach(function () {
    vi.unstubAllGlobals();
});

describe('utils', () => {
    test('supportGuarda returns true when window.guarda is defined in a browser', () => {
        (window as any).guarda = { ready: true, tronWeb: {}, tron: {} };
        expect(supportGuarda()).toBe(true);
    });
    test('supportGuarda returns false when window.guarda is undefined', () => {
        expect(supportGuarda()).toBe(false);
    });
});

describe('GuardaAdapter', () => {
    test('should be defined', () => {
        expect(GuardaAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new GuardaAdapter();
        expect(adapter.name).toEqual('Guarda');
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
        const adapter = new GuardaAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue([ADDRESS]) },
            tronWeb: {
                defaultAddress: { base58: ADDRESS },
                trx: {
                    sign: vi.fn().mockResolvedValue({ signature: 'tx' }),
                    signMessage: vi.fn().mockResolvedValue('msg'),
                },
            },
        };
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#disconnect()', () => {
        test('is a no-op when not connected', async () => {
            const adapter = new GuardaAdapter();
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
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when state is not Connected', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = { tronWeb: {} };
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });
        test('throws WalletDisconnectedError when wallet/tronWeb is missing', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = null;
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps provider errors in WalletGetNetworkError and emits error event', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = { tronWeb: { fullNode: { host: 'https://broken' } } };
            vi.unstubAllGlobals();
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('#_connect()', () => {
        test('throws WalletConnectionError when res?.[0] is falsy', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = {
                tron: { request: vi.fn().mockResolvedValue([]) },
            };
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        });
        test('throws WalletConnectionError when res is null', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = {
                tron: { request: vi.fn().mockResolvedValue(null) },
            };
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        });
        test('rethrows a WalletError instance unchanged', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = {
                tron: { request: vi.fn().mockRejectedValue(new WalletDisconnectedError('custom')) },
            };
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps a non-WalletError throw in WalletConnectionError', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = {
                tron: { request: vi.fn().mockRejectedValue(new Error('raw')) },
            };
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        });
        test('resets _connecting in finally even when it throws', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = {
                tron: { request: vi.fn().mockRejectedValue(new Error('boom')) },
            };
            adapter.on('error', () => {});
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect((adapter as any)._connecting).toBe(false);
        });
    });

    describe('#signTransaction()', () => {
        test('returns the signed transaction on success', async () => {
            const adapter = makeConnectedAdapter();
            const signed = await adapter.signTransaction({} as any);
            expect(signed).toEqual({ signature: 'tx' });
        });
        test('wraps an Error instance in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('sign-fail'));
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
        test('wraps a non-Error in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce('string-error');
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = null;
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#signMessage()', () => {
        test('returns the signature on success', async () => {
            const adapter = makeConnectedAdapter();
            const sig = await adapter.signMessage('hello');
            expect(sig).toBe('msg');
        });
        test('wraps errors in WalletSignMessageError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessage.mockRejectedValueOnce(new Error('m-fail'));
            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });
    });

    describe('openAppWithDeeplink', () => {
        test('_openAppByDeepLinkIfNeed always returns false (Guarda has no deeplink)', () => {
            const adapter = new GuardaAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });
    });

    describe('setState (no guard — unlike other adapters)', () => {
        test('always emits stateChanged even when state is unchanged', () => {
            const adapter = new GuardaAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Loading;
            const onState = vi.fn();
            adapter.on('stateChanged', onState);
            (adapter as any).setState(AdapterState.Loading);
            expect(onState).toHaveBeenCalledWith(AdapterState.Loading);
        });
    });
});
