import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BitKeepAdapter } from '../../src/adapter.js';
import { openBitgetWallet, supportBitgetWallet } from '../../src/utils.js';
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
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
});
afterEach(function () {
    vi.unstubAllGlobals();
    delete (window as any).bitkeep;
});

describe('utils', () => {
    test('supportBitgetWallet returns true when both window.tronLink and window.isBitKeep are set', () => {
        (window as any).tronLink = {};
        (window as any).isBitKeep = true;
        expect(supportBitgetWallet()).toBe(true);
    });
    test('supportBitgetWallet returns false when window.tronLink is missing', () => {
        (window as any).isBitKeep = true;
        delete (window as any).tronLink;
        expect(supportBitgetWallet()).toBe(false);
    });
    test('supportBitgetWallet returns false when window.isBitKeep is falsy', () => {
        (window as any).tronLink = {};
        (window as any).isBitKeep = false;
        expect(supportBitgetWallet()).toBe(false);
    });
    test('openBitgetWallet returns false when supportBitgetWallet is true', () => {
        (window as any).tronLink = {};
        (window as any).isBitKeep = true;
        expect(openBitgetWallet()).toBe(false);
    });
    test('openBitgetWallet returns false when not on a mobile browser', () => {
        delete (window as any).tronLink;
        delete (window as any).isBitKeep;
        expect(openBitgetWallet()).toBe(false);
    });
});

describe('BitKeepAdapter', () => {
    test('should be defined', () => {
        expect(BitKeepAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new BitKeepAdapter();
        expect(adapter.name).toEqual('Bitget Wallet');
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

    function makeAdapter(defaultAddress: unknown) {
        const adapter = new BitKeepAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue({ code: 200 }) },
            tronWeb: { defaultAddress },
        };
        adapter.on('error', () => {});
        return adapter;
    }

    /**
     * `tron_requestAccounts` answering with code 200 does not mean an address is
     * available yet; the adapter used to fall back to `''` and go Connected anyway.
     */
    test.each([
        ['base58 is missing', {}],
        ['base58 is an empty string', { base58: '' }],
        ['base58 is false', { base58: false }],
        ['defaultAddress is undefined', undefined],
    ])('rejects when %s', async (_label, defaultAddress) => {
        const adapter = makeAdapter(defaultAddress);
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.address).toBeNull();
        expect(adapter.state).not.toBe(AdapterState.Connected);
        expect(adapter.connected).toBe(false);
        expect(onConnect).not.toHaveBeenCalled();
    });

    test('still accepts the window.bitkeep fallback address', async () => {
        const adapter = makeAdapter({});
        (window as any).bitkeep = { tronWeb: { defaultAddress: { base58: ADDRESS } } };

        await adapter.connect();

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.connected).toBe(true);
    });

    test('connects when a real address is available', async () => {
        const adapter = makeAdapter({ base58: ADDRESS });
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await adapter.connect();

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });

    test('rejects with "canceled by user" message when res.code is 40001', async () => {
        const adapter = new BitKeepAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue({ code: 40001 }) },
            tronWeb: {},
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toMatchObject({
            message: 'The connection request is canceled by user.',
        });
    });

    test('rejects with res.message when res.code is non-200 / non-40001', async () => {
        const adapter = new BitKeepAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue({ code: 5000, message: 'something went wrong' }) },
            tronWeb: {},
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toMatchObject({ message: 'something went wrong' });
    });

    test('rejects when res is null (res?.code !== 200)', async () => {
        const adapter = new BitKeepAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue(null) },
            tronWeb: {},
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });
});

describe('BitKeepAdapter - disconnect, network, signing', () => {
    const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

    function makeConnectedAdapter() {
        const adapter = new BitKeepAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = {
            tron: { request: vi.fn().mockResolvedValue({ code: 200 }), ready: true },
            tronWeb: {
                defaultAddress: { base58: ADDRESS },
                trx: {
                    sign: vi.fn().mockResolvedValue({ signature: 'tx' }),
                    signMessageV2: vi.fn().mockResolvedValue('msg'),
                    multiSign: vi.fn().mockResolvedValue({ signature: 'multi' }),
                },
            },
        };
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#disconnect()', () => {
        test('is a no-op when not connected', async () => {
            const adapter = new BitKeepAdapter();
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
            const adapter = new BitKeepAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = { tronWeb: {} };
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });
        test('throws WalletDisconnectedError when wallet/tronWeb is missing', async () => {
            const adapter = new BitKeepAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = null;
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps provider error in WalletGetNetworkError', async () => {
            const adapter = new BitKeepAdapter();
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
            const adapter = new BitKeepAdapter();
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
            await adapter.multiSign(tx, { permissionId: 5 });
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, 5);
        });
        test('defaults permissionId to undefined when omitted', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            await adapter.multiSign(tx);
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, undefined);
        });
        test('wraps errors in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(new Error('m-fail'));
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
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
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('msg-fail'));
            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });
    });

    describe('openAppWithDeeplink = false', () => {
        test('_openAppByDeepLinkIfNeed returns false when deeplink is disabled', () => {
            const adapter = new BitKeepAdapter({ openAppWithDeeplink: false });
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });
    });

    describe('setState guard', () => {
        test('does NOT emit stateChanged when state is unchanged', () => {
            const adapter = new BitKeepAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Loading;
            const onState = vi.fn();
            adapter.on('stateChanged', onState);
            (adapter as any).setState(AdapterState.Loading);
            expect(onState).not.toHaveBeenCalled();
        });
    });
});
