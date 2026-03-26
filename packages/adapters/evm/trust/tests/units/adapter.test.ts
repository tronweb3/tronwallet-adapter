import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { WalletConnectionError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { TrustEvmAdapter } from '../../src/adapter.js';
import { TrustWalletProvider, installTrustWalletProvider } from './trustwallet-provider.js';

vi.useFakeTimers();

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

async function flushPromises() {
    for (const i of [1, 2, 3]) {
        await Promise.resolve(i);
    }
}

async function settleProviderDetection() {
    vi.advanceTimersByTime(100);
    await flushPromises();
}

describe('TrustEvmAdapter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    test('base props should be valid when provider is unavailable', async () => {
        const adapter = new TrustEvmAdapter();

        expect(adapter.name).toEqual('Trust Wallet');
        expect(adapter.url).toEqual('https://trustwallet.com');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);

        vi.advanceTimersByTime(4000);
        await flushPromises();

        expect(adapter.readyState).toEqual('NotFound');
    });

    test('should discover Trust Wallet provider via EIP-6963', async () => {
        const provider = new TrustWalletProvider();
        const cleanup = installTrustWalletProvider(provider);

        const adapter = new TrustEvmAdapter();
        await flushPromises();

        expect(adapter.readyState).toEqual('Found');
        await expect(adapter.getProvider()).resolves.toBe(provider);

        cleanup();
    });

    test('should prefer Trust Wallet provider when multiple wallets are announced', async () => {
        const cleanupOther = installTrustWalletProvider(new TrustWalletProvider(), {
            name: 'Other Wallet',
            rdns: 'io.other.wallet',
        });
        const trustProvider = new TrustWalletProvider();
        const cleanupTrust = installTrustWalletProvider(trustProvider);

        const adapter = new TrustEvmAdapter();
        await flushPromises();

        await expect(adapter.getProvider()).resolves.toBe(trustProvider);

        cleanupOther();
        cleanupTrust();
    });

    test('should auto connect by eth_accounts', async () => {
        const provider = new TrustWalletProvider();
        provider._setAccountsRes(['0x123']);
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustEvmAdapter();
        await settleProviderDetection();

        expect(adapter.address).toEqual('0x123');
        expect(adapter.connected).toEqual(true);
    });

    test('connect should work fine when provider returns account list', async () => {
        const provider = new TrustWalletProvider();
        provider._setRequestAccountsRes(['0xabc']);
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustEvmAdapter();
        const addressPromise = adapter.connect();
        await settleProviderDetection();
        const address = await addressPromise;

        expect(address).toEqual('0xabc');
        expect(adapter.address).toEqual('0xabc');
    });

    test('connect should throw WalletNotFoundError when provider is unavailable', async () => {
        const adapter = new TrustEvmAdapter();
        const res = adapter.connect();

        vi.advanceTimersByTime(4000);
        await flushPromises();

        await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    test('connect should throw WalletConnectionError when provider rejects the request', async () => {
        const provider = new TrustWalletProvider();
        provider._setRequestAccountsError({
            name: 'ProviderRpcError',
            message: 'User rejected the request.',
            code: 4001,
        });
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustEvmAdapter();
        const connectPromise = adapter.connect();
        await settleProviderDetection();
        await expect(connectPromise).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('signTypedData should stringify typed data before requesting signature', async () => {
        const provider = new TrustWalletProvider();
        provider._setAccountsRes(['0x123']);
        provider._setSignTypedDataRes('0xsigned');
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustEvmAdapter();
        await settleProviderDetection();

        const request = vi.spyOn(provider, 'request');
        const signature = await adapter.signTypedData({ typedData });

        expect(signature).toEqual('0xsigned');
        expect(request).toHaveBeenLastCalledWith({
            method: 'eth_signTypedData_v4',
            params: ['0x123', JSON.stringify(typedData)],
        });
    });
});
