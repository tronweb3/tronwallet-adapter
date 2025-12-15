import {
    Adapter,
    WalletConnectionError,
    WalletDisconnectionError,
    AdapterState,
    WalletWindowClosedError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletSignMessageError,
    WalletSignTransactionError,
    WalletReadyState,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { WalletConnectModalConfig } from '@walletconnect/modal';
export type WalletConnectWeb3ModalConfig = Omit<WalletConnectModalConfig, 'projectId'>;
import type { Transaction, SignedTransaction, AdapterName } from '@tronweb3/tronwallet-abstract-adapter';
import { ChainNetwork } from '@tronweb3/tronwallet-abstract-adapter';
import type { ThemeVariables } from '@tronweb3/walletconnect-tron';
import { WalletConnectWallet, WalletConnectChainID } from '@tronweb3/walletconnect-tron';
import type { SignClientTypes } from '@walletconnect/types';

export const WalletConnectWalletName = 'WalletConnect' as AdapterName<'WalletConnect'>;
const NETWORK = Object.keys(ChainNetwork);
const validThemeVariables = [
    '--w3m-font-family',
    '--w3m-accent',
    '--w3m-color-mix',
    '--w3m-color-mix-strength',
    '--w3m-font-size-master',
    '--w3m-border-radius-master',
    '--w3m-z-index',
    '--w3m-qr-color',
];
export interface WalletConnectAdapterConfig {
    /**
     * Network to use, one of Mainnet,Shasta,Nile or chainId such as 0x2b6653dc
     */
    network: `${ChainNetwork}` | string;
    options: SignClientTypes.Options;
    /**
     * Theme mode configuration flag. By default themeMode option will be set to user system settings.
     * @default `system`
     * @type `dark` | `light`
     * @see https://docs.reown.com/appkit/react/core/theming
     */
    themeMode?: `dark` | `light`;
    /**
     * Theme variable configuration object.
     * @default undefined
     * @see https://docs.reown.com/appkit/react/core/theming#themevariables
     */
    themeVariables?: ThemeVariables;
    /**
     * Control the display of "All Wallets" button.
     * @default `HIDE` (recommended for Tron as most wallets don't support it)
     * @see https://docs.reown.com/appkit/react/core/options
     */
    allWallets?: 'SHOW' | 'HIDE' | 'ONLY_MOBILE';
    /**
     * List of featured wallet IDs to display first (in order).
     * @see https://walletguide.walletconnect.network/ to find wallet IDs
     */
    featuredWalletIds?: string[];
    /**
     * Whitelist of wallet IDs to include (if set, only these wallets will be shown).
     */
    includeWalletIds?: string[];
    /**
     * Blacklist of wallet IDs to exclude.
     */
    excludeWalletIds?: string[];
    /**
     * Custom wallets to add to the list.
     */
    customWallets?: any[];
    /**
     * Enable Reown cloud analytics.
     * @default true
     */
    enableAnalytics?: boolean;
    /**
     * Enable debug logs.
     * @default false
     */
    debug?: boolean;
    /**
     * Enable mobile deep linking optimization.
     * When enabled, automatically configures mobile wallet IDs and settings for better deep linking support.
     * @default true
     */
    enableMobileDeepLink?: boolean;
    /**
     * Additional AppKit configuration options.
     * Any extra properties will be passed directly to createAppKit.
     */
    [key: string]: any;
    /**
     * WalletConnectModalOptions to WalletConnect.
     * Only some properties of themeVariables and themeMode are valiable. It's recomended to use `config.themeVariables` and `config.themeMode`.
     * Detailed documentation can be found in WalletConnect page: https://docs.walletconnect.com/advanced/walletconnectmodal/options.
     */
    web3ModalConfig?: WalletConnectWeb3ModalConfig;
}

export class WalletConnectAdapter extends Adapter {
    name = WalletConnectWalletName;
    url = 'https://walletconnect.org';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtNjEuNDM4NTQsOTQuMDAzOGM0OC45MTEyMywtNDcuODg4MTcgMTI4LjIxMTk5LC00Ny44ODgxNyAxNzcuMTIzMjEsMGw1Ljg4NjU1LDUuNzYzNDJjMi40NDU1NiwyLjM5NDQxIDIuNDQ1NTYsNi4yNzY1MSAwLDguNjcwOTJsLTIwLjEzNjcsMTkuNzE1NWMtMS4yMjI3OCwxLjE5NzIxIC0zLjIwNTMsMS4xOTcyMSAtNC40MjgwOCwwbC04LjEwMDU4LC03LjkzMTE1Yy0zNC4xMjE2OSwtMzMuNDA3OTggLTg5LjQ0Mzg5LC0zMy40MDc5OCAtMTIzLjU2NTU4LDBsLTguNjc1MDYsOC40OTM2MWMtMS4yMjI3OCwxLjE5NzIgLTMuMjA1MywxLjE5NzIgLTQuNDI4MDgsMGwtMjAuMTM2NjksLTE5LjcxNTVjLTIuNDQ1NTYsLTIuMzk0NDEgLTIuNDQ1NTYsLTYuMjc2NTIgMCwtOC42NzA5Mmw2LjQ2MTAxLC02LjMyNTg4em0yMTguNzY3OCw0MC43NzM3NWwxNy45MjE3LDE3LjU0Njg5YzIuNDQ1NTQsMi4zOTQ0IDIuNDQ1NTYsNi4yNzY0OCAwLjAwMDAzLDguNjcwODlsLTgwLjgxMDE3LDc5LjEyMTE0Yy0yLjQ0NTU1LDIuMzk0NDIgLTYuNDEwNTksMi4zOTQ0NSAtOC44NTYxNiwwLjAwMDA2Yy0wLjAwMDAxLC0wLjAwMDAxIC0wLjAwMDAzLC0wLjAwMDAyIC0wLjAwMDA0LC0wLjAwMDAzbC01Ny4zNTQxNCwtNTYuMTU0NThjLTAuNjExMzksLTAuNTk4NiAtMS42MDI2NSwtMC41OTg2IC0yLjIxNDA0LDBjMCwwLjAwMDAxIC0wLjAwMDAxLDAuMDAwMDEgLTAuMDAwMDEsMC4wMDAwMmwtNTcuMzUyOTIsNTYuMTU0NTNjLTIuNDQ1NTQsMi4zOTQ0MyAtNi40MTA1OCwyLjM5NDQ3IC04Ljg1NjE2LDAuMDAwMDhjLTAuMDAwMDIsLTAuMDAwMDEgLTAuMDAwMDMsLTAuMDAwMDIgLTAuMDAwMDUsLTAuMDAwMDRsLTgwLjgxMjQyLC03OS4xMjIxOWMtMi40NDU1NiwtMi4zOTQ0IC0yLjQ0NTU2LC02LjI3NjUxIDAsLTguNjcwOTFsMTcuOTIxNzMsLTE3LjU0Njg3YzIuNDQ1NTYsLTIuMzk0NDEgNi40MTA2LC0yLjM5NDQxIDguODU2MTYsMGw1Ny4zNTQ5OCw1Ni4xNTUzNWMwLjYxMTM5LDAuNTk4NjEgMS42MDI2NSwwLjU5ODYxIDIuMjE0MDQsMGMwLjAwMDAxLDAgMC4wMDAwMiwtMC4wMDAwMSAwLjAwMDAzLC0wLjAwMDAybDU3LjM1MjEsLTU2LjE1NTMzYzIuNDQ1NSwtMi4zOTQ0NyA2LjQxMDU0LC0yLjM5NDU2IDguODU2MTYsLTAuMDAwMmMwLjAwMDAzLDAuMDAwMDMgMC4wMDAwNywwLjAwMDA3IDAuMDAwMSwwLjAwMDFsNTcuMzU0OSw1Ni4xNTU0M2MwLjYxMTM5LDAuNTk4NiAxLjYwMjY1LDAuNTk4NiAyLjIxNDA0LDBsNTcuMzUzOTgsLTU2LjE1NDMyYzIuNDQ1NTYsLTIuMzk0NDEgNi40MTA2LC0yLjM5NDQxIDguODU2MTYsMHoiIGZpbGw9IiMzYjk5ZmMiIGlkPSJzdmdfMSIvPjwvc3ZnPg==';

    private _readyState: WalletReadyState = WalletReadyState.Found;
    private _state: AdapterState = AdapterState.Disconnect;
    private _connecting: boolean;
    private _wallet: WalletConnectWallet | null;
    private _config: WalletConnectAdapterConfig;
    private _address: string | null;

    constructor(config: WalletConnectAdapterConfig) {
        super();
        config = {
            ...config,
        };
        if (!config || typeof config !== 'object') {
            throw new Error(`[WalletconnectAdapter] config is required.`);
        }
        if (!config.network) {
            console.error(
                `[WalletconnectAdapter] config.network must be one of ${NETWORK.join()} or a chainID such as 0x2b6653dc. Use Nile network instead.`
            );
            config.network = 'Nile';
        }
        if (!config.options) {
            throw new Error(`[WalletconnectAdapter] config.options is required.`);
        }

        const themeVariables: ThemeVariables = {};

        if (config.web3ModalConfig?.themeVariables) {
            Object.entries(config.web3ModalConfig.themeVariables).forEach(([k, v]) => {
                const w3mKey = k.replace('--wcm-', '--w3m-') as keyof ThemeVariables;
                if (validThemeVariables.includes(w3mKey)) {
                    // @ts-ignore
                    themeVariables[w3mKey] = v;
                }
            });
        }

        config.themeMode = config.themeMode || config.web3ModalConfig?.themeMode;
        config.themeVariables = config.themeVariables || themeVariables;
        config.featuredWalletIds =
            config.featuredWalletIds ||
            (config.web3ModalConfig?.explorerRecommendedWalletIds === 'NONE'
                ? undefined
                : config.web3ModalConfig?.explorerRecommendedWalletIds);
        config.privacyPolicyUrl = config.privacyPolicyUrl || config.web3ModalConfig?.privacyPolicyUrl;
        Reflect.deleteProperty(config, 'web3ModalConfig');

        this._connecting = false;
        this._wallet = null;
        this._address = null;
        this._config = config;
    }

    get address() {
        return this._address;
    }

    get readyState() {
        return this._readyState;
    }
    get state() {
        return this._state;
    }

    /**
     * Currently unused for WalletConnectAdapter.
     */
    get connecting() {
        return this._connecting;
    }

    async connect(): Promise<void> {
        try {
            if (this.connected) return;
            if (this.state === AdapterState.NotFound) throw new WalletNotFoundError();
            this._connecting = true;

            let address = '';
            try {
                if (!this._wallet) {
                    this._wallet = new WalletConnectWallet({
                        ...this._config,
                        network:
                            WalletConnectChainID[this._config.network as `${ChainNetwork}`] ||
                            `tron:${this._config.network}`,
                    });
                }

                ({ address } = await this._wallet.connect());
            } catch (error: any) {
                if (error.message === 'User closed the connection modal') throw new WalletWindowClosedError();
                throw new WalletConnectionError(error?.message, error);
            }

            this._wallet.on('disconnect', this._disconnected);
            this._wallet.on('accountsChanged', this._accountsChanged);

            this._address = address || '';
            this._state = AdapterState.Connected;
            this.emit('stateChanged', this._state);
            this.emit('connect', address);
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            // this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.state === AdapterState.NotFound) {
            return;
        }
        const wallet = this._wallet;
        if (wallet) {
            wallet.off('disconnect', this._disconnected);
            wallet.off('accountsChanged', this._accountsChanged);

            this._address = null;

            try {
                await wallet.disconnect();
            } catch (error: any) {
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }
        this._state = AdapterState.Disconnect;
        this.emit('disconnect');
        this.emit('stateChanged', this._state);
    }

    async signTransaction(transaction: Transaction): Promise<SignedTransaction> {
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletDisconnectedError();

            try {
                return await wallet.signTransaction(transaction);
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signMessage(message: string): Promise<string> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletDisconnectedError();

            try {
                return await wallet.signMessage(message);
            } catch (error: any) {
                throw new WalletSignMessageError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Get WalletConnect connection status.
     * Address is not empty if the WalletConnectWallet is connected.
     * @returns {object} status
     * @property {string} status.address - connected address
     */
    async getConnectionStatus(): Promise<{ address: string }> {
        if (!this._wallet || !this.connected) {
            return { address: '' };
        }
        try {
            return await this._wallet.checkConnectStatus();
        } catch (e) {
            this._address = null;
            this._state = AdapterState.Disconnect;
            return { address: '' };
        }
    }

    private _disconnected = () => {
        const wallet = this._wallet;
        if (wallet) {
            wallet.off('disconnected', this._disconnected);
            wallet.off('accountsChanged', this._accountsChanged);

            this._address = null;

            this._state = AdapterState.Disconnect;
            this.emit('disconnect');
            this.emit('stateChanged', this._state);
        }
    };

    private _accountsChanged = (curAddr: string[]) => {
        const preAddress = this.address;
        this._address = curAddr?.[0] || '';
        this.emit('accountsChanged', this.address || '', preAddress || '');
    };
}
