import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportOnekey() {
    return typeof window !== 'undefined' && !!(window.$onekey && window.$onekey.tron);
}

export function openOnekeyWallet() {
    if (isInMobileBrowser()) {
        // window.location.href = 'https://link.onekey.so/open_url?url=' + encodeURIComponent(window.location.href);
        return false;
    }

    return false;
}
