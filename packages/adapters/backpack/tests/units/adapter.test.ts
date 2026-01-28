import {
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { BackpackAdapter } from '../../src/adapter.js';
import { MockBackpackProvider, installMockBackpack, uninstallMockBackpack } from './mock.js';
import { wait, CHECK_TIMEOUT } from './utils.js';

window.open = jest.fn();

beforeEach(() => {
    jest.useFakeTimers();
    uninstallMockBackpack();
});

afterEach(() => {
    jest.useRealTimers();
    uninstallMockBackpack();
});

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
        expect(adapter).toHaveProperty('network');

        expect(adapter).toHaveProperty('on');
        expect(adapter).toHaveProperty('off');
    });

    test('should accept config options', () => {
        const adapter = new BackpackAdapter({
            checkTimeout: 5000,
            openUrlWhenWalletNotFound: false,
            openAppWithDeeplink: false,
        });
        expect(adapter.config.checkTimeout).toEqual(5000);
        expect(adapter.config.openUrlWhenWalletNotFound).toEqual(false);
        expect(adapter.config.openAppWithDeeplink).toEqual(false);
    });

    test('should throw error for invalid checkTimeout', () => {
        expect(() => {
            new BackpackAdapter({ checkTimeout: 'invalid' as any });
        }).toThrow('[BackpackAdapter] config.checkTimeout should be a number');
    });
});

describe('BackpackAdapter - Wallet Detection', () => {
    test('should set state to NotFound when Backpack is not installed', async () => {
        uninstallMockBackpack();
        const adapter = new BackpackAdapter();
        expect(adapter.state).toEqual(AdapterState.Loading);
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await Promise.resolve();
        expect(adapter.state).toEqual(AdapterState.NotFound);
        expect(adapter.connected).toEqual(false);
    });

    test('should set state to Disconnect when Backpack is installed but not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);
        provider._setAddress('');
        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await Promise.resolve();
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        expect(adapter.connected).toEqual(false);
    });

    test('should set state to Connected when Backpack is already connected', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await Promise.resolve();
        expect(adapter.state).toEqual(AdapterState.Connected);
        expect(adapter.connected).toEqual(true);
        expect(adapter.address).toEqual(address);
    });
});

describe('BackpackAdapter - connect()', () => {
    test('should throw WalletNotFoundError when Backpack is not installed', async () => {
        uninstallMockBackpack();
        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await expect(adapter.connect()).rejects.toThrow(WalletNotFoundError);
    });

    test('should open wallet URL when wallet not found and openUrlWhenWalletNotFound is true', async () => {
        uninstallMockBackpack();
        const adapter = new BackpackAdapter({ openUrlWhenWalletNotFound: true });
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        try {
            await adapter.connect();
        } catch (e) {
            // Expected to throw
        }
        expect(window.open).toHaveBeenCalledWith('https://backpack.app', '_blank');
    });

    test('should throw WalletConnectionError when user rejects connection', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);
        provider.request = jest.fn().mockRejectedValue({ code: 4001, message: 'User rejected' });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await expect(adapter.connect()).rejects.toThrow(WalletConnectionError);
    });

    test('should connect successfully when user approves', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack();
        provider._setConnected(true);
        provider._setAddress(address);
        provider.request = jest.fn().mockResolvedValue([address]);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        const onConnect = jest.fn();
        adapter.on('connect', onConnect);

        await adapter.connect();

        expect(adapter.state).toEqual(AdapterState.Connected);
        expect(adapter.address).toEqual(address);
        expect(adapter.connected).toEqual(true);
        expect(onConnect).toHaveBeenCalledWith(address);
    });

    test('should not connect twice if already connected', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        const requestMock = jest.fn().mockResolvedValue([address]);
        provider.request = requestMock;

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await Promise.resolve();

        // Already connected from initialization (tron_accounts was called)
        expect(adapter.connected).toEqual(true);

        // Clear mock to track new calls
        requestMock.mockClear();

        // Try to connect again
        await adapter.connect();

        // tron_requestAccounts should not be called for second connect
        expect(requestMock).not.toHaveBeenCalledWith({ method: 'tron_requestAccounts' });
    });
});

describe('BackpackAdapter - disconnect()', () => {
    test('should disconnect successfully', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockResolvedValue([address]);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const onDisconnect = jest.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();

        expect(adapter.state).toEqual(AdapterState.Disconnect);
        expect(adapter.address).toEqual(null);
        expect(adapter.connected).toEqual(false);
        expect(onDisconnect).toHaveBeenCalled();
    });

    test('should do nothing if not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        const onDisconnect = jest.fn();
        adapter.on('disconnect', onDisconnect);

        await adapter.disconnect();

        expect(onDisconnect).not.toHaveBeenCalled();
    });
});

