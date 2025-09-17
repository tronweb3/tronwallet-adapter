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
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    AccountsChangedEventData,
    TronLinkMessageEvent,
    TronLinkWallet,
} from '@tronweb3/tronwallet-adapter-tronlink';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { openNaboxWallet, supportNaboxWallet } from './utils.js';

declare global {
    interface Window {
        NaboxWallet?: {
            tronLink: TronLinkWallet;
        };
    }
}
export interface NaboxWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if NaboxWallet wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open NaboxWallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const NaboxWalletAdapterName = 'Nabox Wallet' as AdapterName<'Nabox Wallet'>;

export class NaboxWalletAdapter extends Adapter {
    name = NaboxWalletAdapterName;
    url = 'https://nabox.io/';
    icon =
        'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iX+WbvuWxgl8yIiBkYXRhLW5hbWU9IuWbvuWxgiAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogIzFiMWUxZDsKICAgICAgfQoKICAgICAgLmNscy0yIHsKICAgICAgICBmaWxsOiAjMmFjNjg4OwogICAgICAgIGZpbGwtcnVsZTogZXZlbm9kZDsKICAgICAgfQogICAgPC9zdHlsZT4KICA8L2RlZnM+CiAgPGcgaWQ9Il/lm77lsYJfMS0yIiBkYXRhLW5hbWU9IuWbvuWxgiAxIj4KICAgIDxnPgogICAgICA8Y2lyY2xlIGNsYXNzPSJjbHMtMSIgY3g9IjI0IiBjeT0iMjQiIHI9IjI0Ii8+CiAgICAgIDxnPgogICAgICAgIDxwb2x5Z29uIGNsYXNzPSJjbHMtMiIgcG9pbnRzPSIxMC44NSAxNy40MiAxMC44NSAzMS40IDE0LjkgMzMuNzMgMTQuOSAyMy43MyAxOC45MyAyNi4wNiAxOC45MyAzNi4wNSAyMi45NyAzOC4zOCAyMi45NyAyNC40MSAxMC44NSAxNy40MiIvPgogICAgICAgIDxwYXRoIGNsYXNzPSJjbHMtMiIgZD0iTTIwLjA0LDE2LjE1bDQuMDUtMi4zNyw1LjA0LDIuOTUtNC4wNSwyLjM3LTUuMDQtMi45NFpNMjQuMSw5bC0xMi4yMiw3LjE1LDEzLjE4LDcuNzN2MTUuMTJzNC0yLjMzLDQtMi4zM3YtMTUuM2w0LjA0LTIuMzZ2MTUuMjlsNC4wNi0yLjM5di0xNS4yN2wtMTMuMDUtNy42NFoiLz4KICAgICAgPC9nPgogICAgPC9nPgogIDwvZz4KPC9zdmc+';

    config: Required<NaboxWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: NaboxWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[NaboxWalletAdapter] config.checkTimeout should be a number');
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
        if (supportNaboxWallet()) {
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
     * Get network information used by NaboxWallet.
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
            this.checkIfOpenNaboxWallet();
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
            const wallet = this._wallet as TronLinkWallet;
            try {
                const res = await wallet.request({ method: 'tron_requestAccounts' });
                if (!res) {
                    throw new WalletConnectionError('Request connect error.');
                }
                if (res.code === 4000) {
                    throw new WalletConnectionError(
                        'The same DApp has already initiated a request to connect to NaboxWallet, and the pop-up window has not been closed.'
                    );
                }
                if (res.code === 4001) {
                    throw new WalletConnectionError('The user rejected connection.');
                }
            } catch (error: any) {
                throw new WalletConnectionError(error?.message, error);
            }

            const address = wallet.tronWeb.defaultAddress?.base58 || '';
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
                if (error instanceof Error || (typeof error === 'object' && error.message)) {
                    throw new WalletSignTransactionError(error.message, error);
                } else if (typeof error === 'string') {
                    throw new WalletSignTransactionError(error, new Error(error));
                } else {
                    throw new WalletSignTransactionError('Unknown error', error);
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
                if (error instanceof Error || (typeof error === 'object' && error.message)) {
                    throw new WalletSignTransactionError(error.message, error);
                } else if (typeof error === 'string') {
                    throw new WalletSignTransactionError(error, new Error(error));
                } else {
                    throw new WalletSignTransactionError('Unknown error', error);
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
                if (error instanceof Error || (typeof error === 'object' && error.message)) {
                    throw new WalletSignMessageError(error.message, error);
                } else if (typeof error === 'string') {
                    throw new WalletSignMessageError(error, new Error(error));
                } else {
                    throw new WalletSignMessageError('Unknown error', error);
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private async checkAndGetWallet() {
        this.checkIfOpenNaboxWallet();
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as TronLinkWallet;
    }

    private _listenEvent() {
        this._stopListenEvent();
        window.addEventListener('message', this.messageHandler);
    }

    private _stopListenEvent() {
        window.removeEventListener('message', this.messageHandler);
    }

    private messageHandler = (e: TronLinkMessageEvent) => {
        const message = e.data?.message;
        if (!message) {
            return;
        }
        if (message.action === 'accountsChanged') {
            setTimeout(() => {
                const preAddr = this.address || '';
                if ((this._wallet as TronLinkWallet)?.ready) {
                    const address = (message.data as AccountsChangedEventData).address;
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
        } else if (message.action === 'connect') {
            const isCurConnected = this.connected;
            const preAddress = this.address || '';
            const address = (this._wallet as TronLinkWallet).tronWeb?.defaultAddress?.base58 || '';
            this.setAddress(address);
            this.setState(AdapterState.Connected);
            if (!isCurConnected) {
                this.emit('connect', address);
            } else if (address !== preAddress) {
                this.emit('accountsChanged', this.address || '', preAddress);
            }
        } else if (message.action === 'disconnect') {
            this.setAddress(null);
            this.setState(AdapterState.Disconnect);
            this.emit('disconnect');
        }
    };

    private checkIfOpenNaboxWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openNaboxWallet()) {
            throw new WalletNotFoundError();
        }
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if NaboxWallet exists
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
                const isSupport = supportNaboxWallet();
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
        if (supportNaboxWallet()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = window.NaboxWallet!.tronLink;
            this._listenEvent();
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            state = this._wallet.ready ? AdapterState.Connected : AdapterState.Disconnect;
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
