import { vi, describe, beforeEach, test, expect } from 'vitest';
import { WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { MetaMaskEvmAdapter } from '../../src/adapter.js';
import { MetaMaskProvider } from './metamask-provider.js';

let provider: MetaMaskProvider;

beforeEach(() => {
    vi.useFakeTimers();
    provider = new MetaMaskProvider();
    (window as any).ethereum = provider;
    vi.clearAllMocks();
});
const typedData = {
    domain: {
        chainId: 1,
        name: 'Ether Mail',
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        version: '1',
    },
    primaryType: 'Mail',
    types: {
        Mail: [
            { name: 'from', type: 'string' },
            { name: 'to', type: 'string' },
            { name: 'contents', type: 'string' },
        ],
    },
    message: {
        from: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        to: '0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57',
        contents: 'Hello',
    },
};

describe('MetaMaskEvmAdapter', () => {
    test('base props should be valid', () => {
        // @ts-ignore
        (window as any).ethereum = null;
        const adapter = new MetaMaskEvmAdapter();
        expect(adapter.name).toEqual('MetaMask');
        expect(adapter.url).toEqual('https://metamask.io');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
        vi.advanceTimersByTime(4000);
        expect(adapter.readyState).toEqual('Loading');
    });

    describe('provider detection should work fine', () => {
        test('adapter should be ready when window.ethereum.isMetaMask is true', () => {
            const adapter = new MetaMaskEvmAdapter();
            expect(adapter.readyState).toEqual('Found');
        });
        test('adapter should be ready when window.ethereum.providers has MetaMaskProvider', () => {
            // @ts-ignore
            (window as any).ethereum.providers = [{}, (window as any).ethereum];
            const adapter = new MetaMaskEvmAdapter();
            expect(adapter.readyState).toEqual('Found');
        });
        test('adapter should be ready when window.ethereum is injected asynchronously', async () => {
            // @ts-ignore
            (window as any).ethereum = null;
            const cb: any = {};
            (window as any).addEventListener = function (event: string, listener: any) {
                cb[event] = listener;
            };
            const adapter = new MetaMaskEvmAdapter();
            expect(adapter.readyState).toEqual('Loading');
            setTimeout(() => {
                (window as any).ethereum = new MetaMaskProvider();
                cb['ethereum#initialized']?.();
            }, 2000);
            vi.advanceTimersByTime(3000);
            for (const i of [1, 2, 3]) {
                await Promise.resolve(i);
            }

            expect(adapter.readyState).toEqual('Found');
        });

        test.skip('adapter should be not ready when window.ethereum is undefined and is not in MetaMask app', async () => {
            (window as any).ethereum = null as any;
            const adapter = new MetaMaskEvmAdapter();
            await Promise.resolve();
            expect(adapter.readyState).toEqual('NotFound');
        });
    });

    describe('#signTypedData()', () => {
        test('should work fine', async () => {
            provider._setAccountsRes(['address']);
            const adapter = new MetaMaskEvmAdapter();
            await Promise.resolve();
            const request = vi.spyOn(provider, 'request');
            const getProvider = vi.spyOn(adapter, 'getProvider');
            await adapter.signTypedData({ typedData });
            expect(getProvider).toHaveBeenCalledTimes(1);
            expect(request).toHaveBeenLastCalledWith({
                method: 'eth_signTypedData_v4',
                params: [adapter.address, JSON.stringify(typedData)],
            });
            request.mockReset();
            request.mockRestore();
        });
        test('should throw error when ethereum.request throw error', async () => {
            provider._setAccountsRes(['address']);
            const adapter = new MetaMaskEvmAdapter();
            await Promise.resolve();
            const oldRequest = provider.request;
            const error = new Error();
            provider.request = vi.fn(() => {
                throw error;
            });
            await expect(adapter.signTypedData({ typedData })).rejects.toEqual(error);
            provider.request = oldRequest;
        });
    });

    describe('#connect()', () => {
        test('should work fine when provider.request return account list', async () => {
            provider._setRequestAccountsRes(['address']);
            const adapter = new MetaMaskEvmAdapter();
            const res = await adapter.connect();
            expect(res).toEqual('address');
        });
        test('should throw WalletNotFoundError when there is no ethereum provider', async () => {
            (window as any).ethereum = null as any;
            const adapter = new MetaMaskEvmAdapter();
            const res = adapter.connect();
            vi.advanceTimersByTime(5000);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
        });
        test('should throw WalletConnectionError when provider.request throw error', async () => {
            provider._setAccountsRes(['address']);
            const adapter = new MetaMaskEvmAdapter();
            await Promise.resolve();
            const oldRequest = provider.request;
            const error = new Error();
            provider.request = vi.fn(() => {
                throw error;
            });
            await expect(adapter.connect()).rejects.toThrow();
            provider.request = oldRequest;
        });
    });
});
