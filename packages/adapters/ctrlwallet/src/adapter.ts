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
    WalletSwitchChainError,
    WalletGetNetworkError,
    isInMobileBrowser,
    NetworkType,
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
    NetworkChangedEventData,
    ReqestAccountsResponse,
    Tron,
    TronAccountsChangedCallback,
    TronChainChangedCallback,
    TronLinkMessageEvent,
    TronWeb,
} from './types.js';
import { supportTron, supportTronLink } from './utils.js';
export interface TronLink {
    ready: boolean;
    tronWeb: TronWeb;
    request(config: Record<string, unknown>): Promise<ReqestAccountsResponse | null>;
}
export const chainIdNetworkMap: Record<string, NetworkType> = {
    '0x2b6653dc': NetworkType.Mainnet,
    '0x94a9059e': NetworkType.Shasta,
    '0xcd8690dc': NetworkType.Nile,
};

export async function getNetworkInfoByTronWeb(tronWeb: TronWeb) {
    const { blockID = '' } = await tronWeb.trx.getBlockByNumber(0);
    const chainId = `0x${blockID.slice(-8)}`;
    return {
        networkType: chainIdNetworkMap[chainId] || NetworkType.Unknown,
        chainId,
        fullNode: tronWeb.fullNode?.host || '',
        solidityNode: tronWeb.solidityNode?.host || '',
        eventServer: tronWeb.eventServer?.host || '',
    };
}
declare global {
    interface Window {
        tronLink?: TronLink;
        tronWeb?: TronWeb & { ready?: boolean };
        // @ts-ignore
        tron?: Tron;
    }
}
export interface CtrlWalletConfig extends BaseAdapterConfig {
    checkTimeout?: number;
    openTronLinkAppOnMobile?: boolean;
}

export const CtrlWalletName = 'CtrlWallet' as AdapterName<'CtrlWallet'>;

export class CtrlWalletAdapter extends Adapter {
    name = CtrlWalletName;
    url = 'https://ctrl.xyz/';
    icon =
        'data:image/png;base64,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';
    config: Required<CtrlWalletConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: TronLink | Tron | null;
    private _address: string | null;
    // https://github.com/tronprotocol/tips/blob/master/tip-1193.md
    private _supportNewTronProtocol = false;
    // record if first connect event has emitted or not

