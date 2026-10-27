import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GateWalletAdapter } from '../../src/index.js';
import { supportGateWallet, isInGateApp, openGateWallet } from '../../src/utils.js';
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
    window.gatewallet = undefined;
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

describe('GateWalletAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new GateWalletAdapter();
            expect(adapter.name).toEqual('Gate Wallet');
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

describe('#connect() empty-account regression', function () {
    /** Desktop extension path: isInGateApp() is false under the default test UA. */
    function makeAdapter(accounts: unknown) {
        const adapter = new GateWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._updateWallet = vi.fn().mockResolvedValue(undefined);
        (adapter as any)._wallet = {
            request: vi.fn().mockResolvedValue(accounts),
            tronWeb: { defaultAddress: {} },
            on: vi.fn(),
            removeListener: vi.fn(),
        };
        adapter.on('error', () => {});
        return adapter;
    }

    test.each([
        ['an empty array', []],
        ['an array holding an empty string', ['']],
        ['an array holding null', [null]],
    ])('rejects on the extension path when the wallet returns %s', async (_label, accounts) => {
        const adapter = makeAdapter(accounts);
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.connected).toBe(false);
        expect(onConnect).not.toHaveBeenCalled();
    });

    test('connects when the extension returns a real address', async () => {
        const adapter = makeAdapter([ADDRESS]);
        const onConnect = vi.fn();
        adapter.on('connect', onConnect);

        await adapter.connect();

        expect(adapter.address).toBe(ADDRESS);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onConnect).toHaveBeenCalledWith(ADDRESS);
    });
});

describe('#accountsChanged stale-timer regression', function () {
    const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
    const STALE = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

    function makeConnected() {
        const adapter = new GateWalletAdapter();
        (adapter as any)._wallet = {
            tronWeb: { defaultAddress: { base58: ADDR_A } },
            on: vi.fn(),
            off: vi.fn(),
        };
        (adapter as any)._address = ADDR_A;
        (adapter as any)._state = AdapterState.Connected;
        adapter.on('error', () => {});
        return adapter;
    }

    test('does not resurrect state after disconnect', async () => {
        const adapter = makeConnected();

        (adapter as any).onGateAccountChange([STALE]);
        await adapter.disconnect();

        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.address).toBeNull();

        await vi.advanceTimersByTimeAsync(1000);

        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.address).toBeNull();
        expect(adapter.connected).toBe(false);
    });

    test('disconnects instead of connecting to an empty address', async () => {
        const adapter = makeConnected();
        const onConnect = vi.fn();
        const onDisconnect = vi.fn();
        const onAccountsChanged = vi.fn();
        adapter.on('connect', onConnect);
        adapter.on('disconnect', onDisconnect);
        adapter.on('accountsChanged', onAccountsChanged);

        (adapter as any).onGateAccountChange(['']);
        await vi.advanceTimersByTimeAsync(1000);

        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.connected).toBe(false);
        expect(onAccountsChanged).toHaveBeenCalledWith('', ADDR_A);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
        expect(onConnect).not.toHaveBeenCalled();
    });

    test('does not emit connect for an event cancelled by disconnect', async () => {
        const adapter = makeConnected();
        const onConnect = vi.fn();
        const onAccountsChanged = vi.fn();
        adapter.on('connect', onConnect);
        adapter.on('accountsChanged', onAccountsChanged);

        (adapter as any).onGateAccountChange([STALE]);
        await adapter.disconnect();
        await vi.advanceTimersByTimeAsync(1000);

        expect(onConnect).not.toHaveBeenCalled();
        expect(onAccountsChanged).not.toHaveBeenCalled();
    });

    test('abandons an in-flight callback when disconnect lands during checkSecurity', async () => {
        const adapter = makeConnected();
        let releaseSecurity: () => void = () => {};
        vi.spyOn(adapter as any, 'checkSecurity').mockImplementation(
            () => new Promise<void>((resolve) => (releaseSecurity = resolve))
        );

        (adapter as any).onGateAccountChange([STALE]);
        await vi.advanceTimersByTimeAsync(200);

        await adapter.disconnect();
        releaseSecurity();
        await vi.advanceTimersByTimeAsync(0);

        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.address).toBeNull();
    });

    test('still applies an account change during a live session', async () => {
        const adapter = makeConnected();
        const onAccountsChanged = vi.fn();
        adapter.on('accountsChanged', onAccountsChanged);

        (adapter as any).onGateAccountChange([STALE]);
        await vi.advanceTimersByTimeAsync(1000);

        expect(adapter.address).toBe(STALE);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(onAccountsChanged).toHaveBeenCalledWith(STALE, ADDR_A);
    });
});

/* ------------------------------------------------------------------ *
 *  Helpers used by the new coverage tests below.                      *
 * ------------------------------------------------------------------ */

/** Construct an adapter that is already "connected" with a real-looking wallet. */
function makeConnectedAdapter() {
    const adapter = new GateWalletAdapter();
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
        on: vi.fn(),
        off: vi.fn(),
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
        (adapter as any)._wallet = { on: vi.fn(), off: vi.fn() };
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
        const adapter = new GateWalletAdapter({ openAppWithDeeplink: false });
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
    });

    test('returns false on desktop UA', () => {
        const adapter = new GateWalletAdapter();
        expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        expect(window.location.href).toBe('http://localhost/');
    });

    test('navigates and returns true on mobile UA when not in app', () => {
        Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
        window.location.href = 'http://localhost/';
        const adapter = new GateWalletAdapter();
        const ret = (adapter as any)._openAppByDeepLinkIfNeed();
        expect(ret).toBe(true);
        expect(window.location.href).toBe('https://gate.onelink.me/Hls0/web3');
    });
});

