import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterState, WalletConnectionError, WalletDisconnectionError } from '@tronweb3/tronwallet-abstract-adapter';
import {
    WalletWindowClosedError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { WalletConnectAdapter } from '../../src/adapter.js';
import type { WalletConnectAdapterConfig } from '../../src/adapter.js';

const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
const ADDR_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

const baseConfig = (): WalletConnectAdapterConfig => ({ network: 'Nile', options: { projectId: 'test' } } as any);

/** Stand-in for walletconnect-tron's wallet, so the lazy import inside connect() never runs. */
function makeWallet(address: string = ADDR_A) {
    const handlers: Record<string, (...args: any[]) => void> = {};
    return {
        connect: vi.fn(async () => ({ address })),
        disconnect: vi.fn(async () => undefined),
        signMessage: vi.fn(),
        signTransaction: vi.fn(),
        checkConnectStatus: vi.fn(async () => ({ address: ADDR_A })),
        on: vi.fn((event: string, handler: any) => (handlers[event] = handler)),
        off: vi.fn((event: string, handler: any) => {
            if (handlers[event] === handler) delete handlers[event];
        }),
        /** Fire an event the way the underlying wallet would. */
        fire: (event: string, ...args: any[]) => handlers[event]?.(...args),
    };
}

function makeAdapter(wallet: ReturnType<typeof makeWallet>, config: WalletConnectAdapterConfig = baseConfig()) {
    const adapter = new WalletConnectAdapter(config);
    (adapter as any)._wallet = wallet;
    adapter.on('error', () => {});
    return adapter;
}

/** Subscribe the way a dapp would, so we can assert what it actually learns. */
function spyEvents(adapter: WalletConnectAdapter) {
    const events = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        accountsChanged: vi.fn(),
        stateChanged: vi.fn(),
    };
    Object.entries(events).forEach(([name, fn]) => adapter.on(name as any, fn));
    return events;
}

async function connected() {
    const wallet = makeWallet();
    const adapter = makeAdapter(wallet);
    await adapter.connect();
    return { wallet, adapter, events: spyEvents(adapter) };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// =================================================================
// constructor validation
// =================================================================

describe('WalletConnectAdapter — constructor', () => {
    it('throws when config is null', () => {
        expect(() => new WalletConnectAdapter(null as any)).toThrow(/config is required/);
    });

    it('throws when config is undefined', () => {
        expect(() => new WalletConnectAdapter(undefined as any)).toThrow(/config is required/);
    });

    it('throws when config is a primitive (string)', () => {
        expect(() => new WalletConnectAdapter('hello' as any)).toThrow(/config is required/);
    });

    it('throws when config.options is missing', () => {
        expect(() => new WalletConnectAdapter({ network: 'Nile' } as any)).toThrow(/config\.options is required/);
    });

    it('defaults config.network to "Nile" and logs console.error when network missing', () => {
        const adapter = new WalletConnectAdapter({ options: { projectId: 'x' } } as any);
        expect((adapter as any)._config.network).toBe('Nile');
        expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/config\.network must be one of/));
    });

    it('preserves an explicit network without logging', () => {
        const adapter = new WalletConnectAdapter({ network: 'Mainnet', options: { projectId: 'x' } } as any);
        expect((adapter as any)._config.network).toBe('Mainnet');
        expect(console.error).not.toHaveBeenCalled();
    });

    it('strips --wcm- prefix from web3ModalConfig.themeVariables and keeps valid keys', () => {
        const adapter = new WalletConnectAdapter({
            network: 'Nile',
            options: { projectId: 'x' },
            web3ModalConfig: {
                themeVariables: {
                    // After --wcm- → --w3m-, the key matches the allow-list and is kept.
                    '--wcm-font-family': 'Arial',
                    // --wcm-accent-color becomes --w3m-accent-color, which is NOT on
                    // the allow-list (only `--w3m-accent` is), so it is dropped.
                    '--wcm-accent-color': '#fff',
                    // --w3m-* keys are kept verbatim (already valid).
                    '--w3m-z-index': '99',
                    // Unknown keys dropped.
                    '--unknown-key': 'whatever',
                } as any,
            },
        } as any);
        expect((adapter as any)._config.themeVariables).toEqual({
            '--w3m-font-family': 'Arial',
            '--w3m-z-index': '99',
        });
    });

    it('drops themeVariables keys not on the allow-list', () => {
        const adapter = new WalletConnectAdapter({
            network: 'Nile',
            options: { projectId: 'x' },
            web3ModalConfig: { themeVariables: { '--w3m-not-allowed': 'x' } as any },
        } as any);
        expect((adapter as any)._config.themeVariables).toEqual({});
    });

    it('coalesces themeMode, featuredWalletIds, privacyPolicyUrl from web3ModalConfig', () => {
        const adapter = new WalletConnectAdapter({
            network: 'Nile',
            options: { projectId: 'x' },
            web3ModalConfig: {
                themeMode: 'dark',
                explorerRecommendedWalletIds: ['wallet-1', 'wallet-2'],
                privacyPolicyUrl: 'https://example.com/privacy',
            },
        } as any);
        expect((adapter as any)._config.themeMode).toBe('dark');
        expect((adapter as any)._config.featuredWalletIds).toEqual(['wallet-1', 'wallet-2']);
        expect((adapter as any)._config.privacyPolicyUrl).toBe('https://example.com/privacy');
    });

    it('does not overwrite explicit themeVariables with web3ModalConfig values', () => {
        const adapter = new WalletConnectAdapter({
            network: 'Nile',
            options: { projectId: 'x' },
            themeVariables: { '--w3m-accent': 'explicit' } as any,
            web3ModalConfig: { themeVariables: { '--w3m-accent': 'from-web3modal' } as any },
        } as any);
        expect((adapter as any)._config.themeVariables).toEqual({ '--w3m-accent': 'explicit' });
    });

    it('deletes web3ModalConfig after parsing', () => {
        const adapter = new WalletConnectAdapter({
            network: 'Nile',
            options: { projectId: 'x' },
            web3ModalConfig: { themeMode: 'dark' },
        } as any);
        expect((adapter as any)._config.web3ModalConfig).toBeUndefined();
    });
});