    constructor(config: CtrlWalletConfig = {}) {
        super();
        const {
            checkTimeout = 30 * 1000,
            openUrlWhenWalletNotFound = true,
            openTronLinkAppOnMobile = true,
        } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[CtrlWallet] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openTronLinkAppOnMobile,
            openUrlWhenWalletNotFound,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (supportTron() || (isInMobileBrowser() && (window.tronLink || window.tronWeb))) {
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

    /**
     * Get network information used by TronLink.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            const tronWeb = this._wallet?.tronWeb || window.tronWeb;
            if (!tronWeb) throw new WalletDisconnectedError();
            try {
                return await getNetworkInfoByTronWeb(tronWeb);
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
            if (this.connected || this.connecting) return;
            await this._checkWallet();
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            // lower version only support window.tronWeb, no window.tronLink
            if (!this._wallet) return;
            this._connecting = true;
            if (this._supportNewTronProtocol) {
                const wallet = this._wallet as Tron;
                try {
                    const res = await wallet.request({ method: 'eth_requestAccounts' });
                    const address = res[0];
                    this.setAddress(address);
                    this.setState(AdapterState.Connected);
                    this._listenTronEvent();
                } catch (error: any) {
                    let message = error?.message || error || 'Connect TronLink wallet failed.';
                    if (error.code === -32002) {
                        message =
                            'The same DApp has already initiated a request to connect to TronLink wallet, and the pop-up window has not been closed.';
                    }
                    if (error.code === 4001) {
                        message = 'The user rejected connection.';
                    }
                    throw new WalletConnectionError(message, error);
                }
            } else if (window.tronLink) {
                const wallet = this._wallet as TronLink;
                try {
                    const res = await wallet.request({ method: 'tron_requestAccounts' });
                    if (!res) {
                        // 1. wallet is locked
                        // 2. tronlink is first installed and there is no wallet account
                        throw new WalletConnectionError('TronLink wallet is locked or no wallet account is avaliable.');
                    }
                    if (res.code === 4000) {
                        throw new WalletConnectionError(
                            'The same DApp has already initiated a request to connect to TronLink wallet, and the pop-up window has not been closed.'
                        );
                    }
                    if (res.code === 4001) {
                        throw new WalletConnectionError('The user rejected connection.');
                    }
                } catch (error: any) {
                    throw new WalletConnectionError(error?.message, error);
                }

                const address = wallet.tronWeb.defaultAddress?.base58 || '';
                this.setAddress(address);
                this.setState(AdapterState.Connected);
                this._listenTronLinkEvent();
            } else if (window.tronWeb) {
                const wallet = this._wallet as TronLink;
                const address = wallet.tronWeb.defaultAddress?.base58 || '';
                this.setAddress(address);
                this.setState(AdapterState.Connected);
            } else {
                throw new WalletConnectionError('Cannot connect wallet.');
            }
            this.connected && this.emit('connect', this.address || '');
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (this._supportNewTronProtocol) {
            this._stopListenTronEvent();
        } else {
            this._stopListenTronLinkEvent();
        }
        if (this.state !== AdapterState.Connected) {
            return;
        }
        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signTransaction(transaction: Transaction, privateKey?: string): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.sign(transaction, privateKey);
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

    async multiSign(
        transaction: Transaction,
        privateKey?: string | false,
        permissionId?: number
    ): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.multiSign(transaction, privateKey, permissionId);
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

    async signMessage(message: string, privateKey?: string): Promise<string> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                return await wallet.tronWeb.trx.signMessageV2(message, privateKey);
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

    /**
     * Switch to target chain. If current chain is the same as target chain, the call will success immediately.
     * Available chainIds:
     * - Mainnet: 0x2b6653dc
     * - Shasta: 0x94a9059e
     * - Nile: 0xcd8690dc
     * @param chainId chainId
     */
    async switchChain(chainId: string) {
        try {
            await this._checkWallet();
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            if (!this._supportNewTronProtocol) {
                throw new WalletSwitchChainError("Current version of TronLink doesn't support switch chain operation.");
            }
            const wallet = this._wallet as Tron;
            try {
                await wallet.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId }],
                });
            } catch (e: any) {
                throw new WalletSwitchChainError(e?.message || e, e instanceof Error ? e : new Error(e));
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private async checkAndGetWallet() {
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as Tron & { tronWeb: TronWeb };
    }

    private _listenTronLinkEvent() {
        this._stopListenTronLinkEvent();
        window.addEventListener('message', this._tronLinkMessageHandler);
    }

    private _stopListenTronLinkEvent() {
        window.removeEventListener('message', this._tronLinkMessageHandler);
    }

    private _tronLinkMessageHandler = (e: TronLinkMessageEvent) => {
        const message = e.data?.message;
        if (!message) {
            return;
        }
        if (message.action === 'accountsChanged') {
            setTimeout(() => {
                const preAddr = this.address || '';
                if ((this._wallet as TronLink)?.ready) {
                    const address = (message.data as AccountsChangedEventData).address;
                    this.setAddress(address);
                    this.setState(AdapterState.Connected);
                } else {
                    this.setAddress(null);
                    this.setState(AdapterState.Disconnect);
                }
                this.emit('accountsChanged', this.address || '', preAddr);
                if (!preAddr && this.address) {
                    this.emit('connect', this.address);
                } else if (preAddr && !this.address) {
                    this.emit('disconnect');
                }
            }, 200);
        } else if (message.action === 'setNode') {
            this.emit('chainChanged', { chainId: (message.data as NetworkChangedEventData)?.node?.chainId || '' });
        } else if (message.action === 'connect') {
            const address = (this._wallet as TronLink).tronWeb?.defaultAddress?.base58 || '';
            this.setAddress(address);
            this.setState(AdapterState.Connected);
            this.emit('connect', address);
        } else if (message.action === 'disconnect') {
            this.setAddress(null);
            this.setState(AdapterState.Disconnect);
            this.emit('disconnect');
        }
    };

    // following code is for TIP-1193
    private _listenTronEvent() {
        this._stopListenTronEvent();
        this._stopListenTronLinkEvent();
        const wallet = this._wallet as Tron;
        wallet.on('chainChanged', this._onChainChanged);
        wallet.on('accountsChanged', this._onAccountsChanged);
    }

    private _stopListenTronEvent() {
        const wallet = this._wallet as Tron;
        wallet.removeListener('chainChanged', this._onChainChanged);
        wallet.removeListener('accountsChanged', this._onAccountsChanged);
    }

    private _onChainChanged: TronChainChangedCallback = (data) => {
        this.emit('chainChanged', data);
    };

    private _onAccountsChanged: TronAccountsChangedCallback = () => {
        const preAddr = this.address || '';
        const curAddr = (this._wallet?.tronWeb && this._wallet?.tronWeb.defaultAddress?.base58) || '';
        if (!curAddr) {
            // change to a new address and if it's disconnected, data will be empty
            // tronlink will emit accountsChanged many times, only process when connected
            this.setAddress(null);
            this.setState(AdapterState.Disconnect);
        } else {
            const address = curAddr as string;
            this.setAddress(address);
            this.setState(AdapterState.Connected);
        }
        this.emit('accountsChanged', this.address || '', preAddr);
        if (!preAddr && this.address) {
            this.emit('connect', this.address);
        } else if (preAddr && !this.address) {
            this.emit('disconnect');
        }
    };

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if wallet exists
     */
    private _checkWallet(): Promise<boolean> {
        if (this.readyState === WalletReadyState.Found) {
            return Promise.resolve(true);
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }
        const interval = 100;
        const checkTronTimes = Math.floor(2000 / interval);
        const maxTimes = Math.floor(this.config.checkTimeout / interval);
        let times = 0,
            timer: ReturnType<typeof setInterval>;
        this._checkPromise = new Promise((resolve) => {
            const check = () => {
                times++;
                const isSupport = times < checkTronTimes && !isInMobileBrowser() ? supportTron() : supportTronLink();
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
        let state = this.state;
        let address = this.address;
        if (isInMobileBrowser()) {
            if (window.tronLink) {
                this._wallet = window.tronLink;
            } else {
                this._wallet = {
                    ready: !!window.tronWeb?.defaultAddress,
                    tronWeb: window.tronWeb,
                    request: () => Promise.resolve(true) as any,
                } as TronLink;
            }
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            state = address ? AdapterState.Connected : AdapterState.Disconnect;
        } else if (window.tron && window.tron.isTronLink) {
            this._supportNewTronProtocol = true;
            this._wallet = window.tron;
            this._listenTronEvent();
            address = (this._wallet.tronWeb && this._wallet.tronWeb?.defaultAddress?.base58) || null;
            state = address ? AdapterState.Connected : AdapterState.Disconnect;
        } else if (window.tronLink) {
            this._wallet = window.tronLink;
            this._listenTronLinkEvent();
            address = this._wallet.tronWeb?.defaultAddress?.base58 || null;
            state = this._wallet.ready ? AdapterState.Connected : AdapterState.Disconnect;
        } else if (window.tronWeb) {
            // fake tronLink
            this._wallet = {
                ready: window.tronWeb.ready,
                tronWeb: window.tronWeb,
                request: () => Promise.resolve(true) as any,
            } as TronLink;
            address = this._wallet.tronWeb.defaultAddress?.base58 || null;
            state = this._wallet.ready ? AdapterState.Connected : AdapterState.Disconnect;
        } else {
            // no tronlink support
            this._wallet = null;
            address = null;
            state = AdapterState.NotFound;
        }
        // In TronLink App, account should be connected
        if (isInMobileBrowser() && state === AdapterState.Disconnect) {
            this.checkForWalletReadyForApp();
        }
        this.setAddress(address);
        this.setState(state);
    };

    private checkReadyInterval: ReturnType<typeof setInterval> | null = null;
    private checkForWalletReadyForApp() {
        if (this.checkReadyInterval) {
            return;
        }
        let times = 0;
        const maxTimes = Math.floor(this.config.checkTimeout / 200);
        const check = () => {
            if (window.tronLink ? window.tronLink.tronWeb?.defaultAddress : window.tronWeb?.defaultAddress) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
                this._updateWallet();
                this.emit('connect', this.address || '');
            } else if (times > maxTimes) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
            } else {
                times++;
            }
        };
        this.checkReadyInterval = setInterval(check, 200);
    }
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
