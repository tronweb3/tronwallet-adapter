/**
 * Backpack TRON Wallet Adapter
 *
 * This adapter integrates Backpack wallet with the TronWallet Adapter system.
 * Backpack implements TIP-1193, TIP-1102, and TIP-6963 standards.
 *
 * @packageDocumentation
 */

import {
    Adapter,
    AdapterState,
    NetworkType,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletError,
    WalletGetNetworkError,
    WalletNotFoundError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletSwitchChainError,
    type AdapterName,
    type Network,
    type SignedTransaction,
    type Transaction,
} from '@tronweb3/tronwallet-abstract-adapter';

const chainIdNetworkMap: Record<string, NetworkType> = {
    '0x2b6653dc': NetworkType.Mainnet,
    '0x94a9059e': NetworkType.Shasta,
    '0xcd8690dc': NetworkType.Nile,
};

/**
 * Backpack TRON Wallet Adapter
 *
 * Connects to Backpack wallet via window.tron or window.tronWeb
 * Supports TIP-1193, TIP-1102, and TIP-6963 standards
 */
export class BackpackAdapter extends Adapter {
    readonly name = 'Backpack' as AdapterName<'Backpack'>;
    readonly url = 'https://backpack.app';
    readonly icon =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDU1IDgwIiBmaWxsPSJub25lIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMyLjcxIDYuMjkwMjZDMzUuNjE3OCA2LjI5MDI2IDM4LjM0NTIgNi42ODAwNSA0MC44NzA1IDcuNDAyOTZDMzguMzk4MiAxLjY0MDg1IDMzLjI2NDkgMCAyNy41NTE5IDBDMjEuODI3NyAwIDE2LjY4NTUgMS42NDcyOSAxNC4yMTg4IDcuNDM2OTJMMTYuNzI1NSA2LjY4ODU2IDE5LjQ0MTIgNi4yOTAyNiAyMi4zMzkgNi4yOTAyNkgzMi43MVpNMjEuNjczOSAxMi4wNzUyQzcuODY2NzcgMTIuMDc1MiAwIDIyLjkzNzEgMCAzNi4zMzZWNTAuMUMwIDUxLjQzOTkgMS4xMTkyOSA1Mi41IDIuNSA1Mi41SDUyLjVDNTMuODgwNyA1Mi41IDU1IDUxLjQzOTkgNTUgNTAuMVYzNi4zMzZDNTUgMjIuOTM3MSA0NS44NTIxIDEyLjA3NTIgMzIuMDQ0OSAxMi4wNzUySDIxLjY3MzlaTTI3LjQ4MDUgMzYuNDU1MUMzMi4zMTMgMzYuNDU1MSAzNi4yMzA1IDMyLjUzNzYgMzYuMjMwNSAyNy43MDUxQzM2LjIzMDUgMjIuODcyNiAzMi4zMTMgMTguOTU1MSAyNy40ODA5IDE4Ljk1NTFDMjIuNjQ4IDE4Ljk1NTEgMTguNzMwNSAyMi44NzI2IDE4LjczMDUgMjcuNzA1MUMxOC43MzA1IDMyLjUzNzYgMjIuNjQ4IDM2LjQ1NTEgMjcuNDgwNSAzNi40NTUxWk0wIDYwLjU5MDFDMCA1OS4yNTAzIDEuMTE5MjkgNTguMTY0MSAyLjUgNTguMTY0MUg1Mi41QzUzLjg4MDcgNTguMTY0MSA1NSA1OS4yNTAzIDU1IDYwLjU5MDFWNzUuMTQ2NkM1NSA3Ny44MjY0IDUyLjc2MTQgNzkuOTk4OCA1MCA3OS45OTg4SDVDMi4yMzg1NyA3OS45OTg4IDAgNzcuODI2NCAwIDc1LjE0NjZWNjAuNTkwMVoiIGZpbGw9IiNFMzNFM0YiLz48L3N2Zz4=';

    private _state: AdapterState = AdapterState.Loading;
    private _address: string | null = null;
    private _connecting = false;
    private _provider: any = null;
    private _readyState: WalletReadyState = WalletReadyState.Loading;

