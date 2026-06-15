import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImTokenAdapter } from '../../src/adapter.js';

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

describe('ImTokenAdapter', () => {
    test('should be defined', () => {
        expect(ImTokenAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new ImTokenAdapter();
        expect(adapter.name).toEqual('imToken Wallet');
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
