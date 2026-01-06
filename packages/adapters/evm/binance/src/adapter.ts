import type { AdapterName, EIP1193Provider } from '@tronweb3/abstract-adapter-evm';
import {
    Adapter,
    WalletReadyState,
    WalletNotFoundError,
    WalletConnectionError,
    isInMobileBrowser,
    WalletError,
} from '@tronweb3/abstract-adapter-evm';
import { getBinanceEvmProvider, openBinanceWithDeeplink, supportBinanceEvm } from './utils.js';

declare global {
    interface Window {
        binancew3w?: {
            tron: any;
            ethereum: EIP1193Provider;
        };
    }
}
export interface BinanceEvmAdapterOptions {
    useDeeplink?: boolean;
}
export const BinanceEvmAdapterName = 'Binance' as AdapterName<'Binance'>;
export class BinanceEvmAdapter extends Adapter {
    name = BinanceEvmAdapterName;
    // @prettier-ignore
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMEIwRTExIi8+CjxwYXRoIGQ9Ik01IDE1TDcuMjU4MDYgMTIuNzQxOUw5LjUxNjEzIDE1TDcuMjU4MDYgMTcuMjU4MUw1IDE1WiIgZmlsbD0iI0YwQjkwQiIvPgo8cGF0aCBkPSJNOC44NzA5NyAxMS4xMjlMMTUgNUwyMS4xMjkgMTEuMTI5TDE4Ljg3MSAxMy4zODcxTDE1IDkuNTE2MTNMMTEuMTI5IDEzLjM4NzFMOC44NzA5NyAxMS4xMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMi43NDE5IDE1TDE1IDEyLjc0MTlMMTcuMjU4MSAxNUwxNSAxNy4yNTgxTDEyLjc0MTkgMTVaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0xMS4xMjkgMTYuNjEyOUw4Ljg3MDk3IDE4Ljg3MUwxNSAyNUwyMS4xMjkgMTguODcxTDE4Ljg3MSAxNi42MTI5TDE1IDIwLjQ4MzlMMTEuMTI5IDE2LjYxMjlaIiBmaWxsPSIjRjBCOTBCIi8+CjxwYXRoIGQ9Ik0yMC40ODM5IDE1TDIyLjc0MTkgMTIuNzQxOUwyNSAxNUwyMi43NDE5IDE3LjI1ODFMMjAuNDgzOSAxNVoiIGZpbGw9IiNGMEI5MEIiLz4KPC9zdmc+Cg==';
    url = 'https://www.binance.com/en/binancewallet';
    readyState = WalletReadyState.Loading;
    address: string | null = null;
    connecting = false;
    options: BinanceEvmAdapterOptions;

    constructor(options: BinanceEvmAdapterOptions = { useDeeplink: true }) {
        super();
        this.options = options;
        const provider = getBinanceEvmProvider();
        if (provider) {
            this.readyState = WalletReadyState.Found;
            this.listenEvents(provider);
            this.autoConnect(provider);
        } else {
            this.getProvider().then((res) => {
                if (res) {
                    this.readyState = WalletReadyState.Found;
                    this.listenEvents(res);
                    this.autoConnect(res);
                } else {
                    this.readyState = WalletReadyState.NotFound;
                }
                this.emit('readyStateChanged', this.readyState);
            });
        }
    }

    async connect() {
        if (this.options.useDeeplink !== false) {
            if (isInMobileBrowser() && !supportBinanceEvm()) {
                openBinanceWithDeeplink();
                return '';
            }
        }
        this.connecting = true;

        const provider = await this.getProvider();
        if (!provider) {
            throw new WalletNotFoundError();
        }
        let accounts: string[] = [];
        try {
            accounts = await provider.request<undefined, string[]>({ method: 'eth_requestAccounts' });
        } catch (e: any) {
            throw new WalletConnectionError('Connection error: ' + e?.message, e);
        }
        if (!accounts.length) {
            throw new WalletConnectionError('No accounts is avaliable.');
        }
        this.address = accounts[0];
        this.connecting = false;
        this.emit('accountsChanged', accounts);
        return this.address as string;
    }

    async addChain(): Promise<null> {
        throw new WalletError('[BinanceEvm] The wallet does not support addChain() currently.');
    }

    private getProviderPromise: Promise<EIP1193Provider | null> | null = null;
    async getProvider(): Promise<EIP1193Provider | null> {
        if (this.getProviderPromise !== null) {
            return this.getProviderPromise;
        }
        this.getProviderPromise = new Promise((resolve) => {
            const provider = getBinanceEvmProvider();
            if (provider) {
                return resolve(provider);
            }
            let handled = false;
            let interval: null | ReturnType<typeof setInterval> = null;
            const handleEthereum = () => {
                if (handled) {
                    return;
                }
                handled = true;
                const provider = getBinanceEvmProvider();
                if (provider) {
                    resolve(provider);
                } else {
                    console.error('[BinanceEvmAdapter]: Unable to detect window.ethereum.');
                    resolve(null);
                }
            };
            interval = setInterval(() => {
                const provider = getBinanceEvmProvider();
                if (provider) {
                    handleEthereum();
                    interval && clearInterval(interval);
                }
            }, 100);
            setTimeout(() => {
                interval && clearInterval(interval);
                handleEthereum();
            }, 3000);
        });
        return this.getProviderPromise;
    }
    private listenEvents(provider: EIP1193Provider) {
        provider.on('connect', (connectInfo) => {
            this.emit('connect', connectInfo);
        });
        provider.on('disconnect', (error) => {
            this.emit('disconnect', error);
        });
        provider.on('accountsChanged', this.onAccountsChanged);
        provider.on('chainChanged', (chainId) => {
            this.emit('chainChanged', chainId);
        });
    }
    private onAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
            this.address = null;
        } else {
            this.address = accounts[0];
        }
        this.emit('accountsChanged', accounts);
    };
    private async autoConnect(provider: EIP1193Provider) {
        const accounts = await provider.request<undefined, string[]>({ method: 'eth_accounts' });

        this.address = accounts?.[0] || null;
        if (this.address) {
            this.emit('accountsChanged', accounts);
        }
    }
}
