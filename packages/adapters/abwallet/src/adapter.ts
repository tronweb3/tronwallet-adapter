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
import { openABWallet, supportABWallet } from './utils.js';

declare global {
    interface Window {
        abwallet?: {
            tronLink: TronLinkWallet;
        };
    }
}
export interface ABWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if ABWallet wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open ABWallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const ABWalletAdapterName = 'AB Wallet' as AdapterName<'AB Wallet'>;

export class ABWalletAdapter extends Adapter {
    name = ABWalletAdapterName;
    url = 'https://ab.org';
    icon =
        'data:image/png;base64,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';

    config: Required<ABWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: ABWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[ABWalletAdapter] config.checkTimeout should be a number');
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
        if (supportABWallet()) {
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
     * Get network information used by ABWallet.
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
            this.checkIfOpenABWallet();
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
                        'The same DApp has already initiated a request to connect to ABWallet, and the pop-up window has not been closed.'
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
        this.checkIfOpenABWallet();
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

    private checkIfOpenABWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openABWallet()) {
            throw new WalletNotFoundError();
        }
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if ABWallet exists
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
                const isSupport = supportABWallet();
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
        if (supportABWallet()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = window.abwallet!.tronLink;
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
