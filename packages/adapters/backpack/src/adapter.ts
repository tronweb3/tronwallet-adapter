import {
    Adapter,
    AdapterState,
    isInBrowser,
    NetworkType,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletSwitchChainError,
    type AdapterName,
    type BaseAdapterConfig,
    type Network,
    type SignedTransaction,
    type Transaction,
} from '@tronweb3/tronwallet-abstract-adapter';
import {
    getBackpackProvider,
    isInBackpackApp,
    openBackpack,
    supportBackpack,
    type BackpackTronProvider,
} from './utils.js';

const chainIdNetworkMap: Record<string, NetworkType> = {
    '0x2b6653dc': NetworkType.Mainnet,
    '0x94a9059e': NetworkType.Shasta,
    '0xcd8690dc': NetworkType.Nile,
};

export interface BackpackAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in milliseconds for checking if Backpack wallet exists.
     * Default is 2000ms
     */
    checkTimeout?: number;
    /**
     * Set if open Backpack app using DeepLink on mobile.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const BackpackAdapterName = 'Backpack' as AdapterName<'Backpack'>;

export class BackpackAdapter extends Adapter {
    readonly name = BackpackAdapterName;
    readonly url = 'https://backpack.app';
    readonly icon =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDU1IDgwIiBmaWxsPSJub25lIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMyLjcxIDYuMjkwMjZDMzUuNjE3OCA2LjI5MDI2IDM4LjM0NTIgNi42ODAwNSA0MC44NzA1IDcuNDAyOTZDMzguMzk4MiAxLjY0MDg1IDMzLjI2NDkgMCAyNy41NTE5IDBDMjEuODI3NyAwIDE2LjY4NTUgMS42NDcyOSAxNC4yMTg4IDcuNDM2OTJMMTYuNzI1NSA2LjY4ODU2IDE5LjQ0MTIgNi4yOTAyNiAyMi4zMzkgNi4yOTAyNkgzMi43MVpNMjEuNjczOSAxMi4wNzUyQzcuODY2NzcgMTIuMDc1MiAwIDIyLjkzNzEgMCAzNi4zMzZWNTAuMUMwIDUxLjQzOTkgMS4xMTkyOSA1Mi41IDIuNSA1Mi41SDUyLjVDNTMuODgwNyA1Mi41IDU1IDUxLjQzOTkgNTUgNTAuMVYzNi4zMzZDNTUgMjIuOTM3MSA0NS44NTIxIDEyLjA3NTIgMzIuMDQ0OSAxMi4wNzUySDIxLjY3MzlaTTI3LjQ4MDUgMzYuNDU1MUMzMi4zMTMgMzYuNDU1MSAzNi4yMzA1IDMyLjUzNzYgMzYuMjMwNSAyNy43MDUxQzM2LjIzMDUgMjIuODcyNiAzMi4zMTMgMTguOTU1MSAyNy40ODA5IDE4Ljk1NTFDMjIuNjQ4IDE4Ljk1NTEgMTguNzMwNSAyMi44NzI2IDE4LjczMDUgMjcuNzA1MUMxOC43MzA1IDMyLjUzNzYgMjIuNjQ4IDM2LjQ1NTEgMjcuNDgwNSAzNi40NTUxWk0wIDYwLjU5MDFDMCA1OS4yNTAzIDEuMTE5MjkgNTguMTY0MSAyLjUgNTguMTY0MUg1Mi41QzUzLjg4MDcgNTguMTY0MSA1NSA1OS4yNTAzIDU1IDYwLjU5MDFWNzUuMTQ2NkM1NSA3Ny44MjY0IDUyLjc2MTQgNzkuOTk4OCA1MCA3OS45OTg4SDVDMi4yMzg1NyA3OS45OTg4IDAgNzcuODI2NCAwIDc1LjE0NjZWNjAuNTkwMVoiIGZpbGw9IiNFMzNFM0YiLz48L3N2Zz4=';

    config: Required<BackpackAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting = false;
    private _wallet: BackpackTronProvider | null = null;
    private _address: string | null = null;

    constructor(config: BackpackAdapterConfig = {}) {
        super();
        const { checkTimeout = 2000, openUrlWhenWalletNotFound = true, openAppWithDeeplink = true } = config;

        if (typeof checkTimeout !== 'number') {
            throw new Error('[BackpackAdapter] config.checkTimeout should be a number');
        }

        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
            openAppWithDeeplink,
        };

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this._setState(AdapterState.NotFound);
            return;
        }

        if (supportBackpack()) {
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

    get state(): AdapterState {
        return this._state;
    }

    get address(): string | null {
        return this._address;
    }

    get readyState(): WalletReadyState {
        return this._readyState;
    }

    get connected(): boolean {
        return this._state === AdapterState.Connected;
    }

    get connecting(): boolean {
        return this._connecting;
    }

    async connect(): Promise<void> {
        try {
            this._checkIfOpenBackpack();

            if (this.connected || this._connecting) {
                return;
            }

            await this._checkWallet();

            if (this._state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }

            if (!this._wallet) {
                throw new WalletNotFoundError();
            }

            this._connecting = true;

            try {
                const accounts = (await this._wallet.request({
                    method: 'tron_requestAccounts',
                })) as string[];

                if (!accounts || accounts.length === 0) {
                    throw new WalletConnectionError('No accounts returned from Backpack wallet.');
                }

                const address = accounts[0];
                if (!address) {
                    throw new WalletConnectionError('No address returned from Backpack wallet.');
                }

                this._setAddress(address);
                this._setState(AdapterState.Connected);
                this._listenProviderEvents();
            } catch (error: any) {
                if (error?.code === 4001) {
                    throw new WalletConnectionError('The user rejected connection.');
                }
                throw new WalletConnectionError(error?.message || 'Failed to connect to Backpack wallet.', error);
            }

            this.emit('connect', this._address!);
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        this._stopListenProviderEvents();

        if (this._state !== AdapterState.Connected) {
            return;
        }

        try {
            if (this._wallet?.disconnect) {
                await this._wallet.disconnect();
            }
        } catch {
            // Ignore disconnect errors
        }

        this._setAddress(null);
        this._setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signMessage(message: string, privateKey?: string): Promise<string> {
        try {
            const wallet = this._checkConnected();

            if (privateKey) {
                throw new WalletSignMessageError(
                    'Message signing with a client provided private key is not supported by Backpack.'
                );
            }

            try {
                return (await wallet.request({
                    method: 'tron_signMessage',
                    params: { message },
                })) as string;
            } catch (error: any) {
                throw new WalletSignMessageError(error?.message || 'Failed to sign message.', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signTransaction(transaction: Transaction, privateKey?: string): Promise<SignedTransaction> {
        try {
            const wallet = this._checkConnected();

            if (privateKey) {
                throw new WalletSignTransactionError(
                    'Transaction signing with a client provided private key is not supported by Backpack.'
                );
            }

            try {
                return (await wallet.request({
                    method: 'tron_signTransaction',
                    params: { transaction },
                })) as SignedTransaction;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message || 'Failed to sign transaction.', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async multiSign(..._args: unknown[]): Promise<unknown> {
        throw new Error('Multi-sign method not implemented for Backpack wallet.');
    }

    async switchChain(chainId: string): Promise<void> {
        try {
            const wallet = this._checkConnected();

            try {
                await wallet.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId }],
                });
                this.emit('chainChanged', { chainId });
            } catch (error: any) {
                throw new WalletSwitchChainError(error?.message || 'Failed to switch chain.', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async network(): Promise<Network> {
        try {
            const wallet = this._checkConnected();

            try {
                const chainId = (await wallet.request({ method: 'eth_chainId' })) as string;
                return {
                    networkType: chainIdNetworkMap[chainId] || NetworkType.Unknown,
                    chainId,
                    fullNode: '',
                    solidityNode: '',
                    eventServer: '',
                };
            } catch (error: any) {
                throw new WalletGetNetworkError(error?.message || 'Failed to get network info.', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _checkConnected(): BackpackTronProvider {
        if (this._state !== AdapterState.Connected || !this._wallet) {
            throw new WalletDisconnectedError();
        }
        return this._wallet;
    }

    private _checkIfOpenBackpack(): void {
        if (this.config.openAppWithDeeplink === false) {
            return;
        }
        if (openBackpack()) {
            throw new WalletNotFoundError();
        }
    }

    private _checkPromise: Promise<boolean> | null = null;

    private _checkWallet(): Promise<boolean> {
        if (this._readyState === WalletReadyState.Found) {
            return Promise.resolve(true);
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }

        const interval = 100;
        const maxTimes = Math.floor(this.config.checkTimeout / interval);
        let times = 0;
        let timer: ReturnType<typeof setInterval>;

        this._checkPromise = new Promise((resolve) => {
            const check = () => {
                times++;
                const isSupport = supportBackpack();
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    this._updateWallet();
                    this.emit('readyStateChanged', this._readyState);
                    resolve(isSupport);
                }
            };
            timer = setInterval(check, interval);
            check();
        });

        return this._checkPromise;
    }

    private _updateWallet(): void {
        const provider = getBackpackProvider();

        if (provider) {
            this._wallet = provider;
            this._listenProviderEvents();

            // Check for existing connection
            this._checkExistingConnection();
        } else {
            this._wallet = null;
            this._setAddress(null);
            this._setState(AdapterState.NotFound);
        }
    }

    private async _checkExistingConnection(): Promise<void> {
        if (!this._wallet) return;

        try {
            const accounts = (await this._wallet.request({
                method: 'tron_accounts',
            })) as string[];

            if (accounts && accounts.length > 0 && accounts[0]) {
                this._setAddress(accounts[0]);
                this._setState(AdapterState.Connected);
            } else {
                this._setState(AdapterState.Disconnect);
            }
        } catch {
            this._setState(AdapterState.Disconnect);
        }
    }

    private _listenProviderEvents(): void {
        this._stopListenProviderEvents();
        if (this._wallet?.on) {
            this._wallet.on('accountsChanged', this._onAccountsChanged);
            this._wallet.on('chainChanged', this._onChainChanged);
        }
    }

    private _stopListenProviderEvents(): void {
        if (this._wallet?.removeListener) {
            this._wallet.removeListener('accountsChanged', this._onAccountsChanged);
            this._wallet.removeListener('chainChanged', this._onChainChanged);
        }
    }

    private _onAccountsChanged = (accounts: unknown) => {
        const accountList = accounts as string[];
        const prevAddress = this._address;

        if (!accountList || accountList.length === 0) {
            this._setAddress(null);
            this._setState(AdapterState.Disconnect);
            this.emit('accountsChanged', '', prevAddress || '');
            this.emit('disconnect');
        } else {
            const newAddress = accountList[0];
            this._setAddress(newAddress);
            this._setState(AdapterState.Connected);
            this.emit('accountsChanged', newAddress, prevAddress || '');
            if (!prevAddress && newAddress) {
                this.emit('connect', newAddress);
            }
        }
    };

    private _onChainChanged = (chainData: unknown) => {
        const chainId = typeof chainData === 'string' ? chainData : (chainData as { chainId?: string })?.chainId || '';
        this.emit('chainChanged', { chainId });
    };

    private _setAddress(address: string | null): void {
        this._address = address;
    }

    private _setState(state: AdapterState): void {
        if (this._state !== state) {
            this._state = state;
            this.emit('stateChanged', state);
        }
    }
}
