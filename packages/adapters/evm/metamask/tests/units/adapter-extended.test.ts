import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetaMaskEvmAdapter } from '../../src/adapter.js';
import { WalletConnectionError, WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { MetaMaskProvider, installMetaMaskEIP6963Provider } from './metamask-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36';
const ADDRESS_A = '0xabc0000000000000000000000000000000000001';

async function flushPromises() {
    for (const i of [1, 2, 3, 4]) {
        await Promise.resolve(i);
    }
}

describe('MetaMaskEvmAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;
    let locationDesc: PropertyDescriptor | undefined;
    let hrefCalls: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        (window as any).ReactNativeWebView = undefined;
        hrefCalls = [];
        locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
        const stub = {
            _href: 'http://localhost:3000/dapp?a=1',
            protocol: 'http:',
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
        (window as any).ReactNativeWebView = undefined;
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
        it('opens the metamask deeplink on mobile and returns an empty string', async () => {
            setUserAgent(ANDROID_UA);
            const adapter = new MetaMaskEvmAdapter();
            await expect(adapter.connect()).resolves.toBe('');
            expect(hrefCalls).toEqual(['dapp://localhost:3000/dapp?a=1']);
        });

        it('opens the https link variant on non-Android mobile', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new MetaMaskEvmAdapter();
            await expect(adapter.connect()).resolves.toBe('');
            expect(openSpy).toHaveBeenCalledTimes(1);
            expect(openSpy.mock.calls[0][0]).toContain('https://metamask.app.link/dapp/');
        });

        it('does not use the deeplink when useDeeplink is false', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new MetaMaskEvmAdapter({ useDeeplink: false, openUrlWhenWalletNotFound: false });

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first            // getProvider returns null immediately on mobile outside the webview.
            await flushPromises();
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(hrefCalls).toHaveLength(0);
        });

        it('opens the website when the provider is missing on desktop', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new MetaMaskEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).toHaveBeenCalledTimes(1);
            expect(adapter.connecting).toBe(false);
        });

        it('connects and returns the first account', async () => {
            const provider = new MetaMaskProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            const cleanup = installMetaMaskEIP6963Provider(provider);

            const adapter = new MetaMaskEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).resolves.toBe(ADDRESS_A);
            expect(adapter.address).toBe(ADDRESS_A);
            cleanup();
        });

        it('rejects when no accounts are available', async () => {
            const provider = new MetaMaskProvider();
            const cleanup = installMetaMaskEIP6963Provider(provider);

            const adapter = new MetaMaskEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            cleanup();
        });
    });

    describe('#getProvider()', () => {
        it('returns null on mobile outside the MetaMask webview', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new MetaMaskEvmAdapter();
            await expect(adapter.getProvider()).resolves.toBeNull();
        });

        it('returns the injected provider on mobile inside the MetaMask webview', async () => {
            setUserAgent('Mozilla/5.0 (iPhone) MetaMaskMobile');
            // @ts-ignore
            (window as any).ReactNativeWebView = {};
            const provider = new MetaMaskProvider();
            // @ts-ignore
            window.ethereum = provider;

            const adapter = new MetaMaskEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await expect(adapter.getProvider()).resolves.toBe(provider);
        });
    });

    describe('#signTypedData()', () => {
        it('serialises object typed data and rejects when disconnected', async () => {
            const provider = new MetaMaskProvider();
            provider.request = vi.fn(({ method, params }: any) => {
                if (method === 'eth_accounts') return Promise.resolve([ADDRESS_A]);
                if (method === 'eth_requestAccounts') return Promise.resolve([ADDRESS_A]);
                if (method === 'eth_signTypedData_v4') return Promise.resolve('typed-sig');
                return Promise.resolve(null);
            });
            const cleanup = installMetaMaskEIP6963Provider(provider);

            const adapter = new MetaMaskEvmAdapter();
            await flushPromises();
            await adapter.connect();

            const typedData = { domain: { name: 'x' }, primaryType: 'T', types: {}, message: {} } as any;
            await expect(adapter.signTypedData({ typedData })).resolves.toBe('typed-sig');
            expect(provider.request).toHaveBeenCalledWith({
                method: 'eth_signTypedData_v4',
                params: [ADDRESS_A, JSON.stringify(typedData)],
            });

            await expect(adapter.signTypedData({ typedData: 'raw' as any })).resolves.toBe('typed-sig');
            expect(provider.request).toHaveBeenLastCalledWith({
                method: 'eth_signTypedData_v4',
                params: [ADDRESS_A, 'raw'],
            });

            adapter.address = null;
            await expect(adapter.signTypedData({ typedData })).rejects.toBeInstanceOf(WalletDisconnectedError);
            cleanup();
        });
    });

    describe('event wiring', () => {
        it('re-emits provider events and auto-connects', async () => {
            const provider = new MetaMaskProvider();
            provider._setAccountsRes([ADDRESS_A]);
            const cleanup = installMetaMaskEIP6963Provider(provider);

            const adapter = new MetaMaskEvmAdapter();
            const onAccountsChanged = vi.fn();
            const onChainChanged = vi.fn();
            const onDisconnect = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            adapter.on('chainChanged', onChainChanged);
            adapter.on('disconnect', onDisconnect);
            await flushPromises();

            expect(adapter.address).toBe(ADDRESS_A);

            provider.emit('chainChanged', '0x2');
            expect(onChainChanged).toHaveBeenCalledWith('0x2');

            const err = new Error('closed');
            provider.emit('disconnect', err);
            expect(onDisconnect).toHaveBeenCalledWith(err);

            provider.emit('accountsChanged', []);
            expect(adapter.address).toBeNull();
            expect(onAccountsChanged).toHaveBeenCalledWith([]);
            cleanup();
        });
    });

    describe('#isEIP6963Provider()', () => {
        it('accepts only the MetaMask rdns', () => {
            const adapter = new MetaMaskEvmAdapter();
            const provider = new MetaMaskProvider();
            const check = (info: any) => (adapter as any).isEIP6963Provider(provider, info);
            expect(check({ rdns: 'io.metamask', name: 'MetaMask', uuid: 'u', icon: '' })).toBe(true);
            expect(check({ rdns: 'com.okex.wallet', name: 'OKX', uuid: 'u', icon: '' })).toBe(false);
            expect(check(undefined)).toBe(false);
        });
    });
});
