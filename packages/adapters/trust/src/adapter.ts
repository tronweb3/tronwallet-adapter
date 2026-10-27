import {
    AdapterState,
    isInBrowser,
    isInMobileBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletSignTransactionError,
    WalletGetNetworkError,
    AddonAdapter,
    WalletError,
    assertConnectAddress,
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
import { getTrustProvider, openTrustWallet, supportTrust } from './utils.js';

declare global {
    interface Window {
        trustwallet?: {
            tronLink?: TronLinkWallet;
            tron?: TronLinkWallet;
        };
    }
}

export type TrustAdapterConfig = BaseAdapterConfig;

export const TrustAdapterName = 'Trust' as AdapterName<'Trust'>;

export class TrustAdapter extends AddonAdapter {
    name = TrustAdapterName;
    url = 'https://trustwallet.com';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTgiIGhlaWdodD0iNjUiIHZpZXdCb3g9IjAgMCA1OCA2NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgOS4zODk0OUwyOC44OTA3IDBWNjUuMDA0MkM4LjI1NDUgNTYuMzM2OSAwIDM5LjcyNDggMCAzMC4zMzUzVjkuMzg5NDlaIiBmaWxsPSIjMDUwMEZGIi8+CjxwYXRoIGQ9Ik01Ny43ODIyIDkuMzg5NDlMMjguODkxNSAwVjY1LjAwNDJDNDkuNTI3NyA1Ni4zMzY5IDU3Ljc4MjIgMzkuNzI0OCA1Ny43ODIyIDMwLjMzNTNWOS4zODk0OVoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yMjAxXzY5NDIpIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMjIwMV82OTQyIiB4MT0iNTEuMzYxNSIgeTE9Ii00LjE1MjkzIiB4Mj0iMjkuNTM4NCIgeTI9IjY0LjUxNDciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjAyMTEyIiBzdG9wLWNvbG9yPSIjMDAwMEZGIi8+CjxzdG9wIG9mZnNldD0iMC4wNzYyNDIzIiBzdG9wLWNvbG9yPSIjMDA5NEZGIi8+CjxzdG9wIG9mZnNldD0iMC4xNjMwODkiIHN0b3AtY29sb3I9IiM0OEZGOTEiLz4KPHN0b3Agb2Zmc2V0PSIwLjQyMDA0OSIgc3RvcC1jb2xvcj0iIzAwOTRGRiIvPgo8c3RvcCBvZmZzZXQ9IjAuNjgyODg2IiBzdG9wLWNvbG9yPSIjMDAzOEZGIi8+CjxzdG9wIG9mZnNldD0iMC45MDI0NjUiIHN0b3AtY29sb3I9IiMwNTAwRkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K';

    config: Required<TrustAdapterConfig>;

    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLinkWallet | null;
    private _address: string | null;

    constructor(config: TrustAdapterConfig = {}) {
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
        if (!isInMobileBrowser()) {
            // Desktop: poll for the extension to inject.
            this._checkWallet().then(() => {
                if (this.connected) {
                    this.emit('connect', this.address || '');
                }
            });
        } else if (supportTrust()) {
            // Mobile + wallet already injected (e.g. inside the Trust iOS/Android
            // app's in-app browser, or after the extension loaded): skip polling.
            this._readyState = WalletReadyState.Found;
            this._updateWallet().then(() => {
                if (this.connected) {
                    this.emit('connect', this.address || '');
                }
            });
        } else {
            // Mobile + wallet not yet injected: poll so the adapter picks it up
            // once the user opens the dapp inside the Trust app via the deeplink.
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
     * Get network information used by Trust.
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

    protected async _connect(): Promise<void> {
        try {
            if (!(await this._beforeConnect())) return;
            if (!this._wallet) return;
            this._connecting = true;
            const wallet = this._wallet as TronLinkWallet;
            // The Trust mobile app's `window.trustwallet.tron` has no `request` method:
            // it is already authorized when injected, so read the address directly.
            if (typeof wallet.request === 'function') {
                const res = await wallet.request({ method: 'tron_requestAccounts' });
                if (!res) {
                    throw new WalletConnectionError('Request connect error.');
                }
                if (res.code === 4000) {
                    throw new WalletConnectionError(
                        'The same DApp has already initiated a request to connect to trustwallet, and the pop-up window has not been closed.'
                    );
                }
                if (res.code === 4001) {
                    throw new WalletConnectionError('The user rejected connection.');
                }
            }

            const address = assertConnectAddress(wallet.tronWeb.defaultAddress?.base58);
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

    private async _checkAndSign<T>(
        action: (wallet: TronLinkWallet) => Promise<T>,
        ErrorConstructor: typeof WalletSignTransactionError | typeof WalletSignMessageError
    ): Promise<T> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                return await action(wallet);
            } catch (error: any) {
                if (error instanceof Error || (typeof error === 'object' && error.message)) {
                    throw new ErrorConstructor(error.message, error);
                } else if (typeof error === 'string') {
                    throw new ErrorConstructor(error, new Error(error));
                } else {
                    throw new ErrorConstructor('Unknown error', error);
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        return this._checkAndSign((wallet) => wallet.tronWeb.trx.sign(transaction), WalletSignTransactionError);
    }

    async multiSign(transaction: Transaction, options: { permissionId?: number } = {}): Promise<SignedTransaction> {
        return this._checkAndSign(
            (wallet) => wallet.tronWeb.trx.multiSign(transaction, undefined, options.permissionId),
            WalletSignTransactionError
        );
    }

    async signMessage(message: string): Promise<string> {
        return this._checkAndSign(async (wallet) => wallet.tronWeb.trx.signMessageV2(message), WalletSignMessageError);
    }

    private async checkAndGetWallet() {
        this.checkIfopenTrustWallet();
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
        this._eventGeneration++;
        if (this._accountsChangedTimer) {
            clearTimeout(this._accountsChangedTimer);
            this._accountsChangedTimer = null;
        }
        window.removeEventListener('message', this.messageHandler);
    }

    private _accountsChangedTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     * Incremented whenever the listening session ends. Deferred `accountsChanged`
     * work and the awaited `connect` handler capture the value before they yield and
     * abandon themselves if it no longer matches, so an event that started before
     * `disconnect()` cannot write state after it.
     */
    private _eventGeneration = 0;

    private messageHandler = async (e: TronLinkMessageEvent) => {
        if (e.origin !== window.location.origin) {
            return;
        }

        const message = e.data?.message;
        if (!message) {
            return;
        }
        if (message.action === 'accountsChanged') {
            if (this._accountsChangedTimer) {
                clearTimeout(this._accountsChangedTimer);
            }
            const generation = this._eventGeneration;
            this._accountsChangedTimer = setTimeout(async () => {
                this._accountsChangedTimer = null;
                if (generation !== this._eventGeneration) return;
                const preAddr = this.address || '';
                const curAddr = (message.data as AccountsChangedEventData).address || '';
                // An empty account is a disconnection, not a connection to the empty
                // address. Going Connected here leaves `connected === true` with no
                // address, and the block below then emits `disconnect` against a state
                // that still says Connected.
                if (curAddr && (this._wallet as TronLinkWallet)?.ready) {
                    try {
                        await this.checkSecurity();
                    } catch {
                        if (generation !== this._eventGeneration) return;
                        this.setAddress(null);
                        this.setState(AdapterState.Disconnect);
                        return;
                    }
                    // `checkSecurity()` was awaited, so the session may have ended while it
                    // was pending — re-check before writing any state.
                    if (generation !== this._eventGeneration) return;
                    this.setAddress(curAddr);
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
            const generation = this._eventGeneration;
            // Trust may post a `connect` message before the address is available;
            // ignore it so we don't report a connection (and emit connect) with no address.
            if (!(this._wallet as TronLinkWallet).tronWeb?.defaultAddress?.base58) {
                return;
            }
            try {
                await this.checkSecurity();
            } catch {
                // A stale rejection must not tear down a session that has since been
                // re-established, so the generation is honoured on this path too.
                if (generation !== this._eventGeneration) return;
                this.setAddress(null);
                this.setState(AdapterState.Disconnect);
                return;
            }
            // `checkSecurity()` was awaited, so the session may have ended while it
            // was pending — re-check before writing any state.
            if (generation !== this._eventGeneration) return;
            // Re-read after the await: the account may have changed or been cleared
            // while the check was pending.
            const address = (this._wallet as TronLinkWallet).tronWeb?.defaultAddress?.base58 || '';
            if (!address) return;
            const isCurConnected = this.connected;
            const preAddress = this.address || '';
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

    private checkIfopenTrustWallet() {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openTrustWallet()) {
            throw new WalletNotFoundError();
        }
    }

    protected _openAppByDeepLinkIfNeed(): boolean {
        if (this.config.openAppWithDeeplink === false) {
            return false;
        }
        return openTrustWallet();
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * Detection polls for the full `checkTimeout` only once. Later attempts re-check a
     * single time, so retrying is free when the wallet is genuinely absent.
     */
    private _hasRunInitialDetection = false;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if trustwallet exists
     */
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
                const isSupport = supportTrust();
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    const update = this._updateWallet();
                    this.emit('readyStateChanged', this.readyState);
                    // Resolve only after `_updateWallet` settles: it awaits `checkSecurity()`, and
                    // callers read `this.connected` as soon as detection resolves.
                    update.then(
                        () => resolve(isSupport),
                        () => resolve(isSupport)
                    );
                }
            };
            timer = setInterval(check, interval);
            check();
        });
        this._checkPromise = detection;
        // Never cache a failed detection. The extension may inject late, be switched on at
        // runtime, or a mobile WebView may still be initialising — in all of those cases the
        // next call has to look again instead of replaying the old negative answer.
        void detection.then((found) => {
            if (!found && this._checkPromise === detection) {
                this._checkPromise = null;
            }
        });
        return detection;
    }

    private _updateWallet = async () => {
        let state;
        let address;
        if (supportTrust()) {
            this._wallet = getTrustProvider()!;
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
