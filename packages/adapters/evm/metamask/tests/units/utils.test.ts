import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getMetaMaskProvider,
    isMetaMaskMobileWebView,
    openMetaMaskWithDeeplink,
    METAMASK_RDNS,
} from '../../src/utils.js';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

function makeProvider(flags: { isMetaMask?: boolean; overrideIsMetaMask?: boolean } = {}): EIP1193Provider {
    return {
        isMetaMask: flags.isMetaMask ?? true,
        overrideIsMetaMask: flags.overrideIsMetaMask,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    } as any;
}

const MOBILE_ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

describe('metamask evm utils', () => {
    let realUA: PropertyDescriptor | undefined;

    beforeEach(() => {
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        (window as any).ReactNativeWebView = undefined;
    });

    afterEach(() => {
        if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
        else delete (window.navigator as any).userAgent;
        realUA = undefined;
        vi.restoreAllMocks();
        // @ts-ignore
        window.ethereum = undefined;
        // @ts-ignore
        (window as any).ReactNativeWebView = undefined;
    });

    function setUserAgent(ua: string) {
        realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => ua,
        });
    }

    describe('#getMetaMaskProvider()', () => {
        it('returns null when window.ethereum is missing', () => {
            expect(getMetaMaskProvider()).toBeNull();
        });

        it('returns window.ethereum when isMetaMask is true', () => {
            const injected = makeProvider();
            // @ts-ignore
            window.ethereum = injected;
            expect(getMetaMaskProvider()).toBe(injected);
        });

        it('returns null when window.ethereum is unflagged and has no providers array', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isMetaMask: false });
            expect(getMetaMaskProvider()).toBeNull();
        });

        it('returns null when window.ethereum has overrideIsMetaMask set', () => {
            // @ts-ignore
            window.ethereum = makeProvider({ isMetaMask: true, overrideIsMetaMask: true });
            expect(getMetaMaskProvider()).toBeNull();
        });

        it('discovers a provider inside window.ethereum.providers', () => {
            const nested = makeProvider();
            // @ts-ignore
            window.ethereum = { isMetaMask: false, providers: [makeProvider({ isMetaMask: false }), nested] };
            expect(getMetaMaskProvider()).toBe(nested);
        });

        it('skips providers with overrideIsMetaMask inside the providers array', () => {
            const nested = makeProvider({ isMetaMask: true, overrideIsMetaMask: true });
            // @ts-ignore
            window.ethereum = { isMetaMask: false, providers: [nested] };
            expect(getMetaMaskProvider()).toBeNull();
        });
    });

    describe('#isMetaMaskMobileWebView()', () => {
        it('returns false when ReactNativeWebView is not injected', () => {
            setUserAgent('Mozilla/5.0 ... MetaMaskMobile');
            expect(isMetaMaskMobileWebView()).toBe(false);
        });

        it('returns false when the UA does not end with MetaMaskMobile', () => {
            // @ts-ignore
            (window as any).ReactNativeWebView = {};
            setUserAgent(DESKTOP_UA);
            expect(isMetaMaskMobileWebView()).toBe(false);
        });

        it('returns true when ReactNativeWebView is injected and UA ends with MetaMaskMobile', () => {
            // @ts-ignore
            (window as any).ReactNativeWebView = {};
            setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) MetaMaskMobile');
            expect(isMetaMaskMobileWebView()).toBe(true);
        });
    });

    describe('#openMetaMaskWithDeeplink()', () => {
        let hrefCalls: string[];
        let openSpy: ReturnType<typeof vi.fn>;
        let locationDesc: PropertyDescriptor | undefined;

        beforeEach(() => {
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
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: stub,
            });
            openSpy = vi.fn();
            vi.spyOn(window, 'open').mockImplementation(openSpy as any);
        });

        afterEach(() => {
            if (locationDesc) Object.defineProperty(window, 'location', locationDesc);
            else delete (window as any).location;
        });

        it('navigates to the dapp:// link on Android mobile', () => {
            setUserAgent(MOBILE_ANDROID_UA);
            openMetaMaskWithDeeplink();
            expect(hrefCalls).toEqual(['dapp://localhost:3000/dapp?a=1']);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('opens the metamask.app.link URL on other platforms', () => {
            setUserAgent(DESKTOP_UA);
            openMetaMaskWithDeeplink();
            expect(hrefCalls).toHaveLength(0);
            expect(openSpy).toHaveBeenCalledTimes(1);
            expect(openSpy.mock.calls[0][0]).toBe('https://metamask.app.link/dapp/localhost:3000/dapp?a=1');
            expect(openSpy.mock.calls[0][1]).toBe('_blank');
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(METAMASK_RDNS).toBe('io.metamask');
    });
});
