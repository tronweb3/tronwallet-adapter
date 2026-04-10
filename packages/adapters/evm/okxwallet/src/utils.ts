import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export const OKX_WALLET_RDNS = 'com.okex.wallet';

export interface OkxWalletProvider extends EIP1193Provider {
    isOkxWallet?: boolean;
}

function isOkxWalletProvider(provider: EIP1193Provider | null | undefined): provider is OkxWalletProvider {
    return Boolean(provider && (provider as OkxWalletProvider).isOkxWallet);
}

export function getOkxWalletProvider(): OkxWalletProvider | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const context = window as Window & {
        okxwallet?: OkxWalletProvider;
        ethereum?: OkxWalletProvider & { providers?: OkxWalletProvider[] };
    };

    // OKX Wallet injects its own `window.okxwallet` object
    if (isOkxWalletProvider(context.okxwallet)) {
        return context.okxwallet;
    }

    // Fallback: check window.ethereum and its providers array
    const providers = [context.ethereum, ...(context.ethereum?.providers || [])].filter(Boolean) as OkxWalletProvider[];
    return providers.find((provider) => isOkxWalletProvider(provider)) || null;
}

export function isOkxWalletMobileWebView(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const context = window as Window & {
        okxwallet?: OkxWalletProvider;
    };
    return isOkxWalletProvider(context.okxwallet);
}

export function openOkxWalletWithDeeplink(): void {
    if (typeof window === 'undefined') {
        return;
    }
    const encodedUrl = encodeURIComponent(window.location.href);
    const link = `okx://wallet/dapp/url?dappUrl=${encodedUrl}`;
    window.location.href = link;
}