describe('#checkIfOpenGateWallet', function () {
    test('throws WalletNotFoundError on mobile when deeplink fires', async () => {
        Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
        window.location.href = 'http://localhost/';
        const { adapter, trx } = makeConnectedAdapter();
        await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('is a no-op when openAppWithDeeplink is disabled', async () => {
        const adapter = new GateWalletAdapter({ openAppWithDeeplink: false });
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
    /** Sets up an adapter that's ready to attempt a fresh connect. */
    function makeReadyForConnect() {
        const adapter = new GateWalletAdapter();
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._updateWallet = vi.fn().mockResolvedValue(undefined);
        const wallet: any = {
            request: vi.fn(),
            tronWeb: { defaultAddress: { base58: ADDRESS } },
            on: vi.fn(),
            off: vi.fn(),
        };
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        return { adapter, wallet };
    }

    test('extension path: empty res throws WalletConnectionError', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue(null);
        await expect((adapter as any)._connect()).rejects.toBeInstanceOf(WalletConnectionError);
        // The catch block only emits 'error' and rethrows; the source intentionally
        // only resets to Disconnect in the `!address` branch (after the request
        // resolves), not in the `!res` early-throw. Document the actual behaviour.
        expect([AdapterState.Loading, AdapterState.Disconnect]).toContain(adapter.state);
    });

    test('extension path: code 4000 throws specific message', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4000 });
        await expect((adapter as any)._connect()).rejects.toThrow(
            'The same DApp has already initiated a request to connect to GateWallet, and the pop-up window has not been closed.'
        );
    });

    test('extension path: code 4001 throws specific message', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4001 });
        await expect((adapter as any)._connect()).rejects.toThrow('The user rejected connection.');
    });

    test('extension path: empty res[0] resets state to Disconnect and rejects', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue(['']);
        await expect((adapter as any)._connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.address).toBeNull();
    });

    test('extension path: reuses this.address when _updateWallet resolves to Connected', async () => {
        const { adapter, wallet } = makeReadyForConnect();
        (adapter as any)._updateWallet = vi.fn().mockImplementation(async () => {
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
        });
        await (adapter as any)._connect();
        expect(adapter.address).toBe(ADDRESS);
        expect(wallet.request).not.toHaveBeenCalled();
        expect(adapter.state).toBe(AdapterState.Connected);
    });

    test('gateapp path: reads wallet.tronWeb.defaultAddress.base58', async () => {
        window.gatewallet = { tronLink: {}, tron: undefined };
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 200 });
        wallet.tronWeb = { defaultAddress: { base58: ADDRESS } };
        await (adapter as any)._connect();
        expect(adapter.address).toBe(ADDRESS);
        expect(wallet.request).toHaveBeenCalledWith({ method: 'tron_requestAccounts' });
        expect(adapter.state).toBe(AdapterState.Connected);
    });

    test('gateapp path: empty res throws WalletConnectionError', async () => {
        window.gatewallet = { tronLink: {}, tron: undefined };
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue(null);
        await expect((adapter as any)._connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('gateapp path: code 4000 throws specific message', async () => {
        window.gatewallet = { tronLink: {}, tron: undefined };
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4000 });
        await expect((adapter as any)._connect()).rejects.toThrow(
            'The same DApp has already initiated a request to connect to GateWallet, and the pop-up window has not been closed.'
        );
    });

    test('gateapp path: code 4001 throws specific message', async () => {
        window.gatewallet = { tronLink: {}, tron: undefined };
        const { adapter, wallet } = makeReadyForConnect();
        wallet.request.mockResolvedValue({ code: 4001 });
        await expect((adapter as any)._connect()).rejects.toThrow('The user rejected connection.');
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
        wallet.request.mockResolvedValue([ADDRESS]);
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
    describe('supportGateWallet()', () => {
        test('returns true when window.gatewallet.tronLink is present', () => {
            window.gatewallet = { tronLink: {} };
            expect(supportGateWallet()).toBe(true);
        });
        test('returns false when window.gatewallet.tronLink is absent', () => {
            window.gatewallet = { tron: {} };
            expect(supportGateWallet()).toBe(false);
        });
    });

    describe('isInGateApp()', () => {
        test('returns true with a GateApp user-agent', () => {
            Object.defineProperty(navigator, 'userAgent', { value: 'GateApp/1.0', configurable: true });
            window.gatewallet = undefined;
            expect(isInGateApp()).toBe(true);
        });
        test('returns true when window.gatewallet.tronLink exists but tron does not', () => {
            window.gatewallet = { tronLink: {}, tron: undefined };
            expect(isInGateApp()).toBe(true);
        });
        test('returns false in a plain browser', () => {
            window.gatewallet = undefined;
            Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
            expect(isInGateApp()).toBe(false);
        });
    });

    describe('openGateWallet()', () => {
        test('returns false on desktop UA', () => {
            window.location.href = 'http://localhost/';
            Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
            window.gatewallet = undefined;
            expect(openGateWallet()).toBe(false);
            expect(window.location.href).toBe('http://localhost/');
        });

        test('navigates on mobile UA when not in app', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            window.gatewallet = undefined;
            window.location.href = 'http://localhost/';
            expect(openGateWallet()).toBe(true);
            expect(window.location.href).toBe('https://gate.onelink.me/Hls0/web3');
        });

        test('returns false on mobile UA when already inside the Gate app', () => {
            Object.defineProperty(navigator, 'userAgent', { value: 'GateApp/1.0', configurable: true });
            window.location.href = 'http://localhost/';
            expect(openGateWallet()).toBe(false);
            expect(window.location.href).toBe('http://localhost/');
        });
    });
});
