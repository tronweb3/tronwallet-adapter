import {
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletSwitchChainError,
    AdapterState,
    TIP6963AnnounceProviderEventName,
    TIP6963RequestProviderEventName,
} from '@tronweb3/tronwallet-abstract-adapter';
import { TronLinkAdapter } from '../../src/index.js';
import { wait, ONE_MINUTE } from './utils.js';
import { MockTron, MockTronLink } from './mock.js';
import { waitFor } from '@testing-library/dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
const noop = () => {
    //
};

function installTIP6963Provider(provider: MockTron, options: { name?: string; rdns?: string } = {}) {
    const detail = {
        info: {
            uuid: `${options.rdns || 'com.tronlink.wallet'}-${options.name || 'TronLink'}`,
            name: options.name || 'TronLink',
            icon: '',
            rdns: options.rdns || 'com.tronlink.wallet',
        },
        provider,
    };

    const onRequestProvider = () => {
        window.dispatchEvent(
            new CustomEvent(TIP6963AnnounceProviderEventName, {
                detail,
            })
        );
    };

    window.addEventListener(TIP6963RequestProviderEventName, onRequestProvider);

    return () => {
        window.removeEventListener(TIP6963RequestProviderEventName, onRequestProvider);
    };
}

window.open = vi.fn();
beforeEach(function () {
    vi.useFakeTimers();
    vi.clearAllTimers();
    global.document = window.document;
    global.navigator = window.navigator;
    window.tronLink = undefined;
    window.tron = undefined;
    window.tronWeb = undefined;
    // @ts-ignore
});
describe('TronLinkAdapter', function () {
    describe('#adapter()', function () {
        test('constructor', () => {
            const adapter = new TronLinkAdapter();
            expect(adapter.name).toEqual('TronLink');
            expect(adapter).toHaveProperty('icon');
            expect(adapter).toHaveProperty('url');
            expect(adapter).toHaveProperty('state');
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

        test('should work fine when TronLink is not installed', async function () {
            (window as any).tronLink = undefined;
            const adapter = new TronLinkAdapter();
            expect(adapter.state).toEqual(AdapterState.Loading);
            expect(adapter.connected).toEqual(false);
            vi.advanceTimersByTime(ONE_MINUTE);
            await Promise.resolve();
            expect(adapter.state).toEqual(AdapterState.NotFound);
        });
        test('should work fine when TronLink is installed but not connected', function () {
            (window as any).tronLink = {
                ready: false,
                tronWeb: false,
                request: noop,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.connected).toEqual(false);
        });
        test('should work fine when TronLink is connected', function () {
            (window as any).tronLink = {
                ready: true,
                tronWeb: {
                    defaultAddress: { base58: 'xxx' },
                },
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.connected).toEqual(true);
            expect(adapter.address).toEqual('xxx');
        });
    });
    describe('Tron protocol for TIP1193', function () {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        test('should discover TronLink via TIP-6963 on desktop', async function () {
            const tron = new MockTron('xxx');
            tron._unlock();
            const cleanup = installTIP6963Provider(tron);

            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(50);
            await Promise.resolve();

            expect(adapter.readyState).toEqual('Found');
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual('xxx');

            cleanup();
        });
        test('should prefer TIP-6963 TronLink provider over legacy injected tron object', async function () {
            const tron = new MockTron('xxx');
            tron._unlock();
            const cleanup = installTIP6963Provider(tron);
            setTimeout(() => {
                (window as any).tron = { isTronLink: true, tronWeb: { defaultAddress: { base58: 'legacy' } } };
            }, 100);

            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(50);
            await Promise.resolve();

            expect(adapter.address).toEqual('xxx');
            expect(adapter.state).toEqual(AdapterState.Connected);

            cleanup();
        });
        test('should work fine when tron is disconnected', async function () {
            const tron = ((window as any).tron = new MockTron(''));
            tron.request = vi.fn(() => {
                return Promise.resolve(['xxx']);
            });
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            tron._unlock();
            tron._setAddress('xxx');
            await adapter.connect();
            vi.advanceTimersByTime(1000);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual('xxx');
        });
        test('should work fine when tron is connected', async function () {
            const onMethod = vi.fn();
            const removeListenerMethod = vi.fn();
            let tron: MockTron;
            (window as any).tron = tron = new MockTron('xxx');
            tron._unlock();
            tron.on = onMethod;
            tron.removeListener = removeListenerMethod;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual('xxx');
            // accountsChanged, chainChanged
            expect(onMethod).toHaveBeenCalledTimes(2);

            await adapter.disconnect();
            expect(removeListenerMethod).toHaveBeenCalled();
        });
    });
    describe('#connect()', function () {
        test('should throw error when TronLink is not installed', async function () {
            (window as any).tronLink = undefined;
            const adapter = new TronLinkAdapter({ checkTimeout: 100 });
            vi.advanceTimersByTime(200);
            await expect(adapter.connect()).rejects.toThrow(WalletNotFoundError);
        });
        test('should throw error when TronLink is locked', async function () {
            const address = 'xxxxx';
            (window as any).tronLink = {
                ready: true,
                tronWeb: {
                    defaultAddress: {
                        base58: address,
                    },
                },
                request: function () {
                    return Promise.resolve('');
                },
            };
            const connecor = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            try {
                await connecor.connect();
            } catch (e) {
                expect(e).toBeInstanceOf(WalletConnectionError);
            }
        });
        test('should throw error when user denied the connection', async function () {
            const address = 'xxxxx';
            (window as any).tronLink = {
                ready: true,
                tronWeb: {
                    defaultAddress: {
                        base58: address,
                    },
                },
                request: function () {
                    return Promise.resolve({ code: 4001 });
                },
            };
            const connecor = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            try {
                await connecor.connect();
            } catch (e) {
                expect(e).toBeInstanceOf(WalletConnectionError);
            }
        });
        test('should throw error when last connection is not completed', async function () {
            const address = 'xxxxx';
            (window as any).tronLink = {
                ready: true,
                tronWeb: {
                    defaultAddress: {
                        base58: address,
                    },
                },
                request: function () {
                    return Promise.resolve({ code: 4000 });
                },
            };
            const connecor = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            try {
                await connecor.connect();
            } catch (e) {
                expect(e).toBeInstanceOf(WalletConnectionError);
            }
        });
        test('should work fine when TronLink is installed', async function () {
            const address = 'xxxxx';
            (window as any).tronLink = {
                ready: true,
                tronWeb: {
                    defaultAddress: {
                        base58: address,
                    },
                },
                request: noop,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await adapter.connect();
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual(address);
            expect(adapter.connected).toEqual(true);
        });
    });
    describe('#signMessage()', function () {
        test('should throw Disconnected error when TronLink is not installed', async function () {
            vi.useFakeTimers();
            (window as any).tronLink = undefined;
            const adapter = new TronLinkAdapter();
            const res = adapter.signMessage('some str');
            vi.advanceTimersByTime(ONE_MINUTE);
            await expect(res).rejects.toThrow(WalletDisconnectedError);
        });
        test('should throw Disconnected error when TronLink is disconnected', async function () {
            (window as any).tronLink = {
                ready: false,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await expect(adapter.signMessage('some str')).rejects.toThrow(WalletDisconnectedError);
        });
        test('should work fine when TronLink is connected', async function () {
            const tronLink = ((window as any).tronLink = new MockTronLink('address'));
            tronLink.tronWeb.trx.signMessageV2 = () => Promise.resolve('123') as any;
            tronLink._unlock();
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            await adapter.connect();
            const signedMsg = await adapter.signMessage('some str');
            expect(signedMsg).toEqual('123');
        });
    });
    describe('#signTransaction()', function () {
        test('should throw Disconnected error when TronLink is not installed', async function () {
            (window as any).tronLink = undefined;
            const adapter = new TronLinkAdapter({ checkTimeout: 100 });
            vi.advanceTimersByTime(200);
            await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletDisconnectedError);
        });
        test('should throw Disconnected error when TronLink is disconnected', async function () {
            (window as any).tronLink = {
                ready: false,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            try {
                await adapter.signTransaction({} as any);
            } catch (e) {
                expect(e).toBeInstanceOf(WalletDisconnectedError);
            }
        });
        test('should work fine when TronLink is connected', async function () {
            vi.useFakeTimers();
            const tronLink = ((window as any).tronLink = new MockTronLink('address'));
            tronLink._unlock();
            tronLink.tronWeb.trx.sign = () => Promise.resolve('123') as any;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            await adapter.connect();
            await Promise.resolve();
            const signedTransaction = await adapter.signTransaction({} as any);
            expect(signedTransaction).toEqual('123');
        });
    });

    describe('#switchChain', function () {
        test('should throw error and open link when TronLink is not found', async function () {
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            await expect(adapter.switchChain('0x39483')).rejects.toThrow('The wallet is not found.');
            expect(window.open).toBeCalled();
        });
        test('should throw error when TronLink do not support Tron protocol', async function () {
            (window as any).tronLink = {
                ready: false,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await expect(adapter.switchChain('0x39483')).rejects.toThrowError(WalletSwitchChainError);
        });
        test('should work fine when TronLink support Tron protocol', async function () {
            (window as any).tron = new MockTron('address');
            window.tron!.request = vi.fn();
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await adapter.switchChain('0x39483');
            expect(window.tron!.request).toBeCalledTimes(1);
        });
    });
});

describe('Events should work fine', function () {
    let tron: MockTron;
    let adapter: TronLinkAdapter;
    beforeEach(() => {
        vi.useFakeTimers();
        tron = window.tron = new MockTron('address');
        tron._unlock();
        adapter = new TronLinkAdapter();
    });
    test('connect event should work fine', async () => {
        const _onConnect = vi.fn();
        tron = window.tron = new MockTron('');
        tron._unlock();
        const adapter = new TronLinkAdapter();
        adapter.on('connect', _onConnect);
        vi.advanceTimersByTime(ONE_MINUTE);
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        expect(adapter.address).toEqual(null);
        setTimeout(() => {
            tron._setAddress('address');
            tron._emit('accountsChanged', ['address']);
        }, 100);
        vi.advanceTimersByTime(3000);
        await wait();
        expect(_onConnect).toHaveBeenCalled();
    });
    describe('accountsChanged event should work fine', () => {
        let tron: MockTron;
        let adapter: TronLinkAdapter;
        beforeEach(() => {
            vi.useFakeTimers();
            tron = window.tron = new MockTron('address');
            tron._unlock();
            adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
        });
        test('when switch to a connected account', async () => {
            const _onAccountsChanged = vi.fn();
            const _onConnect = vi.fn();

            adapter.on('accountsChanged', _onAccountsChanged);
            adapter.on('connect', _onConnect);
            tron._setAddress('address2');
            tron._emit('accountsChanged', ['address2']);
            await wait();
            expect(_onAccountsChanged).toHaveBeenCalled();
            expect(_onConnect).not.toHaveBeenCalled();
        });
        test('when switch to a disconnected account', async () => {
            const _onAccountsChanged = vi.fn();
            const _onDisconnect = vi.fn();
            adapter.on('accountsChanged', _onAccountsChanged);
            adapter.on('disconnect', _onDisconnect);
            tron._setAddress('');
            tron._emit('accountsChanged', []);
            vi.advanceTimersByTime(200);
            await Promise.resolve();
            expect(_onAccountsChanged).toHaveBeenCalled();
            expect(_onDisconnect).toHaveBeenCalled();
        });
    });

    test('chainChanged event should work fine', () => {
        const _onChainChanged = vi.fn();
        adapter.on('chainChanged', _onChainChanged);
        vi.advanceTimersByTime(3000);
        tron._emit('chainChanged', { chainId: '0x2b6653dc' });
        expect(_onChainChanged).toHaveBeenCalled();
    });

    test('disconnect event should work fine', async () => {
        const _onDisconnect = vi.fn();
        const adapter = new TronLinkAdapter();
        adapter.on('disconnect', _onDisconnect);
        vi.advanceTimersByTime(3000);
        tron._setAddress('');
        tron._emit('accountsChanged', []);
        await waitFor(() => {
            expect(_onDisconnect).toHaveBeenCalled();
        });
    });

    test('empty message should work fine', () => {
        const _onDisconnect = vi.fn();
        const adapter = new TronLinkAdapter();
        adapter.on('disconnect', _onDisconnect);
        vi.advanceTimersByTime(3000);
        tron._emit('disconnect', false);
        expect(_onDisconnect).not.toHaveBeenCalled();
    });
});
