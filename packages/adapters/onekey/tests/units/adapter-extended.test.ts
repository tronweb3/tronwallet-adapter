import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { OneKeyAdapter } from '../../src/index.js';
import { AdapterState, WalletReadyState } from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

function makeWallet(address: string | null = ADDRESS) {
    return {
        request: vi.fn().mockResolvedValue({ code: 200 }),
        tronWeb: {
            defaultAddress: address ? { base58: address } : null,
            trx: {
                sign: vi.fn().mockResolvedValue({ signature: 'tx-sig' }),
                signMessageV2: vi.fn().mockResolvedValue('msg-sig'),
            },
        },
        on: vi.fn(),
        removeListener: vi.fn(),
    };
}

describe('OneKeyAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        delete (window as any).$onekey;
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete (window as any).$onekey;
    });

    describe('constructor branches', () => {
        test('with the injected provider and an address it becomes Connected and emits connect', async () => {
            (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            const adapter = new OneKeyAdapter();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            expect(adapter.readyState).toBe(WalletReadyState.Found);
            await vi.advanceTimersByTimeAsync(10);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(adapter.address).toBe(ADDRESS);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('with the injected provider but no address it stays Disconnected', async () => {
            (window as any).$onekey = { tron: makeWallet(null) };
            const adapter = new OneKeyAdapter();
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            await vi.advanceTimersByTimeAsync(10);
            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.address).toBeNull();
            expect(onConnect).not.toHaveBeenCalled();
        });

        test('without the provider it polls and ends up NotFound', async () => {
            const adapter = new OneKeyAdapter({ checkTimeout: 100 });
            const onReadyState = vi.fn();
            adapter.on('readyStateChanged', onReadyState);

            expect(adapter.readyState).toBe(WalletReadyState.Loading);
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
            expect(adapter.state).toBe(AdapterState.NotFound);
            expect(onReadyState).toHaveBeenCalledWith(WalletReadyState.NotFound);
        });

        test('detects a late-injected provider during the polling window', async () => {
            const adapter = new OneKeyAdapter({ checkTimeout: 500 });
            // Inject the wallet halfway through the detection window.
            setTimeout(() => {
                (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            }, 250);
            await vi.advanceTimersByTimeAsync(400);
            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.state).toBe(AdapterState.Connected);
        });
    });

    describe('#_updateWallet()', () => {
        test('tears the session down when the security check fails', async () => {
            (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            const adapter = new OneKeyAdapter();
            await vi.advanceTimersByTimeAsync(10);
            expect(adapter.state).toBe(AdapterState.Connected);

            const err = new Error('blocked');
            vi.spyOn(adapter as any, 'checkSecurity').mockRejectedValue(err);
            await (adapter as any)._updateWallet();
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
        });

        test('falls to NotFound when the provider disappears', async () => {
            (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            const adapter = new OneKeyAdapter();
            await vi.advanceTimersByTimeAsync(10);

            delete (window as any).$onekey;
            await (adapter as any)._updateWallet();
            expect(adapter.state).toBe(AdapterState.NotFound);
            expect(adapter.address).toBeNull();
            expect((adapter as any)._wallet).toBeNull();
        });
    });

    describe('provider event handlers', () => {
        function captureCallbacks(adapter: OneKeyAdapter) {
            const wallet = (adapter as any)._wallet;
            const accountsChanged = wallet.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            const chainChanged = wallet.on.mock.calls.find((c: any[]) => c[0] === 'chainChanged')?.[1];
            return { accountsChanged, chainChanged };
        }

        test('accountsChanged connects to the new address', async () => {
            (window as any).$onekey = { tron: makeWallet(null) };
            const adapter = new OneKeyAdapter();
            await vi.advanceTimersByTimeAsync(10);
            expect(adapter.state).toBe(AdapterState.Disconnect);

            const wallet = (adapter as any)._wallet;
            wallet.tronWeb.defaultAddress = { base58: ADDRESS };
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);
            const { accountsChanged } = captureCallbacks(adapter);
            await accountsChanged();
            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });

        test('accountsChanged disconnects on an empty address', async () => {
            (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            const adapter = new OneKeyAdapter();
            await vi.advanceTimersByTimeAsync(10);

            const wallet = (adapter as any)._wallet;
            wallet.tronWeb.defaultAddress = null;
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);
            const { accountsChanged } = captureCallbacks(adapter);
            await accountsChanged();
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });

        test('chainChanged normalizes the 0x00 Shasta chain id', async () => {
            (window as any).$onekey = { tron: makeWallet(ADDRESS) };
            const adapter = new OneKeyAdapter();
            await vi.advanceTimersByTimeAsync(10);

            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);
            const { chainChanged } = captureCallbacks(adapter);
            chainChanged('0x00');
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x94a9059e' });
            chainChanged('0x2b6653dc');
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2b6653dc' });
        });
    });

    describe('#_checkWallet() retry semantics', () => {
        test('a second detection while one is pending reuses the same promise', async () => {
            const adapter = new OneKeyAdapter({ checkTimeout: 1000 });
            // The constructor already started a pending detection.
            const p1 = (adapter as any)._checkWallet();
            const p2 = (adapter as any)._checkWallet();
            expect(p1).toBe(p2);
            await vi.advanceTimersByTimeAsync(1100);
            await expect(p1).resolves.toBe(false);
        });

        test('after a first failure the second call resolves NotFound immediately', async () => {
            const adapter = new OneKeyAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
            expect((adapter as any)._checkPromise).toBeNull();

            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });
});
