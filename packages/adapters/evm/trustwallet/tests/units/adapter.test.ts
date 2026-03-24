import { WalletConnectionError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { TrustWalletEvmAdapter } from '../../src/adapter.js';
import { TrustWalletProvider, installTrustWalletProvider } from './trustwallet-provider.js';

jest.useFakeTimers();

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

describe('TrustWalletEvmAdapter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });

    test('base props should be valid when provider is unavailable', async () => {
        const adapter = new TrustWalletEvmAdapter();

        expect(adapter.name).toEqual('Trust Wallet');
        expect(adapter.url).toEqual('https://trustwallet.com');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);

        jest.advanceTimersByTime(4000);
        await flushPromises();

        expect(adapter.readyState).toEqual('NotFound');
    });

    test('should discover Trust Wallet provider via EIP-6963', async () => {
        const provider = new TrustWalletProvider();
        const cleanup = installTrustWalletProvider(provider);

        const adapter = new TrustWalletEvmAdapter();
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

        const adapter = new TrustWalletEvmAdapter();
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

        const adapter = new TrustWalletEvmAdapter();
        await flushPromises();

        expect(adapter.address).toEqual('0x123');
        expect(adapter.connected).toEqual(true);
    });

    test('connect should work fine when provider returns account list', async () => {
        const provider = new TrustWalletProvider();
        provider._setRequestAccountsRes(['0xabc']);
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustWalletEvmAdapter();
        const address = await adapter.connect();

        expect(address).toEqual('0xabc');
        expect(adapter.address).toEqual('0xabc');
    });

    test('connect should throw WalletNotFoundError when provider is unavailable', async () => {
        const adapter = new TrustWalletEvmAdapter();
        const res = adapter.connect();

        jest.advanceTimersByTime(4000);
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

        const adapter = new TrustWalletEvmAdapter();
        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
    });

    test('signTypedData should stringify typed data before requesting signature', async () => {
        const provider = new TrustWalletProvider();
        provider._setAccountsRes(['0x123']);
        provider._setSignTypedDataRes('0xsigned');
        // @ts-ignore
        window.trustwallet = { ethereum: provider };

        const adapter = new TrustWalletEvmAdapter();
        await flushPromises();

        const request = jest.spyOn(provider, 'request');
        const signature = await adapter.signTypedData({ typedData });

        expect(signature).toEqual('0xsigned');
        expect(request).toHaveBeenLastCalledWith({
            method: 'eth_signTypedData_v4',
            params: ['0x123', JSON.stringify(typedData)],
        });
    });
});
