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
    WalletConnectionError,
    WalletError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
    Network,
    TronWeb,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import type { Tron } from '@tronweb3/tronwallet-adapter-tronlink';
import { supportGuarda } from './utils.js';

export interface GuardaAdapterConfig extends BaseAdapterConfig {
    checkTimeout?: number;
    openUrlWhenWalletNotFound?: boolean;
}

export const GuardaAdapterName = 'Guarda' as AdapterName<'Guarda'>;

export interface GuardaWallet {
    ready: boolean;
    tronWeb: TronWeb;
    tron: Tron;
}

declare global {
    interface Window {
        guarda?: GuardaWallet;
    }
}

export class GuardaAdapter extends Adapter {
    name = GuardaAdapterName;
    url = 'https://guarda.com?install=guarda-extensional';
    icon =
        'data:image/svg+xml;utf8,<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M42.988 4.81415C43.0306 4.86441 43.0563 4.92697 43.0613 4.99278C43.0877 5.31552 45.4233 37.3313 23.6002 44.7878C23.5347 44.8103 23.4636 44.8103 23.398 44.7878C1.57567 37.3313 3.91123 5.31552 3.93695 4.99278C3.9422 4.92717 3.96786 4.86486 4.01029 4.81465C4.05273 4.76445 4.10979 4.72891 4.17343 4.71304L23.4251 0.00861373C23.4738 -0.00287124 23.5244 -0.00287124 23.573 0.00861373L42.8241 4.71304C42.888 4.72848 42.9454 4.7639 42.988 4.81415ZM39.4448 8.23253C39.4795 8.27324 39.5006 8.32385 39.5051 8.37725H39.5073C39.5287 8.64049 41.4392 34.7784 23.582 40.865C23.5296 40.885 23.4716 40.885 23.4192 40.865C5.56132 34.7784 7.47248 8.64049 7.49393 8.37725C7.49807 8.32385 7.51897 8.27309 7.55364 8.23238C7.5883 8.19168 7.63494 8.16303 7.68682 8.15057L23.4377 4.30758C23.4776 4.29755 23.5193 4.29755 23.5592 4.30758L39.3115 8.15057C39.3634 8.16318 39.41 8.19188 39.4448 8.23253Z" fill="%23798CE5"/><path d="M23.2759 10.0442L12.7734 12.6047C12.7388 12.6136 12.7078 12.6331 12.6847 12.6604C12.6617 12.6878 12.6477 12.7218 12.6448 12.7575C12.6312 12.9332 11.3574 30.3588 23.2609 34.417C23.2966 34.4284 23.3352 34.4284 23.3709 34.417C35.2745 30.3581 34.0014 12.9332 33.987 12.7568C33.9843 12.721 33.9704 12.6869 33.9471 12.6595C33.9239 12.6322 33.8926 12.613 33.8577 12.6047L23.3559 10.0435C23.3297 10.0365 23.3022 10.0365 23.2759 10.0435" fill="%23798CE5"/></svg>';

    config: Required<GuardaAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: GuardaWallet | null;
    private _address: string | null;

    constructor(config: GuardaAdapterConfig = {}) {
        super();

        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[GuardaAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (supportGuarda()) {
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

    async network(): Promise<Network> {
        try {
            await this._checkWallet();

            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();

            const wallet = this._wallet;
            if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();

            try {
                const networkInfo = await getNetworkInfoByTronWeb(wallet.tronWeb);
                return networkInfo;
            } catch (err: any) {
                throw new WalletGetNetworkError(err?.message, err);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) {
                return;
            }

            await this._checkWallet();

            if (this.readyState === WalletReadyState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }

            if (!this._wallet) {
                return;
            }

            this._connecting = true;
            const wallet = this._wallet as GuardaWallet;

            try {
                const res = await wallet.tron.request({ method: 'eth_requestAccounts' });
                if (!res?.[0]) {
                    throw new WalletConnectionError('Request connect error.');
                }
                const address = res[0];
                this.setAddress(address);
                this.setState(AdapterState.Connected);
                this.emit('connect', this.address || '');
            } catch (error: any) {
                if (error instanceof WalletError) {
                    throw error;
                } else {
                    throw new WalletConnectionError(error?.message, error);
                }
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
        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                const signedTx = await wallet.tronWeb.trx.sign(transaction);
                return signedTx;
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

    async signMessage(message: string): Promise<string> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                const signature = await wallet.tronWeb.trx.signMessage(message);
                return signature;
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
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) {
            throw new WalletDisconnectedError();
        }
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) {
            throw new WalletDisconnectedError();
        }
        return wallet;
    }

    private _checkPromise: Promise<boolean> | null = null;

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
                const isSupport = supportGuarda();
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
        if (!isInBrowser()) {
            return;
        }
        const guarda = window.guarda;
        if (supportGuarda() && guarda) {
            this._wallet = guarda;
            this.setState(AdapterState.Disconnect);
        } else {
            this._wallet = null;
            this.setState(AdapterState.NotFound);
        }
    };

    private setAddress(address: string | null) {
        this._address = address;
    }

    private setState(state: AdapterState) {
        this._state = state;
        this.emit('stateChanged', state);
    }
}
