import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BinanceEvmAdapter } from '../../src/adapter.js';
import { WalletConnectionError, WalletError, WalletNotFoundError } from '@tronweb3/abstract-adapter-evm';
import { BinanceProvider, installBinanceEIP6963Provider } from './binance-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const ADDRESS_A = '0xabc0000000000000000000000000000000000001';

async function flushPromises() {
    for (const i of [1, 2, 3, 4]) {
        await Promise.resolve(i);
    }
}

describe('BinanceEvmAdapter - extended', () => {
    let realUA: PropertyDescriptor | undefined;

    beforeEach(() => {
        vi.useFakeTimers();
        // @ts-ignore
        window.ethereum = null;
        // @ts-ignore
        window.binancew3w = undefined;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        // @ts-ignore
        window.ethereum = null;
        // @ts-ignore
        window.binancew3w = undefined;
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
        it('opens the deeplink and returns an empty string on mobile without the wallet', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

            const adapter = new BinanceEvmAdapter();
            await expect(adapter.connect()).resolves.toBe('');
            expect(adapter.connecting).toBe(false);
            expect(openSpy).toHaveBeenCalledTimes(1);
            expect((openSpy.mock.calls[0][0] as string).startsWith('bnc://app.binance.com/mp/app')).toBe(true);
        });

        it('does not open the deeplink on mobile when useDeeplink is false', async () => {
            setUserAgent(MOBILE_UA);
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

            const adapter = new BinanceEvmAdapter({ useDeeplink: false, openUrlWhenWalletNotFound: false });
            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first            // Drive the 3s detection window under fake timers.
            await vi.advanceTimersByTimeAsync(3100);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('opens the wallet website when the provider is missing on desktop', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new BinanceEvmAdapter();
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first            // The retry detection has a 0ms grace window.
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).toHaveBeenCalledWith('https://www.binance.com/en/binancewallet', '_blank');
            expect(adapter.connecting).toBe(false);
        });

        it('skips opening the website when openUrlWhenWalletNotFound is false', async () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            const adapter = new BinanceEvmAdapter({ openUrlWhenWalletNotFound: false });
            await vi.advanceTimersByTimeAsync(3100);
            await flushPromises();

            const res = adapter.connect();
            res.catch(() => {}); // attach no-op handler so the rejection is observed even when async timer advance fires first
            await vi.advanceTimersByTimeAsync(10);
            await expect(res).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('connects and emits accountsChanged when accounts are returned', async () => {
            const provider = new BinanceProvider();
            provider._setRequestAccountsRes([ADDRESS_A]);
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();

            await expect(adapter.connect()).resolves.toBe(ADDRESS_A);
            expect(adapter.address).toBe(ADDRESS_A);
            expect(adapter.connected).toBe(true);
            expect(adapter.connecting).toBe(false);
            cleanup();
        });

        it('rejects with WalletConnectionError when no accounts are available', async () => {
            const provider = new BinanceProvider();
            provider._setRequestAccountsRes([]);
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect(adapter.connecting).toBe(false);
            cleanup();
        });

        it('wraps a requestAccounts rejection in WalletConnectionError', async () => {
            const provider = new BinanceProvider();
            provider.request = vi.fn(({ method }) => {
                if (method === 'eth_requestAccounts') {
                    return Promise.reject(new Error('user closed the popup'));
                }
                return Promise.resolve(null);
            });
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            await flushPromises();

            await expect(adapter.connect()).rejects.toThrow('Connection error: user closed the popup');
            cleanup();
        });
    });

    describe('#addChain()', () => {
        it('always throws because the wallet does not support it', async () => {
            const adapter = new BinanceEvmAdapter();
            await expect(adapter.addChain({} as any)).rejects.toBeInstanceOf(WalletError);
        });
    });

    describe('#isEIP6963Provider()', () => {
        it('accepts only the Binance rdns', () => {
            const adapter = new BinanceEvmAdapter();
            const provider = new BinanceProvider();
            const check = (info: any) => (adapter as any).isEIP6963Provider(provider, info);

            expect(check({ rdns: 'com.binance.wallet', name: 'Binance Wallet', uuid: 'u', icon: '' })).toBe(true);
            expect(check({ rdns: 'io.metamask', name: 'MetaMask', uuid: 'u', icon: '' })).toBe(false);
            expect(check(undefined)).toBe(false);
            expect(check({ name: 'Binance Wallet', uuid: 'u', icon: '' })).toBe(false);
        });
    });

    describe('event wiring (listenEvents / onAccountsChanged / autoConnect)', () => {
        it('re-emits provider events on the adapter', async () => {
            const provider = new BinanceProvider();
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            const onConnect = vi.fn();
            const onDisconnect = vi.fn();
            const onChainChanged = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('connect', onConnect);
            adapter.on('disconnect', onDisconnect);
            adapter.on('chainChanged', onChainChanged);
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();

            const connectInfo = { chainId: '0x1' };
            provider.emit('connect', connectInfo);
            expect(onConnect).toHaveBeenCalledWith(connectInfo);

            const disconnectError = new Error('boom');
            provider.emit('disconnect', disconnectError);
            expect(onDisconnect).toHaveBeenCalledWith(disconnectError);

            provider.emit('chainChanged', '0x2b6653dc');
            expect(onChainChanged).toHaveBeenCalledWith('0x2b6653dc');

            // onAccountsChanged: empty array clears the address but still emits.
            adapter.address = ADDRESS_A;
            provider.emit('accountsChanged', []);
            expect(adapter.address).toBeNull();
            expect(onAccountsChanged).toHaveBeenCalledWith([]);

            provider.emit('accountsChanged', [ADDRESS_A]);
            expect(adapter.address).toBe(ADDRESS_A);
            cleanup();
        });

        it('autoConnect restores the address from eth_accounts', async () => {
            const provider = new BinanceProvider();
            provider._setAccountsRes([ADDRESS_A]);
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            const onAccountsChanged = vi.fn();
            adapter.on('accountsChanged', onAccountsChanged);
            await flushPromises();

            expect(adapter.address).toBe(ADDRESS_A);
            expect(onAccountsChanged).toHaveBeenCalledWith([ADDRESS_A]);
            expect(adapter.readyState).toBe('Found');
            cleanup();
        });

        it('autoConnect leaves the address null when eth_accounts is empty', async () => {
            const provider = new BinanceProvider();
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            await flushPromises();

            expect(adapter.address).toBeNull();
            expect(adapter.connected).toBe(false);
            cleanup();
        });
    });

    describe('#signMessage() / #switchChain() / #watchAsset()', () => {
        it('routes wallet-api calls through the provider', async () => {
            const provider = new BinanceProvider();
            const requestSpy = vi.fn(({ method }: { method: string }) => {
                switch (method) {
                    case 'eth_accounts':
                        return Promise.resolve([ADDRESS_A]);
                    case 'personal_sign':
                        return Promise.resolve('sig');
                    case 'wallet_switchEthereumChain':
                        return Promise.resolve(null);
                    case 'wallet_watchAsset':
                        return Promise.resolve(true);
                    default:
                        return Promise.resolve(null);
                }
            });
            provider.request = requestSpy;
            const cleanup = installBinanceEIP6963Provider(provider);

            const adapter = new BinanceEvmAdapter();
            await flushPromises();

            await expect(adapter.signMessage({ message: 'hello' })).resolves.toBe('sig');
            expect(requestSpy).toHaveBeenCalledWith({ method: 'personal_sign', params: ['hello', ADDRESS_A] });

            await expect(adapter.switchChain('0x2b6653dc')).resolves.toBeNull();
            await expect(adapter.watchAsset({ type: 'ERC20', options: { address: '0x1' } } as any)).resolves.toBe(true);
            cleanup();
        });
    });
});
