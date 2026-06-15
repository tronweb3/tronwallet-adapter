import { MockTron, TronLinkAdapter } from './mock.js';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
Object.defineProperty(global, 'performance', {
    writable: true,
});
globalThis.window = {
    open: vi.fn(),
    location: {
        href: '',
        origin: '',
        pathname: '',
        search: '',
        hash: '',
    },
} as any;
let adapter: TronLinkAdapter;

beforeEach(() => {
    vi.useFakeTimers();
    globalThis.navigator = {} as any;
    // @ts-ignore
    globalThis.navigator.userAgent = 'Android';
    (window as any).tron = undefined;
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
    adapter = new TronLinkAdapter();
});
afterEach(() => {
    globalThis.window.location.href = '';
    (window as any).tron = undefined;
    vi.clearAllTimers();
    // vi.unstubAllGlobals();
});

describe('when on mobile device browser', () => {
    test('will open TronLink app when tron is undefined ', { timeout: 5000 }, async () => {
        (window as any).tron = undefined;
        vi.advanceTimersByTime(5000);
        try {
            await adapter.connect();
        } catch {
            //
        } finally {
            expect(window.location.href).toContain('tronlinkoutside://');
        }
    });
    test('will not open TronLink app when tron exists', { timeout: 5000 }, async () => {
        globalThis.window.tron = new MockTron();
        adapter = new TronLinkAdapter();
        vi.advanceTimersByTime(10000);
        try {
            await adapter.connect();
        } catch {
            //
        } finally {
            expect(window.location.href || '').not.toContain('tronlinkoutside://');
        }
    });
    test('config.openAppWithDeeplink should work fine', { timeout: 5000 }, async () => {
        adapter = new TronLinkAdapter({
            checkTimeout: 3000,
            openAppWithDeeplink: false,
        });
        vi.advanceTimersByTime(3000);
        try {
            await adapter.connect();
        } catch {
            //
        }
        expect(window.location.href || '').not.toContain('tronlinkoutside://');
    });
});
