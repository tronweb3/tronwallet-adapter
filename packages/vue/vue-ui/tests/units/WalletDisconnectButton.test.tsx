import { MockTronLink } from './MockTronLink.js';
import { WalletDisconnectButton } from '../../src/WalletDisconnectButton.js';
import { h, nextTick } from 'vue';
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils';
import { vi, beforeEach, describe, test, expect } from 'vitest';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';

import { Providers, NoAutoConnectProviders } from './TestProviders.js';
const makeSut = (props: any = {}) => {
    const { adapters = [new TronLinkAdapter({ checkTimeout: 0 })], autoConnect, ...buttonProps } = props;
    return mount(Providers, {
        props: { adapters, autoConnect },
        slots: {
            default: () => h(WalletDisconnectButton, buttonProps),
        },
    });
};
const makeSutNoAutoConnect = (props: any = {}) => {
    const { adapters = [new TronLinkAdapter({ checkTimeout: 0 })], ...buttonProps } = props;
    return mount(NoAutoConnectProviders, {
        props: { adapters },
        slots: {
            default: () => h(WalletDisconnectButton, buttonProps),
        },
    });
};
let container: VueWrapper;
function getByTestId(id: string) {
    return container?.get(`[data-testid="${id}"]`);
}

async function flushView(ms: number) {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await nextTick();
    await Promise.resolve();
    await nextTick();
}

beforeEach(() => {
    localStorage.clear();
    window.tronLink = new MockTronLink();
    window.tronWeb = window.tronLink.tronWeb;
});
describe('basic usage', () => {
    test('should work fine with basic usage', () => {
        container = makeSut({
            className: 'test-class-name',
            tabIndex: 20,
            style: { borderColor: 'red' },
        });
        const button = container.get('button');
        expect(button).not.toBeNull();
        // class change will influence style
        expect(button?.classes().includes('adapter-vue-button')).toBe(true);
        expect(button?.classes().includes('test-class-name')).toBe(true);
        expect(button?.attributes('tabindex')).toBe('20');
        expect(button?.attributes('style')).toContain('border-color: red');
        expect(button?.attributes('disabled')).toBe('');
        expect(button?.text()).toEqual('Disconnect Wallet');
    });
});

describe('when no wallet is selected', () => {
    test('should be disabled', async () => {
        container = makeSut();
        expect(getByTestId('wallet-disconnect-button').attributes('disabled')).toBe('');
        expect(getByTestId('wallet-disconnect-button').text()).toContain('Disconnect Wallet');
    });
});

describe('when a wallet is seleted', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.setItem('tronAdapterName', '"TronLink"');
    });
    describe('when tronlink is avaliable', () => {
        test('should auto connect and not be disabled when antoConnect enabled', async () => {
            container = makeSut({});
            await flushView(4000);
            const el = getByTestId('wallet-disconnect-button');
            expect(el).not.toBeNull();
            expect(el.attributes('disabled')).toBe('');
            expect(el.text()).toContain('Disconnect');
        });
        test('tronlink is connected when antoConnect disabled', async () => {
            container = makeSutNoAutoConnect({});
            await flushView(3000);
            const el = getByTestId('wallet-disconnect-button');
            expect(el).not.toBeNull();
            expect(el.attributes('disabled')).toBe('');
            expect(el.text()).toContain('Disconnect');
        });
    });

    describe('when tronlink is not avaliable', () => {
        beforeEach(() => {
            window.tronLink = undefined;
            window.tronWeb = undefined;
        });
        test('should be disabled with autoConnect enabled', async () => {
            container = makeSut();
            expect(getByTestId('wallet-disconnect-button').attributes('disabled')).toBe('');
            expect(getByTestId('wallet-disconnect-button').text()).toContain('Disconnect');
        });
        test('should be disabled with autoConnect disabled', async () => {
            container = makeSutNoAutoConnect();
            expect(getByTestId('wallet-disconnect-button').attributes('disabled')).toBe('');
            expect(getByTestId('wallet-disconnect-button').text()).toContain('Disconnect');
        });
    });
});
