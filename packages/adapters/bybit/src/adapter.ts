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
import { openBybitWallet, supportBybitWallet } from './utils.js';

declare global {
    interface Window {
        bybitWallet?: {
            tronLink: TronLinkWallet;
        };
    }
}
export interface BybitWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if BybitWallet wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open BybitWallet app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const BybitWalletAdapterName = 'Bybit Wallet' as AdapterName<'Bybit Wallet'>;

export class BybitWalletAdapter extends Adapter {
    name = BybitWalletAdapterName;
    url = 'https://bybit.com/web3';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHZpZXdCb3g9IjAgMCA4OCA4OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMTguN0MwIDguMzcyMjcgOC4zNzIyOCAwIDE4LjcgMEg2OS4zQzc5LjYyNzcgMCA4OCA4LjM3MjI4IDg4IDE4LjdWNjkuM0M4OCA3OS42Mjc3IDc5LjYyNzcgODggNjkuMyA4OEgxOC43QzguMzcyMjcgODggMCA3OS42Mjc3IDAgNjkuM1YxOC43WiIgZmlsbD0iIzQwNDM0NyIvPgo8cGF0aCBkPSJNNy41NzYxNyAyNi44MDY3QzYuNzg1MTYgMjQuMDc4NyA4LjQ3NzUgMjEuMjUzMSAxMS4yNTU5IDIwLjY2M0w1Ny42MDg3IDEwLjgxNzNDNTkuODA5IDEwLjM1IDYyLjA0NDMgMTEuNDQ0MyA2My4wMjQ3IDEzLjQ2ODlMODMuODQ0MyA1Ni40NjU3TDI1LjE3NzYgODcuNTEwMUw3LjU3NjE3IDI2LjgwNjdaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMzEyXzE3NTM0KSIvPgo8cGF0aCBkPSJNOC4xODI0MiAzMC4xNjE4QzcuMzUwNDkgMjcuMjgzOCA5LjI3OTI1IDI0LjM0MTMgMTIuMjUwMiAyMy45NTU5TDczLjY4NjUgMTUuOTg4MUM3Ni4yMzkxIDE1LjY1NzEgNzguNjExMSAxNy4zNjE4IDc5LjExMTEgMTkuODg2N0w4OC4wMDAzIDY0Ljc3NzFMMjQuNjg5MiA4Ny4yNjY1TDguMTgyNDIgMzAuMTYxOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0wIDM0LjIyMjJDMCAyOC44MjIxIDQuMzc3NjYgMjQuNDQ0NSA5Ljc3Nzc4IDI0LjQ0NDVINjguNDQ0NEM3OS4yNDQ3IDI0LjQ0NDUgODggMzMuMTk5OCA4OCA0NFY2OC40NDQ1Qzg4IDc5LjI0NDcgNzkuMjQ0NyA4OCA2OC40NDQ0IDg4SDE5LjU1NTZDOC43NTUzMiA4OCAwIDc5LjI0NDcgMCA2OC40NDQ1VjM0LjIyMjJaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNNTguMjIwMSA2MS4xOTU5VjQyLjg3NTVINjEuNzkzN1Y2MS4xOTU5SDU4LjIyMDFaIiBmaWxsPSIjRjdBNjAwIi8+CjxwYXRoIGQ9Ik0xNy40Mzk1IDY2LjY2MzdIOS43Nzc5NVY0OC4zNDM0SDE3LjEzMTNDMjAuNzA0OSA0OC4zNDM0IDIyLjc4NzQgNTAuMzUwNSAyMi43ODc0IDUzLjQ4OTNDMjIuNzg3NCA1NS41MjE1IDIxLjQ1MDQgNTYuODM0NSAyMC41MjU3IDU3LjI3MjFDMjEuNjMxNSA1Ny43ODY5IDIzLjA0NTYgNTguOTQzOCAyMy4wNDU2IDYxLjM4ODVDMjMuMDQ1NiA2NC44MTA4IDIwLjcwNDkgNjYuNjYzNyAxNy40Mzk1IDY2LjY2MzdaTTE2Ljg0ODEgNTEuNTM0M0gxMy4zNTE2VjU1Ljc1NDhIMTYuODQ4MUMxOC4zNjQyIDU1Ljc1NDggMTkuMjEzOCA1NC45MDY0IDE5LjIxMzggNTMuNjQ1NUMxOS4yMTM4IDUyLjM4MjYgMTguMzY2MiA1MS41MzQzIDE2Ljg0ODEgNTEuNTM0M1pNMTcuMDc5MyA1OC45NzA4SDEzLjM1MTZWNjMuNDcyOEgxNy4wNzkzQzE4LjY5OTQgNjMuNDcyOCAxOS40NyA2Mi40NDMyIDE5LjQ3IDYxLjIwOTJDMTkuNDcyIDU5Ljk3MzMgMTguNjk5NCA1OC45NzA4IDE3LjA3OTMgNTguOTcwOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0zMi44OTI1IDU5LjE1MDFWNjYuNjYzN0gyOS4zNDM5VjU5LjE1MDFMMjMuODQxOSA0OC4zNDM0SDI3LjcyMzhMMzEuMTQzMiA1NS43Mjc4TDM0LjUxMDcgNDguMzQzNEgzOC4zOTI2TDMyLjg5MjUgNTkuMTUwMVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00OC41NjMzIDY2LjY2MzdINDAuOTAxN1Y0OC4zNDM0SDQ4LjI1NTFDNTEuODI4NyA0OC4zNDM0IDUzLjkxMTIgNTAuMzUwNSA1My45MTEyIDUzLjQ4OTNDNTMuOTExMiA1NS41MjE1IDUyLjU3NDIgNTYuODM0NSA1MS42NDk1IDU3LjI3MjFDNTIuNzU1MyA1Ny43ODY5IDU0LjE2OTMgNTguOTQzOCA1NC4xNjkzIDYxLjM4ODVDNTQuMTY3NCA2NC44MTA4IDUxLjgyNjggNjYuNjYzNyA0OC41NjMzIDY2LjY2MzdaTTQ3Ljk3MTkgNTEuNTM0M0g0NC40NzUzVjU1Ljc1NDhINDcuOTcxOUM0OS40ODggNTUuNzU0OCA1MC4zMzc2IDU0LjkwNjQgNTAuMzM3NiA1My42NDU1QzUwLjMzNTcgNTIuMzgyNiA0OS40ODggNTEuNTM0MyA0Ny45NzE5IDUxLjUzNDNaTTQ4LjIwMzEgNTguOTcwOEg0NC40NzUzVjYzLjQ3MjhINDguMjAzMUM0OS44MjMyIDYzLjQ3MjggNTAuNTkzOCA2Mi40NDMyIDUwLjU5MzggNjEuMjA5MkM1MC41OTM4IDU5Ljk3MzQgNDkuODIxMyA1OC45NzA4IDQ4LjIwMzEgNTguOTcwOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik03My40MzkgNTEuNTM0M1Y2Ni42NjM3SDY5Ljg2NTRWNTEuNTM0M0g2NS4wODM5VjQ4LjM0MzRINzguMjIyNFY1MS41MzQzSDczLjQzOVoiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMzEyXzE3NTM0IiB4MT0iNy4zMzMwOCIgeTE9IjI1LjU5NCIgeDI9Ijg0LjYzODEiIHkyPSIyMS43MjE2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGRkQ3NDgiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjdBNjAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==';

    config: Required<BybitWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: BybitWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[BybitWalletAdapter] config.checkTimeout should be a number');
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
        if (supportBybitWallet()) {
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
     * Get network information used by BybitWallet.
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
            this.checkIfOpenBybitWallet();
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
                        'The same DApp has already initiated a request to connect to BybitWallet, and the pop-up window has not been closed.'
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
        this.checkIfOpenBybitWallet();
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

    private checkIfOpenBybitWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openBybitWallet()) {
            throw new WalletNotFoundError();
        }
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if BybitWallet exists
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
                const isSupport = supportBybitWallet();
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
        if (supportBybitWallet()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = window.bybitWallet!.tronLink;
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
