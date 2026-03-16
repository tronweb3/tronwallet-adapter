import { describe, test, expect } from 'vitest';
import { ImTokenAdapter } from '../../src/adapter.js';

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
