import { vi, describe, it, test, expect, beforeEach, afterEach } from 'vitest';
import { OkxWalletAdapter } from '../../src/index.js';
import {
    AdapterState,
    NetworkType,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    WalletError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { supportOkxWallet, openOkxWallet, isInOKApp, isOKApp } from '../../src/utils.js';

window.open = vi.fn();

beforeEach(function () {
    vi.useFakeTimers();
    window.tronLink = undefined;
    window.tron = undefined;
    delete (window as any).okxwallet;
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
});

describe('OkxWalletAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new OkxWalletAdapter();
            expect(adapter.name).toEqual('OKX Wallet');
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
        const adapter = new OkxWalletAdapter();
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
});

describe('#_connect() branches', () => {
    const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

    function makeReadyAdapter(request: any = vi.fn().mockResolvedValue({ code: 200 })) {
        const adapter = new OkxWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request,
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        return adapter;
    }

    it('throws WalletConnectionError("Request connect error.") when request resolves to null', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockResolvedValue(null));

        await expect(adapter.connect()).rejects.toMatchObject({
            message: expect.stringMatching(/Request connect error/),
        });
    });

    it('throws WalletConnectionError("Request connect error.") when request resolves to undefined', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockResolvedValue(undefined));

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    it('throws WalletConnectionError with the "pop-up window" message when res.code is 4000', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockResolvedValue({ code: 4000 }));

        await expect(adapter.connect()).rejects.toMatchObject({
            message: expect.stringContaining('pop-up window has not been closed'),
        });
    });

    it('throws WalletConnectionError("The user rejected connection.") when res.code is 4001', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockResolvedValue({ code: 4001 }));

        await expect(adapter.connect()).rejects.toMatchObject({
            message: 'The user rejected connection.',
        });
    });

    it('rethrows an existing WalletError from assertConnectAddress without re-wrapping', async () => {
        // assertConnectAddress("") throws WalletConnectionError("Request connect error.").
        // base58 is provided but falsy.
        const adapter = makeReadyAdapter();
        (adapter as any)._wallet.tronWeb.defaultAddress.base58 = '';

        await expect(adapter.connect()).rejects.toMatchObject({
            message: expect.stringMatching(/Request connect error/),
        });
    });

    it('wraps an unknown thrown error as WalletConnectionError', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockRejectedValue(new Error('raw')));

        await expect(adapter.connect()).rejects.toMatchObject({ message: expect.stringMatching(/raw/) });
    });

    it('clears _connecting in finally even when connect throws', async () => {
        const adapter = makeReadyAdapter(vi.fn().mockRejectedValue(new Error('boom')));

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect((adapter as any)._connecting).toBe(false);
    });
});