// =================================================================
// _getChainId — three-branch mapping
// =================================================================

describe('WalletConnectAdapter — _getChainId mapping', () => {
    it('returns the mapped value when network is in the chainIdEnum', () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        const mapped = (adapter as any)._getChainId('Nile', { Nile: 'tron:0xcd8690dc' });
        expect(mapped).toBe('tron:0xcd8690dc');
    });

    it('returns the value unchanged when it already starts with "tron:"', () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        const mapped = (adapter as any)._getChainId('tron:0x2b6653dc', {});
        expect(mapped).toBe('tron:0x2b6653dc');
    });

    it('wraps the network in "tron:<network>" when no direct mapping and no prefix', () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        const mapped = (adapter as any)._getChainId('MyCustomNet', {});
        expect(mapped).toBe('tron:MyCustomNet');
    });
});

// =================================================================
// connect()
// =================================================================

describe('WalletConnectAdapter — connect()', () => {
    it('rejects an empty connect address and closes the session', async () => {
        const wallet = makeWallet('');
        const adapter = makeAdapter(wallet);
        const events = spyEvents(adapter);

        await expect(adapter.connect()).rejects.toThrow(/Request connect error/);

        expect(adapter.address).toBeNull();
        expect(adapter.connected).toBe(false);
        expect(events.connect).not.toHaveBeenCalled();
        expect(wallet.disconnect).toHaveBeenCalledTimes(1);
        expect(wallet.on).not.toHaveBeenCalled();
    });

    it('connects with a real address and emits connect', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        const events = spyEvents(adapter);

        await adapter.connect();

        expect(adapter.address).toBe(ADDR_A);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(adapter.connected).toBe(true);
        expect(events.connect).toHaveBeenCalledWith(ADDR_A);
    });

    it('short-circuits without invoking _wallet.connect when already connected', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        await adapter.connect();
        wallet.connect.mockClear();

        await adapter.connect();
        expect(wallet.connect).not.toHaveBeenCalled();
    });

    it('short-circuits when connecting', async () => {
        const wallet = makeWallet();
        // Make the connect promise pending.
        let resolveConnect: (v: { address: string }) => void = () => {};
        wallet.connect = vi.fn(() => new Promise((resolve) => (resolveConnect = resolve)));
        const adapter = makeAdapter(wallet);

        const first = adapter.connect();
        // While the first is in flight, fire a second.
        const second = adapter.connect();
        expect(wallet.connect).toHaveBeenCalledTimes(1);

        resolveConnect({ address: ADDR_A });
        await Promise.all([first, second]);
    });

    it('throws WalletNotFoundError when state === AdapterState.NotFound', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        (adapter as any)._state = AdapterState.NotFound;

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletNotFoundError);
    });

    it('maps "User closed the connection modal" to WalletWindowClosedError', async () => {
        const wallet = makeWallet();
        wallet.connect = vi.fn().mockRejectedValue(new Error('User closed the connection modal'));
        const adapter = makeAdapter(wallet);

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletWindowClosedError);
    });

    it('maps any other error to WalletConnectionError and emits error', async () => {
        const wallet = makeWallet();
        wallet.connect = vi.fn().mockRejectedValue(new Error('other'));
        const adapter = makeAdapter(wallet);
        const onError = vi.fn();
        adapter.on('error', onError);

        await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
        expect(onError).toHaveBeenCalled();
    });

    it('always resets _connecting in finally (failure path)', async () => {
        const wallet = makeWallet();
        wallet.connect = vi.fn().mockRejectedValue(new Error('User closed the connection modal'));
        const adapter = makeAdapter(wallet);
        try {
            await adapter.connect();
        } catch {
            // ignore
        }
        expect(adapter.connecting).toBe(false);
    });

    it('registers disconnect and accountsChanged listeners on the wallet', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        await adapter.connect();

        const events = wallet.on.mock.calls.map((c: any[]) => c[0]);
        expect(events).toContain('disconnect');
        expect(events).toContain('accountsChanged');
    });
});

