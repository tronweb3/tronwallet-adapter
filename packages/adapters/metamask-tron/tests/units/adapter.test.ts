import { MetaMaskAdapter } from '../../src/adapter.js';

describe('MetaMaskAdapter', () => {
    test('should be defined', () => {
        expect(MetaMaskAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new MetaMaskAdapter();
        expect(adapter.name).toEqual('MetaMask');
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
