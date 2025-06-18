import { getDeepLink } from '@binance/w3w-utils';

export function supportBinanceWallet() {
    return Boolean(window.isBinance);
}

export function openBinanceWallet() {
    if (supportBinanceWallet()) {
        window.location.href = getDeepLink(window.location.href).bnc;
        return true;
    }
    return false;
}
