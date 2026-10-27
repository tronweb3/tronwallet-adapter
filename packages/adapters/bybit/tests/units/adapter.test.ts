import { vi, describe, it, test, expect, beforeEach, afterEach } from 'vitest';
import { BybitWalletAdapter } from '../../src/index.js';
import { supportBybitWallet, isBybitApp, isInBybitApp, openBybitWallet } from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const ADDR_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';
const NETWORK_INFO = {
    networkType: 'Mainnet',
    chainId: '0x2b6653dc',
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io',
};

window.open = vi.fn();

beforeEach(function () {
    vi.useFakeTimers();
    window.tronLink = undefined;
    window.tron = undefined;
    window.bybitWallet = undefined;
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
    vi.useRealTimers();
});

describe('BybitWalletAdapter', function () {
    describe('#adapter()', function () {
        test('constructor exposes basic properties', () => {
            const adapter = new BybitWalletAdapter();
            expect(adapter.name).toEqual('Bybit Wallet');
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

// ----- helper -----
function makeAdapter(defaultAddress: unknown) {
    const adapter = new BybitWalletAdapter();
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

function makeConnectedAdapter(address: string = ADDRESS) {
    const adapter = new BybitWalletAdapter();
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._wallet = {
        request: vi.fn(),
        tronWeb: {
            defaultAddress: { base58: address },
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
                getBlockByNumber: vi
                    .fn()
                    .mockResolvedValue({ blockID: '000000000000000000000000000000000000000000000000002b6653dc' }),
            },
            fullNode: { host: 'https://api.trongrid.io' },
            solidityNode: { host: 'https://api.trongrid.io' },
            eventServer: { host: 'https://api.trongrid.io' },
        },
        on: vi.fn(),
        removeListener: vi.fn(),
    };
    (adapter as any)._address = address;
    (adapter as any)._state = AdapterState.Connected;
    adapter.on('error', () => {});
    return adapter;
}

function fireAccountsChanged(adapter: BybitWalletAdapter, address: string) {
    window.dispatchEvent(
        new MessageEvent('message', {
            origin: window.location.origin,
            data: { message: { action: 'accountsChanged', data: { address } } },
        })
    );
}

function fireConnect() {
    window.dispatchEvent(
        new MessageEvent('message', {
            origin: window.location.origin,
            data: { message: { action: 'connect' } },
        })
    );
}

function fireDisconnect() {
    window.dispatchEvent(
        new MessageEvent('message', {
            origin: window.location.origin,
            data: { message: { action: 'disconnect' } },
        })
    );
}

// =================================================================
// connect() — code branches
// =================================================================

describe('#connect() empty-account regression', () => {
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

describe('#connect() error-code branches', () => {
    function adapterForRequest(request: any) {
        const adapter = new BybitWalletAdapter();
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

    test('request resolves null → "Request connect error."', async () => {
        const adapter = adapterForRequest(vi.fn().mockResolvedValue(null));
        await expect(adapter.connect()).rejects.toMatchObject({
            message: expect.stringMatching(/Request connect error/),
        });
    });

    test('request resolves undefined → "Request connect error."', async () => {
        const adapter = adapterForRequest(vi.fn().mockResolvedValue(undefined));
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('request resolves { code: 4000 } → pending-request message', async () => {
        const adapter = adapterForRequest(vi.fn().mockResolvedValue({ code: 4000 }));
        await expect(adapter.connect()).rejects.toThrow(/already initiated a request/);
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('request resolves { code: 4001 } → user-rejected message', async () => {
        const adapter = adapterForRequest(vi.fn().mockResolvedValue({ code: 4001 }));
        await expect(adapter.connect()).rejects.toThrow(/user rejected/i);
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('passes through a WalletError unchanged (no rewrap)', async () => {
        const inner = new WalletConnectionError('original');
        const adapter = adapterForRequest(vi.fn().mockRejectedValue(inner));
        await expect(adapter.connect()).rejects.toBe(inner);
    });

    test('wraps a non-WalletError rejection as WalletConnectionError', async () => {
        const adapter = adapterForRequest(vi.fn().mockRejectedValue(new Error('boom')));
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('always resets _connecting in finally even on rejection', async () => {
        const adapter = adapterForRequest(vi.fn().mockRejectedValue(new Error('fail')));
        try {
            await adapter.connect();
        } catch {
            // ignore
        }
        expect(adapter.connecting).toBe(false);
    });

    test('always resets _connecting in finally on success', async () => {
        const adapter = adapterForRequest(vi.fn().mockResolvedValue({ code: 200 }));
        await adapter.connect();
        expect(adapter.connecting).toBe(false);
    });
});

// =================================================================
// disconnect()
// =================================================================

describe('#disconnect()', () => {
    test('is a no-op (no emits) when not connected', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.NotFound;
        (adapter as any)._wallet = null;
        const onDisconnect = vi.fn();
        const onStateChanged = vi.fn();
        adapter.on('disconnect', onDisconnect);
        adapter.on('stateChanged', onStateChanged);
        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
        expect(onStateChanged).not.toHaveBeenCalled();
    });

    test('clears address, sets Disconnect, emits disconnect when connected', async () => {
        const adapter = makeConnectedAdapter();
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    test('calls _stopListenEvent first (removeEventListener always invoked)', async () => {
        const adapter = makeConnectedAdapter();
        // Spy on window.removeEventListener; should be called at least once.
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        await adapter.disconnect();
        expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
        removeSpy.mockRestore();
    });

    test('still calls _stopListenEvent when not connected', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.NotFound;
        (adapter as any)._wallet = null;
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        await adapter.disconnect();
        expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
        removeSpy.mockRestore();
    });
});

// =================================================================
// network()
// =================================================================

describe('#network()', () => {
    test('returns network info on success', async () => {
        const adapter = makeConnectedAdapter();
        const network = await adapter.network();
        expect(network).toEqual(NETWORK_INFO);
    });

    test('throws WalletDisconnectedError when state is not Connected', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.NotFound;
        (adapter as any)._wallet = { tronWeb: {} };
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when wallet is null', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._wallet = null;
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('throws WalletDisconnectedError when wallet.tronWeb is missing', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._wallet = {
            /* no tronWeb */
        };
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    test('wraps inner tronWeb failure in WalletGetNetworkError and emits error', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.getBlockByNumber = vi.fn().mockRejectedValue(new Error('rpc down'));
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        expect(onError).toHaveBeenCalled();
    });
});

// =================================================================
// signTransaction / multiSign / signMessage
// =================================================================

describe('#signTransaction()', () => {
    test('returns signed tx on success', async () => {
        const adapter = makeConnectedAdapter();
        const signed = await adapter.signTransaction({} as any);
        expect(signed).toEqual({ signature: 'tx-sig' });
    });

    test('wraps Error instance in WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('boom'));
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });

    test('wraps plain-string error in WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce('plain string');
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });

    test('wraps unknown (object without .message) in WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        // Plain object without `.message` falls into the "Unknown error" branch.
        (adapter as any)._wallet.tronWeb.trx.sign.mockRejectedValueOnce({ code: 99 });
        await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
            message: expect.stringMatching(/Unknown error/),
        });
    });

    test('throws WalletDisconnectedError when not connected', async () => {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.NotFound;
        (adapter as any)._wallet = null;
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('#multiSign()', () => {
    test('returns signed tx on success', async () => {
        const adapter = makeConnectedAdapter();
        const signed = await adapter.multiSign({} as any);
        expect(signed).toEqual({ signature: 'multi-sig' });
    });

    test('passes permissionId from options to trx.multiSign', async () => {
        const adapter = makeConnectedAdapter();
        const tx = { raw: 'tx' };
        await adapter.multiSign(tx as any, { permissionId: 7 });
        expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, 7);
    });

    test('defaults permissionId to undefined when omitted', async () => {
        const adapter = makeConnectedAdapter();
        const tx = { raw: 'tx' };
        await adapter.multiSign(tx as any);
        expect((adapter as any)._wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith(tx, undefined, undefined);
    });

    test('wraps Error in WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(new Error('multi-fail'));
        await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });

    test('wraps string error in WalletSignTransactionError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce('string-fail');
        await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });

    test('wraps unknown error in WalletSignTransactionError with "Unknown error"', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.multiSign.mockRejectedValueOnce({ noMessage: true });
        try {
            await adapter.multiSign({} as any);
        } catch (e: any) {
            expect(e).toBeInstanceOf(WalletSignTransactionError);
            expect(e.message).toBe('Unknown error');
        }
    });
});

describe('#signMessage()', () => {
    test('returns the signature on success', async () => {
        const adapter = makeConnectedAdapter();
        const sig = await adapter.signMessage('hello');
        expect(sig).toBe('msg-sig');
    });

    test('wraps Error in WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('msg-fail'));
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
    });

    test('wraps string error in WalletSignMessageError', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce('string-fail');
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
    });

    test('wraps unknown error in WalletSignMessageError with "Unknown error"', async () => {
        const adapter = makeConnectedAdapter();
        (adapter as any)._wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce({ noMessage: true });
        try {
            await adapter.signMessage('hi');
        } catch (e: any) {
            expect(e).toBeInstanceOf(WalletSignMessageError);
            expect(e.message).toBe('Unknown error');
        }
    });
});

// =================================================================
// messageHandler: origin guard, no-message guard, disconnect branch
// =================================================================

describe('#messageHandler — guards', () => {
    test('ignores messages from a different origin', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnectedAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'https://evil.example.com',
                    data: { message: { action: 'accountsChanged', data: { address: ADDR_B } } },
                })
            );
            await vi.advanceTimersByTimeAsync(500);
            expect(onAccountsChanged).not.toHaveBeenCalled();
            // Address unchanged
            expect(adapter.address).toBe(ADDRESS);
        } finally {
            vi.useRealTimers();
        }
    });

    test('ignores messages without a data.message payload', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnectedAdapter();
            const onStateChanged = vi.fn();
            adapter.on('stateChanged', onStateChanged);
            window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: {} }));
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: undefined },
                })
            );
            await vi.advanceTimersByTimeAsync(500);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onStateChanged).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    test('disconnect message drops address and emits disconnect', async () => {
        const adapter = makeConnectedAdapter();
        // _listenEvent is normally called by _connect() at the end of a successful
        // handshake; mirror that here so the message handler is actually attached.
        (adapter as any)._listenEvent();
        const onDisconnect = vi.fn();
        const onStateChanged = vi.fn();
        adapter.on('disconnect', onDisconnect);
        adapter.on('stateChanged', onStateChanged);
        fireDisconnect();
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
        expect(onStateChanged).toHaveBeenCalledWith(AdapterState.Disconnect);
    });

    test('accountsChanged with same address emits nothing', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnectedAdapter();
            const onAccountsChanged = vi.fn();
            const onConnect = vi.fn();
            const onDisconnect = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            adapter.on('connect', onConnect);
            adapter.on('disconnect', onDisconnect);
            fireAccountsChanged(adapter, ADDRESS);
            await vi.advanceTimersByTimeAsync(500);
            expect(onAccountsChanged).not.toHaveBeenCalled();
            expect(onConnect).not.toHaveBeenCalled();
            expect(onDisconnect).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    test('accountsChanged with !wallet.ready forces Disconnect even when address non-empty', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnectedAdapter();
            (adapter as any)._wallet.ready = false;
            (adapter as any)._listenEvent();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            fireAccountsChanged(adapter, ADDR_B);
            await vi.advanceTimersByTimeAsync(500);
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});

// =================================================================
// accountsChanged stale-timer regression (kept)
// =================================================================

describe('#accountsChanged stale-timer regression', function () {
    const STALE = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

    function makeConnected() {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._wallet = { ready: true, tronWeb: { defaultAddress: { base58: ADDRESS } } };
        (adapter as any)._address = ADDRESS;
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        (adapter as any)._listenEvent();
        return adapter;
    }

    it('does not resurrect state after disconnect', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            fireAccountsChanged(adapter, STALE);
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

            fireAccountsChanged(adapter, STALE);
            await adapter.disconnect();
            await vi.advanceTimersByTimeAsync(1000);

            expect(onConnect).not.toHaveBeenCalled();
            expect(onAccountsChanged).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('abandons an in-flight callback when disconnect lands during checkSecurity', async () => {
        vi.useFakeTimers();
        try {
            const adapter = makeConnected();
            let releaseSecurity: () => void = () => {};
            vi.spyOn(adapter as any, 'checkSecurity').mockImplementation(
                () => new Promise<void>((resolve) => (releaseSecurity = resolve))
            );

            fireAccountsChanged(adapter, STALE);
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

            fireAccountsChanged(adapter, '');
            await vi.advanceTimersByTimeAsync(1000);

            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.connected).toBe(false);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
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

            fireAccountsChanged(adapter, STALE);
            await vi.advanceTimersByTimeAsync(1000);

            expect(adapter.address).toBe(STALE);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onAccountsChanged).toHaveBeenCalledWith(STALE, ADDRESS);
        } finally {
            vi.useRealTimers();
        }
    });
});

// =================================================================
// connect() concurrency
// =================================================================

describe('#connect() concurrency', function () {
    it('requests accounts once for two simultaneous calls', async () => {
        vi.useRealTimers();
        const request = vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { code: 200 };
        });
        const adapter = new BybitWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            request,
            ready: true,
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});

        const [first, second] = [adapter.connect(), adapter.connect()];
        expect(second).toBe(first);
        await Promise.all([first, second]);

        expect(request).toHaveBeenCalledTimes(1);
        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
    });
});

