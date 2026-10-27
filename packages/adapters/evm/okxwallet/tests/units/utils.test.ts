import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getOkxWalletProvider,
    isOkxWalletMobileWebView,
    openOkxWalletWithDeeplink,
    OKX_WALLET_RDNS,
} from '../../src/utils.js';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

function makeProvider(flags: { isOkxWallet?: boolean } = {}): EIP1193Provider {
    return {
        isOkxWallet: flags.isOkxWallet ?? true,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    } as any;
}

describe('okxwallet evm utils', () => {
    beforeEach(() => {
        // @ts-ignore
        window.okxwallet = undefined;
        // @ts-ignore
        window.ethereum = undefined;
    });

    afterEach(() => {
        // @ts-ignore
        window.okxwallet = undefined;
        // @ts-ignore
        window.ethereum = undefined;
    });

    describe('#getOkxWalletProvider()', () => {
        it('returns null when nothing is injected', () => {
            expect(getOkxWalletProvider()).toBeNull();
        });

        it('prefers window.okxwallet when flagged', () => {
            const dedicated = makeProvider();
            const injected = makeProvider();
            // @ts-ignore
            window.okxwallet = dedicated;
            // @ts-ignore
            window.ethereum = injected;
            expect(getOkxWalletProvider()).toBe(dedicated);
        });

        it('ignores an unflagged window.okxwallet', () => {
            // @ts-ignore
            window.okxwallet = makeProvider({ isOkxWallet: false });
            expect(getOkxWalletProvider()).toBeNull();
        });

        it('falls back to window.ethereum', () => {
            const injected = makeProvider();
            // @ts-ignore
            window.ethereum = injected;
            expect(getOkxWalletProvider()).toBe(injected);
        });

        it('falls back to a provider inside window.ethereum.providers', () => {
            const other = makeProvider({ isOkxWallet: false });
            const nested = makeProvider();
            // @ts-ignore
            window.ethereum = { isMetaMask: true, providers: [other, nested] };
            expect(getOkxWalletProvider()).toBe(nested);
        });

        it('returns null when no provider is flagged', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isOkxWallet: false });
            expect(getOkxWalletProvider()).toBeNull();
        });
    });

    describe('#isOkxWalletMobileWebView()', () => {
        it('returns false when window.okxwallet is missing', () => {
            expect(isOkxWalletMobileWebView()).toBe(false);
        });

        it('returns true when window.okxwallet is flagged', () => {
            // @ts-ignore
            window.okxwallet = makeProvider();
            expect(isOkxWalletMobileWebView()).toBe(true);
        });

        it('returns false when window.okxwallet is not flagged', () => {
            // @ts-ignore
            window.okxwallet = makeProvider({ isOkxWallet: false });
            expect(isOkxWalletMobileWebView()).toBe(false);
        });
    });

    describe('#openOkxWalletWithDeeplink()', () => {
        let hrefCalls: string[];
        let locationDesc: PropertyDescriptor | undefined;

        beforeEach(() => {
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
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: stub,
            });
        });

        afterEach(() => {
            if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
            else delete (window as any).location;
        });

        it('navigates to the okx deeplink with the dappUrl encoded', () => {
            openOkxWalletWithDeeplink();
            expect(hrefCalls).toHaveLength(1);
            expect(hrefCalls[0]).toBe('okx://wallet/dapp/url?dappUrl=http%3A%2F%2Flocalhost%3A3000%2Fdapp%3Fa%3D1');
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(OKX_WALLET_RDNS).toBe('com.okex.wallet');
    });
});
