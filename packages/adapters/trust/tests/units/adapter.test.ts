import { vi, describe, it, test, expect, beforeEach, afterEach } from 'vitest';
import { TrustAdapter } from '../../src/index.js';
import { supportTrust, getTrustProvider, isTrustApp, isInTrustApp, openTrustWallet } from '../../src/utils.js';
import {
    AdapterState,
    WalletReadyState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletError,
    NetworkType,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';

window.open = vi.fn();
beforeEach(function () {
    vi.useFakeTimers();
    window.tronLink = undefined;
    window.tron = undefined;
    window.trustwallet = undefined;
    Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
    Object.defineProperty(window.location, 'href', {
        value: 'http://localhost/',
        writable: true,
        configurable: true,
    });
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
    vi.restoreAllMocks();
});

describe('TrustAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new TrustAdapter();
            expect(adapter.name).toEqual('Trust');
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

describe('#init connect event with late injection and security check regression', () => {
    // `_checkWallet` used to resolve before `_updateWallet` finished awaiting `checkSecurity()`,
    // so the constructor saw `connected === false` and never emitted `connect`.
    function stubSlowSecurityFetch() {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockImplementation(
                    () =>
                        new Promise((resolve) =>
                            setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ wallets: {} }) }), 300)
                        )
                )
        );
    }
    function createAdapter(configUrl: string) {
        const adapter = new TrustAdapter({ securityOptions: { enabled: true, configUrls: [configUrl] } });
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);
        adapter.on('error', () => {});
        return { adapter, onConnect };
    }

    test('emits connect on mobile when window.trustwallet.tron is injected after construction', async () => {
        stubSlowSecurityFetch();
        Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
        const { adapter, onConnect } = createAdapter('https://example.com/trust-late-mobile.json');
        window.trustwallet = { tron: { tronWeb: { defaultAddress: { base58: ADDRESS } } } } as any;
        await vi.advanceTimersByTimeAsync(5000);
        expect(adapter.connected).toBe(true);
        expect(onConnect).toHaveBeenCalledTimes(1);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });

    test('emits connect on desktop when window.trustwallet.tronLink is injected after construction', async () => {
        stubSlowSecurityFetch();
        const { adapter, onConnect } = createAdapter('https://example.com/trust-late-desktop.json');
        window.trustwallet = { tronLink: { tronWeb: { defaultAddress: { base58: ADDRESS } } } } as any;
        await vi.advanceTimersByTimeAsync(5000);
        expect(adapter.connected).toBe(true);
        expect(onConnect).toHaveBeenCalledTimes(1);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });
});

