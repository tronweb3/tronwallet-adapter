import { LedgerWallet } from '../../src/LedgerWallet.js';
import { LedgerAdapter } from '../../src/adapter.js';
import type { Transaction } from '@tronweb3/tronwallet-abstract-adapter';
import {
    AdapterState,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { waitFor } from '@testing-library/dom';
import { vi, expect, beforeEach, afterEach, beforeAll, describe, test } from 'vitest';
import { createTestTransaction } from './utils.js';
vi.mock('../../src/LedgerWallet.js');
function addPropertyToLedgerWallet(prop, value) {
    LedgerWallet[prop] = value;
}

const LedgerWalletKeyValues = Object.getOwnPropertyNames(LedgerWallet)
    .filter((name) => Reflect.getOwnPropertyDescriptor(LedgerWallet, name).writable)
    .reduce((acc, name) => {
        acc[name] = LedgerWallet[name];
        return acc;
    }, {});

beforeAll(() => {
    vi.useFakeTimers();
});

let navigatorGetter;

beforeEach(() => {
    // @ts-ignore
    navigatorGetter = vi.spyOn(window, 'navigator', 'get');
    navigatorGetter.mockReturnValue({
        hid: {},
    });
});

afterEach(() => {
    Object.entries(LedgerWalletKeyValues).forEach(([k, v]) => {
        LedgerWallet[k] = v;
    });
});

describe('LedgerAdapter', () => {
    test('LedgerAdapter should be defined', () => {
        expect(LedgerAdapter).toBeDefined();
    });
});
describe('constructor()', () => {
    test('constructor() should work fine', () => {
        const adapter = new LedgerAdapter();
        expect(adapter.name).toEqual('Ledger');
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        expect(adapter.address).toEqual(null);
        expect(adapter.ledgerUtils).toHaveProperty('getAccounts');
        expect(adapter.ledgerUtils).toHaveProperty('getAddress');
    });
    test('constructor() params should pass to LedgerWallet', () => {
        const _constructor = vi.fn();
        addPropertyToLedgerWallet('_constructor', _constructor);
        const params = { accountNumber: 2 };
        new LedgerAdapter(params);
        expect(_constructor).toHaveBeenCalledWith(params);
    });
});
describe('connect()', () => {
    test('should work fine', async () => {
        const _connect = vi.fn();
        addPropertyToLedgerWallet('_connect', _connect);
        const onConnect = vi.fn();
        const onStateChanged = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('connect', onConnect);
        adapter.on('stateChanged', onStateChanged);
        const params = { account: { index: 1, address: 'address' } };
        await adapter.connect(params);
        expect(_connect).toHaveBeenCalledWith(params);
        expect(onConnect).toHaveBeenCalled();
        expect(onStateChanged).toHaveBeenCalled();
    });
    test('should throw error when connect() throw error', async () => {
        const _connect = vi.fn(async () => {
            throw new Error('connection error');
        });
        addPropertyToLedgerWallet('_connect', _connect);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        adapter.on('error', onError);
        await expect(adapter.connect()).rejects.toThrow('connection error');
        waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
    });
});
describe('disconnect()', () => {
    test('should work fine', async () => {
        const _disconnect = vi.fn();
        addPropertyToLedgerWallet('_disconnect', _disconnect);
        const onDisconnect = vi.fn();
        const onStateChanged = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('disconnect', onDisconnect);
        adapter.on('stateChanged', onStateChanged);
        expect(adapter.state).toEqual(AdapterState.Disconnect);

        await adapter.connect();
        expect(adapter.state).toEqual(AdapterState.Connected);

        await adapter.disconnect();
        expect(_disconnect).toHaveBeenCalledTimes(1);
        expect(onStateChanged).toHaveBeenCalledTimes(2);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
    test('throw error when disconnect throw error', async () => {
        const _disconnect = vi.fn(() => {
            throw new Error('disconnection error');
        });
        addPropertyToLedgerWallet('_disconnect', _disconnect);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        await adapter.connect();
        await expect(adapter.disconnect()).rejects.toThrow();
        waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
    });
});
describe('signMessage()', () => {
    test('should throw error when not connect ledger', async () => {
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        await expect(adapter.signMessage('message')).rejects.toThrow(WalletDisconnectedError);
        expect(onError).toHaveBeenCalledTimes(1);
    });
    test('should work fine', async () => {
        const _signPersonalMessage = vi.fn(() => {
            return Promise.resolve('signed message');
        });
        addPropertyToLedgerWallet('_signPersonalMessage', _signPersonalMessage);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        expect(adapter.state).toEqual(AdapterState.Disconnect);

        await adapter.connect();
        expect(adapter.state).toEqual(AdapterState.Connected);

        const res = await adapter.signMessage('message to sign');
        expect(res).toEqual('signed message');
        expect(_signPersonalMessage).toHaveBeenCalledTimes(1);
        expect(_signPersonalMessage).toHaveBeenCalledWith('message to sign');
    });

    test('should throw error when signMessage throw error', async () => {
        const _signPersonalMessage = vi.fn(() => {
            throw new Error('_signPersonalMessage error');
        });
        addPropertyToLedgerWallet('_signPersonalMessage', _signPersonalMessage);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        await adapter.connect();
        await expect(adapter.signMessage('message to sign')).rejects.toThrow(WalletSignMessageError);
        await expect(adapter.signMessage('message to sign')).rejects.toThrow('_signPersonalMessage error');
        waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
    });

    test('should convert signature suffix by default', async () => {
        const _signPersonalMessage = vi.fn(() => Promise.resolve('abcdef00'));
        addPropertyToLedgerWallet('_signPersonalMessage', _signPersonalMessage);
        const adapter = new LedgerAdapter();
        await adapter.connect();
        const res = await adapter.signMessage('msg');
        expect(res.endsWith('1b')).toBe(true);
    });

    test('should not convert signature suffix when convertSuffix is false', async () => {
        const _signPersonalMessage = vi.fn(() => Promise.resolve('abcdef01'));
        addPropertyToLedgerWallet('_signPersonalMessage', _signPersonalMessage);
        const adapter = new LedgerAdapter();
        await adapter.connect();
        const res = await adapter.signMessage('msg', { convertSuffix: false });
        expect(res.endsWith('01')).toBe(true);
    });

    test('should convert 01 to 1c when convertSuffix is true', async () => {
        const _signPersonalMessage = vi.fn(() => Promise.resolve('abcdef01'));
        addPropertyToLedgerWallet('_signPersonalMessage', _signPersonalMessage);
        const adapter = new LedgerAdapter();
        await adapter.connect();
        const res = await adapter.signMessage('msg', { convertSuffix: true });
        expect(res.endsWith('1c')).toBe(true);
    });
});

describe('signTransaction()', async () => {
    let transaction: Transaction;
    beforeEach(async () => {
        transaction = await createTestTransaction();
    });
    test('should throw error when not connect ledger', async () => {
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        await expect(adapter.signTransaction(transaction)).rejects.toThrow(WalletDisconnectedError);
        expect(onError).toHaveBeenCalledTimes(1);
    });
    test('should work fine', async () => {
        const _signTransaction = vi.fn(() => {
            return Promise.resolve('signed transaction');
        });
        addPropertyToLedgerWallet('_signTransaction', _signTransaction);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        expect(adapter.state).toEqual(AdapterState.Disconnect);

        await adapter.connect();
        expect(adapter.state).toEqual(AdapterState.Connected);

        const res = await adapter.signTransaction(transaction);
        expect(res).toEqual('signed transaction');
        expect(_signTransaction).toHaveBeenCalledTimes(1);
        expect(_signTransaction).toHaveBeenCalledWith(transaction);
    });

    test('should throw error when signTransaction throw error', async () => {
        const _signTransaction = vi.fn(() => {
            throw new Error('_signTransaction error');
        });
        addPropertyToLedgerWallet('_signTransaction', _signTransaction);
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        expect(adapter.state).toEqual(AdapterState.Disconnect);
        await adapter.connect();
        await expect(adapter.signTransaction(transaction)).rejects.toThrow(WalletSignTransactionError);
        waitFor(() => {
            expect(onError).toHaveBeenCalled();
        });
    });

    test('should use hash sign when "Too many bytes to encode" error occurs', async () => {
        const _signTransaction = vi.fn(() => {
            throw new Error('Too many bytes to encode');
        });
        const _signTransactionHash = vi.fn(() => {
            return Promise.resolve('signed by hash');
        });
        addPropertyToLedgerWallet('_signTransaction', _signTransaction);
        addPropertyToLedgerWallet('_signTransactionHash', _signTransactionHash);

        const adapter = new LedgerAdapter();
        await adapter.connect();

        const res = await adapter.signTransaction(transaction);
        expect(res).toEqual('signed by hash');
        expect(_signTransaction).toHaveBeenCalledTimes(1);
        expect(_signTransactionHash).toHaveBeenCalledTimes(1);
        expect(_signTransactionHash).toHaveBeenCalledWith(transaction);
    });

    test('should throw error when "Too many bytes to encode" occurs and fallbackToHashSign is false', async () => {
        const _signTransaction = vi.fn(() => {
            throw new Error('Too many bytes to encode');
        });
        const _signTransactionHash = vi.fn();
        addPropertyToLedgerWallet('_signTransaction', _signTransaction);
        addPropertyToLedgerWallet('_signTransactionHash', _signTransactionHash);

        const adapter = new LedgerAdapter();
        await adapter.connect();

        await expect(adapter.signTransaction(transaction, { fallbackToHashSign: false })).rejects.toThrow(
            WalletSignTransactionError
        );
        expect(_signTransaction).toHaveBeenCalledTimes(1);
        expect(_signTransactionHash).not.toHaveBeenCalled();
    });
});

describe('signTransactionHash()', async () => {
    let transaction: Transaction;
    beforeEach(async () => {
        transaction = await createTestTransaction();
    });
    test('should throw error when not connect ledger', async () => {
        const onError = vi.fn();
        const adapter = new LedgerAdapter();
        adapter.on('error', onError);
        await expect(adapter.signTransactionHash(transaction)).rejects.toThrow(WalletDisconnectedError);
        expect(onError).toHaveBeenCalledTimes(1);
    });
    test('should work fine', async () => {
        const _signTransactionHash = vi.fn(() => {
            return Promise.resolve('signed transaction hash');
        });
        addPropertyToLedgerWallet('_signTransactionHash', _signTransactionHash);
        const adapter = new LedgerAdapter();
        await adapter.connect();
        const res = await adapter.signTransactionHash(transaction);
        expect(res).toEqual('signed transaction hash');
        expect(_signTransactionHash).toHaveBeenCalledTimes(1);
        expect(_signTransactionHash).toHaveBeenCalledWith(transaction);
    });
    test('should throw error when signTransactionHash throw error', async () => {
        const _signTransactionHash = vi.fn(() => {
            throw new Error('signTransactionHash error');
        });
        addPropertyToLedgerWallet('_signTransactionHash', _signTransactionHash);
        const adapter = new LedgerAdapter();
        await adapter.connect();
        await expect(adapter.signTransactionHash(transaction)).rejects.toThrow(WalletSignTransactionError);
    });
});