describe('#accountsChanged stale-timer regression', function () {
    const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
    const STALE = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

    function makeConnected() {
        const adapter = new OkxWalletAdapter();
        (adapter as any)._wallet = { ready: true, tronWeb: { defaultAddress: { base58: ADDR_A } } };
        (adapter as any)._address = ADDR_A;
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        (adapter as any)._listenEvent();
        return adapter;
    }

    function fireAccountsChanged(address: string) {
        window.dispatchEvent(
            new MessageEvent('message', {
                origin: window.location.origin,
                data: { message: { action: 'accountsChanged', data: { address } } },
            })
        );
    }

    /**
     * The handler deferred its state update by 200ms without keeping the timer, so
     * `disconnect()` removed the listener but could not stop work already queued.
     * The callback then rewrote the address and flipped the adapter back to
     * Connected after the disconnect had settled.
     */
    it('does not resurrect state after disconnect', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            fireAccountsChanged(STALE);
            await adapter.disconnect();

            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();

            await vi.advanceTimersByTimeAsync(1000);

            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();
            expect(adapter.connected).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not emit connect for an event cancelled by disconnect', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            const onConnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('connect', onConnect);
            adapter.on('accountsChanged', onAccountsChanged);

            fireAccountsChanged(STALE);
            await adapter.disconnect();
            await vi.advanceTimersByTimeAsync(1000);

            expect(onConnect).not.toHaveBeenCalled();
            expect(onAccountsChanged).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    /**
     * The callback awaits `checkSecurity()`, so a disconnect landing during that
     * await must also be honoured — clearing the timer alone cannot cover it.
     */
    it('abandons an in-flight callback when disconnect lands during checkSecurity', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            let releaseSecurity: () => void = () => {};
            vi.spyOn(adapter as any, 'checkSecurity').mockImplementation(
                () => new Promise<void>((resolve) => (releaseSecurity = resolve))
            );

            fireAccountsChanged(STALE);
            // let the timer fire so the callback is parked on checkSecurity()
            await vi.advanceTimersByTimeAsync(200);

            await adapter.disconnect();
            releaseSecurity();
            await vi.advanceTimersByTimeAsync(0);

            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    /**
     * An empty account is a disconnection. Reporting Connected with an empty address
     * left `connected === true` with nothing to sign with, and the emit block then
     * fired `disconnect` against a state that still said Connected.
     */
    it('disconnects instead of connecting to an empty address', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            const onConnect = vi.fn();
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('connect', onConnect);
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            fireAccountsChanged('');
            await vi.advanceTimersByTimeAsync(1000);

            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.connected).toBe(false);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDR_A);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onConnect).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('still applies an account change during a live session', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);

            fireAccountsChanged(STALE);
            await vi.advanceTimersByTimeAsync(1000);

            expect(adapter.address).toBe(STALE);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onAccountsChanged).toHaveBeenCalledWith(STALE, ADDR_A);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('#connect message stale-session regression', function () {
    const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
    const ADDR_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

    function makeConnected(base58: unknown = ADDR_A) {
        const adapter = new OkxWalletAdapter();
        (adapter as any)._wallet = { ready: true, tronWeb: { defaultAddress: { base58 } } };
        (adapter as any)._address = ADDR_A;
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        (adapter as any)._listenEvent();
        return adapter;
    }

    function fireConnect() {
        window.dispatchEvent(
            new MessageEvent('message', {
                origin: window.location.origin,
                data: { message: { action: 'connect' } },
            })
        );
    }

    function parkSecurity(adapter: unknown) {
        let release: () => void = () => {};
        let reject: (reason?: unknown) => void = () => {};
        vi.spyOn(adapter as any, 'checkSecurity').mockImplementation(
            () =>
                new Promise<void>((resolve, rej) => {
                    release = resolve;
                    reject = rej;
                })
        );
        return {
            release: () => release(),
            reject: () => reject(new Error('blocked')),
        };
    }

    /**
     * The handler awaits `checkSecurity()` before writing state. A `disconnect()`
     * landing during that await used to be ignored, so the handler wrote the
     * address back and flipped the adapter to Connected after the disconnect.
     */
    it('does not resurrect state when disconnect lands during checkSecurity', async () => {
        const adapter = makeConnected();
        const security = parkSecurity(adapter);
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        fireConnect();
        await adapter.disconnect();

        security.release();
        await vi.advanceTimersByTimeAsync(0);

        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.address).toBeNull();
        expect(adapter.connected).toBe(false);
        expect(onConnect).not.toHaveBeenCalled();
    });

    /**
     * The failure path tears state down unconditionally, so a stale rejection
     * must not disconnect a session that has already been re-established.
     */
    it('does not tear down a newer session when a stale checkSecurity rejects', async () => {
        const adapter = makeConnected();
        const security = parkSecurity(adapter);

        fireConnect();
        await adapter.disconnect();
        // a fresh session starts before the stale check settles
        (adapter as any)._address = ADDR_B;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._listenEvent();

        security.reject();
        await vi.advanceTimersByTimeAsync(0);

        expect(adapter.state).toBe(AdapterState.Connected);
        expect(adapter.address).toBe(ADDR_B);
    });

    it('ignores a connect message that yields no address', async () => {
        const adapter = makeConnected(null);
        (adapter as any)._address = null;
        (adapter as any)._state = AdapterState.Disconnect;
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        fireConnect();
        await vi.advanceTimersByTimeAsync(0);

        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onConnect).not.toHaveBeenCalled();
    });

    it('still connects during a live session', async () => {
        const adapter = makeConnected();
        (adapter as any)._address = null;
        (adapter as any)._state = AdapterState.Disconnect;
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        fireConnect();
        await vi.advanceTimersByTimeAsync(0);

        expect(adapter.address).toBe(ADDR_A);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onConnect).toHaveBeenCalledWith(ADDR_A);
    });
});

