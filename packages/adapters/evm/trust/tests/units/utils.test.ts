import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getTrustWalletProvider,
    isTrustWalletMobileWebView,
    openTrustWalletWithDeeplink,
    TRUST_WALLET_RDNS,
} from '../../src/utils.js';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

function makeProvider(flags: { isTrust?: boolean; isTrustWallet?: boolean } = {}): EIP1193Provider {
    return {
        isTrust: flags.isTrust ?? true,
        isTrustWallet: flags.isTrustWallet,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    } as any;
}

describe('trust evm utils', () => {
    beforeEach(() => {
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
    });

    afterEach(() => {
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        window.trustwallet = undefined;
    });

    describe('#getTrustWalletProvider()', () => {
        it('returns null when nothing is injected', () => {
            expect(getTrustWalletProvider()).toBeNull();
        });

        it('discovers a flagged window.ethereum (isTrust)', () => {
            const injected = makeProvider({ isTrust: true });
            // @ts-ignore
            window.ethereum = injected;
            expect(getTrustWalletProvider()).toBe(injected);
        });

        it('discovers a flagged window.ethereum (isTrustWallet variant)', () => {
            const injected = makeProvider({ isTrust: false, isTrustWallet: true });
            // @ts-ignore
            window.ethereum = injected;
            expect(getTrustWalletProvider()).toBe(injected);
        });

        it('discovers a provider inside window.ethereum.providers', () => {
            const nested = makeProvider();
            // @ts-ignore
            window.ethereum = { isMetaMask: true, providers: [makeProvider({ isTrust: false }), nested] };
            expect(getTrustWalletProvider()).toBe(nested);
        });

        it('falls back to window.trustwallet.ethereum when injected providers are unflagged', () => {
            const dedicated = makeProvider();
            // @ts-ignore
            window.ethereum = makeProvider({ isTrust: false });
            // @ts-ignore
            window.trustwallet = { ethereum: dedicated };
            expect(getTrustWalletProvider()).toBe(dedicated);
        });

        it('prefers the injected provider over window.trustwallet.ethereum', () => {
            const injected = makeProvider();
            const dedicated = makeProvider();
            // @ts-ignore
            window.ethereum = injected;
            // @ts-ignore
            window.trustwallet = { ethereum: dedicated };
            expect(getTrustWalletProvider()).toBe(injected);
        });

        it('returns null when nothing is flagged', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isTrust: false });
            // @ts-ignore
            window.trustwallet = { ethereum: makeProvider({ isTrust: false }) };
            expect(getTrustWalletProvider()).toBeNull();
        });
    });

    describe('#isTrustWalletMobileWebView()', () => {
        it('returns false when nothing is injected', () => {
            expect(isTrustWalletMobileWebView()).toBe(false);
        });

        it('returns true when window.ethereum is flagged', () => {
            // @ts-ignore
            window.ethereum = makeProvider();
            expect(isTrustWalletMobileWebView()).toBe(true);
        });

        it('returns true when window.trustwallet.ethereum is flagged', () => {
            // @ts-ignore
            window.trustwallet = { ethereum: makeProvider() };
            expect(isTrustWalletMobileWebView()).toBe(true);
        });
    });

    describe('#openTrustWalletWithDeeplink()', () => {
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

        it('navigates to the trustwallet deeplink with the URL encoded', () => {
            openTrustWalletWithDeeplink();
            expect(hrefCalls).toHaveLength(1);
            expect(hrefCalls[0]).toBe(
                'https://link.trustwallet.com/open_url?url=http%3A%2F%2Flocalhost%3A3000%2Fdapp%3Fa%3D1'
            );
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(TRUST_WALLET_RDNS).toBe('com.trustwallet.app');
    });
});
