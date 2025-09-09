import { isInBinance, getDeepLink } from '@binance/w3w-utils';

import { isInBrowser, isInMobileBrowser, type EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export function supportBinanceEvm() {
    return isInBrowser() && isInBinance();
}
export function getBinanceEvmProvider(): null | EIP1193Provider {
    if (supportBinanceEvm()) {
        return window.ethereum || null;
    }
    return null;
}

export function openBinanceWithDeeplink() {
    if (isInMobileBrowser() && !supportBinanceEvm()) {
        const link = getDeepLink(window.location.href, 14);
        window.open(link.http, '_blank');
    }
    return false;
}
