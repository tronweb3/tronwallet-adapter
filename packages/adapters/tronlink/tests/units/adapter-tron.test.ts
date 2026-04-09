import {
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletSignTypedDataError,
    WalletSwitchChainError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { TronWeb } from '../../src/types.js';
import { MockTron, TronLinkAdapter } from './mock.js';
import { ONE_MINUTE, wait } from './utils.js';
import { waitFor } from '@testing-library/dom';
import { describe, test, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

const noop = () => {
    //
};
const DESKTOP_TIP6963_FALLBACK_DELAY = 1100;

async function waitForDesktopDetection(delay = DESKTOP_TIP6963_FALLBACK_DELAY) {
    vi.advanceTimersByTime(delay);
    await Promise.resolve();
    await Promise.resolve();
}
let tron: MockTron;
beforeAll(() => {
    global.window.open = vi.fn() as any;
    global.document = window.document;
    global.navigator = window.navigator;
    vi.useFakeTimers();
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
            vi.advanceTimersByTime(3000);
            await Promise.resolve();
            expect(adapter.state).toEqual(AdapterState.NotFound);
        });
        test('should work fine when TronLink is installed but not connected', function () {
            window.tronLink = window.tronWeb = undefined;
            window.tron = new MockTron();
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(2000);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.connected).toEqual(false);
        });
        test('should work fine when TronLink is connected', function () {
            const tron = (window.tron = new MockTron('xxx'));
            tron._unlock();
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
            window.tron = window.tronWeb = window.tronLink = undefined;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
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
            (window as any).tron = {
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
            window.tron = window.tronWeb = window.tronLink = undefined;
            const adapter = new TronLinkAdapter();
            const res = adapter.signMessage('some str');
            vi.advanceTimersByTime(3000);
            await expect(res).rejects.toThrow(WalletDisconnectedError);
        });
        test('should throw Disconnected error when TronLink is disconnected', async function () {
            (window as any).tron = {
                ready: false,
            };
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await expect(adapter.signMessage('some str')).rejects.toThrow(WalletDisconnectedError);
        });
        test('should work fine when TronLink is connected', async function () {
            const tronLink = ((window as any).tron = new MockTron('address'));
            tronLink._unlock();
            (tronLink.tronWeb as TronWeb).trx.signMessageV2 = () => Promise.resolve('123') as any;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await adapter.connect();
            const signedMsg = await adapter.signMessage('some str');
            expect(signedMsg).toEqual('123');
        });
    });
    describe('#signTransaction()', function () {
        test('should throw Disconnected error when TronLink is not installed', async function () {
            window.tronLink = window.tron = undefined;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
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
            const tronLink = ((window as any).tron = new MockTron('address'));
            tronLink._unlock();
            (tronLink.tronWeb as TronWeb).trx.sign = () => Promise.resolve('123') as any;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await adapter.connect();
            const signedTransaction = await adapter.signTransaction({} as any);
            expect(signedTransaction).toEqual('123');
        });
    });

    describe('#switchChain', function () {
        test('should throw error and open link when TronLink is not found', async function () {
            window.tron = window.tronLink = window.tronWeb = undefined;
            const adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(3000);
            await expect(adapter.switchChain('0x39483')).rejects.toThrow('The wallet is not found.');
            expect(window.open).toBeCalled();
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

describe('when tron is not found', () => {
    let adapter: TronLinkAdapter;
    beforeEach(() => {
        window.tron = window.tronLink = window.tronWeb = undefined;
        adapter = new TronLinkAdapter();
    });
    test('readyState and state should be NotFound', async () => {
        expect(adapter.readyState).toEqual(WalletReadyState.Loading);
        expect(adapter.state).toEqual(AdapterState.Loading);
        vi.advanceTimersByTime(ONE_MINUTE);
        await Promise.resolve();
        expect(adapter.readyState).toEqual(WalletReadyState.NotFound);
        expect(adapter.state).toEqual(AdapterState.NotFound);
        expect(adapter.address).toEqual(null);
    });

    test('call connect() should throw WalletNotFoundError', async () => {
        const res = adapter.connect();
        vi.advanceTimersByTime(3000);
        await expect(res).rejects.toThrow(WalletNotFoundError);
        expect(window.open).toHaveBeenCalled();
    }, 3000);
    test('call signMessage() should throw WalletDisconnectedError', async () => {
        vi.advanceTimersByTime(ONE_MINUTE);
        await expect(adapter.signMessage('')).rejects.toThrow(WalletDisconnectedError);
    });
    test('call signTransaction() should throw WalletDisconnectedError', async () => {
        vi.advanceTimersByTime(ONE_MINUTE);
        await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletDisconnectedError);
    });
});

describe('when tronlink is locked', () => {
    describe('initial state should be find', () => {
        let adapter: TronLinkAdapter;
        let originOn: any;
        const newOn = vi.fn();
        beforeAll(() => {
            tron = new MockTron('');
            setTimeout(() => {
                window.tron = tron;
            }, 100 + Math.floor(Math.random() * 100));
            tron._lock();
            originOn = tron.on;
            tron.on = newOn;
            adapter = new TronLinkAdapter();
        });
        afterAll(() => {
            tron.on = originOn;
        });
        test('state should be Disconnect', async () => {
            expect(adapter.readyState).toEqual(WalletReadyState.Loading);
            expect(adapter.state).toEqual(AdapterState.Loading);
            vi.advanceTimersByTime(1000);
            await Promise.resolve();
            expect(adapter.readyState).toEqual(WalletReadyState.Found);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
        });
    });
    describe('when there is no connected account', () => {
        let adapter: TronLinkAdapter;
        beforeAll(() => {
            tron = new MockTron('');
            setTimeout(() => {
                window.tron = tron;
            }, 100 + Math.floor(Math.random() * 100));
            tron._lock();
            adapter = new TronLinkAdapter();
        });

        test('state should be Disconnect after unlock tronLink', () => {
            tron._unlock();
            vi.advanceTimersByTime(1000);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.address).toEqual(null);
        });
    });

    describe('when there is a connected account', () => {
        let adapter: TronLinkAdapter;
        beforeAll(() => {
            tron = new MockTron('address');
            window.tron = tron;
            adapter = new TronLinkAdapter();
        });

        // todo: TronLink should emit accountsChanged when unlock/lock
        test('state should be Connected after unlock tronLink', async () => {
            tron._unlock();
            tron._setAddress('address');
            tron._emit('accountsChanged', ['address']);
            vi.advanceTimersByTime(2000);
            await Promise.resolve();
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual('address');
        });
    });
});

describe('when tronlink is unlocked', () => {
    describe('when there is no connected account', () => {
        let adapter: TronLinkAdapter;
        beforeAll(() => {
            tron = new MockTron();
            tron._unlock();
            window.tron = undefined;
            setTimeout(() => {
                window.tron = tron;
            }, 100 + Math.floor(Math.random() * 100));
            adapter = new TronLinkAdapter();
        });

        test('initial state should be fine', async () => {
            expect(adapter.readyState).toEqual(WalletReadyState.Loading);
            expect(adapter.state).toEqual(AdapterState.Loading);
            vi.advanceTimersByTime(ONE_MINUTE);
            await Promise.resolve();
            expect(adapter.readyState).toEqual(WalletReadyState.Found);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.address).toEqual(null);
        });

        test('switch to a connected account should work fine', () => {
            const address = 'address';
            tron._setAddress(address);
            tron._emit('accountsChanged', [address]);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual(address);
        });
        test('then switch to disconnected account should work fine', () => {
            tron._setAddress('');
            tron._emit('accountsChanged', []);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.address).toEqual(null);
        });
    });
    describe('when there is a connected account', () => {
        let adapter: TronLinkAdapter;
        const address = 'address';
        beforeAll(() => {
            window.tron = tron = new MockTron(address);
            tron._unlock();
            adapter = new TronLinkAdapter();
        });
        test('initial state should be fine', async () => {
            expect(adapter.readyState).toEqual(WalletReadyState.Loading);
            expect(adapter.state).toEqual(AdapterState.Loading);
            await waitForDesktopDetection();
            expect(adapter.readyState).toEqual(WalletReadyState.Found);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual(address);
        });
        test('switch to a disconnected account should work fine', async () => {
            await waitForDesktopDetection();
            tron._setAddress('');
            tron._emit('accountsChanged', []);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.address).toEqual(null);
        });
        test('then switch to connected account should work fine', async () => {
            await waitForDesktopDetection();
            tron._setAddress(address);
            tron._emit('accountsChanged', [address]);
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual(address);
        });
    });
});

