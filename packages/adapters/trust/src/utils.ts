import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportTrust() {
    return typeof window !== 'undefined' && !!(window.trustwallet && window.trustwallet.tronLink);
}

export const isTrustApp = function () {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        return /Trust/i.test(window.navigator.userAgent);
    }
    return false;
};
export function openTrustWallet() {
    if (!isTrustApp() && isInMobileBrowser()) {
        window.location.href = 'https://link.trustwallet.com/open_url?url=' + encodeURIComponent(window.location.href);
        return true;
    }

    return false;
}
