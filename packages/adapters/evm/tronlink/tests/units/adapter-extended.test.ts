import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TronLinkEvmAdapter } from '../../src/adapter.js';
import { WalletConnectionError, WalletError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { TronLinkProvider, installTronLinkEIP6963Provider } from './tronlink-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const ADDRESS_A = '0xabc0000000000000000000000000000000000001';

async function flushPromises() {
    for (const i of [1, 2, 3, 4]) {
        await Promise.resolve(i);
    }
}

describe('TronLinkEvmAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;

    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        (window as any).TronLinkEVM = undefined;
        // @ts-ignore
        window.ethereum = undefined;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        // @ts-ignore
        (window as any).TronLinkEVM = undefined;
        // @ts-ignore
        window.ethereum = undefined;
        if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
        else delete (window.navigator as any).userAgent;
        realUA = undefined;
    });

    function setUserAgent(ua: string) {
        realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => ua,
        });
    }

    describe('#connect()', () => {
        it('opens the wallet website when the provider is missing', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new TronLinkEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).toHaveBeenCalledWith('https://www.tronlink.org/', '_blank');
            expect(adapter.connecting).toBe(false);
        });

        it('skips the website when openUrlWhenWalletNotFound is false', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new TronLinkEvmAdapter({ openUrlWhenWalletNotFound: false });
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('connects using the selectedAddress from the provider', async () => {
            const provider = new TronLinkProvider();
            provider.selectedAddress = ADDRESS_A;
            const cleanup = installTronLinkEIP6963Provider(provider);

            const adapter = new TronLinkEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).resolves.toBe(ADDRESS_A);
            expect(adapter.address).toBe(ADDRESS_A);
            cleanup();
        });

        it('rejects with WalletConnectionError when no account is selected', async () => {
            const provider = new TronLinkProvider();
            const cleanup = installTronLinkEIP6963Provider(provider);

            const adapter = new TronLinkEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            cleanup();
        });
    });

    describe('#getProvider()', () => {
        it('always returns null on mobile (extension only)', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new TronLinkEvmAdapter();
            await expect(adapter.getProvider()).resolves.toBeNull();
            expect(adapter.readyState).toBe('NotFound');
        });
    });

    describe('unsupported wallet api', () => {
        it('throws WalletError from signTypedData and addChain', async () => {
            const adapter = new TronLinkEvmAdapter();
            await expect(adapter.signTypedData({ typedData: {} as any })).rejects.toBeInstanceOf(WalletError);
            await expect(adapter.addChain({} as any)).rejects.toBeInstanceOf(WalletError);
        });
    });

    describe('event wiring and autoConnect', () => {
        it('re-emits chainChanged events', async () => {
            const provider = new TronLinkProvider();
            const cleanup = installTronLinkEIP6963Provider(provider);

            const adapter = new TronLinkEvmAdapter();
            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);
            await flushPromises();

            provider.emit('chainChanged', '0x2b6653dc');
            expect(onChainChanged).toHaveBeenCalledWith('0x2b6653dc');
            cleanup();
        });

        it('autoConnect restores the address from selectedAddress after 200ms', async () => {
            const provider = new TronLinkProvider();
            provider.selectedAddress = ADDRESS_A;
            const cleanup = installTronLinkEIP6963Provider(provider);

            const adapter = new TronLinkEvmAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();
            // Before the 200ms timer fires, the address is still unset.
            expect(adapter.address).toBeNull();

            await vi.advanceTimersByTimeAsync(250);
            expect(adapter.address).toBe(ADDRESS_A);
            expect(onAccountsChanged).toHaveBeenCalledWith([ADDRESS_A]);
            cleanup();
        });

        it('autoConnect keeps the address null without a selectedAddress', async () => {
            const provider = new TronLinkProvider();
            const cleanup = installTronLinkEIP6963Provider(provider);

            const adapter = new TronLinkEvmAdapter();
            await flushPromises();
            await vi.advanceTimersByTimeAsync(250);
            expect(adapter.address).toBeNull();
            cleanup();
        });
    });

    describe('#isEIP6963Provider()', () => {
        it('accepts only the TronLink rdns', () => {
            const adapter = new TronLinkEvmAdapter();
            const provider = new TronLinkProvider();
            const check = (info: any) => (adapter as any).isEIP6963Provider(provider, info);
            expect(check({ rdns: 'org.tronlink.www', name: 'TronLink', uuid: 'u', icon: '' })).toBe(true);
            expect(check({ rdns: 'io.metamask', name: 'MetaMask', uuid: 'u', icon: '' })).toBe(false);
            expect(check(undefined)).toBe(false);
        });
    });
});
