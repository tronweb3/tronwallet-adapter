import {
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletSignTransactionError,
    type Network,
    WalletGetNetworkError,
    NetworkType,
    AddonAdapter,
    WalletError,
    WalletNotFoundError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
} from '@tronweb3/tronwallet-abstract-adapter';
import {
    type WalletConnectAdapterConfig,
    WalletConnectAdapter,
    type WalletConnectConnectOptions,
} from '@tronweb3/tronwallet-adapter-walletconnect';

declare global {
    interface Window {
        isBinance: boolean;
    }
}

export interface BinanceWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if Binance Wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;

    /**
     * Whether to open Binance Wallet download page when wallet is not found.
     * Default is true
     */
    openUrlWhenWalletNotFound?: boolean;

    /**
     * Use WalletConnect as fallback when Binance Wallet is not found.
     * Default is false
     */
    useWalletConnectWhenWalletNotFound?: boolean;

    walletConnectConfig?: WalletConnectAdapterConfig;

    /**
     * Callback to receive the WalletConnect URI for custom QR code rendering.
     * When provided, the AppKit modal will be skipped.
     * Only used when falling back to WalletConnect.
     */
    onWalletConnectUri?: (uri: string) => void;
}

export const BinanceWalletAdapterName = 'Binance Wallet' as AdapterName<'Binance Wallet'>;

const chainIdNetworkMap: Record<string, NetworkType> = {
    '0x2b6653dc': NetworkType.Mainnet,
    '0x94a9059e': NetworkType.Shasta,
    '0xcd8690dc': NetworkType.Nile,
    CT_195: NetworkType.Mainnet,
};
const CHAIN_ID_MAP: Record<string, string> = {
    CT_195: '0x2b6653dc',
};

export class BinanceWalletAdapter extends AddonAdapter {
    name = BinanceWalletAdapterName;
    url = 'https://www.binance.com/en/binancewallet';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMEIwRTExIi8+CjxwYXRoIGQ9Ik01IDE1TDcuMjU4MDYgMTIuNzQxOUw5LjUxNjEzIDE1TDcuMjU4MDYgMTcuMjU4MUw1IDE1WiIgZmlsbD0iI0YwQjkwQiIvPgo8cGF0aCBkPSJNOC44NzA5NyAxMS4xMjlMMTUgNUwyMS4xMjkgMTEuMTI5TDE4Ljg3MSAxMy4zODcxTDE1IDkuNTE2MTNMMTEuMTI5IDEzLjM4NzFMOC44NzA5NyAxMS4xMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMi43NDE5IDE1TDE1IDEyLjc0MTlMMTcuMjU4MSAxNUwxNSAxNy4yNTgxTDEyLjc0MTkgMTVaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMS4xMjkgMTYuNjEyOUw4Ljg3MDk3IDE4Ljg3MUwxNSAyNUwyMS4xMjkgMTguODcxTDE4Ljg3MSAxNi42MTI5TDE1IDIwLjQ4MzlMMTEuMTI5IDE2LjYxMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0yMC40ODM5IDE1TDIyLjc0MTkgMTIuNzQxOUwyNSAxNUwyMi43NDE5IDE3LjI1ODFMMjAuNDgzOSAxNVoiIGZpbGw9IiNGMEI5MEIiLz4KPC9zdmc+Cg==';

    config: Required<Omit<BinanceWalletAdapterConfig, 'walletConnectConfig' | 'onWalletConnectUri'>> & {
        walletConnectConfig?: WalletConnectAdapterConfig;
        onWalletConnectUri?: (uri: string) => void;
    };
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _provider: any;
    private _address: string | null;
    private _walletConnectAdapter: WalletConnectAdapter | null = null;
    private _wcDisconnectHandler: (() => void) | null = null;

    constructor(config: BinanceWalletAdapterConfig = {}) {
        super(config);
        this.config = {
            ...this.commonConfig,
            useWalletConnectWhenWalletNotFound: false,
            ...config,
        };
        this._connecting = false;
        this._provider = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }

