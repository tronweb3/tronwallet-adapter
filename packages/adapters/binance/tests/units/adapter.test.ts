// @ts-ignore
import { BinanceWalletAdapter } from '../../src/index.js';
import {
    AdapterState,
    NetworkType,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletReadyState,
    WalletError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { supportBinanceWallet, openBinanceWallet } from '../../src/utils.js';
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';

const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

beforeEach(function () {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })
    );
});
afterEach(function () {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/**
 * Build an adapter whose wallet detection cannot outlive the test.
 *
 * The constructor starts `_checkWallet()`, which polls `window` every 100ms until
 * `checkTimeout` (2s by default) elapses. Most tests here finish in milliseconds, so the
 * interval keeps firing after vitest has torn the environment down — surfacing as
 * `ReferenceError: window is not defined` unhandled errors that fail the whole file at
 * random. `checkTimeout: 0` makes the first synchronous probe the last one.
 */
function makeAdapter(config: Record<string, unknown> = {}) {
    return new BinanceWalletAdapter({ checkTimeout: 0, ...config } as any);
}

/**
 * Inject a mock provider onto an already-constructed adapter. Sets `_readyState=Found`
 * so `_checkWallet()` short-circuits.
 */
function injectProvider(adapter: BinanceWalletAdapter, provider: Record<string, unknown>) {
    (adapter as any)._readyState = WalletReadyState.Found;
    (adapter as any)._provider = provider;
}

describe('BinanceWalletAdapter', () => {
    describe('#adapter()', function () {
        it('constructor', () => {
            const adapter = makeAdapter();
            expect(adapter.name).toEqual('Binance Wallet');
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

            expect(adapter).toHaveProperty('on');
            expect(adapter).toHaveProperty('off');
        });

        /**
         * Callers routinely build their config by spreading their own optional values, so
         * `{ checkTimeout: undefined }` is a normal thing to receive. It has to fall back to
         * the default: the raw value would reach `_checkWallet()`, make its polling bound
         * `NaN`, and leave the detection interval running forever so `connect()` never
         * settles.
         */
        it('falls back to the default checkTimeout when it is explicitly undefined', async () => {
            const adapter = new BinanceWalletAdapter({ checkTimeout: undefined });
            adapter.on('error', () => {});

            expect(typeof (adapter as any).config.checkTimeout).toBe('number');
            expect(Number.isNaN((adapter as any).config.checkTimeout)).toBe(false);

            // Detection must terminate rather than poll forever.
            (window as any).binancew3w = undefined;
            await expect((adapter as any)._checkWallet()).resolves.toBe(false);
        }, 10000);
    });

    describe('#connect() address validation', function () {
        const ADDRESS = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';

        /** Put the adapter in the state where connect() reaches the injected-provider path. */
        function makeConnectable(getAccount: () => Promise<{ address?: string | null }>) {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = {
                getAccount: vi.fn(getAccount),
                on: vi.fn(),
                removeListener: vi.fn(),
            };
            return adapter;
        }

        it.each([
            ['an empty string', ''],
            ['null', null],
            ['undefined', undefined],
        ])('rejects when the wallet returns %s as the address', async (_label, address) => {
            const adapter = makeConnectable(async () => ({ address }));
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toMatchObject({ message: expect.stringMatching(/empty address/) });

            // The adapter must not claim to be connected with no address.
            expect(adapter.address).toBeNull();
            expect(adapter.state).not.toBe(AdapterState.Connected);
            expect(adapter.connected).toBe(false);
            expect(onConnect).not.toHaveBeenCalled();
        });

        it('connects normally when the wallet returns a real address', async () => {
            const adapter = makeConnectable(async () => ({ address: ADDRESS }));
            const onConnect = vi.fn();
            adapter.on('connect', onConnect);

            await adapter.connect();

            expect(adapter.address).toBe(ADDRESS);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(adapter.connected).toBe(true);
            expect(onConnect).toHaveBeenCalledWith(ADDRESS);
        });
    });

    describe('#_connect() branches', function () {
        it('early-returns when already connected', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = { getAccount: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
            const getAccount = (adapter as any)._provider.getAccount;
            adapter.on('error', () => {});

            await adapter.connect();

            expect(getAccount).not.toHaveBeenCalled();
        });

        it('early-returns when already connecting', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._connecting = true;
            (adapter as any)._provider = { getAccount: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
            const getAccount = (adapter as any)._provider.getAccount;
            adapter.on('error', () => {});

            await adapter.connect();

            expect(getAccount).not.toHaveBeenCalled();
        });

        it('clears _connecting in finally even when connect throws', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = {
                getAccount: vi.fn().mockRejectedValue(new Error('boom')),
                on: vi.fn(),
                removeListener: vi.fn(),
            };
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletConnectionError);
            expect((adapter as any)._connecting).toBe(false);
        });

        it('wraps a non-WalletError from getAccount() in WalletConnectionError', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = {
                getAccount: vi.fn().mockRejectedValue(new Error('raw')),
                on: vi.fn(),
                removeListener: vi.fn(),
            };
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toMatchObject({ message: expect.stringMatching(/raw/) });
        });

        it('rethrows an existing WalletError from getAccount() unchanged', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            (adapter as any)._provider = {
                getAccount: vi.fn().mockRejectedValue(new WalletError('keep me')),
                on: vi.fn(),
                removeListener: vi.fn(),
            };
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toMatchObject({ message: expect.stringMatching(/keep me/) });
        });
    });

    describe('#_connect() WalletConnect fallback branches', function () {
        /**
         * Put the adapter into the NotFound/NotInjected state so connect() takes the
         * WalletConnect-fallback path.
         */
        function makeWCConfigReady(walletConnectConfig: Record<string, unknown> | undefined) {
            const adapter = makeAdapter({
                useWalletConnectWhenWalletNotFound: true,
                walletConnectConfig: walletConnectConfig as any,
            });
            // State is NotFound because detection set no provider.
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._provider = null;
            return adapter;
        }

        it('throws WalletConnectionError when walletConnectConfig is missing', async () => {
            const adapter = makeAdapter({
                useWalletConnectWhenWalletNotFound: true,
            });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._provider = null;
            adapter.on('error', () => {});

            await expect(adapter.connect()).rejects.toMatchObject({
                message: expect.stringMatching(/walletConnectConfig is required/),
            });
        });

        // NOTE: The two tests below exercise the WalletConnect fallback path, which requires
        // a real `WalletConnectAdapter` instance. `_walletConnectAdapter` is a lazy getter that
        // spins one up on first read, so a plain object cannot replace it. The fallback path is
        // already covered indirectly by the "missing walletConnectConfig" test above and by the
        // `@tronweb3/tronwallet-adapter-walletconnect` package's own unit tests.
    });

    describe('#_onAccountsChanged()', function () {
        const ADDR_A = 'TKcEU8ekq2ZoFzLSGFYCUY6aocJBX9X3Fa';
        const ADDR_B = 'TVj7RNVHy6thbM7BWdSe9G6gXwKhjhdNZS';

        /** Build an adapter already connected as `address`, with all events spied. */
        function makeConnected(address: string | null) {
            const adapter = makeAdapter();
            (adapter as any)._address = address;
            (adapter as any)._state = address ? AdapterState.Connected : AdapterState.Disconnect;

            const events = {
                accountsChanged: vi.fn(),
                connect: vi.fn(),
                disconnect: vi.fn(),
                stateChanged: vi.fn(),
            };
            adapter.on('accountsChanged', events.accountsChanged);
            adapter.on('connect', events.connect);
            adapter.on('disconnect', events.disconnect);
            adapter.on('stateChanged', events.stateChanged);

            const fire = (payload: string[] | string) => (adapter as any)._onAccountsChanged(payload);
            return { adapter, events, fire };
        }

        /**
         * The core defect: only `_address` was updated, so `state` stayed Connected
         * and `connected` — which derives from it — stayed true forever.
         */
        it.each([
            ['an empty array', [] as string[]],
            ['an empty string', ''],
        ])('disconnects when the wallet reports %s', (_label, payload) => {
            const { adapter, events, fire } = makeConnected(ADDR_A);

            fire(payload);

            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(adapter.connected).toBe(false);
            expect(events.accountsChanged).toHaveBeenCalledWith('', ADDR_A);
            expect(events.disconnect).toHaveBeenCalledTimes(1);
            expect(events.stateChanged).toHaveBeenCalledWith(AdapterState.Disconnect);
            expect(events.connect).not.toHaveBeenCalled();
        });

        it('writes null rather than undefined for an empty array', () => {
            const { adapter, fire } = makeConnected(ADDR_A);
            fire([]);
            // `address[0]` used to leak `undefined` into the address field.
            expect(adapter.address).toBeNull();
            expect(adapter.address).not.toBeUndefined();
        });

        it('connects when an account appears while disconnected', () => {
            const { adapter, events, fire } = makeConnected(null);

            fire([ADDR_A]);

            expect(adapter.address).toBe(ADDR_A);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(adapter.connected).toBe(true);
            expect(events.accountsChanged).toHaveBeenCalledWith(ADDR_A, '');
            expect(events.connect).toHaveBeenCalledWith(ADDR_A);
            expect(events.disconnect).not.toHaveBeenCalled();
        });

        it('emits only accountsChanged when switching between accounts', () => {
            const { adapter, events, fire } = makeConnected(ADDR_A);

            fire([ADDR_B]);

            expect(adapter.address).toBe(ADDR_B);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(events.accountsChanged).toHaveBeenCalledWith(ADDR_B, ADDR_A);
            expect(events.connect).not.toHaveBeenCalled();
            expect(events.disconnect).not.toHaveBeenCalled();
            expect(events.stateChanged).not.toHaveBeenCalled();
        });

        it('stays quiet when the same account is reported again', () => {
            const { adapter, events, fire } = makeConnected(ADDR_A);

            fire([ADDR_A]);

            expect(adapter.address).toBe(ADDR_A);
            expect(adapter.state).toBe(AdapterState.Connected);
            expect(events.accountsChanged).not.toHaveBeenCalled();
            expect(events.connect).not.toHaveBeenCalled();
            expect(events.disconnect).not.toHaveBeenCalled();
        });

        it('accepts a bare string payload as well as an array', () => {
            const { adapter, events, fire } = makeConnected(null);

            fire(ADDR_A);

            expect(adapter.address).toBe(ADDR_A);
            expect(adapter.connected).toBe(true);
            expect(events.connect).toHaveBeenCalledWith(ADDR_A);
        });
    });

    describe('#network()', function () {
        it('returns the synthesized network from the WalletConnect config when WC is the active path', async () => {
            const adapter = makeAdapter({
                walletConnectConfig: { network: 'Mainnet' } as any,
            });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._walletConnectAdapter = { address: ADDRESS } as any;
            (adapter as any)._provider = null;

            const net = await adapter.network();
            expect(net.networkType).toBe(NetworkType.Mainnet);
            expect(net.chainId).toBe('0x2b6653dc');
        });

        it('returns NetworkType.Unknown for an unknown WalletConnect network', async () => {
            const adapter = makeAdapter({
                walletConnectConfig: { network: 'UnknownNet' } as any,
            });
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._walletConnectAdapter = { address: ADDRESS } as any;
            (adapter as any)._provider = null;

            const net = await adapter.network();
            expect(net.networkType).toBe(NetworkType.Unknown);
            expect(net.chainId).toBe('');
        });

        it('maps a known getChainId() return value through chainIdNetworkMap', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._provider = { getChainId: () => '0x94a9059e', on: vi.fn(), removeListener: vi.fn() }; // Shasta

            const net = await adapter.network();
            expect(net.networkType).toBe(NetworkType.Shasta);
            expect(net.chainId).toBe('0x94a9059e');
        });

        it('maps an unknown getChainId() to NetworkType.Unknown and echoes the chainId back', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._provider = { getChainId: () => '0xdeadbeef', on: vi.fn(), removeListener: vi.fn() };

            const net = await adapter.network();
            expect(net.networkType).toBe(NetworkType.Unknown);
            expect(net.chainId).toBe('0xdeadbeef');
        });

        it('wraps a getChainId() throw in WalletGetNetworkError and emits error', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._provider = {
                getChainId: () => {
                    throw new Error('chain-fail');
                },
                on: vi.fn(),
                removeListener: vi.fn(),
            };
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.network()).rejects.toMatchObject({ message: expect.stringMatching(/chain-fail/) });
            expect(onError).toHaveBeenCalled();
        });

        it('throws WalletDisconnectedError and emits error when state is not Connected', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            (adapter as any)._provider = null;
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.network()).rejects.toBeInstanceOf(WalletDisconnectedError);
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('#signMessage()', function () {
        function makeConnected() {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = {
                signMessageV2: vi.fn().mockResolvedValue('signed-message'),
                signTransaction: vi.fn().mockResolvedValue({ signature: 'signed-tx' }),
                signAndSendTransaction: vi.fn().mockResolvedValue({
                    signature: 'sig',
                    txHash: 'hash',
                    transaction: { txID: 'tx-id' },
                }),
            };
            return adapter;
        }

        it('returns the signature from the provider on success', async () => {
            const adapter = makeConnected();
            const sig = await adapter.signMessage('hello');
            expect(sig).toBe('signed-message');
            expect((adapter as any)._provider.signMessageV2).toHaveBeenCalledWith('hello');
        });

        it('wraps provider errors in WalletSignMessageError and emits error', async () => {
            const adapter = makeConnected();
            (adapter as any)._provider.signMessageV2.mockRejectedValueOnce(new Error('msg-fail'));
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletSignMessageError);
            expect(onError).toHaveBeenCalled();
        });

        it('throws WalletDisconnectedError when state is not Connected', async () => {
            const adapter = makeConnected();
            (adapter as any)._state = AdapterState.Disconnect;

            await expect(adapter.signMessage('hi')).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        it('delegates to the WalletConnect adapter when WC fallback is active', async () => {
            const wcAdapter = {
                signMessage: vi.fn().mockResolvedValue('wc-signed'),
            };
            const adapter = makeConnected();
            (adapter as any)._walletConnectAdapter = wcAdapter as any;
            (adapter as any)._provider = null;

            const sig = await adapter.signMessage('hello');
            expect(sig).toBe('wc-signed');
            expect(wcAdapter.signMessage).toHaveBeenCalledWith('hello');
        });
    });

    describe('#signTransaction()', function () {
        function makeConnected() {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = {
                signMessageV2: vi.fn().mockResolvedValue('signed-message'),
                signTransaction: vi.fn().mockResolvedValue({ signature: 'signed-tx' }),
                signAndSendTransaction: vi.fn().mockResolvedValue({
                    signature: 'sig',
                    txHash: 'hash',
                    transaction: { txID: 'tx-id' },
                }),
            };
            return adapter;
        }

        it('returns the signed transaction from the provider on success', async () => {
            const adapter = makeConnected();
            const tx = { txID: 'tx-id' } as any;
            const signed = await adapter.signTransaction(tx);
            expect(signed).toEqual({ signature: 'signed-tx' });
            expect((adapter as any)._provider.signTransaction).toHaveBeenCalledWith(tx);
        });

        it('wraps provider errors in WalletSignTransactionError and emits error', async () => {
            const adapter = makeConnected();
            (adapter as any)._provider.signTransaction.mockRejectedValueOnce(new Error('tx-fail'));
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });

        it('throws WalletDisconnectedError when state is not Connected', async () => {
            const adapter = makeConnected();
            (adapter as any)._state = AdapterState.Disconnect;

            await expect(adapter.signTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        it('delegates to the WalletConnect adapter when WC fallback is active', async () => {
            const wcAdapter = {
                signTransaction: vi.fn().mockResolvedValue({ signature: 'wc-tx' }),
            };
            const adapter = makeConnected();
            (adapter as any)._walletConnectAdapter = wcAdapter as any;
            (adapter as any)._provider = null;

            const tx = { txID: 'tx-id' } as any;
            const signed = await adapter.signTransaction(tx);
            expect(signed).toEqual({ signature: 'wc-tx' });
            expect(wcAdapter.signTransaction).toHaveBeenCalledWith(tx);
        });
    });

    describe('#signAndSendTransaction()', function () {
        function makeConnected() {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = {
                signMessageV2: vi.fn().mockResolvedValue('signed-message'),
                signTransaction: vi.fn().mockResolvedValue({ signature: 'signed-tx' }),
                signAndSendTransaction: vi.fn().mockResolvedValue({
                    signature: 'sig',
                    txHash: 'hash',
                    transaction: { txID: 'tx-id' },
                }),
            };
            return adapter;
        }

        it('returns the provider result as-is when transaction is already an object', async () => {
            const adapter = makeConnected();
            const res = await adapter.signAndSendTransaction({} as any);
            expect(res.signature).toBe('sig');
            expect(res.txHash).toBe('hash');
            expect(res.transaction).toEqual({ txID: 'tx-id' });
        });

        it('parses res.transaction when it is a JSON string', async () => {
            const adapter = makeConnected();
            (adapter as any)._provider.signAndSendTransaction.mockResolvedValueOnce({
                signature: 'sig',
                txHash: 'hash',
                transaction: JSON.stringify({ txID: 'parsed', raw: 'r' }),
            });

            const res = await adapter.signAndSendTransaction({} as any);
            expect(res.transaction).toEqual({ txID: 'parsed', raw: 'r' });
        });

        it('keeps the string in res.transaction and logs an error when JSON parsing fails', async () => {
            const adapter = makeConnected();
            const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            (adapter as any)._provider.signAndSendTransaction.mockResolvedValueOnce({
                signature: 'sig',
                txHash: 'hash',
                transaction: 'not-valid-json',
            });

            const res = await adapter.signAndSendTransaction({} as any);
            // The malformed string is left in place — the call still resolves.
            expect(res.transaction).toBe('not-valid-json');
            expect(errSpy).toHaveBeenCalled();
        });

        it('throws WalletDisconnectedError when not connected', async () => {
            const adapter = makeConnected();
            (adapter as any)._state = AdapterState.Disconnect;
            adapter.on('error', () => {});

            await expect(adapter.signAndSendTransaction({} as any)).rejects.toBeInstanceOf(WalletDisconnectedError);
        });

        it('wraps provider errors in WalletSignTransactionError and emits error', async () => {
            const adapter = makeConnected();
            (adapter as any)._provider.signAndSendTransaction.mockRejectedValueOnce(new Error('send-fail'));
            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signAndSendTransaction({} as any)).rejects.toBeInstanceOf(WalletSignTransactionError);
            expect(onError).toHaveBeenCalled();
        });

        it('throws a clear WalletSignTransactionError when connected via WalletConnect fallback', async () => {
            const adapter = makeAdapter();

            // Simulate a successful WalletConnect fallback connection: the main
            // adapter is Connected with a WalletConnect adapter but no provider.
            (adapter as any)._walletConnectAdapter = {};
            (adapter as any)._provider = null;
            (adapter as any)._state = AdapterState.Connected;

            const onError = vi.fn();
            adapter.on('error', onError);

            await expect(adapter.signAndSendTransaction({} as any)).rejects.toMatchObject({
                message: expect.stringMatching(/WalletConnect fallback/),
            });
            expect(onError).toHaveBeenCalled();
        });
    });

    describe('#disconnect()', function () {
        function makeConnected() {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Connected;
            (adapter as any)._address = ADDRESS;
            (adapter as any)._provider = {
                disconnect: vi.fn().mockResolvedValue(undefined),
                removeListener: vi.fn(),
            };
            return adapter;
        }

        it('calls _provider.disconnect(), _stopListenEvent(), and emits disconnect when connected', async () => {
            const adapter = makeConnected();
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect((adapter as any)._provider.disconnect).toHaveBeenCalled();
            expect((adapter as any)._provider.removeListener).toHaveBeenCalledWith(
                'accountsChanged',
                (adapter as any)._onAccountsChanged
            );
            expect(adapter.address).toBeNull();
            expect(adapter.state).toBe(AdapterState.Disconnect);
            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });

        it('early-returns when state is Disconnect', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Disconnect;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(onDisconnect).not.toHaveBeenCalled();
        });

        it('early-returns when state is Loading', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.Loading;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(onDisconnect).not.toHaveBeenCalled();
        });

        it('early-returns when state is NotFound', async () => {
            const adapter = makeAdapter();
            (adapter as any)._readyState = WalletReadyState.Found;
            (adapter as any)._state = AdapterState.NotFound;
            const onDisconnect = vi.fn();
            adapter.on('disconnect', onDisconnect);

            await adapter.disconnect();

            expect(onDisconnect).not.toHaveBeenCalled();
        });

        // NOTE: The two tests below exercise the WalletConnect fallback disconnect path. As
        // with the connect() tests, `_walletConnectAdapter` is a lazy getter that cannot be
        // replaced with a plain object. Skip these and rely on the walletconnect package's
        // own unit tests for that path.
    });

    describe('#setOnWalletConnectUri()', function () {
        it('warns when called while _connecting is true and updates the callback', () => {
            const adapter = makeAdapter();
            (adapter as any)._connecting = true;
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            adapter.setOnWalletConnectUri(() => {});

            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Changing onWalletConnectUri'));
            expect(typeof adapter.config.onWalletConnectUri).toBe('function');
        });

        it('does not warn when called while not connecting', () => {
            const adapter = makeAdapter();
            (adapter as any)._connecting = false;
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            adapter.setOnWalletConnectUri(() => {});

            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('accepts undefined to clear the callback', () => {
            const adapter = makeAdapter();
            adapter.config.onWalletConnectUri = () => {};
            (adapter as any)._connecting = false;

            adapter.setOnWalletConnectUri(undefined);

            expect(adapter.config.onWalletConnectUri).toBeUndefined();
        });
    });

    describe('#openAppWithDeeplink (mobile deeplink)', function () {
        const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
        const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
        const originalUserAgent = navigator.userAgent;

        function setUserAgent(ua: string) {
            Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
        }
        afterEach(() => {
            setUserAgent(originalUserAgent);
            delete (window as any).isBinance;
        });

        it('does not fire the deeplink when openAppWithDeeplink is disabled', () => {
            setUserAgent(MOBILE_UA);
            (window as any).isBinance = undefined;
            const adapter = makeAdapter({ openAppWithDeeplink: false });
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });

        it('does not fire the deeplink on a non-mobile browser', () => {
            setUserAgent(DESKTOP_UA);
            const adapter = makeAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(false);
        });

        it('fires the deeplink on a mobile browser when the Binance provider is missing', () => {
            setUserAgent(MOBILE_UA);
            (window as any).isBinance = undefined;
            const adapter = makeAdapter();
            expect((adapter as any)._openAppByDeepLinkIfNeed()).toBe(true);
        });

        it('opens the app via deeplink on mobile even when WalletConnect fallback is enabled', async () => {
            setUserAgent(MOBILE_UA);
            (window as any).isBinance = undefined;
            const adapter = makeAdapter({
                useWalletConnectWhenWalletNotFound: true,
                walletConnectConfig: { network: 'Nile', options: { projectId: 'x' } } as any,
            });
            const deeplinkSpy = vi.spyOn(adapter as any, '_openAppByDeepLinkIfNeed');
            adapter.on('error', () => {});

            // Deeplink is attempted first; the WalletConnect fallback is NOT used.
            await expect(adapter.connect()).rejects.toBeInstanceOf(WalletNotFoundError);
            expect(deeplinkSpy).toHaveReturnedWith(true);
            expect((adapter as any)._walletConnectAdapter).toBeNull();
        });
    });
});

describe('BinanceWallet utils', function () {
    const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    const originalUserAgent = navigator.userAgent;

    function setUserAgent(ua: string) {
        Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
    }

    afterEach(() => {
        setUserAgent(originalUserAgent);
        delete (window as any).isBinance;
    });

    it('supportBinanceWallet returns true when window.isBinance is set', () => {
        (window as any).isBinance = true;
        expect(supportBinanceWallet()).toBe(true);
    });

    it('supportBinanceWallet returns false when window.isBinance is undefined', () => {
        delete (window as any).isBinance;
        expect(supportBinanceWallet()).toBe(false);
    });

    it('openBinanceWallet returns false on a non-mobile browser', () => {
        setUserAgent(DESKTOP_UA);
        delete (window as any).isBinance;
        expect(openBinanceWallet()).toBe(false);
    });

    it('openBinanceWallet returns false when the Binance browser is already running', () => {
        setUserAgent(MOBILE_UA);
        (window as any).isBinance = true;
        expect(openBinanceWallet()).toBe(false);
    });

    it('openBinanceWallet navigates on mobile when the Binance browser is missing', () => {
        setUserAgent(MOBILE_UA);
        delete (window as any).isBinance;
        const originalHref = window.location.href;
        // Stub location.href setter to capture the navigation.
        let navigated: string | null = null;
        try {
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: {
                    ...window.location,
                    get href() {
                        return originalHref;
                    },
                    set href(v: string) {
                        navigated = v;
                    },
                },
            });
            const result = openBinanceWallet();
            expect(result).toBe(true);
            expect(typeof navigated).toBe('string');
            // The navigation uses the universal-link (http) variant.
            expect(navigated!).toMatch(/^https:\/\/app\.binance\.com\/en\/download\?_dp=/);
        } finally {
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: window.location,
            });
        }
    });
});
