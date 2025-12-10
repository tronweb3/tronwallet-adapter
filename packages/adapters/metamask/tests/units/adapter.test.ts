import { MetaMaskAdapter, MetaMaskAdapterName } from '../../src/adapter.js';

describe('MetaMaskAdapter', () => {
    test('should be able to instantiate the adapter', () => {
        const adapter = new MetaMaskAdapter();
        expect(adapter).toBeDefined();
        expect(adapter.name).toBe(MetaMaskAdapterName);
    });

    test('should export MetaMaskAdapterName', () => {
        expect(MetaMaskAdapterName).toBe('MetaMask');
    });
});
