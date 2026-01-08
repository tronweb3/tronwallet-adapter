import { BackpackAdapter } from '../../src/adapter.js';

describe('BackpackAdapter', () => {
    test('should be defined', () => {
        expect(BackpackAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new BackpackAdapter();
        expect(adapter.name).toEqual('Backpack');
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
        expect(adapter).toHaveProperty('switchChain');

        expect(adapter).toHaveProperty('on');
        expect(adapter).toHaveProperty('off');
    });
});
