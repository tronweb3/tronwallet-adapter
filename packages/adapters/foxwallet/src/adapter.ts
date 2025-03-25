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
    isInMobileBrowser,
    WalletConnectionError,
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
import { openFoxWallet, supportFoxWallet } from './utils.js';

declare global {
    interface Window {
        foxwallet?: {
            tronLink: TronLinkWallet;
        };
    }
}

export interface FoxWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if Bitget Wallet is supported.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open Wallet's website url when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;
    /**
     * Set if open Bitget Wallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const FoxWalletAdapterName = 'FoxWallet' as AdapterName<'FoxWallet'>;

export class FoxWalletAdapter extends Adapter {
    name = FoxWalletAdapterName;
    url = 'https://foxwallet.com/';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQxIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDE0MSAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHg9IjAuNSIgd2lkdGg9IjE0MCIgaGVpZ2h0PSIxNDAiIHJ4PSI0IiBmaWxsPSJibGFjayIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTkwLjI5NDQgMzMuNTk2NUM4NC40OTMxIDMwLjUyNTMgODAuMDg5MyAyNS4xMzAyIDc4LjM1MDYgMTguNjQ2NUM3Ny44MTQzIDIwLjYyOSA3Ny41MzgxIDIyLjcwOSA3Ny41MzgxIDI0Ljg1NEM3Ny41MzgxIDI2LjUyNzcgNzcuNzE2OCAyOC4xNTI3IDc4LjA0MTggMjkuNzI5Qzc4LjA0MTggMjkuNzI5IDc4LjA0MTggMjkuNzI5IDc4LjA0MTggMjkuNzQ1M0M3OC4wNDE4IDI5Ljc2MTUgNzguMDU4MSAyOS43OTQgNzguMDU4MSAyOS44MTAzQzc4LjQ5NjggMzEuOTIyOCA3OS4yMTE4IDMzLjkyMTUgODAuMTcwNiAzNS43NzRDNzguMTIzMSAzNC4yNjI4IDc2LjMwMzEgMzIuNDU5IDc0Ljc3NTYgMzAuNDI3OEM3Mi43MjgxIDQ2LjMwNCA3OC40OTY4IDYyLjgzMDMgODkuMDQzMSA3My43MTc4QzEwMi44MDcgODkuNzQwMyA5MC4xMTU2IDExNi45MjcgNjguNjY1NiAxMTYuMjEyQzM4LjMxMDUgMTE2LjQ3MiAzMy4xMTA1IDcxLjc2NzggNjIuMjMwNiA2NC43NDc4TDYyLjIxNDMgNjQuNjY2NkM2OS45ODE4IDYyLjE0NzggNzMuNjIxOCA1Ny4wOTQgNzQuMjU1NiA1MC41MjlDNjMuMDQzMSA1OS42MTI4IDQ1LjMzMDUgNDguMzUxNSA0OS4wMDMxIDM0LjI0NjVDNi45MTU1IDU0Ljk2NTMgMjIuNTQ4IDEyMi4xNzUgNzAuMjU4MSAxMjEuMzQ3QzkxLjA0MTkgMTIxLjM0NyAxMDguNjI0IDEwNy41OTkgMTE0LjM5MyA4OC43MDAzQzEyMS4yODMgNjYuNjY1MyAxMTAuMTM2IDQzLjE4NCA5MC4yOTQ0IDMzLjU5NjVaIiBmaWxsPSIjMTJGRTc0Ii8+Cjwvc3ZnPgo=';
    config: Required<FoxWalletAdapterConfig>;
    private _readyState: WalletReadyState = WalletReadyState.Loading;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: FoxWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[FoxWalletAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
            openAppWithDeeplink,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;
        if (!isInMobileBrowser()) {
            // Currently FoxWallet extension does not support Tron.
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (supportFoxWallet()) {
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
                        'The same DApp has already initiated a request to connect to FoxWallet, and the pop-up window has not been closed.'
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
            if (this._wallet?.tronWeb?.defaultAddress?.base58) {
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
                const isSupport = supportFoxWallet();
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
        if (openFoxWallet()) {
            throw new WalletNotFoundError();
        }
    }

    private _updateWallet = () => {
        let state = this.state;
        let address = this.address;
        if (supportFoxWallet()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = window.foxwallet!.tronLink;
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            state = address ? AdapterState.Connected : AdapterState.Disconnect;
        } else {
            this._wallet = null;
            address = null;
            state = AdapterState.NotFound;
        }
        if (isInMobileBrowser() && state === AdapterState.Disconnect) {
            this.checkForWalletReady();
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
