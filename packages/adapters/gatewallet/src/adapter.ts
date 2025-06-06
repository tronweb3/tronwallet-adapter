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
    WalletGetNetworkError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
    Network,
    EventEmitter,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { TronWeb, TronLinkWallet, ReqestAccountsResponse } from '@tronweb3/tronwallet-adapter-tronlink';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { openGateWallet, supportGateWallet, isGateApp } from './utils.js';

interface GateReqestAccountsResponseErr extends ReqestAccountsResponse {
    rpcUrl?: string;
    accountAddress?: string;
    hex?: string;
}

type GateReqestAccountsResponse = GateReqestAccountsResponseErr | Array<string>;

type GateAccountChangeEventRes = Array<string>;

interface TronTronWeb extends TronWeb {
    ready: boolean;
}

interface TronWallet extends EventEmitter {
    request(config: Record<string, unknown>): Promise<GateReqestAccountsResponse | null>;
    tronWeb: TronTronWeb;
}

interface GateWallet extends EventEmitter {
    tronLink: TronLinkWallet;
    tron: TronWallet;
}

declare global {
    interface Window {
        gatewallet?: GateWallet;
    }
}

export interface GateWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if GateWallet wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open GateWallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const GateWalletAdapterName = 'Gate Wallet' as AdapterName<'Gate Wallet'>;

export class GateWalletAdapter extends Adapter {
    name = GateWalletAdapterName;
    url = 'https://gate.io';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPG1hc2sgaWQ9Im1hc2swXzQ1ODJfNzgxIiBzdHlsZT0ibWFzay10eXBlOmFscGhhIiBtYXNrVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiPgo8cGF0aCBkPSJNMCA4QzAgMy41ODE3MiAzLjU4MTcyIDAgOCAwSDMyQzM2LjQxODMgMCA0MCAzLjU4MTcyIDQwIDhWMzJDNDAgMzYuNDE4MyAzNi40MTgzIDQwIDMyIDQwSDhDMy41ODE3MiA0MCAwIDM2LjQxODMgMCAzMlY4WiIgZmlsbD0id2hpdGUiLz4KPC9tYXNrPgo8ZyBtYXNrPSJ1cmwoI21hc2swXzQ1ODJfNzgxKSI+CjxwYXRoIGQ9Ik0wIDhDMCAzLjU4MTcyIDMuNTgxNzIgMCA4IDBIMzJDMzYuNDE4MyAwIDQwIDMuNTgxNzIgNDAgOFYzMkM0MCAzNi40MTgzIDM2LjQxODMgNDAgMzIgNDBIOEMzLjU4MTcyIDQwIDAgMzYuNDE4MyAwIDMyVjhaIiBmaWxsPSIjMDA1MUQyIi8+CjwvZz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zNSAyMEMzNSAyOC4yODQzIDI4LjI4NDMgMzUgMjAgMzVDMTEuNzE1NyAzNSA1IDI4LjI4NDMgNSAyMEM1IDExLjcxNTcgMTEuNzE1NyA1IDIwIDVWMTIuMDU4N0MyMCAxMi4wNTg3IDE5Ljk5OTkgMTIuMDU4NyAxOS45OTk5IDEyLjA1ODdDMTUuNjE0MSAxMi4wNTg3IDEyLjA1ODcgMTUuNjE0MSAxMi4wNTg3IDE5Ljk5OTlDMTIuMDU4NyAyNC4zODU3IDE1LjYxNDEgMjcuOTQxMSAxOS45OTk5IDI3Ljk0MTFDMjQuMzg1NiAyNy45NDExIDI3Ljk0MSAyNC4zODU3IDI3Ljk0MTEgMjBIMzVaIiBmaWxsPSJ3aGl0ZSIvPgo8cmVjdCB4PSIyMCIgeT0iMTIuMDU4NiIgd2lkdGg9IjcuOTQxMTgiIGhlaWdodD0iNy45NDExOCIgZmlsbD0iIzE0RTBBMSIvPgo8L3N2Zz4K';

    config: Required<GateWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronWallet | TronLinkWallet | null;
    private _address: string | null;

