import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrustEvmAdapter } from '../../src/adapter.js';
import { WalletConnectionError, WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { TrustWalletProvider, installTrustWalletProvider } from './trustwallet-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const ADDRESS_A = '0xabc0000000000000000000000000000000000001';

async function flushPromises() {
    for (const i of [1, 2, 3, 4]) {
        await Promise.resolve(i);
    }
}

describe('TrustEvmAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;
    let locationDesc: PropertyDescriptor | undefined;
    let hrefCalls: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
        hrefCalls = [];
        locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
        const stub = {
            _href: 'http://localhost:3000/dapp?a=1',
            get href() {
                return this._href;
            },
            set href(v: string) {
                this._href = v;
                hrefCalls.push(v);
            },
        };
        Object.defineProperty(window, 'location', { configurable: true, value: stub });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
        if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
        else delete (window as any).location;
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
        it('opens the trust deeplink on mobile and returns an empty string', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new TrustEvmAdapter();
            await expect(adapter.connect()).resolves.toBe('');
            expect(hrefCalls).toHaveLength(1);
            expect(hrefCalls[0]).toContain('https://link.trustwallet.com/open_url?url=');
        });

        it('does not use the deeplink when useDeeplink is false', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new TrustEvmAdapter({ useDeeplink: false, openUrlWhenWalletNotFound: false });

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(3100);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(hrefCalls).toHaveLength(0);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('opens the website when the provider is missing on desktop', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new TrustEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).toHaveBeenCalledWith('https://trustwallet.com', '_blank');
            expect(adapter.connecting).toBe(false);
        });

        it('connects and returns the first account', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();

            await expect(adapter.connect()).resolves.toBe(ADDRESS_A);
            expect(adapter.address).toBe(ADDRESS_A);
            expect(adapter.connecting).toBe(false);
            cleanup();
        });

        it('rejects with WalletConnectionError when no accounts are available', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsRes([]);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toThrow('No accounts is available.');
            cleanup();
        });

        it('wraps a requestAccounts rejection with its message', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsError({ code: 4001, message: 'User rejected' } as any);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            cleanup();
        });

        it('falls back to a generic message for rejection without one', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsError({ code: 4001 } as any);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toThrow('Connection error.');
            cleanup();
        });
    });

    describe('#getProvider()', () => {
        it('returns null on mobile when not inside the Trust webview', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new TrustEvmAdapter();
            await expect(adapter.getProvider()).resolves.toBeNull();
        });

        it('returns the injected provider on mobile inside the Trust webview', async () => {
            setUserAgent(MOBILE_UA);
            const provider = new TrustWalletProvider();
            // @ts-ignore
            window.ethereum = provider;

            const adapter = new TrustEvmAdapter();
            // The base detection polls the injected provider every 100ms.
            await vi.advanceTimersByTimeAsync(150);
            await expect(adapter.getProvider()).resolves.toBe(provider);
        });
    });

    describe('#switchChain()', () => {
        it('re-emits chainChanged after the switch resolves', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);
            await flushPromises();

            await expect(adapter.switchChain('0x2b6653dc')).resolves.toBeNull();
            expect(onChainChanged).toHaveBeenCalledWith('0x2b6653dc');
            cleanup();
        });
    });

    describe('#signTypedData()', () => {
        it('serialises the typed data and requests a signature', async () => {
            const provider = new TrustWalletProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            provider._setSignTypedDataRes('typed-sig');
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            await flushPromises();

            const typedData = { domain: { name: 'x' }, primaryType: 'T', types: {}, message: {} } as any;
            // signTypedData requires a connected adapter.
            await adapter.connect();
            await expect(adapter.signTypedData({ typedData })).resolves.toBe('typed-sig');
            // When the address is cleared (disconnected), it rejects before touching the provider.
            adapter.address = null;
            await expect(adapter.signTypedData({ typedData })).rejects.toBeInstanceOf(WalletDisconnectedError);
            cleanup();
        });
    });

    describe('event wiring', () => {
        it('re-emits provider events and clears the address on disconnect', async () => {
            const provider = new TrustWalletProvider();
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            const onConnect = vi.fn();
            const onDisconnect = vi.fn();
            const onChainChanged = vi.fn();
            adapter.on('connect', onConnect);
            adapter.on('disconnect', onDisconnect);
            adapter.on('chainChanged', onChainChanged);
            await flushPromises();

            const connectInfo = { chainId: '0x1' };
            provider.emit('connect', connectInfo);
            expect(onConnect).toHaveBeenCalledWith(connectInfo);

            adapter.address = ADDRESS_A;
            const err = new Error('closed');
            provider.emit('disconnect', err);
            expect(onDisconnect).toHaveBeenCalledWith(err);
            expect(adapter.address).toBeNull();

            provider.emit('chainChanged', '0x2');
            expect(onChainChanged).toHaveBeenCalledWith('0x2');
            cleanup();
        });

        it('autoConnect restores the address when accounts exist', async () => {
            const provider = new TrustWalletProvider();
            provider._setAccountsRes([ADDRESS_A]);
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();

            expect(adapter.address).toBe(ADDRESS_A);
            expect(onAccountsChanged).toHaveBeenCalledWith([ADDRESS_A]);
            cleanup();
        });

        it('autoConnect leaves the address null on empty accounts', async () => {
            const provider = new TrustWalletProvider();
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            await flushPromises();
            expect(adapter.address).toBeNull();
            cleanup();
        });

        it('autoConnect clears the address when eth_accounts throws', async () => {
            const provider = new TrustWalletProvider();
            provider.request = vi.fn(({ method }) =>
                method === 'eth_accounts' ? Promise.reject(new Error('rpc down')) : Promise.resolve(null)
            );
            const cleanup = installTrustWalletProvider(provider);

            const adapter = new TrustEvmAdapter();
            adapter.address = ADDRESS_A;
            await flushPromises();
            expect(adapter.address).toBeNull();
            cleanup();
        });
    });

    describe('#isEIP6963Provider()', () => {
        it('accepts only the Trust rdns', () => {
            const adapter = new TrustEvmAdapter();
            const provider = new TrustWalletProvider();
            const check = (info: any) => (adapter as any).isEIP6963Provider(provider, info);
            expect(check({ rdns: 'com.trustwallet.app', name: 'Trust', uuid: 'u', icon: '' })).toBe(true);
            expect(check({ rdns: 'io.metamask', name: 'MetaMask', uuid: 'u', icon: '' })).toBe(false);
            expect(check(undefined)).toBe(false);
        });
    });
});
