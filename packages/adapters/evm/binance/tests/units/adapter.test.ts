import { BinanceEvmAdapter } from '../../src/adapter.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletConnectionError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { BinanceProvider, installBinanceEIP6963Provider } from './binance-provider.js';

// Mock @binance/w3w-utils so supportBinanceEvm() can be controlled in tests
vi.mock('@binance/w3w-utils', () => ({
    isExtensionInstalled: vi.fn(() => false),
    isInBinance: vi.fn(() => false),
    getDeepLink: vi.fn(() => ({ bnc: '' })),
}));
import { isExtensionInstalled } from '@binance/w3w-utils';

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
        vi.mocked(isExtensionInstalled).mockReturnValue(false);
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

    it('should ignore eth_accounts errors during autoConnect', async () => {
        const provider = new BinanceProvider();
        provider.request = vi.fn(({ method }) => {
            if (method === 'eth_accounts') {
                return Promise.reject(new Error('eth_accounts failed'));
            }
            if (method === 'eth_requestAccounts') {
                return Promise.resolve([] as string[]);
            }
            return Promise.resolve(null);
        });
        const cleanup = installBinanceEIP6963Provider(provider);

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(10);
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        expect(adapter.address).toEqual(null);

        cleanup();
    });

    it('should discover Binance provider via injected window.ethereum when provider.isBinance is true', async () => {
        vi.mocked(isExtensionInstalled).mockReturnValue(true);
        const provider = new BinanceProvider();
        // @ts-ignore
        window.ethereum = provider;

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(200);
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        await expect(adapter.getProvider()).resolves.toBe(provider);
    });

    it('should discover Binance provider via injected window.binancew3w.ethereum when provider.isBinance is true', async () => {
        vi.mocked(isExtensionInstalled).mockReturnValue(true);
        const provider = new BinanceProvider();
        // @ts-ignore
        window.binancew3w = { ethereum: provider };

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(200);
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        await expect(adapter.getProvider()).resolves.toBe(provider);
    });

    it('should not fallback to window.binancew3w.ethereum when isBinance is missing', async () => {
        vi.mocked(isExtensionInstalled).mockReturnValue(true);
        const provider = new BinanceProvider({ isBinance: false });
        // @ts-ignore
        window.binancew3w = { ethereum: provider };

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(3100);
        await flushPromises();

        expect(adapter.readyState).toEqual('NotFound');
    });

    it('should not fallback to window.ethereum when isBinance is missing', async () => {
        vi.mocked(isExtensionInstalled).mockReturnValue(true);
        const provider = new BinanceProvider({ isBinance: false });
        // @ts-ignore
        window.ethereum = provider;

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(3100);
        await flushPromises();

        expect(adapter.readyState).toEqual('NotFound');
    });

    it('connect should reset connecting after WalletNotFoundError', async () => {
        const adapter = new BinanceEvmAdapter();
        const res = adapter.connect();

        vi.advanceTimersByTime(3100);
        await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
        expect(adapter.connecting).toBe(false);
    });

    it('connect should reset connecting after provider rejects requestAccounts', async () => {
        vi.mocked(isExtensionInstalled).mockReturnValue(true);
        const provider = new BinanceProvider();
        provider.request = vi.fn(({ method }) => {
            if (method === 'eth_accounts') {
                return Promise.resolve([]);
            }
            if (method === 'eth_requestAccounts') {
                return Promise.reject(new Error('User rejected the request.'));
            }
            return Promise.resolve(null);
        });
        // @ts-ignore
        window.ethereum = provider;

        const adapter = new BinanceEvmAdapter();
        vi.advanceTimersByTime(200);
        await flushPromises();

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(adapter.connecting).toBe(false);
    });
});
