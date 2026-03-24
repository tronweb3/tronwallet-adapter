import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export const TRUST_WALLET_RDNS = 'com.trustwallet.app';

export interface TrustWalletProvider extends EIP1193Provider {
    isTrust?: boolean;
    isTrustWallet?: boolean;
}

function isInBrowser() {
    return typeof window !== 'undefined';
}

function isTrustWalletProvider(provider: EIP1193Provider | null | undefined): provider is TrustWalletProvider {
    return Boolean(provider && ((provider as TrustWalletProvider).isTrust || (provider as TrustWalletProvider).isTrustWallet));
}

export function getTrustWalletProvider(): TrustWalletProvider | null {
    if (!isInBrowser()) {
        return null;
    }

    const context = window as Window & {
        ethereum?: TrustWalletProvider & { providers?: TrustWalletProvider[] };
        trustwallet?: { ethereum?: TrustWalletProvider };
    };
    const providers = [context.ethereum, ...(context.ethereum?.providers || [])].filter(Boolean) as TrustWalletProvider[];
    const injectedProvider = providers.find((provider) => isTrustWalletProvider(provider));
    if (injectedProvider) {
        return injectedProvider;
    }

    return isTrustWalletProvider(context.trustwallet?.ethereum) ? context.trustwallet.ethereum : null;
}
