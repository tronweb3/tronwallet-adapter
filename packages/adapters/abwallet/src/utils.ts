import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportABWallet() {
    return !!(window.abwallet && window.abwallet.tronLink);
}

export const isABWalletApp = typeof navigator !== 'undefined' && /ABWallet/i.test(navigator.userAgent);
export function isInABWalletApp() {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        return /ABWallet/i.test(window.navigator.userAgent);
    }
    return false;
}
export function openABWallet() {
    if (!isInABWalletApp() && isInMobileBrowser()) {
        window.location.href = 'abwallet://wallet/dapp/url?dappUrl=' + encodeURIComponent(window.location.href);
        return true;
    }
    return false;
}
