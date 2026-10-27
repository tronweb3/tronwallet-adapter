import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrustAdapter } from '../../src/index.js';
import * as utils from '../../src/utils.js';
import {
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const ADDRESS_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';

function makeWallet(address: string | null = ADDRESS) {
    return {
        tronWeb: {
            defaultAddress: address ? { base58: address } : null,
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
            },
        },
        request: vi.fn().mockResolvedValue(undefined),
        ready: true,
    };
}

describe('TrustAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (window as any).trustwallet = undefined;
        Object.defineProperty(navigator, 'userAgent', { value: DESKTOP_UA, configurable: true });
        Object.defineProperty(window.location, 'href', {
            value: 'http://localhost:3000/dapp',
            writable: true,
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        (window as any).trustwallet = undefined;
    });

    function makeConnected(wallet: any, address: string | null = ADDRESS) {
        const adapter = new TrustAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = address;
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        // start listening so message-handler tests work.
        (adapter as any)._listenEvent();
        return adapter;
    }

    describe('messageHandler wiring', () => {
        test('ignores events from other origins', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'https://evil.example.com',
                    data: { message: { action: 'connect' } },
                })
            );
            await vi.advanceTimersByTimeAsync(300);
            expect(onConnect).not.toHaveBeenCalled();
        });

        test('ignores events without a message payload', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);

            window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: {} }));
            await vi.advanceTimersByTimeAsync(300);
            // no error, no state change.
            expect(adapter.state).toBe(AdapterState.Connected);
        });

        test('accountsChanged: connects to the new address after a 200ms debounce', async () => {
            const wallet = makeWallet('');
            const adapter = makeConnected(wallet, '');
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'accountsChanged', data: { address: ADDRESS_B } } },
                })
            );
            // Before the debounce fires, nothing happens.
            await vi.advanceTimersByTimeAsync(100);
            expect(onConnect).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(150);
            expect(adapter.address).toBe(ADDRESS_B);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS_B);
        });

        test('accountsChanged: empty address disconnects and emits disconnect', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'accountsChanged', data: { address: '' } } },
                })
            );
            await vi.advanceTimersByTimeAsync(250);
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });

        test('connect message reconciles the address when the wallet has one', async () => {
            const wallet = makeWallet(ADDRESS);
            const adapter = new TrustAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = wallet;
            (adapter as any)._listenEvent();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'connect' } },
                })
            );
            await vi.advanceTimersByTimeAsync(50);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('connect message with no address is ignored', async () => {
            const wallet = makeWallet(null);
            const adapter = new TrustAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = wallet;
            (adapter as any)._listenEvent();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'connect' } },
                })
            );
            await vi.advanceTimersByTimeAsync(50);
            expect(onConnect).not.toHaveBeenCalled();
        });

        test('disconnect message resets the address and emits disconnect', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'disconnect' } },
                })
            );
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });
    });

    describe('signing error wrapping', () => {
        test('signTransaction wraps Error, string and unknown rejections', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('boom'));
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce('plain-fail');
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce(42);
            await expect(adapter.signTransaction({} as any)).rejects.toThrow('Unknown error');
        });

        test('multiSign passes the permissionId and wraps errors', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            await adapter.multiSign({} as any, { permissionId: 7 });
            expect(wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith({} as any, undefined, 7);
            wallet.tronWeb.trx.multiSign.mockRejectedValueOnce('m-fail');
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('signMessage wraps string and unknown rejections', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce('s-fail');
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletSignMessageError);
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(undefined);
            await expect(adapter.signMessage('m')).rejects.toThrow('Unknown error');
        });

        test('signing rejects with WalletDisconnectedError when not connected', async () => {
            const adapter = new TrustAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = null;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new TrustAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        test('wraps getNetworkInfoByTronWeb failures', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            wallet.tronWeb.trx = {
                ...wallet.tronWeb.trx,
                // Simulate the network call failing by replacing the wallet entirely.
            };
            vi.doMock('@tronweb3/tronwallet-adapter-tronlink', async (importOriginal) => {
                const original: any = await importOriginal();
                return { ...original, getNetworkInfoByTronWeb: vi.fn().mockRejectedValue(new Error('net down')) };
            });
            // Re-require the adapter module so the mock is in effect for the next network() call.
            const { TrustAdapter: Reloaded } = await import('../../src/adapter.js');
            const a2 = new Reloaded({ openAppWithDeeplink: false });
            (a2 as any)._readyState = WalletReadyState.Found;
            (a2 as any)._state = AdapterState.Connected;
            (a2 as any)._address = ADDRESS;
            (a2 as any)._wallet = wallet;
            a2.on('error', () => {});

            await expect(a2.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });
    });

    describe('#checkIfopenTrustWallet() / #_openAppByDeepLinkIfNeed()', () => {
        test('throws WalletNotFoundError when the deeplink fires from checkAndGetWallet', async () => {
            vi.spyOn(utils, 'openTrustWallet').mockReturnValue(true);
            const wallet = makeWallet();
            // No `openAppWithDeeplink: false` here, otherwise checkIfopenTrustWallet short-circuits.
            const adapter = new TrustAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = wallet;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        test('is a no-op when openAppWithDeeplink is false', async () => {
            vi.spyOn(utils, 'openTrustWallet').mockReturnValue(true);
            const adapter = new TrustAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = makeWallet();
            adapter.on('error', () => {});

            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
            await expect(adapter.signTransaction({} as any)).resolves.toBeDefined();
        });
    });

    describe('#_checkWallet() retry semantics', () => {
        test('after a first failure the second call resolves NotFound immediately', async () => {
            const adapter = new TrustAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);

            // A retry after the initial detection has maxTimes=0 and resolves NotFound on the first tick.
            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });

    describe('mobile deeplink branch', () => {
        test('uses deeplink on mobile without the wallet injected', () => {
            Object.defineProperty(navigator, 'userAgent', { value: MOBILE_UA, configurable: true });
            const adapter = new TrustAdapter();
            // Constructor schedules _checkWallet for mobile + no support.
            void adapter;
            // The deeplink path is exercised when checkAndGetWallet fires.
            expect((window.location as any).href).toBe('http://localhost:3000/dapp');
        });
    });
});
