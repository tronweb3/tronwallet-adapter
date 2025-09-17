import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportNaboxWallet() {
    return !!(window.NaboxWallet && window.NaboxWallet.tronLink);
}

export function openNaboxWallet() {
    if (!supportNaboxWallet() && isInMobileBrowser()) {
        window.location.href = 'nabox://com.wallet.nabox?type=1&url=' + encodeURIComponent(window.location.href);
        return true;
    }
    return false;
}
