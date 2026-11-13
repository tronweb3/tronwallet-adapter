import {
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletDisconnectedError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    WalletConnectionError,
    WalletError,
    AddonAdapter,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
    Network,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { getLockerProvider, supportLocker } from './utils.js';
import type { LockerTronProvider } from './utils.js';

export type LockerAdapterConfig = BaseAdapterConfig;

export const LockerAdapterName = 'Locker Wallet' as AdapterName<'Locker Wallet'>;

/**
 * Locker Wallet (https://lockerprotocol.com) is a browser extension for Chrome, Brave and Firefox whose keys never sit in
 * the browser: each request is shown as a QR code, checked and signed on Locker Vault, an app on an offline phone, and
 * the signature comes back through the camera. Connecting asks for the account through TIP-1193; signing goes through
 * the provider's `tronWeb` (`trx.sign` for transactions, `trx.signMessageV2` for messages).
 */
export class LockerAdapter extends AddonAdapter {
    name = LockerAdapterName;
    url = 'https://lockerprotocol.com';
    // Locker Wallet's logo, the one it announces through TIP-6963 (a 96 by 96 SVG)
    icon =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iOTYiIGhlaWdodD0iOTYiPgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIyIiBmaWxsPSIjZmZmZmZmIi8+CjxwYXRoIGQ9Ik0gMzUgMTUgSCAxNSBWIDM1IE0gNjUgMTUgSCA4NSBWIDM1IE0gMzUgODUgSCAxNSBWIDY1IE0gNjUgODUgSCA4NSBWIDY1IiBmaWxsPSJub25lIiBzdHJva2U9IiMxRTI5M0IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0gMzUgMTUgSCAxNSBWIDM1IE0gNjUgMTUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzk5MDBDQyIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTSA2NSA4NSBIIDg1IFYgNjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzk5MDBDQyIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTSAzMCAzMCBWIDY5IiBmaWxsPSJub25lIiBzdHJva2U9IiMxRTI5M0IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik0gNDAgMjIgViA3OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTkwMENDIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNIDUwIDIyIFYgNzgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFFMjkzQiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHBhdGggZD0iTSA2MCAyMiBWIDc4IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTAwQ0MiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxwYXRoIGQ9Ik0gNzAgMzAgViA2OSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMUUyOTNCIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4=';

    config: Required<LockerAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: LockerTronProvider | null;
    private _address: string | null;

    constructor(config: LockerAdapterConfig = {}) {
        super(config);
        this.config = {
            ...this.commonConfig,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (supportLocker()) {
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
                return await getNetworkInfoByTronWeb(wallet.tronWeb);
            } catch (err: any) {
                throw new WalletGetNetworkError(err?.message, err);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    protected async _connect(): Promise<void> {
        try {
            if (!(await this._beforeConnect())) return;
            if (!this._wallet) return;
            this._connecting = true;
            const res = (await this._wallet.request({ method: 'tron_requestAccounts' })) as string[] | null;
            if (!res?.[0]) {
                throw new WalletConnectionError('Request connect error.');
            }
            this.setAddress(res[0]);
            this.setState(AdapterState.Connected);
            this.emit('connect', this.address || '');
        } catch (error: any) {
            const err = error instanceof WalletError ? error : new WalletConnectionError(error?.message, error);
            this.emit('error', err);
            throw err;
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
                return await wallet.tronWeb.trx.sign(transaction);
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
                return await wallet.tronWeb.trx.signMessageV2(message);
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
    /**
     * Detection polls for the full `checkTimeout` only once. Later attempts re-check a
     * single time, so retrying is free when the wallet is genuinely absent.
     */
    private _hasRunInitialDetection = false;

    protected _checkWallet(): Promise<boolean> {
        if (this.readyState === WalletReadyState.Found) {
            return Promise.resolve(true);
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }
        const interval = 100;
        const maxTimes = this._hasRunInitialDetection ? 0 : Math.floor(this.config.checkTimeout / interval);
        this._hasRunInitialDetection = true;
        let times = 0,
            timer: ReturnType<typeof setInterval>;

        const detection = new Promise<boolean>((resolve) => {
            const check = () => {
                times++;
                const isSupport = supportLocker();
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
        this._checkPromise = detection;
        // Never cache a failed detection: the extension may inject late or be switched on at runtime.
        void detection.then((found) => {
            if (!found && this._checkPromise === detection) {
                this._checkPromise = null;
            }
        });
        return detection;
    }

    private _updateWallet = () => {
        if (!isInBrowser()) {
            return;
        }
        const provider = getLockerProvider();
        if (provider) {
            this._wallet = provider;
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

    protected _openAppByDeepLinkIfNeed() {
        return false;
    }
}
