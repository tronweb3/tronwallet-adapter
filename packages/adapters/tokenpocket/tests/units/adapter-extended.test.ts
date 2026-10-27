import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletReadyState,
} from '@tronweb3/tronwallet-abstract-adapter';
import { TokenPocketAdapter } from '../../src/adapter.js';
import { openTokenPocket } from '../../src/utils.js';
import * as utils from '../../src/utils.js';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const ADDRESS_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProvider(address?: string) {
    // The tokenpocket adapter wires `tron` to whatever the provider announces, so
    // the provider object must already carry `on` / `removeListener` / `request`.
    return {
        request: vi.fn().mockResolvedValue([ADDRESS]),
        on: vi.fn(),
        removeListener: vi.fn(),
        tronWeb: {
            defaultAddress: address === undefined ? undefined : { base58: address },
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
            },
        },
    };
}

function makeConnected(provider: any) {
    const adapter = new TokenPocketAdapter({ openAppWithDeeplink: false });
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._state = AdapterState.Disconnect;
    (adapter as any)._address = null;
    (adapter as any)._wallet = {
        tron: provider,
        tronWeb: provider.tronWeb,
        ready: true,
    };
    adapter.on('error', () => {});
    return adapter;
}

describe('TokenPocketAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;
    let locationDesc: PropertyDescriptor | undefined;
    let hrefCalls: string[];

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ wallets: {} }) }));
        delete (window as any).tokenpocket;
        delete (window as any).tronWeb;
        hrefCalls = [];
        locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
        const stub = {
            _href: 'http://localhost:3000/dapp?a=1#h',
            origin: 'http://localhost:3000',
            pathname: '/dapp',
            search: '?a=1',
            hash: '#h',
            get href() {
                return this._href;
            },
            set href(v: string) {
                this._href = v;
                hrefCalls.push(v);
            },
        };
        Object.defineProperty(window, 'location', { configurable: true, value: stub });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete (window as any).tokenpocket;
        delete (window as any).tronWeb;
        if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
        else delete (window as any).location;
        if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
        else delete (window.navigator as any).userAgent;
        realUA = undefined;
    });

    function setUserAgent(ua: string) {
        realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => ua,
        });
    }

    describe('utils.openTokenPocket deeplink', () => {
        test('navigates to the tpdapp deeplink on mobile without the wallet', () => {
            setUserAgent(MOBILE_UA);
            expect(openTokenPocket()).toBe(true);
            expect(hrefCalls).toHaveLength(1);
            const link = hrefCalls[0];
            expect(link).toMatch(/^tpdapp:\/\/open\?params=/);
            const params = JSON.parse(decodeURIComponent(link.slice('tpdapp://open?params='.length)));
            expect(params.url).toBe('http://localhost:3000/dapp?a=1#h');
            expect(params.blockchain).toBe('Tron');
            expect(params.protocol).toBe('TokenPocket');
        });

        test('does nothing when already inside the TokenPocket app', () => {
            setUserAgent(MOBILE_UA);
            (window as any).tokenpocket = {};
            expect(openTokenPocket()).toBe(false);
            expect(hrefCalls).toHaveLength(0);
        });
    });

    describe('#constructor() mobile path', () => {
        test('goes straight to Found and emits connect when the mobile wallet is injected', async () => {
            setUserAgent(MOBILE_UA);
            const wallet = makeProvider(ADDRESS);
            (window as any).tronWeb = { ready: true };
            (window as any).tokenpocket = { tron: wallet, tronWeb: wallet.tronWeb };

            const adapter = new TokenPocketAdapter();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);
            await sleep(50);

            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('mobile polling resolves NotFound when the wallet never appears', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new TokenPocketAdapter({ checkTimeout: 100 });
            await sleep(300);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
            expect(adapter.address).toBeNull();
        });
    });

    describe('TIP-6963 desktop detection', () => {
        test('announceProvider with a TokenPocket provider wires the wallet up', async () => {
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter({ checkTimeout: 2000 });
            const onReadyState = vi.fn();
            adapter.on('readyStateChanged', onReadyState);

            window.dispatchEvent(
                new CustomEvent('TIP6963:announceProvider', {
                    detail: { info: { name: 'TokenPocket' }, provider: wallet },
                })
            );
            await sleep(50);

            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(adapter.address).toBe(ADDRESS);
            // listenTronEvent subscribed on the announced provider (desktop).
            expect(wallet.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
            expect(onReadyState).toHaveBeenCalledWith(WalletReadyState.Found);
        });

        test('ignores announcements from other wallets', async () => {
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter({ checkTimeout: 150 });
            window.dispatchEvent(
                new CustomEvent('TIP6963:announceProvider', {
                    detail: { info: { name: 'SomeOtherWallet' }, provider: wallet },
                })
            );
            await sleep(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
            expect(wallet.on).not.toHaveBeenCalled();
        });

        test('a failed security check disconnects and stops listening', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            wallets: { TokenPocket: [{ title: 'Phishing', noticeType: 1 }] },
                        }),
                })
            );
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter({
                checkTimeout: 2000,
                securityOptions: {
                    enabled: true,
                    configUrls: ['https://example.com/config'],
                    onRiskDetected: () => {
                        throw new Error('risk');
                    },
                },
            });

            window.dispatchEvent(
                new CustomEvent('TIP6963:announceProvider', {
                    detail: { info: { name: 'TokenPocket' }, provider: wallet },
                })
            );
            await sleep(50);

            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();
            expect(wallet.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
        });

        test('starts checkForWalletReady when the announced provider has no address yet', async () => {
            const wallet = makeProvider('');
            (wallet.tronWeb as any).defaultAddress = {};
            const adapter = new TokenPocketAdapter({ checkTimeout: 2000 });
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            window.dispatchEvent(
                new CustomEvent('TIP6963:announceProvider', {
                    detail: { info: { name: 'TokenPocket' }, provider: wallet },
                })
            );
            await sleep(50);
            expect(adapter.address).toBeNull();

            // The wallet becomes ready while the readiness poll is running.
            (adapter as any)._wallet.tronWeb.defaultAddress = { base58: ADDRESS };
            await sleep(250);

            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect((adapter as any)._wallet.ready).toBe(true);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('times out to NotFound when nothing announces', async () => {
            const adapter = new TokenPocketAdapter({ checkTimeout: 100 });
            const onReadyState = vi.fn();
            adapter.on('readyStateChanged', onReadyState);
            await sleep(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
            expect(adapter.address).toBeNull();
            expect(onReadyState).toHaveBeenCalledWith(WalletReadyState.NotFound);
        });
    });

    describe('#connect()', () => {
        test('requests accounts and connects', async () => {
            const wallet = makeProvider('');
            const adapter = makeConnected(wallet);
            wallet.request.mockResolvedValue([ADDRESS]);
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            await adapter.connect();
            expect(wallet.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(adapter.connecting).toBe(false);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('rejects with WalletConnectionError when the response is empty', async () => {
            const wallet = makeProvider('');
            const adapter = makeConnected(wallet);
            wallet.request.mockResolvedValue([]);
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect(adapter.connecting).toBe(false);
            expect(onError).toHaveBeenCalled();
        });

        test('wraps a request rejection in WalletConnectionError', async () => {
            const wallet = makeProvider('');
            const adapter = makeConnected(wallet);
            wallet.request.mockRejectedValue(new Error('user denied'));

            await expect(adapter.connect()).rejects.toThrow('user denied');
            expect(adapter.connecting).toBe(false);
        });
    });

    describe('onAccountsChanged security gate', () => {
        test('ignores account events before the security check has passed', () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._securityPassed = false;

            (adapter as any).onAccountsChanged([ADDRESS]);
            expect(adapter.address).toBeNull();
        });

        test('an empty account disconnects and emits', () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._securityPassed = true;
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            (adapter as any).onAccountsChanged([]);
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });

        test('a new account connects and emits connect', () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._securityPassed = true;
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            (adapter as any).onAccountsChanged([ADDRESS_B]);
            expect(adapter.address).toBe(ADDRESS_B);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS_B);
        });
    });

    describe('#checkIfOpenApp() / #_openAppByDeepLinkIfNeed()', () => {
        test('throws WalletNotFoundError when the deeplink fires', async () => {
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = wallet;
            adapter.on('error', () => {});
            vi.spyOn(utils, 'openTokenPocket').mockReturnValue(true);

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        test('is a no-op when openAppWithDeeplink is disabled', async () => {
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = wallet;
            adapter.on('error', () => {});
            vi.spyOn(utils, 'openTokenPocket').mockReturnValue(true);

            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
            await expect(adapter.signTransaction({} as any)).resolves.toBeDefined();
        });

        test('signing rejects with WalletDisconnectedError when the wallet is missing', async () => {
            const adapter = new TokenPocketAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = null;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('signing error wrapping', () => {
        function makeConnected() {
            const wallet = makeProvider(ADDRESS);
            const adapter = new TokenPocketAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = wallet;
            adapter.on('error', () => {});
            return { adapter, wallet };
        }

        test('signTransaction wraps string rejections', async () => {
            const { adapter, wallet } = makeConnected();
            wallet.tronWeb.trx.sign.mockRejectedValueOnce('string-fail');
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('signTransaction wraps unknown rejections', async () => {
            const { adapter, wallet } = makeConnected();
            wallet.tronWeb.trx.sign.mockRejectedValueOnce({ nope: true });
            await expect(adapter.signTransaction({} as any)).rejects.toThrow('Unknown error');
        });

        test('multiSign wraps string and unknown rejections', async () => {
            const { adapter, wallet } = makeConnected();
            wallet.tronWeb.trx.multiSign.mockRejectedValueOnce('multi-fail');
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(42);
            await expect(adapter.multiSign({} as any)).rejects.toThrow('Unknown error');
        });

        test('signMessage wraps string and unknown rejections', async () => {
            const { adapter, wallet } = makeConnected();
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce('msg-fail');
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletSignMessageError);
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(undefined);
            await expect(adapter.signMessage('m')).rejects.toThrow('Unknown error');
        });

        test('signMessage succeeds and multiSign passes permissionId', async () => {
            const { adapter, wallet } = makeConnected();
            await expect(adapter.signMessage('m')).resolves.toBe('msg-sig');
            await adapter.multiSign({} as any, { permissionId: 2 });
            expect(wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith({} as any, undefined, 2);
        });
    });
});