        this._checkWallet().then(() => {
            if (this.connected) {
                this.emit('connect', this.address || '');
                this._listenEvent();
            }
        });
    }

    get address() {
        return this._address;
    }

    get state() {
        return this._state;
    }

    get readyState() {
        return this._readyState;
    }

    get connecting() {
        return this._connecting;
    }

    /**
     * Set the onWalletConnectUri callback for custom QR code rendering.
     * This allows dynamic configuration of the URI handler after adapter initialization.
     *
     * Note: If called while connecting, the change will not affect the current connection
     * but will take effect on the next connection attempt.
     *
     * @param callback - Callback to receive the WalletConnect URI
     */
    setOnWalletConnectUri(callback: ((uri: string) => void) | undefined): void {
        if (this._connecting) {
            console.warn(
                '[BinanceWalletAdapter] Changing onWalletConnectUri callback while connecting will take effect on next connection'
            );
        }
        this.config.onWalletConnectUri = callback;
    }

    /**
     * Get network information used by Binance Wallet.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();

            // If using WalletConnect fallback, delegate to WalletConnect adapter
            if (this._walletConnectAdapter && !this._provider) {
                // WalletConnect doesn't expose network() method, return default network from config
                const networkType = this.config.walletConnectConfig?.network as string;
                const chainIdMap: Record<string, string> = {
                    Mainnet: '0x2b6653dc',
                    Shasta: '0x94a9059e',
                    Nile: '0xcd8690dc',
                };
                return {
                    networkType: chainIdNetworkMap[chainIdMap[networkType] || ''] || NetworkType.Unknown,
                    chainId: chainIdMap[networkType] || '',
                    fullNode: '',
                    solidityNode: '',
                    eventServer: '',
                };
            }

            try {
                const chainId = this._provider.getChainId();
                return {
                    networkType: chainIdNetworkMap[chainId] || NetworkType.Unknown,
                    chainId: CHAIN_ID_MAP[chainId] || chainId,
                    fullNode: '',
                    solidityNode: '',
                    eventServer: '',
                };
            } catch (e: any) {
                throw new WalletGetNetworkError(e?.message, e);
            }
        } catch (e: any) {
            this.emit('error', e);
            throw e;
        }
    }

    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) return;
            await this._checkWallet();

            this._connecting = true;

            // Check if we should use WalletConnect fallback
            // Either state is NotFound, or we previously used WalletConnect (provider is null)
            const shouldUseWalletConnect = this.state === AdapterState.NotFound || !this._provider;

            if (shouldUseWalletConnect) {
                if (!this.config.useWalletConnectWhenWalletNotFound) {
                    if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                        window.open(this.url, '_blank');
                    }
                    throw new WalletNotFoundError();
                }
                await this.checkSecurity();

                // Use WalletConnect as fallback
                if (!this.config.walletConnectConfig) {
                    throw new WalletConnectionError(
                        '[BinanceWalletAdapter] walletConnectConfig is required when useWalletConnectWhenWalletNotFound is true'
                    );
                }

                // Reuse existing WalletConnect adapter if available
                if (!this._walletConnectAdapter) {
                    this._walletConnectAdapter = new WalletConnectAdapter(this.config.walletConnectConfig);
                }

                try {
                    // Pass onWalletConnectUri option from config to WalletConnect
                    const wcOptions: WalletConnectConnectOptions | undefined = this.config.onWalletConnectUri
                        ? {
                              onUri: this.config.onWalletConnectUri,
                          }
                        : undefined;

                    await this._walletConnectAdapter.connect(wcOptions);

                    // Validate that a real, fresh connection was established. The underlying
                    // WalletConnectWallet.connect() may silently resolve by reusing a stale/persisted
                    // session (e.g. after a previously aborted QR attempt), so a resolved promise alone
                    // does not guarantee a valid connection. Verify the WalletConnect adapter is actually
                    // connected and returned a non-empty address before flipping our own state.
                    const wcAddress = this._walletConnectAdapter.address;
                    if (!wcAddress || this._walletConnectAdapter.state !== AdapterState.Connected) {
                        throw new WalletConnectionError(
                            '[BinanceWalletAdapter] WalletConnect did not establish a valid connection'
                        );
                    }

                    this.setAddress(wcAddress);
                    this.setState(AdapterState.Connected);
                    this.emit('connect', wcAddress);

                    // Listen to WalletConnect events (only if not already listening)
                    if (!this._wcDisconnectHandler) {
                        this._walletConnectAdapter.on('accountsChanged', this._onAccountsChanged);
                        this._wcDisconnectHandler = () => {
                            this.setAddress(null);
                            this.setState(AdapterState.Disconnect);
                            this.emit('disconnect');
                        };
                        this._walletConnectAdapter.on('disconnect', this._wcDisconnectHandler);
                    }
                } catch (error: any) {
                    // Keep the adapter instance for retry, but tear down any half-open/stale session so
                    // the next connect() starts a fresh handshake (and shows the QR again) instead of
                    // silently reusing a leftover session.
                    try {
                        await this._walletConnectAdapter?.disconnect();
                    } catch {
                        // ignore cleanup errors
                    }
                    this._walletConnectAdapter = null;
                    this._connecting = false;
                    throw new WalletConnectionError(error?.message, error);
                }
                return;
            }

            await this.checkSecurity();
            try {
                const { address } = await this._provider.getAccount();
                this.setAddress(address);
                this.setState(AdapterState.Connected);
                this.emit('connect', address);
                this._listenEvent();
            } catch (error: any) {
                throw new WalletConnectionError(error?.message, error);
            }
        } catch (error: any) {
            const err = error instanceof WalletError ? error : new WalletConnectionError(error?.message, error);
            this.emit('error', err);
            throw err;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (this._walletConnectAdapter && !this._provider) {
            const wasConnected = this.connected;
            this._walletConnectAdapter.off('accountsChanged', this._onAccountsChanged);
            if (this._wcDisconnectHandler) {
                this._walletConnectAdapter.off('disconnect', this._wcDisconnectHandler);
                this._wcDisconnectHandler = null;
            }
            try {
                await this._walletConnectAdapter.disconnect();
            } catch {
                // ignore cleanup errors
            }
            this._walletConnectAdapter = null;
            this._connecting = false;
            this.setAddress(null);
            this.setState(AdapterState.NotFound);
            if (wasConnected) {
                this.emit('disconnect');
            }
            return;
        }

        if (this.state !== AdapterState.Connected) {
            return;
        }

        await this._provider.disconnect();
        this._stopListenEvent();

        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signMessage(message: string): Promise<string> {
        try {
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();

            // Use WalletConnect if connected via WalletConnect
            if (this._walletConnectAdapter) {
                return await this._walletConnectAdapter.signMessage(message);
            }

            try {
                return await this._provider.signMessageV2(message);
            } catch (error: any) {
                throw new WalletSignMessageError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        try {
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();

            // Use WalletConnect if connected via WalletConnect
            if (this._walletConnectAdapter) {
                return await this._walletConnectAdapter.signTransaction(transaction);
            }

            try {
                return await this._provider.signTransaction(transaction);
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Sign transaction and broadcast the signed transaction with Binance wallet selected network.
     * @param transaction
     * @returns
     */
    async signAndSendTransaction(transaction: Transaction): Promise<{
        signature: string;
        txHash: string;
        transaction: SignedTransaction;
        wcResult?: { result: boolean; txid: string };
    }> {
        try {
            if (!this.connected) throw new WalletDisconnectedError();

            // WalletConnect fallback does not support sign-and-send. Throw a stable,
            // identifiable error instead of dereferencing a null `_provider`.
            if (this._walletConnectAdapter) {
                throw new WalletSignTransactionError(
                    '[BinanceWalletAdapter] signAndSendTransaction() is not supported when connected via WalletConnect fallback. Use signTransaction() and broadcast the transaction yourself.'
                );
            }

            try {
                const res = await this._provider.signAndSendTransaction(transaction);
                if (typeof res.transaction === 'string') {
                    try {
                        res.transaction = JSON.parse(res.transaction);
                    } catch (e) {
                        console.error(`[BinanceWalletAdapter] parse transaction error: ${e}`);
                    }
                }
                return res;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _onAccountsChanged = (address: string[] | string) => {
        const preAddr = this.address || '';
        this.setAddress(Array.isArray(address) ? address[0] : address);
        this.emit('accountsChanged', this.address || '', preAddr);
    };
    private _listenEvent() {
        this._stopListenEvent();
        this._provider.on('accountsChanged', this._onAccountsChanged);
    }
    private _stopListenEvent() {
        this._provider.removeListener('accountsChanged', this._onAccountsChanged);
    }

    private _checkPromise: Promise<boolean> | null = null;
    protected async _checkWallet(): Promise<boolean> {
        if (this.readyState === WalletReadyState.Found) {
            return true;
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }

        const interval = 100;
        const maxTimes = Math.floor(this.config.checkTimeout / interval);
        let times = 0;
        let timer: ReturnType<typeof setInterval>;

        this._checkPromise = new Promise((resolve) => {
            const check = () => {
                times++;
                const isSupport = !!window.binancew3w?.tron;
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    this._updateProvider();
                    this.emit('readyStateChanged', this.readyState);
                    resolve(isSupport);
                }
            };
            timer = setInterval(check, interval);
            check();
        });

        return this._checkPromise;
    }

    private _updateProvider = () => {
        let state = this.state;
        let address = this.address;

        if (window.binancew3w?.tron) {
            this._provider = window.binancew3w.tron;
            address = null; // Will be set when connected
            state = AdapterState.Disconnect;
        } else {
            this._provider = null;
            address = null;
            state = AdapterState.NotFound;
        }

        this.setAddress(address);
        this.setState(state);
    };

    private setAddress(address: string | null) {
        this._address = address;
    }

    private setState(state: AdapterState) {
        const preState = this.state;
        if (state !== preState) {
            this._state = state;
            this.emit('stateChanged', state);
        }
    }

    protected _openAppByDeepLinkIfNeed(): boolean {
        return false;
    }
}
