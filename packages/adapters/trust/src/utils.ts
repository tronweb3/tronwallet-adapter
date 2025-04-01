import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportTrust() {
    return !!(window.trustwallet && window.trustwallet.tronLink);
}

export const isTrustApp = /Trust/i.test(navigator.userAgent);

export function openTrustWallet() {
    if (!isTrustApp && isInMobileBrowser()) {
        window.location.href = 'https://link.trustwallet.com?source=' + encodeURIComponent(window.location.href);
        return true;
    }

    return false;
}
