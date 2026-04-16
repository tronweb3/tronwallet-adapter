import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export const CATWALLET_EVM_RDNS = 'ai.cattoken.catwallet';

export interface CatWalletEvmProvider extends EIP1193Provider {
    isCatWallet?: boolean;
}

function isInBrowser() {
    return typeof window !== 'undefined';
}

export function getCatWalletEvmProvider(): CatWalletEvmProvider | null {
    if (!isInBrowser()) {
        return null;
    }

    const context = window as Window & {
        catwallet?: CatWalletEvmProvider;
    };

    if (context.catwallet?.isCatWallet) {
        return context.catwallet;
    }

    return null;
}
