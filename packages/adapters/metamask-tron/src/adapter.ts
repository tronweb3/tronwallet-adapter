import type { SessionData } from '@metamask/multichain-api-client';
import {
    type CaipAccountId,
    type MultichainApiClient,
    type Transport,
    getDefaultTransport,
    getMultichainClient,
} from '@metamask/multichain-api-client';
import type { TronAddress } from '@metamask/multichain-api-client/dist/types/scopes/tron.types.cjs';
import {
    Adapter,
    AdapterState,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletReadyState,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { AdapterName, Network, SignedTransaction, Transaction } from '@tronweb3/tronwallet-abstract-adapter';
import { Scope } from './types.js';
import {
    chainIdToScope,
    getAddressFromCaipAccountId,
    isAccountChangedEvent,
    scopeToChainId,
    scopeToNetworkType,
    isSessionChangedEvent,
} from './utils.js';

export const MetaMaskAdapterName = 'MetaMask' as AdapterName<'MetaMask'>;

export class MetaMaskAdapter extends Adapter {
    name = MetaMaskAdapterName;
    // @prettier-ignore
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjIzIiBoZWlnaHQ9IjIzIiB4PSIzLjUiIHk9IjMuNSIgdmlld0JveD0iMCAwIDE0MS41MSAxMzYuNDIiPjxwYXRoIGZpbGw9IiNGRjVDMTYiIGQ9Im0xMzIuMjQgMTMxLjc1LTMwLjQ4LTkuMDctMjIuOTkgMTMuNzQtMTYuMDMtLjAxLTIzLTEzLjc0LTMwLjQ3IDkuMDhMMCAxMDAuNDdsOS4yNy0zNC43M0wwIDM2LjQgOS4yNyAwbDQ3LjYgMjguNDRoMjcuNzZMMTMyLjI0IDBsOS4yNyAzNi4zOC05LjI3IDI5LjM2IDkuMjcgMzQuNzItOS4yNyAzMS4zWiIvPjxwYXRoIGZpbGw9IiNGRjVDMTYiIGQ9Im05LjI3IDAgNDcuNjEgMjguNDZMNTQuOTggNDggOS4yOSAwWm0zMC40NyAxMDAuNDggMjAuOTUgMTUuOTUtMjAuOTUgNi4yNHYtMjIuMlpNNTkuMDEgNzQuMSA1NSA0OCAyOS4yMiA2NS43NWgtLjAybC4wOCAxOC4yNyAxMC40NS05LjkyaDE5LjI5Wk0xMzIuMjUgMGwtNDcuNiAyOC40Nkw4Ni41MSA0OGw0NS43Mi00OFptLTMwLjQ3IDEwMC40OC0yMC45NCAxNS45NSAyMC45NCA2LjI0di0yMi4yWm0xMC41My0zNC43M0w4Ni41MyA0OCA4Mi41IDc0LjFoMTkuMjdsMTAuNDYgOS45LjA3LTE4LjI2WiIvPjxwYXRoIGZpbGw9IiNFMzQ4MDciIGQ9Im0zOS43MyAxMjIuNjctMzAuNDYgOS4wOEwwIDEwMC40OGgzOS43M3YyMi4yWk01OS4wMiA3NC4xbDUuODIgMzcuNzEtOC4wNy0yMC45Ny0yNy40OS02LjgyIDEwLjQ2LTkuOTJINTlabTQyLjc2IDQ4LjU5IDMwLjQ3IDkuMDcgOS4yNy0zMS4yN2gtMzkuNzR6TTgyLjUgNzQuMDlsLTUuODIgMzcuNzEgOC4wNi0yMC45NyAyNy41LTYuODItMTAuNDctOS45MnoiLz48cGF0aCBmaWxsPSIjRkY4RDVEIiBkPSJtMCAxMDAuNDcgOS4yNy0zNC43M0gyOS4ybC4wNyAxOC4yNyAyNy41IDYuODIgOC4wNiAyMC45Ny00LjE1IDQuNjItMjAuOTQtMTUuOTZIMFptMTQxLjUgMC05LjI2LTM0LjczaC0xOS45M2wtLjA3IDE4LjI3LTI3LjUgNi44Mi04LjA2IDIwLjk3IDQuMTUgNC42MiAyMC45NC0xNS45NmgzOS43NFpNODQuNjQgMjguNDRINTYuODhsLTEuODkgMTkuNTQgOS44NCA2My44aDExLjg1bDkuODUtNjMuOC0xLjktMTkuNTRaIi8+PHBhdGggZmlsbD0iIzY2MTgwMCIgZD0iTTkuMjcgMCAwIDM2LjM4bDkuMjcgMjkuMzZIMjkuMkw1NC45OCA0OHptNDMuOTggODEuNjdoLTkuMDNsLTQuOTIgNC44MSAxNy40NyA0LjMzLTMuNTItOS4xNVpNMTMyLjI0IDBsOS4yNyAzNi4zOC05LjI3IDI5LjM2aC0xOS45M0w4Ni41MyA0OHpNODguMjcgODEuNjdoOS4wNGw0LjkyIDQuODItMTcuNDkgNC4zNCAzLjUzLTkuMTdabS05LjUgNDIuMyAyLjA2LTcuNTQtNC4xNS00LjYySDY0LjgybC00LjE0IDQuNjIgMi4wNSA3LjU0Ii8+PHBhdGggZmlsbD0iI0MwQzRDRCIgZD0iTTc4Ljc3IDEyMy45N3YxMi40NUg2Mi43NHYtMTIuNDVoMTYuMDJaIi8+PHBhdGggZmlsbD0iI0U3RUJGNiIgZD0ibTM5Ljc0IDEyMi42NiAyMyAxMy43NnYtMTIuNDZsLTIuMDUtNy41NHptNjIuMDMgMC0yMyAxMy43NnYtMTIuNDZsMi4wNi03LjU0eiIvPjwvc3ZnPjwvc3ZnPg==';
    url = 'https://metamask.io';

    private _readyState: WalletReadyState = WalletReadyState.Found;
    private _state: AdapterState = AdapterState.Disconnect;
    private _connecting = false;
    private _switchingChain = false;
    private _address: string | null = null;
    private _scope: Scope | undefined;
    private _selectedAddressOnPageLoadPromise: Promise<string | undefined> | undefined;
    private _checkWalletPromise: Promise<boolean> | undefined;
    private _removeAccountsChangedListener: (() => void) | undefined;
    private _transport: Transport;
    private _client: MultichainApiClient;

    /**
     * Creates an instance of MetaMaskAdapter.
     * @param config - Configuration options for the adapter.
     */
    constructor() {
        super();
        this._transport = getDefaultTransport();
        this._client = getMultichainClient({ transport: this._transport });
        this._checkWalletPromise = this.checkWallet();
        this._selectedAddressOnPageLoadPromise = this.getInitialSelectedAddress();
        // Auto-restore session on page refresh
        this._checkWalletPromise.then((walletReady) => {
            if (walletReady) {
                this.tryRestoringSession()
                    .then(() => {
                        if (this.address) {
                            this.startListeners();
                            this.setState(AdapterState.Connected);
                            this.emit('connect', this.address);
                        }
                    })
                    .catch((error) => {
                        console.warn('Failed to auto-restore session:', error);
                    });
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
            if (this._readyState !== WalletReadyState.Found) {
                throw new WalletConnectionError('Wallet not found or not ready');
            }
            const walletReady = await this._checkWalletPromise;
            if (!walletReady) {
                throw new WalletConnectionError('Wallet not found after initialization');
            }
            this._connecting = true;
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
                this.startListeners();

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
    async disconnect(): Promise<void> {
        if (this.state !== AdapterState.Connected) {
            return;
        }

        this.stopListeners();

        this.setAddress(null);
        this.setScope(undefined, false);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');

        await this._client.revokeSession({ scopes: [Scope.MAINNET, Scope.NILE, Scope.SHASTA] });
    }

    /**
     * Signs a transaction using the MetaMask wallet.
     * @param transaction - The transaction to sign.
     * @param privateKey - Optional private key (not recommended for production).
     * @returns A promise that resolves to the signed transaction.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async signTransaction(transaction: Transaction, _?: string): Promise<SignedTransaction> {
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
                        address: this._address as TronAddress,
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
     * @param privateKey - Optional private key (not recommended for production).
     * @returns A promise that resolves to the signature.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async signMessage(message: string, _?: string): Promise<string> {
        try {
            if (!this._scope) {
                throw new WalletDisconnectedError('Wallet not connected');
            }

            const base64Message = Buffer.from(message).toString('base64');
            const result = await this._client.invokeMethod({
                scope: this._scope,
                request: {
                    method: 'signMessage',
                    params: { message: base64Message, address: this._address as TronAddress },
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
     * Listen for up to 2 seconds to the accountsChanged event emitted on page load.
     * @returns If any, the initial selected address.
     */
    protected getInitialSelectedAddress(): Promise<string | undefined> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(undefined);
            }, 2000);
            const handleAccountChange = (data: any) => {
                if (isAccountChangedEvent(data)) {
                    const address = data?.params?.notification?.params?.[0];
                    if (address) {
                        clearTimeout(timeout);
                        removeNotification?.();
                        resolve(address);
                    }
                }
            };

            const removeNotification = this._client.onNotification(handleAccountChange);
        });
    }

    /**
     * Checks if the MetaMask wallet is available in the browser.
     * By default, the _readyState is set to Found to avoid issues on page reloads.
     * But if the wallet is not actually available, we need to update the _readyState accordingly.
     * Average time for transport to be connected is around 50-300ms.
     * Will retry up to maxAttempts times with a 10ms delay between attempts.
     * @returns A promise that resolves to true if the wallet is found.
     */
    private async checkWallet(attempt = 1, maxAttempts = 100): Promise<boolean> {
        const isConnected = this._transport.isConnected();

        if (isConnected) {
            this._readyState = WalletReadyState.Found;
            this.emit('readyStateChanged', this.readyState);

            return true;
        }

        if (attempt >= maxAttempts) {
            this._readyState = WalletReadyState.NotFound;
            this.emit('readyStateChanged', this.readyState);

            return false;
        }

        await new Promise((resolve) => setTimeout(resolve, this._transport.warmupTimeout ?? 100));
        return this.checkWallet(attempt + 1, maxAttempts);
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
            // Get the address from accountChanged emitted on page load, if any
            const address = await this._selectedAddressOnPageLoadPromise;
            const scope = this.restoreScope();
            this.updateSession(existingSession, scope, address);
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
        let resolvePromise: (value: string) => void;
        const waitForAccountChangedPromise = new Promise<string>((resolve) => {
            resolvePromise = resolve;
        });

        // If there are multiple accounts, wait for the first accountChanged event to know which one to use
        const handleAccountChange = (data: any) => {
            if (!isAccountChangedEvent(data)) {
                return;
            }
            const selectedAddress = data?.params?.notification?.params?.[0];

            if (selectedAddress) {
                removeNotification();
                resolvePromise(selectedAddress);
            }
        };

        const removeNotification = this._client.onNotification(handleAccountChange);

        const session = await this._client.createSession({
            optionalScopes: {
                [scope]: {
                    accounts: (addresses ? addresses.map((addr) => `${scope}:${addr}`) : []) as CaipAccountId[],
                    methods: [],
                    notifications: [],
                },
            },
            sessionProperties: {
                tron_accountChanged_notifications: true,
            },
        });

        // Wait for the accountChanged event to know which one to use, timeout after 2000ms
        const selectedAddress = await Promise.race([
            waitForAccountChangedPromise,
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2000)),
        ]);

        this.updateSession(session, undefined, selectedAddress);
    }

    /**
     * Updates the session and the address to connect to.
     * This method handles the logic for selecting the appropriate Tron network scope
     * and address to connect to based on the following priority:
     * 1. First tries to find an available scope in order: previously selected scope > mainnet > shasta > nile
     * 2. For address selection:
     *    - First tries to use the selectedAddress param, most likely coming from
     *      the accountsChanged event
     *    - Falls back to the previously saved address if it exists in the scope
     *    - Finally defaults to the first address in the scope
     *
     * @param session - The session data containing available scopes and accounts
     * @param selectedAddress - The address that was selected by the user, if any
     */
    private updateSession(session: SessionData, selectedScope?: Scope, selectedAddress?: string) {
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
        let addressToConnect;
        // Try to use selectedAddress
        if (selectedAddress && scopeAccounts.includes(`${scope}:${selectedAddress}`)) {
            addressToConnect = selectedAddress;
        }
        // Otherwise try to use the previously saved address in this._address
        else if (this._address && scopeAccounts.includes(`${scope}:${this._address}`)) {
            addressToConnect = this._address;
        }
        // Otherwise select first address
        else {
            addressToConnect = getAddressFromCaipAccountId(scopeAccounts[0]);
        }
        // Update the address and scope
        this.setAddress(addressToConnect);
        this.setScope(scope, currentScope !== scope);
    }

    /**
     * Starts listening to the accountsChanged event.
     * @param handler Optional custom handler for the event.
     */
    private startListeners(handler?: (data: any) => void) {
        this._removeAccountsChangedListener = this._client.onNotification(handler ?? this.handleEvents.bind(this));
    }

    /**
     * Stops listening to the accountsChanged event.
     */
    private stopListeners() {
        this._removeAccountsChangedListener?.();
        this._removeAccountsChangedListener = undefined;
    }

    /**
     * Handles the accountsChanged event.
     * @param data - The event data
     */
    private async handleEvents(data: any) {
        if (isAccountChangedEvent(data)) {
            const newAddressSelected = data?.params?.notification?.params?.[0];
            if (!newAddressSelected) {
                // Disconnect if no address selected
                await this.disconnect();
                return;
            }
            const session = await this._client.getSession();
            if (!session) {
                return;
            }
            this.updateSession(session, this._scope, newAddressSelected);
        } else if (isSessionChangedEvent(data)) {
            const session = data?.params;
            if (!session) {
                return;
            }
            const scope = this.selectScopeFromSessionWithPriority(session);

            if (!scope) {
                // Disconnect if no scope selected
                await this.disconnect();
                return;
            }
            const isAccountsEmpty = !(session?.sessionScopes?.[scope]?.accounts?.length > 0);
            if (isAccountsEmpty) {
                // Disconnect if no address selected
                await this.disconnect();
                return;
            }
            this.updateSession(session, scope);
        }
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
        const scopePriorityOrder = (selectedScope ? [selectedScope] : []).concat([
            Scope.MAINNET,
            Scope.SHASTA,
            Scope.NILE,
        ]);

        return scopePriorityOrder.find((scope) => sessionScopes.has(scope));
    }
}
