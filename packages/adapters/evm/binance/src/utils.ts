import { isInBinance, getDeepLink, isExtensionInstalled } from '@binance/w3w-utils';

import { isInBrowser, isInMobileBrowser, type EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export function supportBinanceEvm() {
    return isInBrowser() && (isExtensionInstalled() || isInBinance());
}
export function getBinanceEvmProvider(): null | EIP1193Provider {
    if (supportBinanceEvm()) {
        return window.binancew3w?.ethereum || window.ethereum;
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
