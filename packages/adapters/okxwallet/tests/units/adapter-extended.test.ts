import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { OkxWalletAdapter } from '../../src/index.js';
import * as utils from '../../src/utils.js';
import {
    AdapterState,
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

describe('OkxWalletAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (window as any).okxwallet = undefined;
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
        (window as any).okxwallet = undefined;
    });

    function makeConnected(wallet: any, address: string | null = ADDRESS) {
        const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = address;
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        (adapter as any)._listenEvent();
        return adapter;
    }

    describe('messageHandler wiring', () => {
        test('ignores events from other origins and without a message', async () => {
            const adapter = makeConnected(makeWallet());
            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: 'https://evil.example.com',
                    data: { message: { action: 'connect' } },
                })
            );
            window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: {} }));
            await vi.advanceTimersByTimeAsync(300);
            // No error, no state change.
            expect(adapter.state).toBe(AdapterState.Connected);
        });

        test('accountsChanged: connects to a new address after the 200ms debounce', async () => {
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
            await vi.advanceTimersByTimeAsync(250);
            expect(adapter.address).toBe(ADDRESS_B);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS_B);
        });

        test('accountsChanged: empty address disconnects and emits', async () => {
            const adapter = makeConnected(makeWallet());
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

        test('connect message reconciles when the wallet has a defaultAddress', async () => {
            const wallet = makeWallet(ADDRESS);
            const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
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
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('connect message is ignored when there is no address yet', async () => {
            const wallet = makeWallet(null);
            const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
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

        test('disconnect message clears the address and emits', async () => {
            const adapter = makeConnected(makeWallet());
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            window.dispatchEvent(
                new MessageEvent('message', {
                    origin: window.location.origin,
                    data: { message: { action: 'disconnect' } },
                })
            );
            expect(adapter.address).toBeNull();
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

        test('multiSign passes permissionId and wraps errors', async () => {
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
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = null;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#network() error paths', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        test('wraps getNetworkInfoByTronWeb failures in WalletGetNetworkError', async () => {
            vi.doMock('@tronweb3/tronwallet-adapter-tronlink', async (importOriginal) => {
                const original: any = await importOriginal();
                return { ...original, getNetworkInfoByTronWeb: vi.fn().mockRejectedValue(new Error('net down')) };
            });
            const { OkxWalletAdapter: Reloaded } = await import('../../src/adapter.js');
            const a = new Reloaded({ openAppWithDeeplink: false });
            (a as any)._readyState = WalletReadyState.Found;
            (a as any)._state = AdapterState.Connected;
            (a as any)._address = ADDRESS;
            (a as any)._wallet = makeWallet();
            a.on('error', () => {});

            await expect(a.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });
    });

    describe('deeplink branches', () => {
        test('throws WalletNotFoundError when the okx deeplink fires from checkAndGetWallet', async () => {
            vi.spyOn(utils, 'openOkxWallet').mockReturnValue(true);
            const wallet = makeWallet();
            const adapter = new OkxWalletAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = wallet;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        test('is a no-op when openAppWithDeeplink is disabled', async () => {
            vi.spyOn(utils, 'openOkxWallet').mockReturnValue(true);
            const adapter = new OkxWalletAdapter({ openAppWithDeeplink: false });
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
            const adapter = new OkxWalletAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);

            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });
});