describe('OkxWalletAdapter - network, signing, disconnect, deeplink', () => {
    const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

    function makeConnectedAdapter() {
        const adapter = new OkxWalletAdapter();
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
                    getBlockByNumber: vi.fn().mockResolvedValue({
                        blockID: '000000000000000000000000000000000000000000000000000000002b6653dc',
                    }),
                },
                fullNode: { host: 'https://node' },
                solidityNode: { host: 'https://solidity' },
                eventServer: { host: 'https://event' },
            },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        return adapter;
    }

    describe('#network()', () => {
        it('returns the network from getNetworkInfoByTronWeb on success', async () => {
            const adapter = makeConnectedAdapter();
            const net = await adapter.network();
            expect(net.networkType).toBe(NetworkType.Mainnet);
            expect(net.chainId).toBe('0x2b6653dc');
            expect(net.fullNode).toBe('https://node');
            expect(net.solidityNode).toBe('https://solidity');
            expect(net.eventServer).toBe('https://event');
        });

        it('throws WalletDisconnectedError and emits error when state is not Connected', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = { tronWeb: {} };
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });

        it('throws WalletDisconnectedError when _wallet is null', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = null;

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        it('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = { tronWeb: null };

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        it('wraps getNetworkInfoByTronWeb rejection in WalletGetNetworkError', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._wallet = {
                tronWeb: {
                    trx: {
                        getBlockByNumber: vi.fn().mockRejectedValue(new Error('boom')),
                    },
                },
            };
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.network()).rejects.toMatchObject({ message: expect.stringMatching(/boom/) });
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('#signTransaction()', () => {
        it('returns the signed transaction on success', async () => {
            const adapter = makeConnectedAdapter();
            const signed = await adapter.signTransaction({} as any);
            expect(signed).toEqual({ signature: 'tx' });
        });

        it('wraps an Error instance in WalletSignTransactionError and emits error', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('sign-fail'));
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });

        it('wraps a plain object with .message in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce({ message: 'object-fail' });

            await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
                message: expect.stringMatching(/object-fail/),
            });
        });

        it('wraps a string rejection in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce('string-error');

            await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
                message: expect.stringMatching(/string-error/),
            });
        });

        // NOTE: source reads `error.message` and throws TypeError on `null`, so the
        // documented "Unknown error" path is not actually reachable. Skip this test
        // rather than asserting a behaviour the source cannot deliver.

        it('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = null;

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#multiSign()', () => {
        it('passes permissionId from options to trx.multiSign', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            await adapter.multiSign(tx, { permissionId: 3 });
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, 3);
        });

        it('defaults permissionId to undefined when options are omitted', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            await adapter.multiSign(tx);
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, undefined);
        });

        it('defaults permissionId to undefined when options is empty', async () => {
            const adapter = makeConnectedAdapter();
            const tx = {} as any;
            await adapter.multiSign(tx, {});
            expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, undefined);
        });

        it('wraps an Error instance in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(new Error('m-fail'));

            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        it('wraps a string rejection in WalletSignTransactionError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce('string-m');

            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        it('wraps an unknown rejection as WalletSignTransactionError("Unknown error")', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(undefined);

            await expect(adapter.multiSign({} as any)).rejects.toMatchObject({
                message: expect.stringMatching(/Unknown error/),
            });
        });
    });

    describe('#signMessage()', () => {
        it('returns the signature on success', async () => {
            const adapter = makeConnectedAdapter();
            const sig = await adapter.signMessage('hello');
            expect(sig).toBe('msg');
        });

        it('wraps an Error instance in WalletSignMessageError and emits error', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('msg-fail'));
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
            expect(onError).toHaveBeenCalled();
        });

        it('wraps a string rejection in WalletSignMessageError', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce('s-fail');

            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
        });

        it('wraps an unknown rejection as WalletSignMessageError("Unknown error")', async () => {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(42);

            await expect(adapter.signMessage('hi')).rejects.toMatchObject({
                message: expect.stringMatching(/Unknown error/),
            });
        });

        it('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._wallet = null;

            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#disconnect()', () => {
        it('is a no-op when state is Disconnect (does not emit disconnect)', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(onDisconnect).not.toHaveBeenCalled();
        });

        it('is a no-op when state is NotFound', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(onDisconnect).not.toHaveBeenCalled();
        });

        it('clears address, sets Disconnect, emits disconnect, and calls _stopListenEvent when connected', async () => {
            const adapter = makeConnectedAdapter();
            const stopSpy = vi.spyOn(adapter as any, '_stopListenEvent');
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(stopSpy).toHaveBeenCalledTimes(1);
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });
    });

    describe('#_openAppByDeepLinkIfNeed()', () => {
        const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
        const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
        const originalUserAgent = navigator.userAgent;

        function setUserAgent(ua: string) {
            Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
        }

        afterEach(() => {
            setUserAgent(originalUserAgent);
        });

        it('returns false when openAppWithDeeplink is disabled', () => {
            const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });

        it('returns false on a desktop UA', () => {
            setUserAgent(DESKTOP_UA);
            const adapter = new OkxWalletAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });

        it('returns true on a mobile UA when the OKX app is not running (navigates)', () => {
            setUserAgent(MOBILE_UA);
            const adapter = new OkxWalletAdapter();
            // Stub location to capture the navigation.
            const originalLocation = window.location;
            let navigated: string | null = null;
            try {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: {
                        ...originalLocation,
                        set href(v: string) {
                            navigated = v;
                        },
                        get href() {
                            return originalLocation.href;
                        },
                    },
                });
                const result = (adapter as any)._openAppByDeepLinkIfNeed();
                expect(result).toBe(true);
                expect(navigated).toMatch(/^okx:\/\/wallet\/dapp\/url\?dappUrl=/);
            } finally {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: originalLocation,
                });
            }
        });
    });

    describe('#checkIfOpenOkxWallet()', () => {
        const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
        const originalUserAgent = navigator.userAgent;

        function setUserAgent(ua: string) {
            Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
        }

        afterEach(() => {
            setUserAgent(originalUserAgent);
        });

        it('is a no-op when openAppWithDeeplink is disabled', () => {
            const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
            // Even on mobile, it must not throw.
            expect(() => (adapter as any).checkIfOpenOkxWallet()).not.toThrow();
        });

        it('throws WalletNotFoundError on a mobile UA when the deeplink fires', () => {
            setUserAgent(MOBILE_UA);
            const adapter = new OkxWalletAdapter();
            expect(() => (adapter as any).checkIfOpenOkxWallet()).toThrow(WalletNotFoundError);
        });

        it('is a silent no-op on a desktop UA', () => {
            setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
            const adapter = new OkxWalletAdapter();
            expect(() => (adapter as any).checkIfOpenOkxWallet()).not.toThrow();
        });
    });
});