describe('events should work fine', () => {
    let adapter: TronLinkAdapter;
    beforeEach(async () => {
        window.tron = tron = new MockTron('address');
        tron._unlock();
        adapter = new TronLinkAdapter();
        await waitForDesktopDetection();
    });
    test('readyStateChanged event should work fine when tron is avaliable', async () => {
        window.tron = undefined;
        setTimeout(() => {
            window.tron = tron = new MockTron('address');
        }, 500);
        const onReadyStateChanged = vi.fn();
        const adapter = new TronLinkAdapter();
        adapter.on('readyStateChanged', onReadyStateChanged);
        vi.advanceTimersByTime(1000);
        expect(onReadyStateChanged).toHaveBeenCalledWith(WalletReadyState.Found);
    });
    test('accountsChanged event should work fine', async () => {
        const _onAccountsChanged = vi.fn();
        const _onConnect = vi.fn();
        const _onDisconnect = vi.fn();
        adapter.on('connect', _onConnect);
        adapter.on('disconnect', _onDisconnect);
        adapter.on('accountsChanged', _onAccountsChanged);
        tron._setAddress('address2');
        tron._emit('accountsChanged', ['address2']);
        await wait();
        expect(_onConnect).not.toHaveBeenCalled();
        expect(_onAccountsChanged).toHaveBeenCalledTimes(1);
        expect(_onAccountsChanged).toHaveBeenCalledWith('address2', 'address');
        expect(adapter.address).toEqual('address2');

        tron._setAddress('address3');
        tron._emit('accountsChanged', ['address3']);
        await wait();
        expect(_onAccountsChanged).toHaveBeenCalledTimes(2);
        expect(_onAccountsChanged).toHaveBeenLastCalledWith('address3', 'address2');
        expect(_onConnect).not.toHaveBeenCalled();
        expect(adapter.address).toEqual('address3');

        tron._setAddress('');
        tron._emit('accountsChanged', []);
        await wait();
        expect(adapter.address).toEqual(null);
        expect(_onAccountsChanged).toHaveBeenCalledTimes(3);
        expect(_onAccountsChanged).toHaveBeenLastCalledWith('', 'address3');
        expect(_onDisconnect).toHaveBeenCalled();
    });
    test('connect and stateChanged event should work fine', async () => {
        window.tron = tron = new MockTron('');
        tron._unlock();
        adapter = new TronLinkAdapter();
        await waitForDesktopDetection();
        const _onConnect = vi.fn();
        adapter.on('connect', _onConnect);
        tron._setAddress('address2');
        tron._emit('accountsChanged', ['address2']);
        expect(_onConnect).toHaveBeenCalledTimes(1);
        expect(_onConnect).toHaveBeenCalledWith('address2');
    });
    test('disconnect event should work fine', () => {
        tron._unlock();
        tron._setAddress('address');
        const _onDisconnect = vi.fn();
        adapter.on('disconnect', _onDisconnect);
        tron._setAddress('');
        tron._emit('accountsChanged', []);
        expect(_onDisconnect).toHaveBeenCalledTimes(1);
    });
    test('chainChanged event should work fine', () => {
        const _onChainChanged = vi.fn();
        adapter.on('chainChanged', _onChainChanged);
        tron._emit('chainChanged', '0x383884');
        expect(_onChainChanged).toHaveBeenCalledTimes(1);
    });
});

