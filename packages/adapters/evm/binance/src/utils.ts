import { isInBinance, getDeepLink, isExtensionInstalled } from '@binance/w3w-utils';

import { isInBrowser, isInMobileBrowser, type EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export function supportBinanceEvm() {
    return isInBrowser() && (isExtensionInstalled() || isInBinance());
}
export function getBinanceEvmProvider(): null | EIP1193Provider {
    if (supportBinanceEvm()) {
        const context = window as Window & {
            ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] };
            binancew3w?: { ethereum?: EIP1193Provider };
        };
        const providers = [
            context.binancew3w?.ethereum,
            context.ethereum,
            ...(context.ethereum?.providers || []),
        ].filter(Boolean) as EIP1193Provider[];

        return (
            providers.find((provider) => (provider as any).isBinance) || context.binancew3w?.ethereum || context.ethereum
        );
    }
    return null;
}

export function openBinanceWithDeeplink() {
    if (isInMobileBrowser() && !supportBinanceEvm()) {
        const link = getDeepLink(window.location.href, 14);
        window.open(link.bnc, '_blank');
    }
    return false;
}
