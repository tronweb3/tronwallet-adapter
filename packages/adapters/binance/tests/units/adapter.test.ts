// @ts-ignore
import { BinanceWalletAdapter } from '../../src/index.js';
import { describe, it, expect } from 'vitest';

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
});
