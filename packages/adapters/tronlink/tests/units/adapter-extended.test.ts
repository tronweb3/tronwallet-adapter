import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TronLinkAdapter } from '../../src/index.js';
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
        isTronLink: true,
        tronWeb: {
            defaultAddress: address ? { base58: address } : null,
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
            },
        },
        on: vi.fn(),
        removeListener: vi.fn(),
        request: vi.fn().mockResolvedValue(undefined),
        ready: true,
    };
}

describe('TronLinkAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (window as any).tronLink = undefined;
        (window as any).tron = undefined;
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
        (window as any).tronLink = undefined;
        (window as any).tron = undefined;
    });

    function makeConnected(wallet: any = makeWallet()) {
        const adapter = new TronLinkAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        (adapter as any)._listenTronEvent();
        return adapter;
    }

    describe('wallet event handlers', () => {
        test('accountsChanged: connects to the new address', () => {
            const wallet = makeWallet('');
            const adapter = new TronLinkAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = wallet;
            (adapter as any)._address = null;
            (adapter as any)._listenTronEvent();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            // Find the accountsChanged callback the adapter registered.
            const cb = wallet.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            expect(cb).toBeTypeOf('function');
            wallet.tronWeb.defaultAddress = { base58: ADDRESS_B };
            cb();
            expect(adapter.address).toBe(ADDRESS_B);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS_B);
        });

        test('accountsChanged: empty defaultAddress disconnects', () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            wallet.tronWeb.defaultAddress = null;
            const cb = wallet.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            cb();
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });

        test('chainChanged: re-emits the chain event', () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);

            const cb = wallet.on.mock.calls.find((c: any[]) => c[0] === 'chainChanged')?.[1];
            cb({ chainId: '0x2' });
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2' });
        });
    });

    describe('signing error wrapping', () => {
        test('signTransaction wraps Error/string/unknown rejections', async () => {
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
            const adapter = new TronLinkAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = null;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new TronLinkAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        test('wraps getNetworkInfoByTronWeb failures in WalletGetNetworkError', async () => {
            vi.doMock('@metamask/multichain-api-client', () => ({}));
            vi.doMock('../../src/utils.js', async (importOriginal) => {
                const original: any = await importOriginal();
                return { ...original, getNetworkInfoByTronWeb: vi.fn().mockRejectedValue(new Error('net down')) };
            });
            const { TronLinkAdapter: Reloaded } = await import('../../src/adapter.js');
            const adapter = new Reloaded({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = makeWallet();
            adapter.on('error', () => {});

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });
    });

    describe('deeplink branches', () => {
        test('throws WalletNotFoundError when the deeplink fires from checkAndGetWallet', async () => {
            vi.spyOn(utils, 'openTronLink').mockReturnValue(true);
            const adapter = new TronLinkAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = makeWallet();
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        test('is a no-op when openAppWithDeeplink is disabled', async () => {
            vi.spyOn(utils, 'openTronLink').mockReturnValue(true);
            const adapter = new TronLinkAdapter({ openAppWithDeeplink: false });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = makeWallet();
            adapter.on('error', () => {});

            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
            await expect(adapter.signTransaction({} as any)).resolves.toBeDefined();
        });
    });

    describe('#_checkWallet() legacy fallback', () => {
        test('on desktop, when nothing announces, the legacy detection runs after the timeout', async () => {
            const adapter = new TronLinkAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            // No wallet present, falls back to legacy detection which finds nothing.
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
        });
    });
});
