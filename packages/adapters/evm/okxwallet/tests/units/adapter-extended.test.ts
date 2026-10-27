import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OkxWalletEvmAdapter } from '../../src/adapter.js';
import { WalletConnectionError, WalletDisconnectedError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { OkxWalletProvider, installOkxWalletEIP6963Provider } from './okxwallet-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const ADDRESS_A = '0xabc0000000000000000000000000000000000001';

async function flushPromises() {
    for (const i of [1, 2, 3, 4]) {
        await Promise.resolve(i);
    }
}

describe('OkxWalletEvmAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;
    let locationDesc: PropertyDescriptor | undefined;
    let hrefCalls: string[];

    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.okxwallet = undefined;
        // @ts-ignore
        window.ethereum = undefined;
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
        window.okxwallet = undefined;
        // @ts-ignore
        window.ethereum = undefined;
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
        it('opens the okx deeplink on mobile and returns an empty string', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new OkxWalletEvmAdapter();
            await expect(adapter.connect()).resolves.toBe('');
            expect(hrefCalls).toHaveLength(1);
            expect(hrefCalls[0]).toContain('okx://wallet/dapp/url?dappUrl=');
        });

        it('does not use the deeplink when useDeeplink is false', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new OkxWalletEvmAdapter({ useDeeplink: false, openUrlWhenWalletNotFound: false });

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(3100);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(hrefCalls).toHaveLength(0);
        });

        it('opens the website when the provider is missing on desktop', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new OkxWalletEvmAdapter();
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
            const provider = new OkxWalletProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            const cleanup = installOkxWalletEIP6963Provider(provider);

            const adapter = new OkxWalletEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).resolves.toBe(ADDRESS_A);
            expect(adapter.address).toBe(ADDRESS_A);
            expect(adapter.connecting).toBe(false);
            cleanup();
        });

        it('rejects when no accounts are available', async () => {
            const provider = new OkxWalletProvider();
            const cleanup = installOkxWalletEIP6963Provider(provider);

            const adapter = new OkxWalletEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toThrow('No accounts is available.');
            cleanup();
        });
    });

    describe('#getProvider()', () => {
        it('returns null on mobile outside the OKX webview', async () => {
            setUserAgent(MOBILE_UA);
            const adapter = new OkxWalletEvmAdapter();
            await expect(adapter.getProvider()).resolves.toBeNull();
        });

        it('returns the injected provider on mobile inside the OKX webview', async () => {
            setUserAgent(MOBILE_UA);
            const provider = new OkxWalletProvider();
            // @ts-ignore
            window.okxwallet = provider;

            const adapter = new OkxWalletEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await expect(adapter.getProvider()).resolves.toBe(provider);
        });
    });

    describe('#signTypedData()', () => {
        it('serialises object typed data and rejects when disconnected', async () => {
            const provider = new OkxWalletProvider();
            provider.request = vi.fn(({ method, params }: any) => {
                if (method === 'eth_accounts') return Promise.resolve([ADDRESS_A]);
                if (method === 'eth_requestAccounts') return Promise.resolve([ADDRESS_A]);
                if (method === 'eth_signTypedData_v4') return Promise.resolve('typed-sig');
                return Promise.resolve(null);
            });
            const cleanup = installOkxWalletEIP6963Provider(provider);

            const adapter = new OkxWalletEvmAdapter();
            await flushPromises();
            await adapter.connect();

            const typedData = { domain: { name: 'x' }, primaryType: 'T', types: {}, message: {} } as any;
            await expect(adapter.signTypedData({ typedData })).resolves.toBe('typed-sig');
            expect(provider.request).toHaveBeenCalledWith({
                method: 'eth_signTypedData_v4',
                params: [ADDRESS_A, JSON.stringify(typedData)],
            });

            // A raw string is passed through without re-serialising.
            await expect(adapter.signTypedData({ typedData: 'raw-string' as any })).resolves.toBe('typed-sig');

            adapter.address = null;
            await expect(adapter.signTypedData({ typedData })).rejects.toBeInstanceOf(WalletDisconnectedError);
            cleanup();
        });
    });

    describe('event wiring', () => {
        it('re-emits provider events and auto-connects', async () => {
            const provider = new OkxWalletProvider();
            provider._setAccountsRes([ADDRESS_A]);
            const cleanup = installOkxWalletEIP6963Provider(provider);

            const adapter = new OkxWalletEvmAdapter();
            const onAccountsChanged = vi.fn();
            const onChainChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            adapter.on('chainChanged', onChainChanged);
            await flushPromises();

            // autoConnect restored the address from eth_accounts.
            expect(adapter.address).toBe(ADDRESS_A);

            provider.emit('chainChanged', '0x2');
            expect(onChainChanged).toHaveBeenCalledWith('0x2');

            // Base onAccountsChanged: empty list clears the address but still emits.
            provider.emit('accountsChanged', []);
            expect(adapter.address).toBeNull();
            expect(onAccountsChanged).toHaveBeenCalledWith([]);
            cleanup();
        });
    });

    describe('#isEIP6963Provider()', () => {
        it('accepts only the OKX rdns', () => {
            const adapter = new OkxWalletEvmAdapter();
            const provider = new OkxWalletProvider();
            const check = (info: any) => (adapter as any).isEIP6963Provider(provider, info);
            expect(check({ rdns: 'com.okex.wallet', name: 'OKX Wallet', uuid: 'u', icon: '' })).toBe(true);
            expect(check({ rdns: 'io.metamask', name: 'MetaMask', uuid: 'u', icon: '' })).toBe(false);
            expect(check(undefined)).toBe(false);
        });
    });

    describe('wallet api', () => {
        it('routes signMessage/switchChain/watchAsset through the provider', async () => {
            const provider = new OkxWalletProvider();
            const requestSpy = vi.fn(({ method }: { method: string }) => {
                switch (method) {
                    case 'eth_accounts':
                        return Promise.resolve([ADDRESS_A]);
                    case 'eth_requestAccounts':
                        return Promise.resolve([ADDRESS_A]);
                    case 'personal_sign':
                        return Promise.resolve('msg-sig');
                    case 'wallet_switchEthereumChain':
                        return Promise.resolve(null);
                    case 'wallet_watchAsset':
                        return Promise.resolve(true);
                    default:
                        return Promise.resolve(null);
                }
            });
            provider.request = requestSpy;
            const cleanup = installOkxWalletEIP6963Provider(provider);

            const adapter = new OkxWalletEvmAdapter();
            await flushPromises();
            await adapter.connect();

            await expect(adapter.signMessage({ message: 'hi' })).resolves.toBe('msg-sig');
            await expect(adapter.switchChain('0x1')).resolves.toBeNull();
            await expect(adapter.watchAsset({ type: 'ERC20', options: { address: '0x1' } } as any)).resolves.toBe(true);
            expect(adapter.address).toBe(ADDRESS_A);
            cleanup();
        });
    });
});