// =================================================================
// disconnect()
// =================================================================

describe('WalletConnectAdapter — disconnect()', () => {
    it('returns immediately when state === AdapterState.NotFound', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        (adapter as any)._state = AdapterState.NotFound;
        await adapter.disconnect();
        expect(wallet.disconnect).not.toHaveBeenCalled();
    });

    it('returns when no underlying wallet (half-open session)', async () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        adapter.on('error', () => {});
        (adapter as any)._wallet = null;
        (adapter as any)._state = AdapterState.Disconnect;
        const onDisconnect = vi.fn();
        adapter.on('disconnect', onDisconnect);
        await adapter.disconnect();
        expect(onDisconnect).not.toHaveBeenCalled();
    });

    it('emits disconnect and clears address when previously connected', async () => {
        const { wallet, adapter, events } = await connected();
        await adapter.disconnect();
        expect(adapter.address).toBeNull();
        expect(events.disconnect).toHaveBeenCalledTimes(1);
        expect(wallet.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not emit disconnect or stateChanged when not wasConnected', async () => {
        // Half-open: connect promise resolved to an empty address and tore down.
        const wallet = makeWallet('');
        const adapter = makeAdapter(wallet);
        const events = spyEvents(adapter);
        try {
            await adapter.connect();
        } catch {
            // expect a connection error
        }
        events.disconnect.mockClear();
        events.stateChanged.mockClear();
        await adapter.disconnect();
        expect(events.disconnect).not.toHaveBeenCalled();
        expect(events.stateChanged).not.toHaveBeenCalled();
    });

    it('surfaces disconnect errors only when wasConnected', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.disconnect.mockRejectedValueOnce(new Error('fail'));

        await adapter.disconnect();
        // Since wasConnected was true the error is emitted as WalletDisconnectionError.
        // The internal `_applyConnectionState`/legacy path emits 'error' from the wrapper.
        expect(adapter.address).toBeNull();
        expect(events.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not surface disconnect errors when not wasConnected', async () => {
        const wallet = makeWallet();
        wallet.connect.mockRejectedValueOnce(new Error('User closed the connection modal'));
        const adapter = makeAdapter(wallet);
        const onError = vi.fn();
        adapter.on('error', onError);
        try {
            await adapter.connect();
        } catch {
            // ignore
        }
        onError.mockClear();
        wallet.disconnect.mockClear();
        wallet.disconnect.mockRejectedValueOnce(new Error('fail'));
        await adapter.disconnect();
        expect(onError).not.toHaveBeenCalled();
    });
});

// =================================================================
// signMessage / signTransaction
// =================================================================

