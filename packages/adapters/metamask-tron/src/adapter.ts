import type { TronScope } from '@metamask/multichain-api-client';
import {
    type CaipAccountId,
    type MultichainApiClient,
    type SessionData,
    type Transport,
    getDefaultTransport,
    getMultichainClient,
    isMetamaskInstalled,
} from '@metamask/multichain-api-client';
import {
    Adapter,
    AdapterState,
    isInBrowser,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { AdapterName, Network, SignedTransaction, Transaction } from '@tronweb3/tronwallet-abstract-adapter';
import { Scope } from './types.js';
import {
    chainIdToScope,
    getAddressFromCaipAccountId,
    scopeToChainId,
    scopeToNetworkType,
    isSessionChangedEvent,
    openMetaMaskApp,
} from './utils.js';
import type { BaseAdapterConfig } from '@tronweb3/tronwallet-abstract-adapter';

export interface MetaMaskAdapterConfig extends BaseAdapterConfig {
    /**
     * Set if open MetaMask app using DeepLink.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}

export const MetaMaskAdapterName = 'MetaMask' as AdapterName<'MetaMask'>;

export class MetaMaskAdapter extends Adapter {
    // list of scopes in priority order for resolving selected account
    readonly scopes = [Scope.MAINNET, Scope.SHASTA, Scope.NILE] as const;
    name = MetaMaskAdapterName;
    // @prettier-ignore
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjIzIiBoZWlnaHQ9IjIzIiB4PSIzLjUiIHk9IjMuNSIgdmlld0JveD0iMCAwIDE0MS41MSAxMzYuNDIiPjxwYXRoIGZpbGw9IiNGRjVDMTYiIGQ9Im0xMzIuMjQgMTMxLjc1LTMwLjQ4LTkuMDctMjIuOTkgMTMuNzQtMTYuMDMtLjAxLTIzLTEzLjc0LTMwLjQ3IDkuMDhMMCAxMDAuNDdsOS4yNy0zNC43M0wwIDM2LjQgOS4yNyAwbDQ3LjYgMjguNDRoMjcuNzZMMTMyLjI0IDBsOS4yNyAzNi4zOC05LjI3IDI5LjM2IDkuMjcgMzQuNzItOS4yNyAzMS4zWiIvPjxwYXRoIGZpbGw9IiNGRjVDMTYiIGQ9Im05LjI3IDAgNDcuNjEgMjguNDZMNTQuOTggNDggOS4yOSAwWm0zMC40NyAxMDAuNDggMjAuOTUgMTUuOTUtMjAuOTUgNi4yNHYtMjIuMlpNNTkuMDEgNzQuMSA1NSA0OCAyOS4yMiA2NS43NWgtLjAybC4wOCAxOC4yNyAxMC40NS05LjkyaDE5LjI5Wk0xMzIuMjUgMGwtNDcuNiAyOC40Nkw4Ni41MSA0OGw0NS43Mi00OFptLTMwLjQ3IDEwMC40OC0yMC45NCAxNS45NSAyMC45NCA2LjI0di0yMi4yWm0xMC41My0zNC43M0w4Ni41MyA0OCA4Mi41IDc0LjFoMTkuMjdsMTAuNDYgOS45LjA3LTE4LjI2WiIvPjxwYXRoIGZpbGw9IiNFMzQ4MDciIGQ9Im0zOS43MyAxMjIuNjctMzAuNDYgOS4wOEwwIDEwMC40OGgzOS43M3YyMi4yWk01OS4wMiA3NC4xbDUuODIgMzcuNzEtOC4wNy0yMC45Ny0yNy40OS02LjgyIDEwLjQ2LTkuOTJINTlabTQyLjc2IDQ4LjU5IDMwLjQ3IDkuMDcgOS4yNy0zMS4yN2gtMzkuNzR6TTgyLjUgNzQuMDlsLTUuODIgMzcuNzEgOC4wNi0yMC45NyAyNy41LTYuODItMTAuNDctOS45MnoiLz48cGF0aCBmaWxsPSIjRkY4RDVEIiBkPSJtMCAxMDAuNDcgOS4yNy0zNC43M0gyOS4ybC4wNyAxOC4yNyAyNy41IDYuODIgOC4wNiAyMC45Ny00LjE1IDQuNjItMjAuOTQtMTUuOTZIMFptMTQxLjUgMC05LjI2LTM0LjczaC0xOS45M2wtLjA3IDE4LjI3LTI3LjUgNi44Mi04LjA2IDIwLjk3IDQuMTUgNC42MiAyMC45NC0xNS45NmgzOS43NFpNODQuNjQgMjguNDRINTYuODhsLTEuODkgMTkuNTQgOS44NCA2My44aDExLjg1bDkuODUtNjMuOC0xLjktMTkuNTRaIi8+PHBhdGggZmlsbD0iIzY2MTgwMCIgZD0iTTkuMjcgMCAwIDM2LjM4bDkuMjcgMjkuMzZIMjkuMkw1NC45OCA0OHptNDMuOTggODEuNjdoLTkuMDNsLTQuOTIgNC44MSAxNy40NyA0LjMzLTMuNTItOS4xNVpNMTMyLjI0IDBsOS4yNyAzNi4zOC05LjI3IDI5LjM2aC0xOS45M0w4Ni41MyA0OHpNODguMjcgODEuNjdoOS4wNGw0LjkyIDQuODItMTcuNDkgNC4zNCAzLjUzLTkuMTdabS05LjUgNDIuMyAyLjA2LTcuNTQtNC4xNS00LjYySDY0LjgybC00LjE0IDQuNjIgMi4wNSA3LjU0Ii8+PHBhdGggZmlsbD0iI0MwQzRDRCIgZD0iTTc4Ljc3IDEyMy45N3YxMi40NUg2Mi43NHYtMTIuNDVoMTYuMDJaIi8+PHBhdGggZmlsbD0iI0U3RUJGNiIgZD0ibTM5Ljc0IDEyMi42NiAyMyAxMy43NnYtMTIuNDZsLTIuMDUtNy41NHptNjIuMDMgMC0yMyAxMy43NnYtMTIuNDZsMi4wNi03LjU0eiIvPjwvc3ZnPjwvc3ZnPg==';
    url = 'https://metamask.io';

    private _config: MetaMaskAdapterConfig;
    private _readyState: WalletReadyState = WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Disconnect;
    private _connecting = false;
    private _switchingChain = false;
    private _address: string | null = null;
    private _scope: Scope | undefined;
    private _checkWalletPromise: Promise<void> | undefined;
    private _removeSessionChangedListener: (() => void) | undefined;
    private _transport: Transport;
    private _client: MultichainApiClient;

    /**
     * Creates an instance of MetaMaskAdapter.
     * @param config - Configuration options for the adapter.
     */
    constructor(config: MetaMaskAdapterConfig = { openAppWithDeeplink: true }) {
        super();
        this._config = config;
        this._transport = getDefaultTransport();
        this._client = getMultichainClient({ transport: this._transport });
        this._checkWalletPromise = this.checkWallet();
        // Auto-restore session on page refresh
        this._checkWalletPromise.then(() => {
            if (this._readyState === WalletReadyState.Found) {
                this.tryRestoringSession()
                    .then(() => {
                        if (this.address) {
                            this.setState(AdapterState.Connected);
                            this.emit('connect', this.address);
                        }
                    })
                    .catch((error) => {
                        console.warn('Failed to auto-restore session:', error);
                    });
                this._removeSessionChangedListener = this._client.onNotification(
                    this.handleSessionChangedEvent.bind(this)
                );
            }
        });
    }

    /** Gets the current connected address. */
    get address() {
        return this._address;
    }

    /** Gets the current state of the adapter. */
    get state() {
        return this._state;
    }

    /** Gets the ready state of the wallet. */
    get readyState() {
        return this._readyState;
    }

    /** Gets whether the adapter is currently connecting. */
    get connecting() {
        return this._connecting;
    }

    /**
     * Connects to the MetaMask wallet.
     * @returns A promise that resolves when connected.
     */
    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) {
                return;
            }
            this._connecting = true;
            // Wait for the wallet check to complete before trying to check readyState
            await this._checkWalletPromise;
            if (this._readyState !== WalletReadyState.Found) {
                if (
                    isInBrowser() &&
                    !this.openAppWithDeepLinkIfNeed() &&
                    this._config.openUrlWhenWalletNotFound !== false
                ) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError('Wallet not found or not ready');
            }
            try {
                // Try restoring session
                await this.tryRestoringSession();
                // Otherwise create a session on Mainnet by default
                if (!this.address) {
                    await this.createSession(Scope.MAINNET);
                }
                // In case user didn't select any Tron scope/account, return
                if (!this.address) {
                    return;
                }
                if (!this._removeSessionChangedListener) {
                    this._removeSessionChangedListener = this._client.onNotification(
                        this.handleSessionChangedEvent.bind(this)
                    );
                }
                this.setState(AdapterState.Connected);
                this.emit('connect', this.address);
            } catch (error: any) {
                throw new WalletConnectionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    /**
     * Disconnects from the MetaMask wallet.
     * @returns A promise that resolves when disconnected.
     */
    async disconnect(options: { revokeSession?: boolean } = {}): Promise<void> {
        if (this.state !== AdapterState.Connected) {
            return;
        }
        const { revokeSession = true } = options;

        this.setAddress(null);
        this.setScope(undefined, false);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');

        if (revokeSession) {
            this._removeSessionChangedListener?.();
            this._removeSessionChangedListener = undefined;
            await this._client.revokeSession({ scopes: [...this.scopes] });
        }
    }

    /**
     * Signs a transaction using the MetaMask wallet.
     * @param transaction - The transaction to sign.
     * @returns A promise that resolves to the signed transaction.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        try {
            if (!this._scope) {
                throw new WalletDisconnectedError('Wallet not connected');
            }
            const contractType = transaction.raw_data.contract[0]?.type;
            if (!contractType) {
                throw new WalletSignTransactionError('Transaction contract type is required');
            }

            const result = await this._client.invokeMethod({
                scope: this._scope,
                request: {
                    method: 'signTransaction',
                    params: {
                        address: this._address as TronScope.TronAddress,
                        transaction: {
                            rawDataHex: transaction.raw_data_hex,
                            type: contractType,
                        },
                    },
                },
            });

            return {
                ...transaction,
                signature: [result.signature],
            };
        } catch (error: any) {
            if (error instanceof Error || (typeof error === 'object' && error.message)) {
                throw new WalletSignTransactionError(error.message, error);
            }
            if (typeof error === 'string') {
                throw new WalletSignTransactionError(error, new Error(error));
            }
            throw new WalletSignTransactionError('Unknown error', error);
        }
    }

    /**
     * Signs a message using the MetaMask wallet.
     * @param message - The message to sign.
     * @returns A promise that resolves to the signature.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async signMessage(message: string): Promise<string> {
        try {
            if (!this._scope) {
                throw new WalletDisconnectedError('Wallet not connected');
            }

            const base64Message = Buffer.from(message).toString('base64');
            const result = await this._client.invokeMethod({
                scope: this._scope,
                request: {
                    method: 'signMessage',
                    params: { message: base64Message, address: this._address as TronScope.TronAddress },
                },
            });
            return result.signature;
        } catch (error: any) {
            if (error instanceof Error || (typeof error === 'object' && error.message)) {
                throw new WalletSignMessageError(error.message, error);
            }
            if (typeof error === 'string') {
                throw new WalletSignMessageError(error, new Error(error));
            }
            throw new WalletSignMessageError('Unknown error', error);
        }
    }

    /**
     * Switches the chain for the MetaMask wallet.
     * During the initial connection process by TronWallet, this method can be called multiple times in parallel.
     * And if we call the createSession method multiple times in parallel, it fails.
     * That's why we added a _switchingChain flag to avoid multiple simultaneous calls.
     * @param chainId - The chain ID to switch to.
     */
    async switchChain(chainId: string): Promise<void> {
        if (this._switchingChain) {
            return;
        }
        this._switchingChain = true;
        if (!this._scope) {
            this._switchingChain = false;
            throw new WalletDisconnectedError('Wallet not connected');
        }

        const newScope = chainIdToScope(chainId);
        if (newScope === this._scope) {
            // Still emit event to reconciliate divergent states between dapp and adapter
            this.emit('chainChanged', { chainId });
            this._switchingChain = false;
            return;
        }

        let session = await this._client.getSession();
        let isChainInSession = session?.sessionScopes[newScope]?.accounts?.includes(`${newScope}:${this._address}`);
        if (!isChainInSession) {
            // Create session for the new scope
            await this.createSession(newScope, this.address ? [this.address] : undefined);
            session = await this._client.getSession();
            isChainInSession = session?.sessionScopes[newScope]?.accounts?.includes(`${newScope}:${this._address}`);
            if (!isChainInSession) {
                this._switchingChain = false;
                throw new WalletConnectionError('Failed to switch chain');
            }
        }

        this.setScope(newScope);
        this._switchingChain = false;
    }

    /**
     * Get network information used by MetaMask.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            if (this.state !== AdapterState.Connected || !this._scope) {
                throw new WalletDisconnectedError('Wallet not connected');
            }

            const chainId = scopeToChainId(this._scope);
            const networkType = scopeToNetworkType(this._scope);

            return {
                networkType,
                chainId,
                fullNode: '',
                solidityNode: '',
                eventServer: '',
            };
        } catch (e: any) {
            this.emit('error', e);
            throw e;
        }
    }

    /**
     * Checks if the MetaMask wallet is available in the browser.
     * By default, the _readyState is set to Found to avoid issues on page reloads.
     * But if the wallet is not actually available, we need to update the _readyState accordingly.
     * Average time for wallet to be available is around 50ms.
     * @returns A promise that resolves when the wallet check is complete.
     */
    private async checkWallet(): Promise<void> {
        if (this._readyState === WalletReadyState.Loading) {
            return;
        }
        this._readyState = WalletReadyState.Loading;
        this.emit('readyStateChanged', this.readyState);
        const metamaskInstalled = await isMetamaskInstalled();
        if (metamaskInstalled) {
            this._readyState = WalletReadyState.Found;
            this.emit('readyStateChanged', this.readyState);
            return;
        }
        this._readyState = WalletReadyState.NotFound;
        this.emit('readyStateChanged', this.readyState);
    }

    /**
     * Tries to restore an existing session.
     * @returns A promise that resolves when the session is restored or not.
     */
    private async tryRestoringSession(): Promise<void> {
        try {
            const existingSession = await this._client.getSession();
            if (!existingSession) {
                return;
            }
            const scope = this.restoreScope();
            this.updateSession(existingSession, scope);
        } catch (error) {
            console.warn(`Error restoring session`, error);
        }
    }

    /**
     * Creates a session for the specified scope.
     * @param scope - The TronScope to create the session for.
     * @param addresses - Optional list of addresses to include in the session.
     */
    private async createSession(scope: Scope, addresses?: string[]): Promise<void> {
        const session = await this._client.createSession({
            optionalScopes: {
                [scope]: {
                    accounts: (addresses ? addresses.map((addr) => `${scope}:${addr}`) : []) as CaipAccountId[],
                    methods: [],
                    notifications: [],
                },
            },
            sessionProperties: {
                // Previously this was needed to enable metamask_accountsChanged events for Solana.
                // This isn't needed for that purpose since we now use wallet_sessionChanged events.
                // However this is still needed to help the wallet identify our injected solana provider
                // until we migrate to a more accurate property name.
                // See: https://github.com/MetaMask/metamask-extension/blob/70dd748af54b58ceb8e78d227b6bdf118fb8e7ba/ui/pages/multichain-accounts/multichain-accounts-connect-page/multichain-accounts-connect-page.tsx#L169-L174
                tron_accountChanged_notifications: true,
            },
        });

        this.updateSession(session);
    }

    /**
     * Updates the session and the address to connect to.
     * Selects the scope in priority order: previously selected scope > mainnet > shasta > nile,
     * then uses the first account in that scope.
     *
     * @param session - The session data containing available scopes and accounts
     * @param selectedScope - The scope to prefer, if available
     */
    private updateSession(session: SessionData, selectedScope?: Scope) {
        const currentScope = this._scope;

        const scope = this.selectScopeFromSessionWithPriority(session, selectedScope);

        // If no scope is available, don't disconnect so that we can create/update a new session
        if (!scope) {
            this.setAddress(null);
            return;
        }
        const scopeAccounts = session?.sessionScopes[scope]?.accounts;
        // In case the Tron scope is available but without any accounts
        // Could happen if the user already created a session using ethereum injected provider for example or the SDK
        // Don't disconnect so that we can create/update a new session
        if (!scopeAccounts?.[0]) {
            this.setAddress(null);
            return;
        }
        const addressToConnect = getAddressFromCaipAccountId(scopeAccounts[0]);
        this.setAddress(addressToConnect);
        this.setScope(scope, currentScope !== scope);
    }

    /**
     * Handles the wallet_sessionChanged event.
     * @param data - The event data
     */
    private async handleSessionChangedEvent(data: any) {
        if (!isSessionChangedEvent(data)) {
            return;
        }

        const session = data?.params as SessionData;
        if (!session) {
            return;
        }
        const scope = this.selectScopeFromSessionWithPriority(session);

        if (!scope) {
            // Soft disconnect if no scope selected
            await this.disconnect({ revokeSession: false });
            return;
        }
        const isAccountsEmpty = session.sessionScopes?.[scope]?.accounts?.[0] === undefined;
        if (isAccountsEmpty) {
            // Soft disconnect if no address selected
            await this.disconnect({ revokeSession: false });
            return;
        }

        this.updateSession(session, scope);
    }

    /**
     * Sets the current address.
     * Emits an accountsChanged event if the address changes.
     * @param address - The address to set, or null if disconnected.
     */
    private setAddress(address: string | null) {
        if (this._address === address) {
            return;
        }

        if (address) {
            this.emit('accountsChanged', address, this._address || '');
        }

        this._address = address;
    }

    /**
     * Sets the adapter state and emits a state change event if necessary.
     * @param state - The new adapter state.
     */
    private setState(state: AdapterState) {
        const preState = this.state;
        if (state !== preState) {
            this._state = state;
            this.emit('stateChanged', state);
        }
    }

    /**
     * Sets the current scope.
     * @param scope - The new scope.
     */
    private setScope(scope?: Scope, emitChainChanged = true) {
        if (this._scope === scope) {
            return;
        }
        localStorage.setItem('metamaskAdapterScope', scope ?? '');
        this._scope = scope;

        if (!this._scope) {
            return;
        }

        if (emitChainChanged) {
            const newChainId = scopeToChainId(this._scope);
            this.emit('chainChanged', { chainId: newChainId });
        }
    }

    /**
     * Restores the scope from local storage.
     * @returns The restored scope, or undefined if not found.
     */
    private restoreScope(): Scope | undefined {
        const scope = localStorage.getItem('metamaskAdapterScope');
        return scope ? (scope as Scope) : undefined;
    }

    /**
     * Selects the scope from the session with priority order: mainnet > shasta > nile
     * @param session - The session data containing available scopes
     * @returns The selected scope, or undefined if no scope is available
     */
    private selectScopeFromSessionWithPriority(session: SessionData, selectedScope?: Scope): Scope | undefined {
        const sessionScopes = new Set(Object.keys(session?.sessionScopes ?? {}));
        const scopePriorityOrder = (selectedScope ? [selectedScope] : []).concat(this.scopes);

        return scopePriorityOrder.find((scope) => sessionScopes.has(scope));
    }

    /**
     * Opens the MetaMask app using a deep link if necessary.
     * @returns True if the app was opened, false otherwise.
     */
    private openAppWithDeepLinkIfNeed() {
        if (this._config.openAppWithDeeplink === false) {
            return false;
        }
        return openMetaMaskApp();
    }
}
