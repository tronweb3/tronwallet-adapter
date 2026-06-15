import {
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    AddonAdapter,
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
import { openOkxWallet, supportOkxWallet } from './utils.js';

declare global {
    interface Window {
        okxwallet?: {
            tronLink: TronLinkWallet;
        };
    }
}
export type OkxWalletAdapterConfig = BaseAdapterConfig;

export const OkxWalletAdapterName = 'OKX Wallet' as AdapterName<'OKX Wallet'>;

export class OkxWalletAdapter extends AddonAdapter {
    name = OkxWalletAdapterName;
    url = 'https://okx.com';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTIzLjU1ODMgMTUuODk2NUgxNi40NDc0QzE2LjE0NTMgMTUuODk2NSAxNS45MDA0IDE2LjE0MTQgMTUuOTAwNCAxNi40NDM1VjIzLjU1NDRDMTUuOTAwNCAyMy44NTY1IDE2LjE0NTMgMjQuMTAxNCAxNi40NDc0IDI0LjEwMTRIMjMuNTU4M0MyMy44NjA0IDI0LjEwMTQgMjQuMTA1MyAyMy44NTY1IDI0LjEwNTMgMjMuNTU0NFYxNi40NDM1QzI0LjEwNTMgMTYuMTQxNCAyMy44NjA0IDE1Ljg5NjUgMjMuNTU4MyAxNS44OTY1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTE2LjQ0NzQgMTYuMzk2NUgyMy41NTgzQzIzLjU4NDIgMTYuMzk2NSAyMy42MDUzIDE2LjQxNzUgMjMuNjA1MyAxNi40NDM1VjIzLjU1NDRDMjMuNjA1MyAyMy41ODAzIDIzLjU4NDIgMjMuNjAxNCAyMy41NTgzIDIzLjYwMTRIMTYuNDQ3NEMxNi40MjE0IDIzLjYwMTQgMTYuNDAwNCAyMy41ODAzIDE2LjQwMDQgMjMuNTU0NFYxNi40NDM1QzE2LjQwMDQgMTYuNDE3NSAxNi40MjE0IDE2LjM5NjUgMTYuNDQ3NCAxNi4zOTY1WiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTUiLz4KPHBhdGggZD0iTTE1LjM1MDMgNy42OTE0MUg4LjIzOTM3QzcuOTM3MjggNy42OTE0MSA3LjY5MjM4IDcuOTM2MyA3LjY5MjM4IDguMjM4NFYxNS4zNDkzQzcuNjkyMzggMTUuNjUxNCA3LjkzNzI4IDE1Ljg5NjMgOC4yMzkzNyAxNS44OTYzSDE1LjM1MDNDMTUuNjUyMyAxNS44OTYzIDE1Ljg5NzIgMTUuNjUxNCAxNS44OTcyIDE1LjM0OTNWOC4yMzg0QzE1Ljg5NzIgNy45MzYzIDE1LjY1MjMgNy42OTE0MSAxNS4zNTAzIDcuNjkxNDFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNOC4yMzkzNyA4LjE5MTQxSDE1LjM1MDNDMTUuMzc2MiA4LjE5MTQxIDE1LjM5NzIgOC4yMTI0NSAxNS4zOTcyIDguMjM4NFYxNS4zNDkzQzE1LjM5NzIgMTUuMzc1MiAxNS4zNzYyIDE1LjM5NjMgMTUuMzUwMyAxNS4zOTYzSDguMjM5MzdDOC4yMTM0MiAxNS4zOTYzIDguMTkyMzggMTUuMzc1MiA4LjE5MjM4IDE1LjM0OTNWOC4yMzg0QzguMTkyMzggOC4yMTI0NCA4LjIxMzQyIDguMTkxNDEgOC4yMzkzNyA4LjE5MTQxWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTUiLz4KPHBhdGggZD0iTTMxLjc2MDQgNy42OTE0MUgyNC42NDk1QzI0LjM0NzQgNy42OTE0MSAyNC4xMDI1IDcuOTM2MyAyNC4xMDI1IDguMjM4NFYxNS4zNDkzQzI0LjEwMjUgMTUuNjUxNCAyNC4zNDc0IDE1Ljg5NjMgMjQuNjQ5NSAxNS44OTYzSDMxLjc2MDRDMzIuMDYyNSAxNS44OTYzIDMyLjMwNzQgMTUuNjUxNCAzMi4zMDc0IDE1LjM0OTNWOC4yMzg0QzMyLjMwNzQgNy45MzYzIDMyLjA2MjUgNy42OTE0MSAzMS43NjA0IDcuNjkxNDFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjQuNjQ5NSA4LjE5MTQxSDMxLjc2MDRDMzEuNzg2NCA4LjE5MTQxIDMxLjgwNzQgOC4yMTI0NSAzMS44MDc0IDguMjM4NFYxNS4zNDkzQzMxLjgwNzQgMTUuMzc1MiAzMS43ODY0IDE1LjM5NjMgMzEuNzYwNCAxNS4zOTYzSDI0LjY0OTVDMjQuNjIzNiAxNS4zOTYzIDI0LjYwMjUgMTUuMzc1MiAyNC42MDI1IDE1LjM0OTNWOC4yMzg0QzI0LjYwMjUgOC4yMTI0NCAyNC42MjM2IDguMTkxNDEgMjQuNjQ5NSA4LjE5MTQxWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTUiLz4KPHBhdGggZD0iTTE1LjM1MDMgMjQuMDk5Nkg4LjIzOTM3QzcuOTM3MjggMjQuMDk5NiA3LjY5MjM4IDI0LjM0NDUgNy42OTIzOCAyNC42NDY2VjMxLjc1NzVDNy42OTIzOCAzMi4wNTk2IDcuOTM3MjggMzIuMzA0NSA4LjIzOTM3IDMyLjMwNDVIMTUuMzUwM0MxNS42NTI0IDMyLjMwNDUgMTUuODk3MyAzMi4wNTk2IDE1Ljg5NzMgMzEuNzU3NVYyNC42NDY2QzE1Ljg5NzMgMjQuMzQ0NSAxNS42NTI0IDI0LjA5OTYgMTUuMzUwMyAyNC4wOTk2WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTguMjM5MzcgMjQuNTk5NkgxNS4zNTAzQzE1LjM3NjIgMjQuNTk5NiAxNS4zOTczIDI0LjYyMDYgMTUuMzk3MyAyNC42NDY2VjMxLjc1NzVDMTUuMzk3MyAzMS43ODM0IDE1LjM3NjIgMzEuODA0NSAxNS4zNTAzIDMxLjgwNDVIOC4yMzkzN0M4LjIxMzQyIDMxLjgwNDUgOC4xOTIzOCAzMS43ODM0IDguMTkyMzggMzEuNzU3NVYyNC42NDY2QzguMTkyMzggMjQuNjIwNiA4LjIxMzQyIDI0LjU5OTYgOC4yMzkzNyAyNC41OTk2WiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTUiLz4KPHBhdGggZD0iTTMxLjc2MDQgMjQuMDk5NkgyNC42NDk1QzI0LjM0NzQgMjQuMDk5NiAyNC4xMDI1IDI0LjM0NDUgMjQuMTAyNSAyNC42NDY2VjMxLjc1NzVDMjQuMTAyNSAzMi4wNTk2IDI0LjM0NzQgMzIuMzA0NSAyNC42NDk1IDMyLjMwNDVIMzEuNzYwNEMzMi4wNjI1IDMyLjMwNDUgMzIuMzA3NCAzMi4wNTk2IDMyLjMwNzQgMzEuNzU3NVYyNC42NDY2QzMyLjMwNzQgMjQuMzQ0NSAzMi4wNjI1IDI0LjA5OTYgMzEuNzYwNCAyNC4wOTk2WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI0LjY0OTUgMjQuNTk5NkgzMS43NjA0QzMxLjc4NjQgMjQuNTk5NiAzMS44MDc0IDI0LjYyMDYgMzEuODA3NCAyNC42NDY2VjMxLjc1NzVDMzEuODA3NCAzMS43ODM0IDMxLjc4NjQgMzEuODA0NSAzMS43NjA0IDMxLjgwNDVIMjQuNjQ5NUMyNC42MjM2IDMxLjgwNDUgMjQuNjAyNSAzMS43ODM0IDI0LjYwMjUgMzEuNzU3NVYyNC42NDY2QzI0LjYwMjUgMjQuNjIwNiAyNC42MjM2IDI0LjU5OTYgMjQuNjQ5NSAyNC41OTk2WiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMTUiLz4KPC9zdmc+Cg==';

    config: Required<OkxWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: OkxWalletAdapterConfig = {}) {
        super(config);
        this.config = {
            ...this.commonConfig,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (supportOkxWallet()) {
            this._readyState = WalletReadyState.Found;
            this._updateWallet().then(() => {
                if (this.connected) {
                    this.emit('connect', this.address || '');
                }
            });
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
     * Get network information used by OkxWallet.
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
            if (!(await this._beforeConnect())) return;
            if (!this._wallet) return;
            this._connecting = true;
            const wallet = this._wallet as TronLinkWallet;
            const res = await wallet.request({ method: 'tron_requestAccounts' });
            if (!res) {
                throw new WalletConnectionError('Request connect error.');
            }
            if (res.code === 4000) {
                throw new WalletConnectionError(
                    'The same DApp has already initiated a request to connect to OkxWallet, and the pop-up window has not been closed.'
                );
            }
            if (res.code === 4001) {
                throw new WalletConnectionError('The user rejected connection.');
            }

            const address = wallet.tronWeb.defaultAddress?.base58 || '';
            this.setAddress(address);
            this.setState(AdapterState.Connected);
            this._listenEvent();
            this.connected && this.emit('connect', this.address || '');
        } catch (error: any) {
            const err = error instanceof WalletError ? error : new WalletConnectionError(error?.message, error);
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
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.sign(transaction);
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

    async multiSign(transaction: Transaction, options: { permissionId?: number } = {}): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.multiSign(transaction, undefined, options.permissionId);
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

    async signMessage(message: string): Promise<string> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                return await wallet.tronWeb.trx.signMessageV2(message);
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
        this.checkIfOpenOkxWallet();
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

    private messageHandler = async (e: TronLinkMessageEvent) => {
        const message = e.data?.message;
        if (!message) {
            return;
        }
        if (message.action === 'accountsChanged') {
            setTimeout(async () => {
                const preAddr = this.address || '';
                if ((this._wallet as TronLinkWallet)?.ready) {
                    // Gate the connect transition with the security check.
                    try {
                        await this.checkSecurity();
                    } catch {
                        this.setAddress(null);
                        this.setState(AdapterState.Disconnect);
                        return;
                    }
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
            try {
                await this.checkSecurity();
            } catch {
                this.setAddress(null);
                this.setState(AdapterState.Disconnect);
                return;
            }
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

    private checkIfOpenOkxWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openOkxWallet()) {
            throw new WalletNotFoundError();
        }
    }
    protected _openAppByDeepLinkIfNeed(): boolean {
        if (this.config.openAppWithDeeplink === false) {
            return false;
        }
        return openOkxWallet();
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if OkxWallet exists
     */
    protected _checkWallet(): Promise<boolean> {
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
            const check = async () => {
                times++;
                const isSupport = supportOkxWallet();
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    await this._updateWallet();
                    this.emit('readyStateChanged', this.readyState);
                    resolve(isSupport);
                }
            };
            timer = setInterval(check, interval);
            check();
        });
        return this._checkPromise;
    }

    private _updateWallet = async () => {
        let state = this.state;
        let address = this.address;
        if (supportOkxWallet()) {
            this._wallet = window.okxwallet!.tronLink;
            this._listenEvent();
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            if (address) {
                // Only run the security check once the wallet is actually connected.
                try {
                    await this.checkSecurity();
                } catch {
                    this.setAddress(null);
                    this.setState(AdapterState.Disconnect);
                    return;
                }
                state = AdapterState.Connected;
            } else {
                state = AdapterState.Disconnect;
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