describe('BackpackAdapter - signMessage()', () => {
    test('should throw WalletDisconnectedError when not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        await expect(adapter.signMessage('test message')).rejects.toThrow(WalletDisconnectedError);
    });

    test('should sign message successfully when connected', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            if (args.method === 'tron_signMessage') return Promise.resolve('signed_message');
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const result = await adapter.signMessage('test message');
        expect(result).toEqual('signed_message');
    });
});

describe('BackpackAdapter - signTransaction()', () => {
    test('should throw WalletDisconnectedError when not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        await expect(adapter.signTransaction({} as any)).rejects.toThrow(WalletDisconnectedError);
    });

    test('should sign transaction successfully when connected', async () => {
        const address = 'TTestAddress123456789';
        const signedTx = { txID: 'test_tx', signature: ['sig'] };
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            if (args.method === 'tron_signTransaction') return Promise.resolve(signedTx);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const result = await adapter.signTransaction({} as any);
        expect(result).toEqual(signedTx);
    });
});

describe('BackpackAdapter - switchChain()', () => {
    test('should throw WalletDisconnectedError when not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        await expect(adapter.switchChain('0x2b6653dc')).rejects.toThrow(WalletDisconnectedError);
    });

    test('should switch chain successfully when connected', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            if (args.method === 'tron_switchChain') return Promise.resolve(null);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const onChainChanged = jest.fn();
        adapter.on('chainChanged', onChainChanged);

        await adapter.switchChain('0x2b6653dc');
        expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2b6653dc' });
    });
});

describe('BackpackAdapter - network()', () => {
    test('should throw WalletDisconnectedError when not connected', async () => {
        const provider = installMockBackpack();
        provider._setConnected(false);

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);

        await expect(adapter.network()).rejects.toThrow(WalletDisconnectedError);
    });

    test('should return network info when connected', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            if (args.method === 'tron_chainId') return Promise.resolve('0x2b6653dc');
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const network = await adapter.network();
        expect(network.chainId).toEqual('0x2b6653dc');
        expect(network.networkType).toEqual('Mainnet');
    });
});

describe('BackpackAdapter - Events', () => {
    test('should emit accountsChanged when accounts change', async () => {
        const address = 'TTestAddress123456789';
        const newAddress = 'TNewAddress987654321';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const onAccountsChanged = jest.fn();
        adapter.on('accountsChanged', onAccountsChanged);

        // Simulate accounts changed event from provider
        provider._emit('accountsChanged', [newAddress]);

        expect(onAccountsChanged).toHaveBeenCalledWith(newAddress, address);
        expect(adapter.address).toEqual(newAddress);
    });

    test('should emit disconnect when accounts become empty', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const onDisconnect = jest.fn();
        adapter.on('disconnect', onDisconnect);

        // Simulate disconnect by emitting empty accounts
        provider._emit('accountsChanged', []);

        expect(onDisconnect).toHaveBeenCalled();
        expect(adapter.state).toEqual(AdapterState.Disconnect);
    });

    test('should emit chainChanged when chain changes', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        const onChainChanged = jest.fn();
        adapter.on('chainChanged', onChainChanged);

        // Simulate chain changed event from provider
        provider._emit('chainChanged', '0x94a9059e');

        expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x94a9059e' });
    });

    test('should remove event listeners on disconnect', async () => {
        const address = 'TTestAddress123456789';
        const provider = installMockBackpack(address);
        provider._setConnected(true);
        provider.request = jest.fn().mockImplementation((args) => {
            if (args.method === 'tron_requestAccounts') return Promise.resolve([address]);
            if (args.method === 'tron_accounts') return Promise.resolve([address]);
            return Promise.reject(new Error('Unknown method'));
        });

        const adapter = new BackpackAdapter();
        jest.advanceTimersByTime(CHECK_TIMEOUT);
        await adapter.connect();

        // Verify listeners were added
        expect(provider._getListenerCount('accountsChanged')).toBeGreaterThan(0);
        expect(provider._getListenerCount('chainChanged')).toBeGreaterThan(0);

        await adapter.disconnect();

        // Verify listeners were removed
        expect(provider._getListenerCount('accountsChanged')).toEqual(0);
        expect(provider._getListenerCount('chainChanged')).toEqual(0);
    });
});
