// @ts-ignore
import { BinanceWalletAdapter } from '../../src/index.js';
import { AdapterState, WalletSignTransactionError } from '@tronweb3/tronwallet-abstract-adapter';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

beforeEach(function () {
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

describe('BinanceWalletAdapter', () => {
    describe('#adapter()', function () {
        it('constructor', () => {
            const adapter = new BinanceWalletAdapter();
            expect(adapter.name).toEqual('Binance Wallet');
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

    describe('#signAndSendTransaction()', function () {
        it('throws a clear WalletSignTransactionError when connected via WalletConnect fallback', async () => {
            const adapter = new BinanceWalletAdapter();

            // Simulate a successful WalletConnect fallback connection: the main
            // adapter is Connected with a WalletConnect adapter but no provider.
            (adapter as any)._walletConnectAdapter = {};
            (adapter as any)._provider = null;
            (adapter as any)._state = AdapterState.Connected;

            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signAndSendTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            await expect(adapter.signAndSendTransaction({} as any)).rejects.toThrow(/WalletConnect fallback/);
            expect(onError).toHaveBeenCalled();
        });
    });
});