// =================================================================
// _checkWallet() re-detection
// =================================================================

describe('#_checkWallet() re-detection', function () {
    afterEach(() => {
        (window as any).bybitWallet = undefined;
    });

    function injectWallet() {
        (window as any).bybitWallet = {
            tronLink: {
                ready: true,
                tronWeb: { defaultAddress: { base58: ADDRESS } },
                request: vi.fn().mockResolvedValue({ code: 200 }),
            },
        };
    }

    it('detects a wallet injected after the first attempt timed out', async () => {
        const adapter = new BybitWalletAdapter({ checkTimeout: 200 });
        adapter.on('error', () => {});

        const first = (adapter as any)._checkWallet();
        await vi.advanceTimersByTimeAsync(300);
        expect(await first).toBe(false);
        expect(adapter.readyState).toBe(WalletReadyState.NotFound);

        injectWallet();

        expect(await (adapter as any)._checkWallet()).toBe(true);
        expect(adapter.readyState).toBe(WalletReadyState.Found);
    });

    it('re-checks once rather than polling again', async () => {
        const adapter = new BybitWalletAdapter({ checkTimeout: 5000 });
        adapter.on('error', () => {});

        const first = (adapter as any)._checkWallet();
        await vi.advanceTimersByTimeAsync(6000);
        expect(await first).toBe(false);

        injectWallet();
        await expect((adapter as any)._checkWallet()).resolves.toBe(true);
    });

    it('keeps caching a successful detection', async () => {
        injectWallet();
        const adapter = new BybitWalletAdapter({ checkTimeout: 200 });
        adapter.on('error', () => {});

        expect(await (adapter as any)._checkWallet()).toBe(true);

        (window as any).bybitWallet = undefined;
        expect(await (adapter as any)._checkWallet()).toBe(true);
    });
});