describe('#connect() empty-account regression', () => {
    function makeAdapter(defaultAddress: unknown) {
        const adapter = new TrustAdapter();
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

describe('#accountsChanged stale-timer regression', function () {
    const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
    const STALE = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

    function makeConnected() {
        const adapter = new TrustAdapter();
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
        const adapter = new TrustAdapter();
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

/* ------------------------------------------------------------------ *
 *  Helpers used by the new coverage tests below.                     *
 * ------------------------------------------------------------------ */

function makeConnectedAdapter() {
    const adapter = new TrustAdapter();
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._updateWallet = vi.fn().mockResolvedValue(undefined);
    const trx = {
        sign: vi.fn(),
        signMessageV2: vi.fn(),
        multiSign: vi.fn(),
        getBlockByNumber: vi.fn(),
    };
    const tronWeb: any = {
        defaultAddress: { base58: ADDRESS },
        trx,
        fullNode: { host: 'https://main.example' },
        solidityNode: { host: 'https://solidity.example' },
        eventServer: { host: 'https://event.example' },
    };
    const wallet: any = {
        request: vi.fn(),
        tronWeb,
    };
    (adapter as any)._wallet = wallet;
    (adapter as any)._address = ADDRESS;
    (adapter as any)._state = AdapterState.Connected;
    adapter.on('error', () => {});
    return { adapter, wallet, tronWeb, trx };
}

describe('#network()', function () {
    test('returns the network from getNetworkInfoByTronWeb (Mainnet)', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.getBlockByNumber.mockResolvedValue({
            blockID: '000000000000000000002b6653dc',
        });
        const network = await adapter.network();
        expect(network.networkType).toBe(NetworkType.Mainnet);
        expect(network.chainId).toBe('0x2b6653dc');
        expect(network.fullNode).toBe('https://main.example');
        expect(network.solidityNode).toBe('https://solidity.example');
        expect(network.eventServer).toBe('https://event.example');
    });

    test('returns Unknown when the chain id does not match a known network', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.getBlockByNumber.mockResolvedValue({
            blockID: '00000000000000000000deadbeef',
        });
        const network = await adapter.network();
        expect(network.networkType).toBe(NetworkType.Unknown);
        expect(network.chainId).toBe('0xdeadbeef');
    });

    test('throws WalletDisconnectedError and emits error when state is Disconnect', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.Disconnect;
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when _wallet is null', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._wallet = null;
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('throws WalletDisconnectedError when _wallet.tronWeb is missing', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._wallet = { ready: true };
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        expect(onError).toHaveBeenCalled();
    });

    test('wraps getBlockByNumber rejection in WalletGetNetworkError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        const inner = new Error('boom');
        trx.getBlockByNumber.mockRejectedValue(inner);
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        expect(onError).toHaveBeenCalled();
    });
});

describe('#signTransaction()', function () {
    test('returns the signed transaction from trx.sign', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        const signed = { signature: ['0xabc'] };
        trx.sign.mockResolvedValue(signed);
        const result = await adapter.signTransaction({} as any);
        expect(result).toBe(signed);
        expect(trx.sign).toHaveBeenCalledWith({});
    });

    test('wraps an Error throw in WalletSignTransactionError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        const inner = new Error('boom');
        trx.sign.mockRejectedValue(inner);
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
            message: 'boom',
            error: inner,
        });
    });

    test('wraps a plain-object error with a message in WalletSignTransactionError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        const inner = { message: 'object boom' };
        trx.sign.mockRejectedValue(inner);
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
            message: 'object boom',
            error: inner,
        });
    });

    test('wraps a string throw in WalletSignTransactionError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.sign.mockRejectedValue('rejected');
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
            message: 'rejected',
        });
    });

    test('wraps an unknown throw with "Unknown error"', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.sign.mockRejectedValue(42);
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        await expect(adapter.signTransaction({} as any)).rejects.toMatchObject({
            message: 'Unknown error',
        });
    });

    test('throws WalletDisconnectedError when state is Disconnect', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.Disconnect;
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('#multiSign()', function () {
    test('returns the signed transaction from trx.multiSign', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        const signed = { signature: ['0xabc'] };
        trx.multiSign.mockResolvedValue(signed);
        const result = await adapter.multiSign({} as any, { permissionId: 7 });
        expect(result).toBe(signed);
        expect(trx.multiSign).toHaveBeenCalledWith({}, undefined, 7);
    });

    test('forwards undefined permissionId when options are omitted', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.multiSign.mockResolvedValue({ signature: ['0xabc'] });
        await adapter.multiSign({} as any);
        expect(trx.multiSign).toHaveBeenCalledWith({}, undefined, undefined);
    });

    test('wraps an Error throw in WalletSignTransactionError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.multiSign.mockRejectedValue(new Error('boom'));
        await expect(adapter.multiSign({} as any, { permissionId: 1 })).rejects.toBeInstanceOf(
            WalletSignTransactionError
        );
    });

    test('wraps a string throw in WalletSignTransactionError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.multiSign.mockRejectedValue('rejected');
        await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });

    test('wraps an unknown throw with "Unknown error"', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.multiSign.mockRejectedValue({ code: 1 });
        await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
    });
});

describe('#signMessage()', function () {
    test('returns the signed message from trx.signMessageV2', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.signMessageV2.mockResolvedValue('0xsig');
        const result = await adapter.signMessage('hello');
        expect(result).toBe('0xsig');
        expect(trx.signMessageV2).toHaveBeenCalledWith('hello');
    });

    test('wraps an Error throw in WalletSignMessageError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.signMessageV2.mockRejectedValue(new Error('boom'));
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
    });

    test('wraps a string throw in WalletSignMessageError', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.signMessageV2.mockRejectedValue('rejected');
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
    });

    test('wraps an unknown throw with "Unknown error"', async () => {
        const { adapter, trx } = makeConnectedAdapter();
        trx.signMessageV2.mockRejectedValue(undefined);
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
    });

    test('throws WalletDisconnectedError when state is Disconnect', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.Disconnect;
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });
});

