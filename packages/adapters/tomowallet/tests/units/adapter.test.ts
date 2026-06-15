import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TomoWalletAdapter, TomoWalletAdapterName } from '../../src/adapter.js';

beforeEach(function () {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
});
afterEach(function () {
    vi.unstubAllGlobals();
});

describe('TomoWalletAdapter', () => {
    test('should be defined', () => {
        expect(TomoWalletAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new TomoWalletAdapter();
        expect(adapter.name).toEqual(TomoWalletAdapterName);
        expect(adapter).toHaveProperty('icon');
        expect(adapter).toHaveProperty('url');
        expect(adapter).toHaveProperty('readyState');
        expect(adapter).toHaveProperty('address');
        expect(adapter).toHaveProperty('connecting');
        expect(adapter).toHaveProperty('connected');

        expect(adapter).toHaveProperty('connect');
        expect(adapter).toHaveProperty('disconnect');
        expect(adapter).toHaveProperty('signMessage');
        expect(adapter).toHaveProperty('signTransaction');

        expect(adapter).toHaveProperty('on');
        expect(adapter).toHaveProperty('off');
    });
});
