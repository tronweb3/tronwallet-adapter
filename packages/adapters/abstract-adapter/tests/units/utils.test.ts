import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertConnectAddress, checkAdapterState, isInMobileBrowser, isInBrowser } from '../../src/utils.js';
import { WalletConnectionError } from '../../src/errors.js';

describe('utils', () => {
    describe('isInBrowser()', () => {
        test('returns true in the happy-dom environment', () => {
            expect(isInBrowser()).toBe(true);
        });
    });

    describe('isInMobileBrowser()', () => {
        let realUA: PropertyDescriptor | undefined;

        afterEach(() => {
            if (realUA) Object.defineProperty(navigator, 'userAgent', realUA);
            else delete (navigator as any).userAgent;
            realUA = undefined;
        });

        function patchUA(ua: string) {
            realUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
            Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
        }

        test('matches Android, iPhone and iPad user agents', () => {
            for (const ua of [
                'Mozilla/5.0 (Linux; Android 13; Pixel 7)',
                'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
                'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
            ]) {
                patchUA(ua);
                expect(isInMobileBrowser()).toBeTruthy();
                if (realUA) Object.defineProperty(navigator, 'userAgent', realUA);
                realUA = undefined;
            }
        });

        test('returns falsy on a desktop user agent', () => {
            patchUA('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
            expect(isInMobileBrowser()).toBeFalsy();
        });
    });

    describe('assertConnectAddress()', () => {
        test('returns the address when it is a non-empty string', () => {
            expect(assertConnectAddress('TK...')).toBe('TK...');
        });

        test('throws WalletConnectionError for an empty string', () => {
            expect(() => assertConnectAddress('')).toThrow(WalletConnectionError);
        });

        test('throws WalletConnectionError for null / undefined / false', () => {
            expect(() => assertConnectAddress(null as any)).toThrow(WalletConnectionError);
            expect(() => assertConnectAddress(undefined as any)).toThrow(WalletConnectionError);
            expect(() => assertConnectAddress(false as any)).toThrow(WalletConnectionError);
        });
    });

    describe('checkAdapterState()', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
        });

        test('polls the check function every 500ms and stops once it returns true', () => {
            const states: boolean[] = [false, false, true];
            const check = vi.fn(() => states.shift() ?? true);
            checkAdapterState(check);
            // First call happens synchronously inside the function.
            expect(check).toHaveBeenCalledTimes(1);
            vi.advanceTimersByTime(500);
            expect(check).toHaveBeenCalledTimes(2);
            vi.advanceTimersByTime(500);
            expect(check).toHaveBeenCalledTimes(3);
            // After the third tick the checker returned true, so the interval is cleared.
            vi.advanceTimersByTime(2000);
            expect(check).toHaveBeenCalledTimes(3);
        });

        test('stops automatically after 60s', () => {
            const check = vi.fn().mockReturnValue(false);
            checkAdapterState(check);
            // Initial synchronous call.
            const initialCalls = check.mock.calls.length;
            vi.advanceTimersByTime(60 * 1000);
            // After 60s the dispose fires and no more calls happen.
            vi.advanceTimersByTime(60 * 1000);
            expect(check.mock.calls.length).toBe(initialCalls + 120);
        });

        test('runs the check once more on DOMContentLoaded and on window load', () => {
            const check = vi.fn().mockReturnValue(false);
            // Force the "not complete" path by stubbing document.readyState.
            const readyState = Object.getOwnPropertyDescriptor(document, 'readyState');
            Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
            const addDoc = vi.spyOn(document, 'addEventListener');
            const addWin = vi.spyOn(window, 'addEventListener');
            try {
                checkAdapterState(check);
                expect(check).toHaveBeenCalledTimes(1);
                expect(addDoc).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function), { once: true });
                expect(addWin).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
            } finally {
                if (readyState) Object.defineProperty(document, 'readyState', readyState);
                addDoc.mockRestore();
                addWin.mockRestore();
            }
        });
    });
});
