import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getTokenPocketProvider,
    isTokenPocketMobileWebView,
    openTokenPocketWithDeeplink,
    TOKENPOCKET_RDNS,
} from '../../src/utils.js';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

function makeProvider(flags: { isTokenPocket?: boolean } = {}): EIP1193Provider {
    return {
        isTokenPocket: flags.isTokenPocket ?? true,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    } as any;
}

describe('tokenpocket evm utils', () => {
    describe('#getTokenPocketProvider()', () => {
        beforeEach(() => {
            // @ts-ignore
            window.ethereum = undefined;
            // @ts-ignore
            window.tokenpocket = undefined;
        });
        afterEach(() => {
            // @ts-ignore
            window.ethereum = undefined;
            // @ts-ignore
            window.tokenpocket = undefined;
        });

        it('returns null when nothing is injected', () => {
            expect(getTokenPocketProvider()).toBeNull();
        });

        it('prefers window.tokenpocket.ethereum when it is a TokenPocket provider', () => {
            const dedicated = makeProvider();
            const injected = makeProvider();
            // @ts-ignore
            window.tokenpocket = { ethereum: dedicated };
            // @ts-ignore
            window.ethereum = injected;
            expect(getTokenPocketProvider()).toBe(dedicated);
        });

        it('does not use window.tokenpocket.ethereum when it is not flagged as TokenPocket', () => {
            const dedicated = makeProvider({ isTokenPocket: false });
            const injected = makeProvider();
            // @ts-ignore
            window.tokenpocket = { ethereum: dedicated };
            // @ts-ignore
            window.ethereum = injected;
            expect(getTokenPocketProvider()).toBe(injected);
        });

        it('falls back to window.ethereum', () => {
            const injected = makeProvider();
            // @ts-ignore
            window.ethereum = injected;
            expect(getTokenPocketProvider()).toBe(injected);
        });

        it('falls back to a provider inside window.ethereum.providers', () => {
            const other = makeProvider({ isTokenPocket: false });
            const nested = makeProvider();
            // @ts-ignore
            window.ethereum = { isMetaMask: true, providers: [other, nested] };
            expect(getTokenPocketProvider()).toBe(nested);
        });

        it('returns null when no injected provider is flagged', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isTokenPocket: false });
            expect(getTokenPocketProvider()).toBeNull();
        });
    });

    describe('#isTokenPocketMobileWebView()', () => {
        beforeEach(() => {
            // @ts-ignore
            window.ethereum = undefined;
            // @ts-ignore
            window.tokenpocket = undefined;
        });
        afterEach(() => {
            // @ts-ignore
            window.ethereum = undefined;
            // @ts-ignore
            window.tokenpocket = undefined;
        });

        it('returns false when nothing is injected', () => {
            expect(isTokenPocketMobileWebView()).toBe(false);
        });

        it('returns true when window.ethereum is flagged', () => {
            // @ts-ignore
            window.ethereum = makeProvider();
            expect(isTokenPocketMobileWebView()).toBe(true);
        });

        it('returns true when window.tokenpocket.ethereum is flagged', () => {
            // @ts-ignore
            window.tokenpocket = { ethereum: makeProvider() };
            expect(isTokenPocketMobileWebView()).toBe(true);
        });

        it('returns false for unflagged providers', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isTokenPocket: false });
            // @ts-ignore
            window.tokenpocket = { ethereum: makeProvider({ isTokenPocket: false }) };
            expect(isTokenPocketMobileWebView()).toBe(false);
        });
    });

    describe('#openTokenPocketWithDeeplink()', () => {
        let hrefCalls: string[];
        let locationDesc: PropertyDescriptor | undefined;

        beforeEach(() => {
            hrefCalls = [];
            locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: {
                    origin: 'http://localhost:3000',
                    pathname: '/dapp',
                    search: '?a=1',
                    hash: '#top',
                    href: 'http://localhost:3000/dapp?a=1#top',
                    set href(v: string) {
                        hrefCalls.push(v);
                    },
                },
            });
        });

        afterEach(() => {
            if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
            else delete (window as any).location;
        });

        it('navigates to the tpdapp deeplink with the current URL encoded as params', () => {
            openTokenPocketWithDeeplink();
            expect(hrefCalls).toHaveLength(1);
            const link = hrefCalls[0];
            expect(link).toMatch(/^tpdapp:\/\/open\?params=/);
            const params = JSON.parse(decodeURIComponent(link.slice('tpdapp://open?params='.length)));
            expect(params).toEqual({ url: 'http://localhost:3000/dapp?a=1#top' });
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(TOKENPOCKET_RDNS).toBe('pro.tokenpocket');
    });
});
