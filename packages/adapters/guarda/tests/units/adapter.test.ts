import { GuardaAdapter } from '../../src/adapter';

describe('GuardaAdapter', () => {
    test('should be defined', () => {
        expect(GuardaAdapter).not.toBeNull();
    });
    test('#constructor() should work fine', () => {
        const adapter = new GuardaAdapter();
        expect(adapter.name).toEqual('Guarda');
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