import type { AdapterName, EIP1193Provider, EIP6963ProviderInfo, TypedData } from '@tronweb3/abstract-adapter-evm';
import {
    Adapter,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletNotFoundError,
    WalletReadyState,
    isInMobileBrowser,
} from '@tronweb3/abstract-adapter-evm';
import type { TrustWalletProvider } from './utils.js';
import { getTrustWalletProvider, TRUST_WALLET_RDNS } from './utils.js';

export const TrustEvmAdapterName = 'Trust Wallet' as AdapterName<'Trust Wallet'>;

export class TrustEvmAdapter extends Adapter {
    name = TrustEvmAdapterName;
    url = 'https://trustwallet.com';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTgiIGhlaWdodD0iNjUiIHZpZXdCb3g9IjAgMCA1OCA2NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgOS4zODk0OUwyOC44OTA3IDBWNjUuMDA0MkM4LjI1NDUgNTYuMzM2OSAwIDM5LjcyNDggMCAzMC4zMzUzVjkuMzg5NDlaIiBmaWxsPSIjMDUwMEZGIi8+CjxwYXRoIGQ9Ik01Ny43ODIyIDkuMzg5NDlMMjguODkxNSAwVjY1LjAwNDJDNDkuNTI3NyA1Ni4zMzY5IDU3Ljc4MjIgMzkuNzI0OCA1Ny43ODIyIDMwLjMzNTNWOS4zODk0OVoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8yMjAxXzY5NDIpIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMjIwMV82OTQyIiB4MT0iNTEuMzYxNSIgeTE9Ii00LjE1MjkzIiB4Mj0iMjkuNTM4NCIgeTI9IjY0LjUxNDciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjAyMTEyIiBzdG9wLWNvbG9yPSIjMDAwMEZGIi8+CjxzdG9wIG9mZnNldD0iMC4wNzYyNDIzIiBzdG9wLWNvbG9yPSIjMDA5NEZGIi8+CjxzdG9wIG9mZnNldD0iMC4xNjMwODkiIHN0b3AtY29sb3I9IiM0OEZGOTEiLz4KPHN0b3Agb2Zmc2V0PSIwLjQyMDA0OSIgc3RvcC1jb2xvcj0iIzAwOTRGRiIvPgo8c3RvcCBvZmZzZXQ9IjAuNjgyODg2IiBzdG9wLWNvbG9yPSIjMDAzOEZGIi8+CjxzdG9wIG9mZnNldD0iMC45MDI0NjUiIHN0b3AtY29sb3I9IiMwNTAwRkYiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K';
    readyState = WalletReadyState.Loading;
    address: string | null = null;
    connecting = false;

    constructor() {
        super();
        this.eip6963Info.support = true;
        this.eip6963Info.name = 'Trust Wallet';
        this.eip6963Info.rdns = TRUST_WALLET_RDNS;

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
        this.connecting = true;

        try {
            const provider = await this.getProvider();
            if (!provider) {
                throw new WalletNotFoundError();
            }

            let accounts: string[] = [];
            try {
                accounts = await provider.request<undefined, string[]>({ method: 'eth_requestAccounts' });
            } catch (error: any) {
                throw new WalletConnectionError(error?.message || 'Connection error.', error);
            }

            if (!accounts.length) {
                throw new WalletConnectionError('No accounts is available.');
            }

            this.address = accounts[0];
            this.emit('accountsChanged', accounts);
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
            params: [address, JSON.stringify(typedData)],
        });
    }

    protected getInjectedProvider(): EIP1193Provider | null {
        return getTrustWalletProvider();
    }

    protected isEIP6963Provider(provider: EIP1193Provider, info?: EIP6963ProviderInfo): boolean {
        if (info) {
            return info.rdns === TRUST_WALLET_RDNS || info.name === this.eip6963Info.name;
        }

        return Boolean((provider as TrustWalletProvider).isTrust || (provider as TrustWalletProvider).isTrustWallet);
    }

    async getProvider(): Promise<EIP1193Provider | null> {
        if (isInMobileBrowser()) {
            return null;
        }

        return super.getProvider();
    }

    protected listenEvents(provider: EIP1193Provider) {
        provider.on('connect', (connectInfo) => {
            this.emit('connect', connectInfo);
        });
        provider.on('disconnect', (error) => {
            this.address = null;
            this.emit('disconnect', error);
        });
        provider.on('accountsChanged', this.onAccountsChanged);
        provider.on('chainChanged', (chainId) => {
            this.emit('chainChanged', chainId);
        });
    }

    protected async autoConnect(provider: EIP1193Provider) {
        try {
            const accounts = await provider.request<undefined, string[]>({ method: 'eth_accounts' });
            this.address = accounts?.[0] || null;
            if (accounts?.length) {
                this.emit('accountsChanged', accounts);
            }
        } catch (error) {
            this.address = null;
        }
    }
}

export const TrustWalletEvmAdapter = TrustEvmAdapter;
export const TrustWalletEvmAdapterName = TrustEvmAdapterName;