describe('#disconnect()', function () {
    test('early-returns when state is Disconnect', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.Disconnect;
        (adapter as any)._address = null;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
        expect(adapter.state).toBe(AdapterState.Disconnect);
    });

    test('early-returns when state is Loading', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.Loading;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    test('early-returns when state is NotFound', async () => {
        const { adapter } = makeConnectedAdapter();
        (adapter as any)._state = AdapterState.NotFound;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    test('happy path resets address, sets Disconnect, and emits disconnect', async () => {
        const { adapter } = makeConnectedAdapter();
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.connected).toBe(false);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    test('calls _stopListenEvent before the state guard', async () => {
        const { adapter } = makeConnectedAdapter();
        const order: string[] = [];
        vi.spyOn(adapter as any, '_stopListenEvent').mockImplementation(() => {
            order.push('stop');
        });
        vi.spyOn(adapter as any, 'setState').mockImplementation(function (this: any, state: AdapterState) {
            order.push('setState:' + state);
            (adapter as any)._state = state;
        });
        await adapter.disconnect();
        expect(order[0]).toBe('stop');
        expect(order).toContain('setState:' + AdapterState.Disconnect);
    });
});

describe('#_openAppByDeepLinkIfNeed()', function () {
    test('returns false when openAppWithDeeplink is false', () => {
        const adapter = new TrustAdapter({ openAppWithDeeplink: false });
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });

    test('returns false on desktop UA', () => {
        const adapter = new TrustAdapter();
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        expect(window.location.href).toBe('http://localhost/');
    });

    test('navigates and returns true on mobile UA when not in app', () => {
        Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
        window.location.href = 'http://localhost/';
        const adapter = new TrustAdapter();
        const ret = (adapter as any)._openAppByDeepLinkIfNeed();
        expect(ret).toBe(true);
        expect(window.location.href.startsWith('https://link.trustwallet.com/open_url?url=')).toBe(true);
    });
});

describe('#checkIfopenTrustWallet', function () {
    test('throws WalletNotFoundError on mobile when deeplink fires', async () => {
        Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
        window.location.href = 'http://localhost/';
        const { adapter } = makeConnectedAdapter();
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('is a no-op when openAppWithDeeplink is disabled', async () => {
        const adapter = new TrustAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._wallet = {
            tronWeb: { trx: { signMessageV2: vi.fn().mockResolvedValue('0xsig') } },
        };
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        await adapter.signMessage('hi');
        expect((adapter as any)._wallet.tronWeb.trx.signMessageV2 as any).toHaveBeenCalledWith('hi');
    });
});

describe('#_connect()', function () {
    function makeReadyForConnect() {
        const adapter = new TrustAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        const wallet: any = {
            request: vi.fn(),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        return { adapter, wallet };
    }

    test('connects without calling request when the wallet has no request method (Trust app)', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        delete wallet.request;
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);
        await adapter.connect();
        expect(adapter.connected).toBe(true);
        expect(adapter.address).toBe(ADDRESS);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });

    test('throws WalletConnectionError when the wallet has no request method and no address', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        delete wallet.request;
        wallet.tronWeb.defaultAddress = { base58: false };
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.connected).toBe(false);
    });

    test('empty res throws WalletConnectionError', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue(null);
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('code 4000 throws "same DApp request" error', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4000 });
        await expect(adapter.connect()).rejects.toThrow(
            'The same DApp has already initiated a request to connect to trustwallet, and the pop-up window has not been closed.'
        );
    });

    test('code 4001 throws "user rejected" error', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4001 });
        await expect(adapter.connect()).rejects.toThrow('The user rejected connection.');
    });

    test('assertConnectAddress throws when base58 is missing (rethrows WalletError)', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 200 });
        wallet.tronWeb = { defaultAddress: {} };
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        await expect(adapter.connect()).rejects.toThrow('Request connect error.');
    });

    test('early-returns when _beforeConnect returns false (already connected)', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        (adapter as any)._state = AdapterState.Connected;
        await (adapter as any)._connect();
        expect(wallet.request).not.toHaveBeenCalled();
    });

    test('early-returns when _wallet is null', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        (adapter as any)._wallet = null;
        await (adapter as any)._connect();
        expect(wallet.request).not.toHaveBeenCalled();
    });

    test('rethrows existing WalletError without re-wrapping', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        const original = new WalletConnectionError('original error');
        wallet.request.mockRejectedValue(original);
        await expect((adapter as any)._connect()).rejects.toBe(original);
    });

    test('wraps unknown error as WalletConnectionError', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockRejectedValue({ code: 500 });
        await expect((adapter as any)._connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('finally sets _connecting to false on success', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 200 });
        await (adapter as any)._connect();
        expect(adapter.connecting).toBe(false);
    });

    test('finally sets _connecting to false even on rejection', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockRejectedValue(new Error('boom'));
        await (adapter as any)._connect().catch(() => {});
        expect(adapter.connecting).toBe(false);
    });
});