describe('methods should work fine', () => {
    let adapter: TronLinkAdapter;
    beforeEach(async () => {
        window.open = vi.fn();
        tron = new MockTron();
        window.tron = tron;
        window.tronLink = window.tronWeb = undefined;
        tron._unlock();
        adapter = new TronLinkAdapter();
        await waitForDesktopDetection();
    });
    describe('connect() should work fine', () => {
        test('when connect successfully', async () => {
            tron._unlock();
            tron._setAddress('address22');
            tron.request = () => Promise.resolve(['address22']);
            await adapter.connect();
            expect(adapter.state).toEqual(AdapterState.Connected);
            expect(adapter.address).toEqual('address22');
        });
        test('when there is no wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            const res = adapter.connect();
            vi.advanceTimersByTime(3000);
            await expect(res).rejects.toThrow(WalletNotFoundError);
            expect(window.open).toHaveBeenCalled();
        }, 5000);
        test('when there is already a pop-up window', async () => {
            tron.request = () => Promise.reject({ code: -32002, message: '' });
            const onError = vi.fn();
            adapter.on('error', onError);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            const res = adapter.connect();
            await expect(res).rejects.toThrow(WalletConnectionError);
            await expect(res).rejects.toThrow(
                'The same DApp has already initiated a request to connect to TronLink wallet, and the pop-up window has not been closed.'
            );
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when reject the request', async () => {
            tron.request = () => Promise.reject({ code: 4001, message: '' });
            const onError = vi.fn();
            adapter.on('error', onError);
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            const res = adapter.connect();
            await expect(res).rejects.toThrow(WalletConnectionError);
            await expect(res).rejects.toThrow('The user rejected connection.');
            expect(onError).toHaveBeenCalledTimes(1);
        });
    });
    describe('signMessage() should work fine', () => {
        test('when there is not wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            const onError = vi.fn();
            adapter.on('error', onError);
            vi.advanceTimersByTime(ONE_MINUTE);
            await expect(adapter.signMessage('')).rejects.toThrow(WalletDisconnectedError);
            await wait();
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when wallet is disconnected', async () => {
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signMessage('')).rejects.toThrow(WalletDisconnectedError);
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when signMessage successfully', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            adapter.on('error', onError);
            tron._setAddress('address');
            await adapter.connect();
            const signMessageV2: any = vi.fn(() => Promise.resolve('signedMessage'));
            (tron.tronWeb as TronWeb).trx.signMessageV2 = signMessageV2;

            const result = await adapter.signMessage('333');
            expect(signMessageV2).toHaveBeenCalled();
            expect(result).toBe('signedMessage');
            expect(onError).not.toHaveBeenCalled();
        });
        test('when signMessage with error', async () => {
            tron = new MockTron();
            window.tron = tron;
            tron._unlock();
            tron._setAddress('address');
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            const onError = vi.fn();
            adapter.on('error', onError);
            const signMessageV2: any = vi.fn(() => {
                return Promise.reject('signedMessage33');
            });
            (tron.tronWeb as TronWeb).trx.signMessageV2 = signMessageV2;

            await expect(adapter.signMessage('333')).rejects.toThrow('signedMessage33');
            await expect(adapter.signMessage('333')).rejects.toThrow(WalletSignMessageError);
            waitFor(() => {
                expect(onError).toHaveBeenCalled();
            });
        });
    });

    describe('signTransaction() should work fine', () => {
        test('when there is not wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletDisconnectedError);
            await wait();
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when wallet is disconnected', async () => {
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletDisconnectedError);
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when signTransaction successfully', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            adapter.on('error', onError);
            tron._setAddress('address');
            await adapter.connect();
            const sign: any = vi.fn(() => Promise.resolve('signedTransaction'));
            (tron.tronWeb as TronWeb).trx.sign = sign;

            const result = await adapter.signTransaction({} as any);
            expect(sign).toHaveBeenCalled();
            expect(result).toBe('signedTransaction');
            expect(onError).not.toHaveBeenCalled();
        });
        test('when signTransaction with error', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            tron._setAddress('address');
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            adapter.on('error', onError);
            const sign: any = vi.fn(() => Promise.reject('signedTransaction'));
            (tron.tronWeb as TronWeb).trx.sign = sign;

            await expect(adapter.signTransaction({} as any)).rejects.toThrow('signedTransaction');
            await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('multiSign() should work fine', () => {
        test('when there is not wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.multiSign({} as any)).rejects.toThrow(WalletDisconnectedError);
            await wait();
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when wallet is disconnected', async () => {
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.multiSign({} as any)).rejects.toThrow(WalletDisconnectedError);
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when multiSign successfully', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            adapter.on('error', onError);
            tron._setAddress('address');
            await adapter.connect();
            const sign: any = vi.fn(() => Promise.resolve('signedTransaction'));
            (tron.tronWeb as TronWeb).trx.multiSign = sign;

            const result = await adapter.multiSign({} as any);
            expect(sign).toHaveBeenCalledWith({}, undefined, undefined);
            expect(result).toBe('signedTransaction');
            expect(onError).not.toHaveBeenCalled();
        });
        test('when multiSign with error', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            tron._setAddress('address');
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            adapter.on('error', onError);
            const sign: any = vi.fn(() => Promise.reject('multiSign error'));
            (tron.tronWeb as TronWeb).trx.multiSign = sign;

            await expect(adapter.multiSign({} as any)).rejects.toThrow('multiSign error');
            await expect(adapter.multiSign({} as any)).rejects.toThrow(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('signTypedData() should work fine', () => {
        const mockTypedData = {
            domain: {
                name: 'Permit',
                version: '1',
                chainId: '0x2b6653dc',
                verifyingContract: 'TYukBQZ2XXCcRCReAUgS9shzbhyMCE9mhQ',
            },
            types: {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                ],
            },
            message: {
                owner: 'TYukBQZ2XXCcRCReAUgS9shzbhyMCE9mhQ',
                spender: 'TYukBQZ2XXCcRCReAUgS9shzbhyMCE9mhQ',
                value: '1000000',
            },
        };

        test('when there is no wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signTypedData(mockTypedData)).rejects.toThrow(WalletDisconnectedError);
            await wait();
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when wallet is disconnected', async () => {
            const onError = vi.fn();
            adapter.on('error', onError);
            await expect(adapter.signTypedData(mockTypedData)).rejects.toThrow(WalletDisconnectedError);
            expect(onError).toHaveBeenCalledTimes(1);
        });
        test('when signTypedData successfully', async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            adapter.on('error', onError);
            tron._setAddress('address');
            await adapter.connect();
            const _signTypedData: any = vi.fn(() => Promise.resolve('signedTypedData'));
            (tron.tronWeb as TronWeb).trx._signTypedData = _signTypedData;

            const result = await adapter.signTypedData(mockTypedData);
            expect(_signTypedData).toHaveBeenCalledWith(
                mockTypedData.domain,
                mockTypedData.types,
                mockTypedData.message
            );
            expect(result).toBe('signedTypedData');
            expect(onError).not.toHaveBeenCalled();
        });
        test('when signTypedData with error', { timeout: 1000 }, async () => {
            tron.request = () => Promise.resolve(['address']);
            const onError = vi.fn();
            tron._setAddress('address');
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            adapter.on('error', onError);
            const _signTypedData: any = vi.fn(() => Promise.reject('signTypedData error'));
            (tron.tronWeb as TronWeb).trx._signTypedData = _signTypedData;

            await expect(adapter.signTypedData(mockTypedData)).rejects.toThrow('signTypedData error');
            await expect(adapter.signTypedData(mockTypedData)).rejects.toThrow(WalletSignTypedDataError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('switchChain() should work fine', () => {
        test('when there is not wallet', async () => {
            window.tron = undefined;
            window.open = vi.fn();
            adapter = new TronLinkAdapter();
            const onError = vi.fn();
            adapter.on('error', onError);
            const res = adapter.switchChain('id');
            vi.advanceTimersByTime(ONE_MINUTE);
            await expect(res).rejects.toThrow(WalletNotFoundError);
            adapter
                .switchChain('id')
                .catch(noop)
                .finally(() => {
                    expect(window.open).toHaveBeenCalled();
                });
            await wait();
            expect(onError).toHaveBeenCalledTimes(2);
        });
        test('when switchChain successfully', async () => {
            tron.request = () => Promise.resolve(['999']);
            tron._unlock();
            tron._setAddress('xxx');
            await adapter.connect();
            await adapter.switchChain('99');
            expect(true).toBeTruthy;
        });
        test('when switchChain error', async () => {
            const onError = vi.fn();
            adapter.on('error', onError);
            vi.advanceTimersByTime(300);
            tron.request = () => Promise.resolve(['999']);
            tron._unlock();
            tron._setAddress('xxx');
            await adapter.connect();
            tron.request = () => Promise.reject({ code: 1001, message: 'errormessage' });
            const res = adapter.switchChain('id');
            await expect(res).rejects.toThrow(WalletSwitchChainError);
            await expect(res).rejects.toThrow('errormessage');
            await wait();
            expect(onError).toHaveBeenCalledTimes(1);
        });
    });

    describe('disconnect() should work fine', () => {
        test('when there is no wallet', async () => {
            window.tron = undefined;
            adapter = new TronLinkAdapter();
            const _onDisconnect = vi.fn();
            adapter.on('disconnect', _onDisconnect);
            await adapter.disconnect();
            expect(_onDisconnect).not.toHaveBeenCalled();
        });
        test('when there is window.tron', async () => {
            tron = window.tron = new MockTron('address');
            tron._unlock();
            tron.removeListener = vi.fn();
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            expect(adapter.state).toEqual(AdapterState.Connected);
            const _onDisconnect = vi.fn();
            adapter.on('disconnect', _onDisconnect);
            await adapter.disconnect();
            expect(tron.removeListener).toHaveBeenCalled();
            expect(adapter.state).toEqual(AdapterState.Disconnect);
            expect(adapter.address).toEqual(null);
            await Promise.resolve();
            expect(_onDisconnect).toHaveBeenCalled();
        });
    });
    describe('network() should work fine', () => {
        test('when there is no wallet', async () => {
            window.tron = undefined;
            window.tronLink = undefined;
            window.tronWeb = undefined;
            adapter = new TronLinkAdapter();
            vi.advanceTimersByTime(ONE_MINUTE);
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.network()).rejects.toThrow(WalletDisconnectedError);
            waitFor(() => {
                expect(onError).toHaveBeenCalled();
            });
        });
        test('when there is window.tron', async () => {
            tron = window.tron = new MockTron('address');
            tron._unlock();
            tron.removeListener = vi.fn();
            adapter = new TronLinkAdapter();
            await waitForDesktopDetection();
            expect(adapter.state).toEqual(AdapterState.Connected);
            const network = await adapter.network();
            expect(network.chainId).toEqual('0xcd8690dc');
        });
    });
});
describe('constructor config should work fine', () => {
    let adapter: TronLinkAdapter;
    beforeEach(() => {
        window.tron = tron = new MockTron('address');
        tron._unlock();
    });
    test('config.openUrlWhenWalletNotFound should work fine', async () => {
        window.tron = undefined;
        window.open = vi.fn();
        adapter = new TronLinkAdapter({
            checkTimeout: 3000,
            openUrlWhenWalletNotFound: false,
        });
        vi.advanceTimersByTime(3000);
        try {
            await adapter.connect();
        } catch {
            //
        }
        expect(window.open).not.toHaveBeenCalled();
    });
});
