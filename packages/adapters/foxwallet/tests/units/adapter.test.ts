import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FoxWalletAdapter } from '../../src/index.js';
import { openFoxWallet, supportFoxWallet } from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
} from '@tronweb3/tronwallet-abstract-adapter';

window.open = vi.fn();
beforeEach(function () {
    vi.useFakeTimers();
    window.tronLink = undefined;
    window.tron = undefined;
    delete (window as any).foxwallet;
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
});
afterEach(function () {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('utils', () => {
    test('supportFoxWallet returns true when window.foxwallet.tronLink.tronWeb is set', () => {
        (window as any).foxwallet = { tronLink: { tronWeb: {} } };
        expect(supportFoxWallet()).toBe(true);
    });
    test('supportFoxWallet returns false when window.foxwallet is undefined', () => {
        expect(supportFoxWallet()).toBe(false);
    });
    test('openFoxWallet returns false when supportFoxWallet is true', () => {
        (window as any).foxwallet = { tronLink: { tronWeb: {} } };
        expect(openFoxWallet()).toBe(false);
    });
    test('openFoxWallet returns false when not in a mobile browser', () => {
        expect(openFoxWallet()).toBe(false);
    });
});

describe('FoxWalletAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new FoxWalletAdapter();
            expect(adapter.name).toEqual('FoxWallet');
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
});

describe('#connect() empty-account regression', () => {
    const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

    function makeAdapter(defaultAddress: unknown) {
        const adapter = new FoxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue({ code: 200 }),
            tronWeb: { defaultAddress },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        return adapter;
    }

    /**
     * A success code from the account request does not mean an address is
     * available yet. Going to Connected here leaves `connected === true` with no
     * address, and emits `connect('')` to the dapp.
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

    test('connects when a real address is available', async () => {
        const adapter = makeAdapter({ base58: ADDRESS });
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await adapter.connect();

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(adapter.connected).toBe(true);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });

    test('rejects with WalletConnectionError when request resolves falsy', async () => {
        const adapter = new FoxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue(null),
            tronWeb: {},
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('rejects with "pop-up not closed" message when res.code is 4000', async () => {
        const adapter = new FoxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue({ code: 4000 }),
            tronWeb: {},
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toMatchObject({
            message: expect.stringContaining('pop-up window has not been closed'),
        });
    });

    test('rejects with "user rejected" message when res.code is 4001', async () => {
        const adapter = new FoxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue({ code: 4001 }),
            tronWeb: {},
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        await expect(adapter.connect()).rejects.toMatchObject({
            message: 'The user rejected connection.',
        });
    });
});

describe('FoxWalletAdapter - disconnect, network, signing', () => {
    const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

    function makeConnectedAdapter() {
        const adapter = new FoxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue({ code: 200 }),
            tronWeb: {
                defaultAddress: { base58: ADDRESS },
                trx: {
                    sign: vi.fn().mockResolvedValue({ signature: 'tx' }),
                    signMessageV2: vi.fn().mockResolvedValue('msg'),
                    multiSign: vi.fn().mockResolvedValue({ signature: 'multi' }),
                },
            },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#disconnect()', () => {
        test('is a no-op when not connected', async () => {
            const adapter = new FoxWalletAdapter();
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
            const adapter = new FoxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = { tronWeb: {} };
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });
        test('throws WalletDisconnectedError when wallet/tronWeb is missing', async () => {
            const adapter = new FoxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = null;
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
        test('wraps provider error in WalletGetNetworkError', async () => {
            const adapter = new FoxWalletAdapter();
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
            const adapter = new FoxWalletAdapter();
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
            await adapter.multiSign(tx, { permissionId: 3 });
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, 3);
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
        test('returns signature on success', async () => {
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
            const adapter = new FoxWalletAdapter({ openAppWithDeeplink: false });
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });
    });

    describe('setState guard', () => {
        test('does NOT emit stateChanged when state is unchanged', () => {
            const adapter = new FoxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Loading;
            const onState = vi.fn();
            adapter.on('stateChanged', onState);
            (adapter as any).setState(AdapterState.Loading);
            expect(onState).not.toHaveBeenCalled();
        });
    });
});