    constructor(config: GateWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[GateWalletAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openAppWithDeeplink,
            openUrlWhenWalletNotFound,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (supportGateWallet()) {
            this._readyState = WalletReadyState.Found;
            this._updateWallet();
        } else {
            this._checkWallet().then(() => {
                if (this.connected) {
                    this.emit('connect', this.address || '');
                }
            });
        }
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
     * Get network information used by GateWallet.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            const wallet = this._wallet;
            if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
            try {
                return await getNetworkInfoByTronWeb(wallet.tronWeb);
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
            this.checkIfOpenGateWallet();
            if (this.connected || this.connecting) return;
            await this._checkWallet();
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            if (!this._wallet) return;
            this._connecting = true;
            const wallet = this._wallet;
            let res: GateReqestAccountsResponse | undefined | null;
            try {
                const method = isGateApp ? 'tron_requestAccounts' : 'eth_requestAccounts';
                res = await wallet.request({ method });
                if (!res) {
                    throw new WalletConnectionError('Request connect error.');
                }
                if ((res as GateReqestAccountsResponseErr).code === 4000) {
                    throw new WalletConnectionError(
                        'The same DApp has already initiated a request to connect to GateWallet, and the pop-up window has not been closed.'
                    );
                }
                if ((res as GateReqestAccountsResponseErr).code === 4001) {
                    throw new WalletConnectionError('The user rejected connection.');
                }
            } catch (error: any) {
                throw new WalletConnectionError(error?.message, error);
            }

            const address = (isGateApp ? wallet.tronWeb.defaultAddress?.base58 : (res as Array<string>)[0]) || '';
            this.setAddress(address);
            this.setState(AdapterState.Connected);
            this._listenEvent();
            this.connected && this.emit('connect', this.address || '');
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        this._stopListenEvent();
        if (this.state !== AdapterState.Connected) {
            return;
        }
        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signTransaction(transaction: Transaction, privateKey?: string): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.sign(transaction, privateKey);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignTransactionError(error.message, error);
                } else {
                    throw new WalletSignTransactionError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async multiSign(
        transaction: Transaction,
        privateKey?: string | false,
        permissionId?: number
    ): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.multiSign(transaction, privateKey, permissionId);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignTransactionError(error.message, error);
                } else {
                    throw new WalletSignTransactionError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signMessage(message: string, privateKey?: string): Promise<string> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                return await wallet.tronWeb.trx.signMessageV2(message, privateKey);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignMessageError(error.message, error);
                } else {
                    throw new WalletSignMessageError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private async checkAndGetWallet() {
        this.checkIfOpenGateWallet();
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as TronLinkWallet;
    }

    private _listenEvent() {
        this._stopListenEvent();
        if (isGateApp) return;
        (this._wallet as TronWallet).on('accountsChanged', this.onGateAccountChange);
    }

    private _stopListenEvent() {
        if (isGateApp) return;
        (this._wallet as TronWallet).off('accountsChanged', this.onGateAccountChange);
    }

    private onGateAccountChange = (res: GateAccountChangeEventRes) => {
        setTimeout(() => {
            const preAddr = this.address || '';
            if (res.length !== 0) {
                const address = res[0];
                this.setAddress(address);
                this.setState(AdapterState.Connected);
            } else {
                this.setAddress(null);
                this.setState(AdapterState.Disconnect);
            }
            const address = this.address || '';
            if (address !== preAddr) {
                this.emit('accountsChanged', this.address || '', preAddr);
            }
            if (!preAddr && this.address) {
                this.emit('connect', this.address);
            } else if (preAddr && !this.address) {
                this.emit('disconnect');
            }
        }, 200);
    };

    private checkIfOpenGateWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openGateWallet()) {
            throw new WalletNotFoundError();
        }
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if GateWallet exists
     */
    private _checkWallet(): Promise<boolean> {
        if (this.readyState === WalletReadyState.Found) {
            return Promise.resolve(true);
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }
        const interval = 100;
        const maxTimes = Math.floor(this.config.checkTimeout / interval);
        let times = 0,
            timer: ReturnType<typeof setInterval>;
        this._checkPromise = new Promise((resolve) => {
            const check = () => {
                times++;
                const isSupport = supportGateWallet();
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    this._updateWallet();
                    this.emit('readyStateChanged', this.readyState);
                    resolve(isSupport);
                }
            };
            timer = setInterval(check, interval);
            check();
        });
        return this._checkPromise;
    }

    private _updateWallet = () => {
        let state = this.state;
        let address = this.address;
        if (supportGateWallet()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = isGateApp ? window.gatewallet!.tronLink : window.gatewallet!.tron;
            this._listenEvent();
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            const ready = isGateApp
                ? (this._wallet as TronLinkWallet).ready
                : (this._wallet.tronWeb as TronTronWeb).ready;
            state = ready ? AdapterState.Connected : AdapterState.Disconnect;
        } else {
            this._wallet = null;
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