// =================================================================
// connect-message stale-session regression (kept)
// =================================================================

describe('#connect message stale-session regression', function () {
    function makeConnected(base58: unknown = ADDRESS) {
        const adapter = new BybitWalletAdapter();
        (adapter as any)._wallet = { ready: true, tronWeb: { defaultAddress: { base58 } } };
        (adapter as any)._address = ADDRESS;
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        (adapter as any)._listenEvent();
        return adapter;
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

    it('does not tear down a newer session when a stale checkSecurity rejects', async () => {
        const adapter = makeConnected();
        const security = parkSecurity(adapter);

        fireConnect();
        await adapter.disconnect();
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

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });
});

// =================================================================
// _openAppByDeepLinkIfNeed / checkIfOpenBybitWallet / deeplink
// =================================================================

describe('#_openAppByDeepLinkIfNeed()', () => {
    test('returns false when openAppWithDeeplink === false', () => {
        const adapter = new BybitWalletAdapter({ openAppWithDeeplink: false });
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });

    test('returns true when openBybitWallet redirects (mobile UA + no bybit_app UA)', () => {
        // happy-dom default user agent is non-mobile. Patch it for this test.
        const realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
        });
        // openBybitWallet assigns window.location.href, so stub it with a setter spy.
        const hrefSpy = vi.fn();
        const locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                href: window.location.href,
                set href(v: string) {
                    hrefSpy(v);
                },
            },
        });
        try {
            const adapter = new BybitWalletAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
            expect(hrefSpy).toHaveBeenCalledTimes(1);
            const url = hrefSpy.mock.calls[0][0];
            expect(url).toContain('https://app.bybit.com/inapp?');
            expect(url).toContain('by_dp=');
            expect(url).toContain('by_web_link=');
        } finally {
            // happy-dom does not always expose `location` as an own property of
            // `window`, so the captured descriptor can be undefined — restore by
            // deleting the own property we just defined in that case.
            if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
            else delete (window as any).location;
            if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
            else delete (window.navigator as any).userAgent;
        }
    });
});

