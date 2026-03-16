import { vi, describe, test, expect } from 'vitest';
import { TronLinkEvmAdapter } from '../../src/adapter.js';

describe('TronLinkEvmAdapter', () => {
    test('base props should be valid', () => {
        vi.useFakeTimers();
        const adapter = new TronLinkEvmAdapter();
        expect(adapter.name).toEqual('TronLink');
        expect(adapter.url).toEqual('https://www.tronlink.org/');
        expect(adapter.readyState).toEqual('Loading');
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
        vi.advanceTimersByTime(4000);
        expect(adapter.readyState).toEqual('Loading');
    });
});
