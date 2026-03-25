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
    WalletError,
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
import { supportOneKey } from './utils.js';

declare global {
    interface Window {
        $onekey?: {
            tron: TronLinkWallet;
        };
    }
}

export interface OneKeyAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if OneKey wallet exists.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
}

export const OneKeyAdapterName = 'OneKey' as AdapterName<'OneKey'>;

export class OneKeyAdapter extends Adapter {
    name = OneKeyAdapterName;
    url = 'https://onekey.so/download';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNi42NjY2NyIgZmlsbD0iIzQ0RDYyQyIvPgo8cGF0aCBkPSJNMTcuNDQ1NyA2Ljc4MzJMMTIuOTk0NSA2Ljc4MzJMMTIuMjEzNiA5LjE0NDQ2SDE0LjY4NTlMMTQuNjg1OSAxNC4xMTgySDE3LjQ0NTdWNi43ODMyWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMS4wNzY0IDIwLjEzNzhDMjEuMDc2NCAyMi45NDEzIDE4LjgwMzcgMjUuMjE0MSAxNi4wMDAxIDI1LjIxNDFDMTMuMTk2NiAyNS4yMTQxIDEwLjkyMzggMjIuOTQxMyAxMC45MjM4IDIwLjEzNzhDMTAuOTIzOCAxNy4zMzQyIDEzLjE5NjYgMTUuMDYxNSAxNi4wMDAxIDE1LjA2MTVDMTguODAzNyAxNS4wNjE1IDIxLjA3NjQgMTcuMzM0MiAyMS4wNzY0IDIwLjEzNzhaTTE4Ljc3MTggMjAuMTM3OEMxOC43NzE4IDIxLjY2ODUgMTcuNTMwOSAyMi45MDk1IDE2LjAwMDEgMjIuOTA5NUMxNC40NjkzIDIyLjkwOTUgMTMuMjI4NCAyMS42Njg1IDEzLjIyODQgMjAuMTM3OEMxMy4yMjg0IDE4LjYwNyAxNC40NjkzIDE3LjM2NiAxNi4wMDAxIDE3LjM2NkMxNy41MzA5IDE3LjM2NiAxOC43NzE4IDE4LjYwNyAxOC43NzE4IDIwLjEzNzhaIiBmaWxsPSJibGFjayIvPgo8L3N2Zz4K';

    config: Required<OneKeyAdapterConfig>;

    private _readyState: WalletReadyState = isInBrowser()
        ? supportOneKey()
            ? WalletReadyState.Found
            : WalletReadyState.Loading
        : WalletReadyState.NotFound;
    private _state: AdapterState = isInBrowser()
        ? supportOneKey()
            ? AdapterState.Disconnect
            : AdapterState.Loading
        : AdapterState.NotFound;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: OneKeyAdapterConfig = {}) {
        super();
        const { checkTimeout = 2 * 1000, openUrlWhenWalletNotFound = true } = config;

        if (typeof checkTimeout !== 'number') {
            throw new Error('[OneKeyAdapter] config.checkTimeout should be a number');
        }

        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;
        if (this.readyState === WalletReadyState.Found) {
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
     * Get network information used by OneKey.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            const wallet = this._wallet;
            if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
            return await getNetworkInfoByTronWeb(wallet.tronWeb);
        } catch (e: any) {
            const err =
                e instanceof WalletError ? e : new WalletGetNetworkError(e?.message || 'Failed to get network', e);
            this.emit('error', err);
            throw err;
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
            if (!this._wallet) return;
            this._connecting = true;
            const wallet = this._wallet as TronLinkWallet;
            const res = await wallet.request({ method: 'tron_requestAccounts' });
            if (res?.code === 200) {
                const address = wallet.tronWeb.defaultAddress?.base58 || '';
                this.setAddress(address);
                this.setState(AdapterState.Connected);
                this._listenEvent();
                this.connected && this.emit('connect', this.address || '');
            } else {
                const message = !res
                    ? 'Request connect error.'
                    : res.code === 4000
                    ? 'The user rejected connection.'
                    : res.code === 4001
                    ? 'The same DApp has already initiated a request to connect to onekey wallet, and the pop-up window has not been closed.'
                    : 'Request connect error.';
                throw new WalletConnectionError(message);
            }
        } catch (error: any) {
            const err =
                error instanceof WalletError
                    ? error
                    : new WalletConnectionError(error?.message || 'Unknown error', error);
            this.emit('error', err);
            throw err;
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
    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        return this._checkAndSign((wallet) => wallet.tronWeb.trx.sign(transaction), WalletSignTransactionError);
    }

    async signMessage(message: string): Promise<string> {
        return this._checkAndSign(async (wallet) => wallet.tronWeb.trx.signMessageV2(message), WalletSignMessageError);
    }

    private async _checkAndSign<T>(
        action: (wallet: TronLinkWallet) => Promise<T>,
        ErrorConstructor: typeof WalletSignTransactionError | typeof WalletSignMessageError
    ): Promise<T> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            const wallet = this._wallet;
            if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
            try {
                return await action(wallet);
            } catch (error: any) {
                throw new ErrorConstructor(error?.message || error || 'Unknown error', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _listenEvent() {
        this._stopListenEvent();
        window.addEventListener('message', this._messageHandler);
    }

    private _stopListenEvent() {
        window.removeEventListener('message', this._messageHandler);
    }

    private _messageHandler = (e: TronLinkMessageEvent) => {
        const message = e.data?.message;
        if (!message || !message.action) {
            return;
        }
        const { action, data } = message;
        if (action === 'accountsChanged') {
            // Using a timeout to ensure the wallet's internal state is updated
            // before we process the event. This is a workaround for potential race conditions.
            setTimeout(() => {
                const preAddr = this.address || '';
                if ((this._wallet as TronLinkWallet)?.ready) {
                    const address = (data as AccountsChangedEventData).address;
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
        }
    };
    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if onekeywallet exists
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
                const isSupport = supportOneKey();
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
        let state;
        let address;
        if (supportOneKey()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this._wallet = window.$onekey!.tron;
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
