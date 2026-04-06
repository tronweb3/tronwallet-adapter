import { vi, describe, beforeEach, test, expect } from 'vitest';
import { WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { TronLinkEvmAdapter } from '../../src/adapter.js';
import { TronLinkProvider, installTronLinkEIP6963Provider } from './tronlink-provider.js';

async function flushPromises() {
    for (const i of [1, 2, 3]) {
        await Promise.resolve(i);
    }
}

describe('TronLinkEvmAdapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.TronLinkEVM = null;
        // @ts-ignore
        window.ethereum = null;
    });

    test('base props should be valid', () => {
        vi.useFakeTimers();
        const adapter = new TronLinkEvmAdapter();
        expect(adapter.name).toEqual('TronLink');
        expect(adapter.url).toEqual('https://www.tronlink.org/');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
        vi.advanceTimersByTime(4000);
        expect(adapter.readyState).toEqual('Loading');
    });

    test('should discover TronLink provider via EIP-6963', async () => {
        const provider = new TronLinkProvider();
        provider.selectedAddress = '0x123';
        const cleanup = installTronLinkEIP6963Provider(provider);

        const adapter = new TronLinkEvmAdapter();
        vi.advanceTimersByTime(300);
        await flushPromises();
        vi.advanceTimersByTime(300);
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        await expect(adapter.getProvider()).resolves.toBe(provider);
        expect(adapter.address).toEqual('0x123');

        cleanup();
    });

    test('connect should reset connecting after WalletNotFoundError', async () => {
        const adapter = new TronLinkEvmAdapter();
        const res = adapter.connect();

        vi.advanceTimersByTime(3100);
        await flushPromises();

        await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
        expect(adapter.connecting).toBe(false);
    });
});