    constructor() {
        super();
        this._detectProvider();
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

    /**
     * Detect Backpack provider
     * Checks for window.tron (TIP-1193) or window.tronWeb (compatibility)
     * Also listens for TIP-6963 announcements
     */
    private _detectProvider(): void {
        if (typeof window === 'undefined') {
            this._setReadyState(WalletReadyState.NotFound);
            this._setState(AdapterState.NotFound);
            return;
        }

        // Check for direct provider injection
        const tron = (window as any).tron;
        const tronWeb = (window as any).tronWeb;

        if (tron && typeof tron.request === 'function') {
            this._provider = tron;
            this._setReadyState(WalletReadyState.Found);
            this._checkExistingConnection();
            return;
        }

        if (tronWeb && typeof tronWeb.request === 'function') {
            this._provider = tronWeb;
            this._setReadyState(WalletReadyState.Found);
            this._checkExistingConnection();
            return;
        }

        // Listen for TIP-6963 provider announcements
        const handleAnnounce = (event: CustomEvent) => {
            const { info, provider } = event.detail;
            const nameMatch = info.name?.toLowerCase() === 'backpack';
            const rdnsMatch = info.rdns?.toLowerCase() === 'app.backpack';
            if (nameMatch || rdnsMatch) {
                this._provider = provider;
                this._setReadyState(WalletReadyState.Found);
                this._checkExistingConnection();
                window.removeEventListener('TIP6963:announceProvider', handleAnnounce as EventListener);
            }
        };

        window.addEventListener('TIP6963:announceProvider', handleAnnounce as EventListener);

        // Request providers to announce themselves
        window.dispatchEvent(new CustomEvent('TIP6963:requestProvider'));

        // If still no provider after a short delay, mark as not found
        setTimeout(() => {
            if (!this._provider) {
                this._setReadyState(WalletReadyState.NotFound);
                this._setState(AdapterState.NotFound);
            }
        }, 100);
    }

    async connect(options?: Record<string, unknown>): Promise<void> {
        try {
            if (this.connected || this._connecting) {
                return;
            }

            if (!this._provider) {
                this._detectProvider();

                if (!this._provider) {
                    throw new WalletNotFoundError('Backpack wallet not found. Please install Backpack wallet.');
                }
            }

            this._connecting = true;
            this._setState(AdapterState.Loading);

            try {
                // Try using connect() method first
                if (typeof this._provider.connect === 'function') {
                    await this._provider.connect();
                }

                // Then request accounts (TIP-1102: eth_requestAccounts)
                const accounts = await this._provider.request({
                    method: 'tron_requestAccounts',
                });

                if (!accounts || accounts.length === 0) {
                    throw new WalletConnectionError('No accounts returned from Backpack wallet.');
                }

                this._address = accounts[0];
                if (!this._address) {
                    throw new WalletConnectionError('No address returned from Backpack wallet.');
                }
                this._setState(AdapterState.Connected);
                this._listenProviderEvents();
                this.emit('connect', this._address);
            } catch (error: any) {
                if (error instanceof WalletError) {
                    throw error;
                }
                throw new WalletConnectionError(error?.message || 'Failed to connect to Backpack wallet.', error);
            }
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
            if (this._provider && typeof this._provider.disconnect === 'function') {
                await this._provider.disconnect();
            }

            this._address = null;
            this._setState(AdapterState.Disconnect);
            this.emit('disconnect');
        } catch (error: any) {
            this.emit('error', error);
            throw new WalletDisconnectedError(error?.message || 'Failed to disconnect from Backpack wallet.', error);
        }
    }

    async multiSign(..._args: any[]): Promise<any> {
        throw new Error('Multi-sign method not implemented.');
    }

    async signMessage(message: string, privateKey?: string): Promise<string> {
        try {
            if (this._state !== AdapterState.Connected || !this._address) {
                throw new WalletDisconnectedError();
            }

            if (privateKey) {
                throw new WalletSignMessageError(
                    'Message signing with a client provided private key is not supported by Backpack.'
                );
            }

            try {
                // Try using signMessage() method first
                if (typeof this._provider.signMessage === 'function') {
                    return await this._provider.signMessage(message);
                }

                // Fallback to request() method
                return await this._provider.request({
                    method: 'tron_signMessage',
                    params: { message },
                });
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
            if (this._state !== AdapterState.Connected || !this._address) {
                throw new WalletDisconnectedError();
            }

            if (privateKey) {
                throw new WalletSignTransactionError(
                    'Transaction signing with a client provided private key is not supported by Backpack.'
                );
            }

            try {
                // Try using signTransaction() method first
                if (typeof this._provider.signTransaction === 'function') {
                    return await this._provider.signTransaction(transaction);
                }

                // Fallback to request() method
                return await this._provider.request({
                    method: 'tron_signTransaction',
                    params: { transaction },
                });
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message || 'Failed to sign transaction.', error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async switchChain(chainId: string): Promise<void> {
        try {
            if (this._provider && typeof this._provider.switchChain === 'function') {
                await this._provider.switchChain(chainId);
                this.emit('chainChanged', { chainId });
            } else if (this._provider && typeof this._provider.request === 'function') {
                await this._provider.request({
                    method: 'tron_switchChain',
                    params: { chainId },
                });
                this.emit('chainChanged', { chainId });
            } else {
                throw new WalletSwitchChainError('Chain switching not supported.');
            }
        } catch (error: any) {
            this.emit('error', error);
            throw new WalletSwitchChainError(error?.message || 'Failed to switch chain.', error);
        }
    }

    async network(): Promise<Network> {
        try {
            if (this._state !== AdapterState.Connected) {
                throw new WalletDisconnectedError();
            }

            if (this._provider?.request) {
                const chainId = await this._provider.request({ method: 'tron_chainId' });
                return {
                    networkType: chainIdNetworkMap[chainId] || NetworkType.Unknown,
                    chainId,
                    fullNode: '',
                    solidityNode: '',
                    eventServer: '',
                };
            }

            throw new WalletGetNetworkError('Network info not available');
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _setState(state: AdapterState): void {
        if (this._state !== state) {
            this._state = state;
            this.emit('stateChanged', state);
        }
    }

    private _setReadyState(state: WalletReadyState): void {
        if (this._readyState !== state) {
            this._readyState = state;
            this.emit('readyStateChanged', state);
        }
    }

    private _listenProviderEvents(): void {
        this._stopListenProviderEvents();
        if (this._provider?.on) {
            this._provider.on('accountsChanged', this._onAccountsChanged);
            this._provider.on('chainChanged', this._onChainChanged);
        }
    }

    private _stopListenProviderEvents(): void {
        if (this._provider?.removeListener) {
            this._provider.removeListener('accountsChanged', this._onAccountsChanged);
            this._provider.removeListener('chainChanged', this._onChainChanged);
        }
    }

    private _onAccountsChanged = (accounts: string[]) => {
        const prevAddress = this._address;
        if (!accounts || accounts.length === 0) {
            this._address = null;
            this._setState(AdapterState.Disconnect);
            this.emit('accountsChanged', '', prevAddress || '');
            this.emit('disconnect');
        } else {
            this._address = accounts[0];
            this._setState(AdapterState.Connected);
            this.emit('accountsChanged', this._address, prevAddress || '');
            if (!prevAddress && this._address) {
                this.emit('connect', this._address);
            }
        }
    };

    private _onChainChanged = (chainId: string) => {
        this.emit('chainChanged', { chainId });
    };

    private async _checkExistingConnection(): Promise<void> {
        try {
            if (!this._provider?.request) return;

            const accounts = await this._provider.request({
                method: 'tron_accounts',
            });

            if (accounts && accounts.length > 0 && accounts[0]) {
                const address = accounts[0];
                this._address = address;
                this._setState(AdapterState.Connected);
                this._listenProviderEvents();
                this.emit('connect', address);
            } else {
                this._setState(AdapterState.Disconnect);
            }
        } catch {
            this._setState(AdapterState.Disconnect);
        }
    }
}
