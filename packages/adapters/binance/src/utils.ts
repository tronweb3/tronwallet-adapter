import { getDeepLink } from '@binance/w3w-utils';
import { isInBrowser, isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportBinanceWallet() {
    return isInBrowser() && Boolean(window.isBinance);
}

export function openBinanceWallet() {
    if (isInMobileBrowser() && !supportBinanceWallet()) {
        window.location.href = getDeepLink(window.location.href).bnc;
        return true;
    }
    return false;
}
