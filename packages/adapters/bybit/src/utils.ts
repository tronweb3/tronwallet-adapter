import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportBybitWallet() {
    return !!(window.bybitWallet && window.bybitWallet.tronLink);
}

export const isBybitApp = typeof navigator !== 'undefined' && /bybit_app/i.test(navigator.userAgent);
export function isInBybitApp() {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        return /bybit_app/i.test(window.navigator.userAgent);
    }
    return false;
}
export function openBybitWallet() {
    if (!isInBybitApp() && isInMobileBrowser()) {
        window.location.href = `https://app.bybit.com/inapp?by_dp=${encodeURIComponent(
            'bybitapp://open/route?targetUrl=by%3A%2F%2Fweb3%2Ftab%2Findex%3Findex%3D0'
        )}&by_web_link=${encodeURIComponent(window.location.href)}`;

        return true;
    }
    return false;
}
