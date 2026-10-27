import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackpackAdapter } from '../../src/index.js';
import {
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletSwitchChainError,
} from '@tronweb3/tronwallet-abstract-adapter';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

function makeProvider(requestImpl?: (args: { method: string; params?: unknown }) => Promise<unknown>) {
    return {
        isBackpack: true,
        accounts: [ADDRESS],
        address: ADDRESS,
        request:
            requestImpl ??
            vi.fn(async ({ method }: { method: string }) => {
                switch (method) {
                    case 'tron_accounts':
                    case 'tron_requestAccounts':
                        return [ADDRESS];
                    case 'tron_chainId':
                        return '0x2b6653dc';
                    default:
                        return { signature: 'sig', txID: '0x1' };
                }
            }),
        on: vi.fn(),
        removeListener: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
    };
}

function makeConnected(adapter: BackpackAdapter, provider: any) {
    (adapter as any)._wallet = provider;
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._address = ADDRESS;
    (adapter as any)._state = AdapterState.Connected;
    adapter.on('error', () => {});
    return adapter;
}

describe('BackpackAdapter - extended', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        delete (window as any).backpack;
        delete (window as any).tron;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        delete (window as any).backpack;
        delete (window as any).tron;
    });

    describe('#connect()', () => {
        test('wraps a user rejection (code 4001) into WalletConnectionError', async () => {
            (window as any).backpack = {
                tron: makeProvider(async () => {
                    const e: any = new Error('User rejected');
                    e.code = 4001;
                    throw e;
                }),
            };
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(10);

            const res = adapter.connect();
            await expect(res).rejects.toBeInstanceOf(WalletConnectionError);
            await expect(res).rejects.toThrow('The user rejected connection.');
        });

        test('throws WalletConnectionError when no address is returned', async () => {
            (window as any).backpack = { tron: makeProvider(async () => []) };
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(10);

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            await expect(adapter.connect()).rejects.toThrow('No address returned');
        });

        test('wraps generic provider failures during connect', async () => {
            (window as any).backpack = {
                tron: makeProvider(async () => {
                    throw new Error('provider boom');
                }),
            };
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(10);

            await expect(adapter.connect()).rejects.toThrow('provider boom');
            expect(adapter.connecting).toBe(false);
        });
    });

    describe('#disconnect()', () => {
        test('resolves even when the provider throws during disconnect', async () => {
            const provider = makeProvider();
            provider.disconnect = vi.fn().mockRejectedValue(new Error('gone'));
            const adapter = makeConnected(new BackpackAdapter(), provider);

            await expect(adapter.disconnect()).resolves.toBeUndefined();
            expect(adapter.state).toBe(AdapterState.Disconnect);
        });

        test('is a no-op when already disconnected', async () => {
            const provider = makeProvider();
            const adapter = new BackpackAdapter();
            (adapter as any)._wallet = provider;
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;

            await expect(adapter.disconnect()).resolves.toBeUndefined();
            expect(provider.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('signing error wrapping', () => {
        test('signMessage wraps provider failures', async () => {
            const provider = makeProvider(async () => {
                throw new Error('sign denied');
            });
            const adapter = makeConnected(new BackpackAdapter(), provider);
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletSignMessageError);
            await expect(adapter.signMessage('m')).rejects.toThrow('sign denied');
        });

        test('signTransaction wraps provider failures', async () => {
            const provider = makeProvider(async () => {
                throw new Error('tx denied');
            });
            const adapter = makeConnected(new BackpackAdapter(), provider);
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('multiSign is not supported', async () => {
            const adapter = new BackpackAdapter();
            await expect(adapter.multiSign({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
        });

        test('signing rejects with WalletDisconnectedError when not connected', async () => {
            const adapter = new BackpackAdapter();
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});
            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
            await expect(adapter.signMessage('m')).rejects.toBeInstanceOf(WalletDisconnectedError);
        });
    });

    describe('#switchChain()', () => {
        test('emits chainChanged after a successful switch', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(new BackpackAdapter(), provider);
            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);

            await adapter.switchChain('0x2b6653dc');
            expect(provider.request).toHaveBeenCalledWith({
                method: 'tron_switchChain',
                params: { chainId: 'tron:728126428' },
            });
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2b6653dc' });
        });

        test('rewrites the tron:N chain id back to hex in the error message', async () => {
            const provider = makeProvider(async () => {
                throw new Error('Unrecognized chain tron:728126428 requested');
            });
            const adapter = makeConnected(new BackpackAdapter(), provider);
            const err = await adapter.switchChain('0x2b6653dc').catch((e) => e);
            expect(err).toBeInstanceOf(WalletSwitchChainError);
            expect(err.message).toContain('0x2b6653dc');
            expect(err.message).not.toContain('tron:728126428');
        });

        test('wraps failures without a message as Failed to switch chain.', async () => {
            const provider = makeProvider(async () => {
                throw 42;
            });
            const adapter = makeConnected(new BackpackAdapter(), provider);
            const err = await adapter.switchChain('0x2b6653dc').catch((e) => e);
            expect(err).toBeInstanceOf(WalletSwitchChainError);
            expect(err.message).toBe('Failed to switch chain.');
        });
    });

    describe('#network()', () => {
        test('returns the chain info from the provider', async () => {
            const provider = makeProvider();
            const adapter = makeConnected(new BackpackAdapter(), provider);
            const info = await adapter.network();
            expect(info.chainId).toBe('0x2b6653dc');
        });

        test('wraps provider failures in WalletGetNetworkError', async () => {
            const provider = makeProvider(async () => {
                throw new Error('chain unavailable');
            });
            const adapter = makeConnected(new BackpackAdapter(), provider);
            await expect(adapter.network()).rejects.toBeInstanceOf(WalletGetNetworkError);
        });
    });

    describe('provider event handlers', () => {
        test('accountsChanged events update the address and emit', async () => {
            (window as any).backpack = { tron: makeProvider() };
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(50);
            expect(adapter.state).toBe(AdapterState.Connected);

            const provider = (window as any).backpack.tron;
            const accountsChangedCb = provider.on.mock.calls.find((c: any[]) => c[0] === 'accountsChanged')?.[1];
            const onDisconnect = vi.fn();
            const onAccountsChanged = vi.fn();
            adapter.on('disconnect', onDisconnect);
            adapter.on('accountsChanged', onAccountsChanged);

            accountsChangedCb([]);
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
            expect(onAccountsChanged).toHaveBeenCalledWith('', ADDRESS);
        });

        test('chainChanged events accept a raw string payload', async () => {
            (window as any).backpack = { tron: makeProvider() };
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(50);

            const provider = (window as any).backpack.tron;
            const chainChangedCb = provider.on.mock.calls.find((c: any[]) => c[0] === 'chainChanged')?.[1];
            const onChainChanged = vi.fn();
            adapter.on('chainChanged', onChainChanged);

            chainChangedCb('0x94a9059e');
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x94a9059e' });
            chainChangedCb({ chainId: '0x2b6653dc' });
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '0x2b6653dc' });
            chainChangedCb(null);
            expect(onChainChanged).toHaveBeenCalledWith({ chainId: '' });
        });
    });

    describe('#_checkWallet() retry semantics', () => {
        test('a second detection while one is pending reuses the same promise', async () => {
            const adapter = new BackpackAdapter({ checkTimeout: 1000 });
            const p1 = (adapter as any)._checkWallet();
            const p2 = (adapter as any)._checkWallet();
            expect(p1).toBe(p2);
            await vi.advanceTimersByTimeAsync(1100);
            await expect(p1).resolves.toBe(false);
        });

        test('after a first failure the second call resolves NotFound immediately', async () => {
            const adapter = new BackpackAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);

            const res = (adapter as any)._checkWallet();
            await vi.advanceTimersByTimeAsync(0);
            await expect(res).resolves.toBe(false);
        });
    });

    describe('provider detection sources', () => {
        test('falls back to window.tron with the isBackpack flag', async () => {
            (window as any).tron = makeProvider();
            const adapter = new BackpackAdapter();
            await vi.advanceTimersByTimeAsync(50);
            expect(adapter.readyState).toBe(WalletReadyState.Found);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect((adapter as any)._wallet).toBe((window as any).tron);
        });

        test('ignores window.tron without the isBackpack flag', async () => {
            const provider = makeProvider();
            provider.isBackpack = false;
            (window as any).tron = provider;
            const adapter = new BackpackAdapter({ checkTimeout: 100 });
            await vi.advanceTimersByTimeAsync(200);
            expect(adapter.readyState).toBe(WalletReadyState.NotFound);
        });
    });
});
