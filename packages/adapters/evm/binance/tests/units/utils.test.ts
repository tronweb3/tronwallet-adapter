import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supportBinanceEvm, getBinanceEvmProvider, openBinanceWithDeeplink, BINANCE_RDNS } from '../../src/utils.js';
import { BinanceProvider } from './binance-provider.js';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

describe('binance evm utils', () => {
    let realUA: PropertyDescriptor | undefined;
    let openSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // @ts-ignore
        window.ethereum = null;
        // @ts-ignore
        window.binancew3w = undefined;
        openSpy = vi.fn();
        vi.spyOn(window, 'open').mockImplementation(openSpy as any);
    });

    afterEach(() => {
        if (realUA) Object.defineProperty(window.navigator, 'userAgent', realUA);
        else delete (window.navigator as any).userAgent;
        realUA = undefined;
        vi.restoreAllMocks();
        // @ts-ignore
        window.ethereum = null;
        // @ts-ignore
        window.binancew3w = undefined;
    });

    function setUserAgent(ua: string) {
        realUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            get: () => ua,
        });
    }

    describe('#supportBinanceEvm()', () => {
        it('returns false when nothing is injected', () => {
            expect(supportBinanceEvm()).toBe(false);
        });

        it('returns true when window.ethereum.isBinance is true', () => {
            // @ts-ignore
            window.ethereum = new BinanceProvider();
            expect(supportBinanceEvm()).toBe(true);
        });

        it('returns false when window.ethereum.isBinance is false', () => {
            // @ts-ignore
            window.ethereum = new BinanceProvider({ isBinance: false });
            expect(supportBinanceEvm()).toBe(false);
        });

        it('returns true when window.binancew3w.isExtension is true', () => {
            // @ts-ignore
            window.binancew3w = { isExtension: true };
            expect(supportBinanceEvm()).toBe(true);
        });
    });

    describe('#getBinanceEvmProvider()', () => {
        it('returns null when unsupported', () => {
            expect(getBinanceEvmProvider()).toBeNull();
        });

        it('discovers the provider from window.binancew3w.ethereum', () => {
            const provider = new BinanceProvider();
            // @ts-ignore
            window.binancew3w = { isExtension: true, ethereum: provider };
            expect(getBinanceEvmProvider()).toBe(provider);
        });

        it('discovers the provider from window.ethereum', () => {
            const provider = new BinanceProvider();
            // @ts-ignore
            window.ethereum = provider;
            expect(getBinanceEvmProvider()).toBe(provider);
        });

        it('discovers the provider from window.ethereum.providers array', () => {
            const other = new BinanceProvider({ isBinance: false });
            const provider = new BinanceProvider();
            // Extension flag makes supportBinanceEvm() true; window.ethereum itself is
            // not a Binance provider, but one of its EIP-5792 providers is.
            // @ts-ignore
            window.binancew3w = { isExtension: true };
            // @ts-ignore
            window.ethereum = { isMetaMask: true, providers: [other, provider] };
            expect(getBinanceEvmProvider()).toBe(provider);
        });

        it('prefers window.binancew3w.ethereum over window.ethereum', () => {
            const injected = new BinanceProvider();
            const dedicated = new BinanceProvider();
            // @ts-ignore
            window.ethereum = injected;
            // @ts-ignore
            window.binancew3w = { isExtension: true, ethereum: dedicated };
            expect(getBinanceEvmProvider()).toBe(dedicated);
        });

        it('returns null when no provider has isBinance', () => {
            // @ts-ignore
            window.binancew3w = { isExtension: true, ethereum: new BinanceProvider({ isBinance: false }) };
            // @ts-ignore
            window.ethereum = new BinanceProvider({ isBinance: false });
            expect(getBinanceEvmProvider()).toBeNull();
        });
    });

    describe('#openBinanceWithDeeplink()', () => {
        it('opens the bnc deeplink on mobile when the wallet is not supported', () => {
            setUserAgent(MOBILE_UA);
            expect(supportBinanceEvm()).toBe(false);

            const out = openBinanceWithDeeplink();
            expect(out).toBe(false);
            expect(openSpy).toHaveBeenCalledTimes(1);
            const link = openSpy.mock.calls[0][0] as string;
            expect(link).toContain('bnc://app.binance.com/mp/app');
            expect(link).toContain('appId=yFK5FCqYprrXDiVFbhyRx7');
            expect(link).toContain('startPagePath=');
            expect(link).toContain('startPageQuery=');
            // defaultChainId=14 is encoded in the base64 query
            expect(window.atob(extractQueryParam(link, 'startPageQuery'))).toContain('defaultChainId=14');
        });

        it('does nothing on mobile when the wallet is already supported', () => {
            setUserAgent(MOBILE_UA);
            // @ts-ignore
            window.ethereum = new BinanceProvider();

            const out = openBinanceWithDeeplink();
            expect(out).toBe(false);
            expect(openSpy).not.toHaveBeenCalled();
        });

        it('does nothing on desktop even when unsupported', () => {
            setUserAgent(DESKTOP_UA);
            const out = openBinanceWithDeeplink();
            expect(out).toBe(false);
            expect(openSpy).not.toHaveBeenCalled();
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(BINANCE_RDNS).toBe('com.binance.wallet');
    });
});

function extractQueryParam(link: string, key: string): string {
    const match = link.match(new RegExp(`[?&]${key}=([^&]*)`));
    if (!match) throw new Error(`param ${key} not found in ${link}`);
    return match[1];
}
