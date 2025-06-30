import { getDeepLink } from '@binance/w3w-utils';
import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportBinanceWallet() {
    return Boolean(window.isBinance);
}

export function openBinanceWallet() {
    if (isInMobileBrowser()) {
        window.location.href = getDeepLink(window.location.href).bnc;
        return true;
    }
    return false;
}
