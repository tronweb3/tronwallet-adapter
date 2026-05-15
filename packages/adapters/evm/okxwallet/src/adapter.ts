import type { EIP1193Provider, EIP6963ProviderInfo, TypedData } from '@tronweb3/abstract-adapter-evm';
import {
    Adapter,
    WalletReadyState,
    WalletNotFoundError,
    WalletConnectionError,
    WalletDisconnectedError,
    isInMobileBrowser,
    isInBrowser,
} from '@tronweb3/abstract-adapter-evm';
import { OkxWalletEvmAdapterName, METADATA } from './metadata.js';
import { getOkxWalletProvider, isOkxWalletMobileWebView, OKX_WALLET_RDNS, openOkxWalletWithDeeplink } from './utils.js';

declare global {
    interface Window {
        okxwallet: EIP1193Provider;
    }
}

export interface OkxWalletEvmAdapterOptions {
    useDeeplink?: boolean;
    openUrlWhenWalletNotFound?: boolean;
}

export { OkxWalletEvmAdapterName } from './metadata.js';

export class OkxWalletEvmAdapter extends Adapter {
    name = METADATA.name;
    url = METADATA.url;
    icon = METADATA.icon;
    readyState = WalletReadyState.Loading;
    address: string | null = null;
    connecting = false;
    options: OkxWalletEvmAdapterOptions;

    constructor(options: OkxWalletEvmAdapterOptions = { useDeeplink: true }) {
        super();
        this.options = options;
        this.eip6963Info.support = true;
        this.eip6963Info.name = 'OKX Wallet';
        this.eip6963Info.rdns = OKX_WALLET_RDNS;

        void this.getProvider().then((provider) => {
            if (provider) {
                this.readyState = WalletReadyState.Found;
                this.listenEvents(provider);
                void this.autoConnect(provider);
            } else {
                this.readyState = WalletReadyState.NotFound;
            }
            this.emit('readyStateChanged', this.readyState);
        });
    }

    async connect() {
        if (this.options.useDeeplink !== false) {
            if (isInMobileBrowser() && !isOkxWalletMobileWebView()) {
                openOkxWalletWithDeeplink();
                return '';
            }
        }
        this.connecting = true;

        try {
            const provider = await this.getProvider();
            if (!provider) {
                if (this.options.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            const accounts = await provider.request<undefined, string[]>({ method: 'eth_requestAccounts' });
            if (!accounts.length) {
                throw new WalletConnectionError('No accounts is available.');
            }
            this.address = accounts[0];
            return this.address as string;
        } finally {
            this.connecting = false;
        }
    }

    async signTypedData({
        typedData,
        address = this.address as string,
    }: {
        typedData: TypedData;
        address?: string;
    }): Promise<string> {
        const provider = await this.prepareProvider();
        if (!this.connected) {
            throw new WalletDisconnectedError();
        }
        return provider.request<[string, string], string>({
            method: 'eth_signTypedData_v4',
            params: [address, typeof typedData === 'string' ? typedData : JSON.stringify(typedData)],
        });
    }

    protected isEIP6963Provider(provider: EIP1193Provider, info?: EIP6963ProviderInfo): boolean {
        if (!info?.rdns) {
            return false;
        }
        return info.rdns === OKX_WALLET_RDNS;
    }

    protected getInjectedProvider(): EIP1193Provider | null {
        return getOkxWalletProvider();
    }

    async getProvider(): Promise<EIP1193Provider | null> {
        if (typeof window === 'undefined') {
            return null;
        }

        if (isInMobileBrowser()) {
            if (!isOkxWalletMobileWebView()) {
                return null;
            }

            return this.getInjectedProvider();
        }

        if (this.getProviderPromise !== null) {
            return this.getProviderPromise;
        }

        this.getProviderPromise = new Promise((resolve) => {
            let handled = false;
            let timeout: ReturnType<typeof setTimeout> | null = null;
            let eip6963Handler: ((event: Event) => void) | null = null;

            const cleanup = () => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }

                if (eip6963Handler) {
                    window.removeEventListener('eip6963:announceProvider', eip6963Handler);
                    eip6963Handler = null;
                }
            };

            const finish = (nextProvider: EIP1193Provider | null) => {
                if (handled) {
                    return;
                }

                handled = true;
                cleanup();
                resolve(nextProvider);
            };

            eip6963Handler = (event: Event) => {
                const customEvent = event as CustomEvent<{
                    info?: EIP6963ProviderInfo;
                    provider?: EIP1193Provider;
                }>;
                const announcedProvider = customEvent.detail?.provider;

                if (!announcedProvider || !this.isEIP6963Provider(announcedProvider, customEvent.detail?.info)) {
                    return;
                }

                finish(announcedProvider);
            };

            window.addEventListener('eip6963:announceProvider', eip6963Handler);
            window.dispatchEvent(new Event('eip6963:requestProvider'));

            timeout = setTimeout(() => {
                finish(null);
            }, 3000);
        });

        return this.getProviderPromise;
    }
}
