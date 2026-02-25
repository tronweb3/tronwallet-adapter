import { BinanceEvmAdapter } from '../../src/adapter.js';
import { describe, it, expect } from 'vitest';

describe('BinanceEvmAdapter', () => {
    it('base props should be valid', () => {
        const adapter = new BinanceEvmAdapter();
        expect(adapter.name).toEqual('Binance');
        expect(adapter.url).toEqual('https://www.binance.com/en/binancewallet');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
    });
});