describe('#checkIfOpenBybitWallet()', () => {
    test('throws WalletNotFoundError when openBybitWallet fires the deeplink', () => {
        const realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Mobile',
        });
        const locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                href: 'https://example.com',
                set href(_v: string) {
                    /* no-op: prevent actual navigation */
                },
            },
        });
        try {
            const adapter = new BybitWalletAdapter();
            // checkIfOpenBybitWallet throws synchronously (it is not async).
            expect(() => (adapter as any).checkIfOpenBybitWallet()).toThrow(WalletNotFoundError);
        } finally {
            if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
            else delete (window as any).location;
            if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
            else delete (window.navigator as any).userAgent;
        }
    });

    test('does nothing when openAppWithDeeplink === false', () => {
        const adapter = new BybitWalletAdapter({ openAppWithDeeplink: false });
        expect(() => (adapter as any).checkIfOpenBybitWallet()).not.toThrow();
    });
});

// =================================================================
// utils.ts
// =================================================================

describe('utils.ts', () => {
    afterEach(() => {
        (window as any).bybitWallet = undefined;
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: '',
        });
    });

    test('supportBybitWallet() returns true when window.bybitWallet.tronLink present', () => {
        (window as any).bybitWallet = { tronLink: {} };
        expect(supportBybitWallet()).toBe(true);
    });

    test('supportBybitWallet() returns false when window.bybitWallet missing', () => {
        expect(supportBybitWallet()).toBe(false);
    });

    test('supportBybitWallet() returns false when tronLink missing', () => {
        (window as any).bybitWallet = {};
        expect(supportBybitWallet()).toBe(false);
    });

    test('isInBybitApp() returns true when userAgent contains bybit_app', () => {
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 Bybit_App/1.0',
        });
        expect(isInBybitApp()).toBe(true);
    });

    test('isInBybitApp() returns false when userAgent is clean', () => {
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (Macintosh)',
        });
        expect(isInBybitApp()).toBe(false);
    });

    test('isBybitApp constant reflects userAgent at module load time', () => {
        // Only meaningful as a smoke test: isBybitApp is computed from navigator.userAgent at module eval.
        expect(typeof isBybitApp).toBe('boolean');
    });

    test('openBybitWallet() returns false when already in Bybit app (bybit_app UA)', () => {
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 Bybit_App/1.0',
        });
        expect(openBybitWallet()).toBe(false);
    });

    test('openBybitWallet() returns false on non-mobile browser', () => {
        // happy-dom's default UA is desktop-style; assert no redirect.
        const desc = Object.getOwnPropertyDescriptor(window, 'location')!;
        const hrefSpy = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                set href(v: string) {
                    hrefSpy(v);
                },
            },
        });
        try {
            expect(openBybitWallet()).toBe(false);
            expect(hrefSpy).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(window, 'location', desc);
        }
    });
});
