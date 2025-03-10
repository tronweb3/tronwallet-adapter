import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportOkxWallet() {
    return !!(window.okxwallet && window.okxwallet.tronLink);
}

export const isOKApp = typeof navigator !== 'undefined' && /OKApp/i.test(navigator.userAgent);
export function isInOKApp() {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        return /OKApp/i.test(window.navigator.userAgent);
    }
    return false;
}
export function openOkxWallet() {
    if (!isInOKApp() && isInMobileBrowser()) {
        window.location.href = 'okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(window.location.href);
        return true;
    }
    return false;
}
