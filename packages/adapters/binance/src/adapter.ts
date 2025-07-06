import {
    Adapter,
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletSignTransactionError,
    type Network,
    WalletGetNetworkError,
    NetworkType,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
} from '@tronweb3/tronwallet-abstract-adapter';
import { chainIdNetworkMap } from '@tronweb3/tronwallet-adapter-tronlink/src';

declare global {
    interface Window {
        binancew3w?: {
            tron: any;
        };
        isBinance: boolean;
    }
}

export interface BinanceWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if Binance Wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
}

export const BinanceWalletAdapterName = 'Binance Wallet' as AdapterName<'Binance Wallet'>;

export class BinanceWalletAdapter extends Adapter {
    name = BinanceWalletAdapterName;
    url = 'https://www.binance.com/en/binancewallet';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMEIwRTExIi8+CjxwYXRoIGQ9Ik01IDE1TDcuMjU4MDYgMTIuNzQxOUw5LjUxNjEzIDE1TDcuMjU4MDYgMTcuMjU4MUw1IDE1WiIgZmlsbD0iI0YwQjkwQiIvPgo8cGF0aCBkPSJNOC44NzA5NyAxMS4xMjlMMTUgNUwyMS4xMjkgMTEuMTI5TDE4Ljg3MSAxMy4zODcxTDE1IDkuNTE2MTNMMTEuMTI5IDEzLjM4NzFMOC44NzA5NyAxMS4xMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMi43NDE5IDE1TDE1IDEyLjc0MTlMMTcuMjU4MSAxNUwxNSAxNy4yNTgxTDEyLjc0MTkgMTVaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMS4xMjkgMTYuNjEyOUw4Ljg3MDk3IDE4Ljg3MUwxNSAyNUwyMS4xMjkgMTguODcxTDE4Ljg3MSAxNi42MTI5TDE1IDIwLjQ4MzlMMTEuMTI5IDE2LjYxMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0yMC40ODM5IDE1TDIyLjc0MTkgMTIuNzQxOUwyNSAxNUwyMi43NDE5IDE3LjI1ODFMMjAuNDgzOSAxNVoiIGZpbGw9IiNGMEI5MEIiLz4KPC9zdmc+Cg==';

    config: Required<BinanceWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _provider: any;
    private _address: string | null;

    constructor(config: BinanceWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[BinanceWalletAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
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
     * Get network information used by Binance Wallet.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            try {
                const chainId = this._provider.getChainId();
                return {
                    networkType: chainIdNetworkMap[chainId] || NetworkType.Unknown,
                    chainId,
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
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }

            this._connecting = true;
            try {
                const { address } = await this._provider.getAccount();
                this.setAddress(address);
                this.setState(AdapterState.Connected);
                this.emit('connect', address);
            } catch (error: any) {
                throw new WalletConnectionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.state !== AdapterState.Connected) {
            return;
        }
        await this._provider.disconnect();
        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signMessage(message: string): Promise<string> {
        try {
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
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

    private _checkPromise: Promise<boolean> | null = null;
    private async _checkWallet(): Promise<boolean> {
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
}
