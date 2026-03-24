import { BinanceEvmAdapter } from '../../src/adapter.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BinanceProvider, installBinanceEIP6963Provider } from './binance-provider.js';

async function flushPromises() {
    for (const i of [1, 2, 3]) {
        await Promise.resolve(i);
    }
}

describe('BinanceEvmAdapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.ethereum = null;
        // @ts-ignore
        window.binancew3w = undefined;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it('base props should be valid', () => {
        const adapter = new BinanceEvmAdapter();
        expect(adapter.name).toEqual('Binance');
        expect(adapter.url).toEqual('https://www.binance.com/en/binancewallet');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
    });

    it('should discover Binance provider via EIP-6963', async () => {
        const provider = new BinanceProvider();
        const cleanup = installBinanceEIP6963Provider(provider);

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(10);
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        await expect(adapter.getProvider()).resolves.toBe(provider);

        cleanup();
    });
});
