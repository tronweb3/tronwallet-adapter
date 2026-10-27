import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BitKeepAdapter } from '../../src/adapter.js';
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
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';

function makeWallet(address: string = ADDRESS) {
    return {
        tron: {
            ready: true,
            on: vi.fn(),
            removeListener: vi.fn(),
            request: vi.fn().mockResolvedValue(undefined),
        },
        tronWeb: {
            defaultAddress: { base58: address },
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
                multiSign: vi.fn().mockResolvedValue({ signature: 'multi-sig' }),
            },
        },
    };
}

describe('BitKeepAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (window as any).tronLink = undefined;
        (window as any).isBitKeep = undefined;
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
        (window as any).isBitKeep = undefined;
    });

    function makeConnected(wallet: any = makeWallet()) {
        const adapter = new BitKeepAdapter({ openAppWithDeeplink: false });
        (adapter as any)._readyState = WalletReadyState.Found;
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._address = ADDRESS;
        (adapter as any)._wallet = wallet;
        adapter.on('error', () => {});
        return adapter;
    }

    describe('signing error wrapping', () => {
        test('signTransaction wraps Error and non-Error rejections', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce(new Error('boom'));
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce('plain-fail');
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            wallet.tronWeb.trx.sign.mockRejectedValueOnce({ custom: true });
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('multiSign passes permissionId and wraps errors', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            await adapter.multiSign({} as any, { permissionId: 7 });
            expect(wallet.tronWeb.trx.multiSign).toHaveBeenCalledWith({} as any, undefined, 7);
            wallet.tronWeb.trx.multiSign.mockRejectedValueOnce(new Error('m-fail'));
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('signMessage wraps Error and non-Error rejections', async () => {
            const wallet = makeWallet();
            const adapter = makeConnected(wallet);
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce(new Error('m-fail'));
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletSignMessageError);
            wallet.tronWeb.trx.signMessageV2.mockRejectedValueOnce('plain');
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletSignMessageError);
        });

        test('signing rejects with WalletDisconnectedError when not connected', async () => {
            const adapter = new BitKeepAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._wallet = null;
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#network()', () => {
        test('throws WalletDisconnectedError when not connected', async () => {
            const adapter = new BitKeepAdapter();
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
            const { BitKeepAdapter: Reloaded } = await import('../../src/adapter.js');
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
        test('throws WalletNotFoundError when the bitget deeplink fires', async () => {
            vi.spyOn(utils, 'openBitgetWallet').mockReturnValue(true);
            const adapter = new BitKeepAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._wallet = makeWallet();
            adapter.on('error', () => {});

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletNotFoundError);
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        test('is a no-op when openAppWithDeeplink is disabled', async () => {
            vi.spyOn(utils, 'openBitgetWallet').mockReturnValue(true);
            const adapter = new BitKeepAdapter({ openAppWithDeeplink: false });
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
        test('after a first failure the second call resolves immediately', async () => {
            const adapter = new BitKeepAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);

            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });
});