describe('WalletConnectAdapter — signMessage()', () => {
    it('throws WalletDisconnectedError when not Connected', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        (adapter as any)._state = AdapterState.Disconnect;
        await expect(adapter.signMessage('hello')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    it('throws WalletDisconnectedError when wallet is missing', async () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        adapter.on('error', () => {});
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._wallet = null;
        await expect(adapter.signMessage('hello')).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    it('wraps underlying errors in WalletSignMessageError and emits error', async () => {
        const { wallet, adapter } = await connected();
        wallet.signMessage.mockRejectedValueOnce(new Error('sign-fail'));
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.signMessage('hello')).rejects.toBeInstanceOf(WalletSignMessageError);
        expect(onError).toHaveBeenCalled();
    });

    it('returns the signature on success', async () => {
        const { wallet, adapter } = await connected();
        wallet.signMessage.mockResolvedValueOnce('signature-X');
        expect(await adapter.signMessage('hello')).toBe('signature-X');
    });
});

describe('WalletConnectAdapter — signTransaction()', () => {
    it('throws WalletDisconnectedError when not Connected', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        (adapter as any)._state = AdapterState.Disconnect;
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    it('throws WalletDisconnectedError when wallet is missing', async () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        adapter.on('error', () => {});
        (adapter as any)._state = AdapterState.Connected;
        (adapter as any)._wallet = null;
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
    });

    it('wraps underlying errors in WalletSignTransactionError and emits error', async () => {
        const { wallet, adapter } = await connected();
        wallet.signTransaction.mockRejectedValueOnce(new Error('sign-tx-fail'));
        const onError = vi.fn();
        adapter.on('error', onError);
        await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        expect(onError).toHaveBeenCalled();
    });

    it('returns the signed transaction on success', async () => {
        const { wallet, adapter } = await connected();
        const fake = { signature: 'tx-signature' };
        wallet.signTransaction.mockResolvedValueOnce(fake);
        expect(await adapter.signTransaction({} as any)).toBe(fake);
    });
});

// =================================================================
// getConnectionStatus
// =================================================================

describe('WalletConnectAdapter — getConnectionStatus()', () => {
    it('returns { address: "" } when no wallet', async () => {
        const adapter = new WalletConnectAdapter(baseConfig());
        adapter.on('error', () => {});
        const result = await adapter.getConnectionStatus();
        expect(result).toEqual({ address: '' });
    });

    it('returns { address: "" } when not connected', async () => {
        const wallet = makeWallet();
        const adapter = makeAdapter(wallet);
        // connected === false because address === null
        const result = await adapter.getConnectionStatus();
        expect(result).toEqual({ address: '' });
    });

    it('returns the wallet.checkConnectStatus() result on success', async () => {
        const { wallet, adapter } = await connected();
        wallet.checkConnectStatus.mockResolvedValueOnce({ address: ADDR_A });
        expect(await adapter.getConnectionStatus()).toEqual({ address: ADDR_A });
    });

    it('disconnects fully on an empty account list', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.fire('accountsChanged', []);
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.connected).toBe(false);
        expect(events.disconnect).toHaveBeenCalledTimes(1);
        expect(events.stateChanged).toHaveBeenCalledWith(AdapterState.Disconnect);
        expect(events.accountsChanged).toHaveBeenCalledWith('', ADDR_A);
    });

    it('blocks signing once the accounts went empty', async () => {
        const { wallet, adapter } = await connected();
        wallet.fire('accountsChanged', []);
        await expect(adapter.signMessage('hello')).rejects.toBeTruthy();
    });

    it('stays connected when switching accounts', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.fire('accountsChanged', [ADDR_B]);
        expect(adapter.address).toBe(ADDR_B);
        expect(adapter.state).toBe(AdapterState.Connected);
        expect(events.accountsChanged).toHaveBeenCalledWith(ADDR_B, ADDR_A);
        expect(events.disconnect).not.toHaveBeenCalled();
    });

    it('cannot be revived by the old session after a failed status probe', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.checkConnectStatus.mockRejectedValue(new Error('session expired'));
        await adapter.getConnectionStatus();
        wallet.fire('accountsChanged', [ADDR_B]);
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(adapter.connected).toBe(false);
        expect(events.connect).not.toHaveBeenCalled();
    });

    it('detaches the old session listeners when the status probe fails', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.checkConnectStatus.mockRejectedValue(new Error('session expired'));
        await adapter.getConnectionStatus();
        expect(wallet.off).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
        expect(wallet.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
        wallet.fire('disconnect');
        expect(events.disconnect).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers when the status probe fails', async () => {
        const { wallet, adapter, events } = await connected();
        wallet.checkConnectStatus.mockRejectedValue(new Error('session expired'));
        await expect(adapter.getConnectionStatus()).resolves.toEqual({ address: '' });
        expect(adapter.address).toBeNull();
        expect(adapter.state).toBe(AdapterState.Disconnect);
        expect(events.disconnect).toHaveBeenCalledTimes(1);
        expect(events.stateChanged).toHaveBeenCalledWith(AdapterState.Disconnect);
    });
});
