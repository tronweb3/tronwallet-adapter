import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

/**
 * Get the Tron provider injected by Trust Wallet.
 * The Trust Wallet mobile app (iOS / Android) injects it as `window.trustwallet.tron`,
 * while the browser extension injects it as `window.trustwallet.tronLink`.
 */
export function getTrustProvider() {
    if (typeof window === 'undefined' || !window.trustwallet) {
        return undefined;
    }
    return isInMobileBrowser() ? window.trustwallet.tron : window.trustwallet.tronLink;
}

export function supportTrust() {
    return !!getTrustProvider();
}

/**
 * The Trust Wallet app does not identify itself in `navigator.userAgent`,
 * so detect it by the `window.trustwallet.tron` provider it injects.
 */
export const isTrustApp = function () {
    return typeof window !== 'undefined' && !!(window.trustwallet && window.trustwallet.tron);
};
/**
 * Detect if running inside the Trust Wallet mobile app (iOS or Android).
 * The Trust Wallet app injects `window.trustwallet.tron` into its in-app
 * browser/WebView, which `supportTrust()` checks on mobile.
 */
export function isInTrustApp() {
    return isInMobileBrowser() && isTrustApp();
}
export function openTrustWallet() {
    if (!isInTrustApp() && isInMobileBrowser()) {
        window.location.href = 'https://link.trustwallet.com/open_url?url=' + encodeURIComponent(window.location.href);
        return true;
    }

    return false;
}
