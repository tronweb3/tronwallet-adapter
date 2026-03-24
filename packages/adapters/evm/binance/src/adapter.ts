import type { AdapterName, EIP1193Provider, EIP6963ProviderInfo } from '@tronweb3/abstract-adapter-evm';
import {
    Adapter,
    WalletReadyState,
    WalletNotFoundError,
    WalletConnectionError,
    isInMobileBrowser,
    WalletError,
} from '@tronweb3/abstract-adapter-evm';
import { getBinanceEvmProvider, openBinanceWithDeeplink, supportBinanceEvm } from './utils.js';

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
        this.eip6963Info.support = true;
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

    protected getInjectedProvider(): EIP1193Provider | null {
        return getBinanceEvmProvider();
    }

    protected isEIP6963Provider(provider: EIP1193Provider, info?: EIP6963ProviderInfo): boolean {
        return Boolean((provider as any).isBinance) || !!info?.name?.toLowerCase().includes('binance');
    }
}
