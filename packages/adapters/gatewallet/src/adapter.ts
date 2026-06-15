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
    EventEmitter,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { TronWeb, TronLinkWallet, ReqestAccountsResponse } from '@tronweb3/tronwallet-adapter-tronlink';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { openGateWallet, supportGateWallet, isInGateApp } from './utils.js';

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

export type GateWalletAdapterConfig = BaseAdapterConfig;

export const GateWalletAdapterName = 'Gate Wallet' as AdapterName<'Gate Wallet'>;

export class GateWalletAdapter extends AddonAdapter {
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
        if (supportGateWallet()) {
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
            if (!(await this._beforeConnect())) return;
            if (!this._wallet) return;
            this._connecting = true;
            const wallet = this._wallet;
            const method = isInGateApp() ? 'tron_requestAccounts' : 'eth_requestAccounts';

            let address = '';
            if (!isInGateApp()) {
                // gatewallet extension has a bug when it's already connected but send a new request
                await this._updateWallet();
                if (this.state !== AdapterState.Connected) {
                    const timeoutId = setTimeout(() => {
                        console.warn(
                            '[GateWallet] wallet.request({ method }) did not respond within 5 seconds and there may be a problem with the wallet. Please try to reload page.'
                        );
                    }, 5000);

                    let res: any;
                    try {
                        res = await wallet.request({ method });
                    } finally {
                        clearTimeout(timeoutId);
                    }

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
                    address = (res as Array<string>)[0] || '';
                } else {
                    address = this.address || '';
                }
            } else {
                const timeoutId = setTimeout(() => {
                    console.warn('[GateWallet] wallet.request({ method }) did not respond within 5 seconds');
                }, 5000);

                let res: any;
                try {
                    res = await wallet.request({ method });
                } finally {
                    clearTimeout(timeoutId);
                }

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
                address = wallet.tronWeb.defaultAddress?.base58 || '';
            }

            if (isInGateApp() && !address) {
                // On mobile (GateWallet App), only treat the wallet as connected when an
                // address was actually returned; an empty address means it didn't succeed.
                this.setAddress(null);
                this.setState(AdapterState.Disconnect);
                throw new WalletConnectionError('Request connect error.');
            }
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
        this.checkIfOpenGateWallet();
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as TronLinkWallet;
    }

    private _listenEvent() {
        this._stopListenEvent();
        if (isInGateApp()) return;
        (this._wallet as TronWallet)?.on?.('accountsChanged', this.onGateAccountChange);
    }

    private _stopListenEvent() {
        if (isInGateApp()) return;
        (this._wallet as TronWallet)?.off?.('accountsChanged', this.onGateAccountChange);
    }

    private onGateAccountChange = (res: GateAccountChangeEventRes) => {
        setTimeout(async () => {
            const preAddr = this.address || '';
            if (res.length !== 0) {
                // The wallet just connected / switched accounts — gate it with the security check.
                try {
                    await this.checkSecurity();
                } catch {
                    this.setAddress(null);
                    this.setState(AdapterState.Disconnect);
                    return;
                }
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
    protected _openAppByDeepLinkIfNeed(): boolean {
        if (this.config.openAppWithDeeplink === false) {
            return false;
        }
        return openGateWallet();
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if GateWallet exists
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

    private _updateWallet = async () => {
        let state = this.state;
        let address = this.address;
        if (supportGateWallet()) {
            this._wallet = isInGateApp() ? window.gatewallet!.tronLink : window.gatewallet!.tron;
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
