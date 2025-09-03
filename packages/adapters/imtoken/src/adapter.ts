import {
    Adapter,
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletSignTransactionError,
    WalletGetNetworkError,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import type { TronLinkWallet } from '@tronweb3/tronwallet-adapter-tronlink';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
    Network,
} from '@tronweb3/tronwallet-abstract-adapter';
import { openImTokenApp, supportImToken } from './utils.js';

export interface ImTokenAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if imToken Wallet is supported.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open imToken Wallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const ImTokenWalletAdapterName = 'imToken Wallet' as AdapterName<'imToken Wallet'>;

export class ImTokenAdapter extends Adapter {
    name = ImTokenWalletAdapterName;
    url = 'https://token.im/';
    // prettier-ignore
    icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEzIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMyA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF84OTNfMjU5OSkiPgo8bWFzayBpZD0ibWFzazBfODkzXzI1OTkiIHN0eWxlPSJtYXNrLXR5cGU6bHVtaW5hbmNlIiBtYXNrVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iNTEzIiBoZWlnaHQ9IjUxMiI+CjxwYXRoIGQ9Ik01MTIuMzE5IDBIMC4zMTkzMzZWNTEySDUxMi4zMTlWMFoiIGZpbGw9IndoaXRlIi8+CjwvbWFzaz4KPGcgbWFzaz0idXJsKCNtYXNrMF84OTNfMjU5OSkiPgo8cGF0aCBkPSJNMzk3Ljc0NiAwSDExNS43NDZDNTIuMjMzMyAwIDAuNzQ2MDk0IDUxLjQ4NzMgMC43NDYwOTQgMTE1VjM5N0MwLjc0NjA5NCA0NjAuNTEzIDUyLjIzMzMgNTEyIDExNS43NDYgNTEySDM5Ny43NDZDNDYxLjI1OSA1MTIgNTEyLjc0NiA0NjAuNTEzIDUxMi43NDYgMzk3VjExNUM1MTIuNzQ2IDUxLjQ4NzMgNDYxLjI1OSAwIDM5Ny43NDYgMFoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl84OTNfMjU5OSkiLz4KPHBhdGggZD0iTTQxNy40MzYgMTU4LjI5MUM0MjguMDg0IDMwMi41MDcgMzM1LjM4MiAzNzAuNjcgMjUyLjI3NyAzNzcuOTM5QzE3NS4wMTQgMzg0LjY5NiAxMDIuMjg3IDMzNy4yMjEgOTUuOTA2NyAyNjQuMjc5QzkwLjY0MzYgMjA0LjAxNyAxMjcuODg5IDE3OC4zNjEgMTU3LjE1MiAxNzUuODA0QzE4Ny4yNDkgMTczLjE2NSAyMTIuNTQyIDE5My45MjEgMjE0LjczNiAyMTkuMDUyQzIxNi44NDkgMjQzLjIxMyAyMDEuNzczIDI1NC4yMTEgMTkxLjI4OCAyNTUuMTI2QzE4Mi45OTYgMjU1Ljg1MyAxNzIuNTY0IDI1MC44MTkgMTcxLjYyMiAyNDAuMDFDMTcwLjgxNCAyMzAuNzIyIDE3NC4zNDEgMjI5LjQ1NyAxNzMuNDc5IDIxOS41OUMxNzEuOTQ1IDIwMi4wMjQgMTU2LjYyNyAxOTkuOTc4IDE0OC4yNDEgMjAwLjcwNUMxMzguMDkyIDIwMS41OTQgMTE5LjY3OCAyMTMuNDM5IDEyMi4yNjIgMjQyLjk0NEMxMjQuODYgMjcyLjcwNSAxNTMuMzk2IDI5Ni4yMjEgMTkwLjgwMyAyOTIuOTVDMjMxLjE3MSAyODkuNDIzIDI1OS4yNzYgMjU3Ljk5MyAyNjEuMzkgMjEzLjkxQzI2MS4zNyAyMTEuNTc1IDI2MS44NjIgMjA5LjI2NCAyNjIuODMgMjA3LjEzOUwyNjIuODQzIDIwNy4wODZDMjYzLjI3OCAyMDYuMTYyIDI2My43ODcgMjA1LjI3NSAyNjQuMzY0IDIwNC40MzRDMjY1LjIyNiAyMDMuMTQyIDI2Ni4zMyAyMDEuNzE1IDI2Ny43NTYgMjAwLjE1M0MyNjcuNzcgMjAwLjExMyAyNjcuNzcgMjAwLjExMyAyNjcuNzk3IDIwMC4xMTNDMjY4LjgzMyAxOTguOTQyIDI3MC4wODUgMTk3LjY3NyAyNzEuNDk4IDE5Ni4zMTdDMjg5LjEzMiAxNzkuNjggMzUyLjYzOCAxNDAuNDQzIDQxMi42OTggMTUyLjg2N0M0MTMuOTY4IDE1My4xMzkgNDE1LjExNSAxNTMuODE0IDQxNS45NjkgMTU0Ljc5MkM0MTYuODIzIDE1NS43NyA0MTcuMzM3IDE1Ni45OTcgNDE3LjQzNiAxNTguMjkxWiIgZmlsbD0id2hpdGUiLz4KPC9nPgo8L2c+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfODkzXzI1OTkiIHgxPSI1MTIuNDQiIHkxPSI4Ni41MTkiIHgyPSIxOC4wMjE5IiB5Mj0iMjc5LjUwMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMENDNUZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwN0ZGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzg5M18yNTk5Ij4KPHJlY3Qgd2lkdGg9IjUxMyIgaGVpZ2h0PSI1MTIiIGZpbGw9IndoaXRlIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg==';
    config: Required<ImTokenAdapterConfig>;
    private _readyState: WalletReadyState = WalletReadyState.Loading;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: ImTokenAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[ImTokenAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
            openAppWithDeeplink,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (supportImToken()) {
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
     * Get network information.
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
            this.checkIfOpenApp();
            if (this.connected || this.connecting) return;
            await this._checkWallet();
            if (this.readyState === WalletReadyState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            const wallet = this._wallet as TronLinkWallet;
            const address = wallet.tronWeb.defaultAddress?.base58 || '';
            this.setAddress(address);
            this.setState(AdapterState.Connected);
            this.emit('connect', this.address || '');
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
        this.checkIfOpenApp();
        await this._checkWallet();
        if (!this.connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as TronLinkWallet;
    }

    private checkReadyInterval: ReturnType<typeof setInterval> | null = null;
    private checkForWalletReady() {
        if (this.checkReadyInterval) {
            return;
        }
        let times = 0;
        const maxTimes = Math.floor(this.config.checkTimeout / 200);
        const check = async () => {
            if (this._wallet && this._wallet.ready) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
                await this._updateWallet();
                this.emit('connect', this.address || '');
            } else if (times > maxTimes) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
            } else {
                times++;
            }
        };
        this.checkReadyInterval = setInterval(check, 200);
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if wallet exists
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
                const isSupport = supportImToken();
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

    private checkIfOpenApp() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openImTokenApp()) {
            throw new WalletNotFoundError();
        }
    }
    private _updateWallet = async () => {
        let state = this.state;
        let address = this.address;
        if (supportImToken()) {
            this._wallet = {
                ready: window.tronWeb?.ready || false,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                tronWeb: window.tronWeb!,
                request: () => Promise.resolve(null),
            };
            address = this._wallet.tronWeb.defaultAddress?.base58 || null;
            state = this._wallet.ready ? AdapterState.Connected : AdapterState.Disconnect;
            if (!this._wallet.ready) {
                this.checkForWalletReady();
            }
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
