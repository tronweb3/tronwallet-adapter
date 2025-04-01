import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportGateWallet() {
    return !!(window.gatewallet && window.gatewallet.tronLink);
}

export const isGateApp = typeof navigator !== 'undefined' && /GateApp/i.test(navigator.userAgent);
export function isInGateApp() {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
        return /GateApp/i.test(window.navigator.userAgent);
    }
    return false;
}
export function openGateWallet() {
    if (!isInGateApp() && isInMobileBrowser()) {
        window.location.href =
            'https://gateio.onelink.me/DmA6/web3?dapp_url=' + encodeURIComponent(window.location.href);
        return true;
    }
    return false;
}