describe('OkxWallet utils', () => {
    const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    const originalUserAgent = navigator.userAgent;

    function setUserAgent(ua: string) {
        Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
    }

    afterEach(() => {
        setUserAgent(originalUserAgent);
        delete (window as any).okxwallet;
    });

    describe('supportOkxWallet()', () => {
        it('returns true when window.okxwallet.tronLink is set', () => {
            (window as any).okxwallet = { tronLink: { tronWeb: {} } };
            expect(supportOkxWallet()).toBe(true);
        });

        it('returns false when window.okxwallet is undefined', () => {
            expect(supportOkxWallet()).toBe(false);
        });

        it('returns false when window.okxwallet has no tronLink', () => {
            (window as any).okxwallet = {};
            expect(supportOkxWallet()).toBe(false);
        });
    });

    describe('isInOKApp()', () => {
        it('returns true when the user-agent contains OKApp', () => {
            setUserAgent('Mozilla/5.0 OKApp/1.0');
            expect(isInOKApp()).toBe(true);
        });

        it('returns false when the user-agent does not contain OKApp', () => {
            setUserAgent(DESKTOP_UA);
            expect(isInOKApp()).toBe(false);
        });
    });

    describe('openOkxWallet()', () => {
        it('returns false on desktop (not a mobile browser)', () => {
            setUserAgent(DESKTOP_UA);
            expect(openOkxWallet()).toBe(false);
        });

        it('returns false when already in the OKX app (isInOKApp true)', () => {
            setUserAgent('Mozilla/5.0 OKApp/1.0');
            expect(openOkxWallet()).toBe(false);
        });

        it('returns true and navigates on mobile when not in the OKX app', () => {
            setUserAgent(MOBILE_UA);
            const originalLocation = window.location;
            let navigated: string | null = null;
            try {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: {
                        ...originalLocation,
                        set href(v: string) {
                            navigated = v;
                        },
                        get href() {
                            return originalLocation.href;
                        },
                    },
                });
                expect(openOkxWallet()).toBe(true);
                expect(navigated).toMatch(/^okx:\/\/wallet\/dapp\/url\?dappUrl=/);
            } finally {
                Object.defineProperty(window, 'location', {
                    configurable: true,
                    value: originalLocation,
                });
            }
        });
    });
});
