import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTronLinkEvmProvider, TRONLINK_EVM_RDNS } from '../../src/utils.js';
import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

function makeProvider(flags: { isTronLink?: boolean } = {}): EIP1193Provider {
    return {
        isTronLink: flags.isTronLink ?? true,
        request: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    } as any;
}

describe('tronlink evm utils', () => {
    beforeEach(() => {
        // @ts-ignore
        (window as any).TronLinkEVM = undefined;
        // @ts-ignore
        window.ethereum = undefined;
    });

    afterEach(() => {
        // @ts-ignore
        (window as any).TronLinkEVM = undefined;
        // @ts-ignore
        window.ethereum = undefined;
    });

    describe('#getTronLinkEvmProvider()', () => {
        it('returns null when nothing is injected', () => {
            expect(getTronLinkEvmProvider()).toBeNull();
        });

        it('discovers window.TronLinkEVM first', () => {
            const dedicated = makeProvider();
            const injected = makeProvider();
            // @ts-ignore
            (window as any).TronLinkEVM = dedicated;
            // @ts-ignore
            window.ethereum = injected;
            expect(getTronLinkEvmProvider()).toBe(dedicated);
        });

        it('falls back to window.ethereum', () => {
            const injected = makeProvider();
            // @ts-ignore
            window.ethereum = injected;
            expect(getTronLinkEvmProvider()).toBe(injected);
        });

        it('falls back to a provider inside window.ethereum.providers', () => {
            const nested = makeProvider();
            // @ts-ignore
            window.ethereum = { isMetaMask: true, providers: [makeProvider({ isTronLink: false }), nested] };
            expect(getTronLinkEvmProvider()).toBe(nested);
        });

        it('returns null when no provider is flagged', () => {
            // @ts-ignore
            (window as any).TronLinkEVM = makeProvider({ isTronLink: false });
            // @ts-ignore
            window.ethereum = makeProvider({ isTronLink: false });
            expect(getTronLinkEvmProvider()).toBeNull();
        });
    });

    it('exports the EIP-6963 rdns constant', () => {
        expect(TRONLINK_EVM_RDNS).toBe('org.tronlink.www');
    });
});