describe('#utils', function () {
    describe('supportTrust()', () => {
        test('returns true when window.trustwallet.tronLink is present', () => {
            window.trustwallet = { tronLink: {} };
            expect(supportTrust()).toBe(true);
        });
        test('returns false when window.trustwallet.tronLink is absent', () => {
            window.trustwallet = {} as any;
            expect(supportTrust()).toBe(false);
        });
        test('returns false when window.trustwallet is undefined', () => {
            window.trustwallet = undefined;
            expect(supportTrust()).toBe(false);
        });
        test('returns true on mobile when window.trustwallet.tron is present', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.trustwallet = { tron: {} } as any;
            expect(supportTrust()).toBe(true);
        });
        test('returns false on mobile when only window.trustwallet.tronLink is present', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.trustwallet = { tronLink: {} } as any;
            expect(supportTrust()).toBe(false);
        });
    });

    describe('getTrustProvider()', () => {
        test('returns window.trustwallet.tronLink on desktop', () => {
            const tronLink = {};
            window.trustwallet = { tronLink, tron: {} } as any;
            expect(getTrustProvider()).toBe(tronLink);
        });
        test('returns window.trustwallet.tron on mobile', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            const tron = {};
            window.trustwallet = { tronLink: {}, tron } as any;
            expect(getTrustProvider()).toBe(tron);
        });
    });

    describe('isTrustApp()', () => {
        test('returns true when window.trustwallet.tron is present', () => {
            window.trustwallet = { tron: {} } as any;
            expect(isTrustApp()).toBe(true);
        });
        test('returns false when only window.trustwallet.tronLink is present', () => {
            window.trustwallet = { tronLink: {} } as any;
            expect(isTrustApp()).toBe(false);
        });
        test('returns false when window.trustwallet is undefined', () => {
            window.trustwallet = undefined;
            expect(isTrustApp()).toBe(false);
        });
        test('ignores a Trust user agent without the injected provider', () => {
            Object.defineProperty(navigator, 'userAgent', { value: 'Trust/1.0 mobile', configurable: true });
            window.trustwallet = undefined;
            expect(isTrustApp()).toBe(false);
        });
    });

    describe('isInTrustApp()', () => {
        // NOTE: happy-dom does not consistently let tests override `navigator.userAgent`,
        // so the mobile-UA path of isInTrustApp() is asserted indirectly via
        // openTrustWallet() (which uses the same check). The two paths inside the
        // expression are covered by `returns true on mobile when window.trustwallet.tron is present`
        // and the in-source guard in openTrustWallet.
        test('returns true on mobile when window.trustwallet.tron is present', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.trustwallet = { tron: {} } as any;
            expect(isInTrustApp()).toBe(true);
        });
        test('returns false on desktop even when window.trustwallet.tron is present', () => {
            window.trustwallet = { tron: {} } as any;
            expect(isInTrustApp()).toBeFalsy();
        });
    });

    describe('openTrustWallet()', () => {
        test('returns false on desktop UA', () => {
            Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
            window.location.href = 'http://localhost/';
            expect(openTrustWallet()).toBe(false);
            expect(window.location.href).toBe('http://localhost/');
        });

        test('navigates on mobile UA when not in app', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.trustwallet = undefined;
            window.location.href = 'http://localhost/';
            expect(openTrustWallet()).toBe(true);
            expect(window.location.href.startsWith('https://link.trustwallet.com/open_url?url=')).toBe(true);
        });

        test('returns false on mobile UA when already inside Trust app', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.trustwallet = { tron: {} } as any;
            window.location.href = 'http://localhost/';
            expect(openTrustWallet()).toBe(false);
            expect(window.location.href).toBe('http://localhost/');
        });
    });
});
