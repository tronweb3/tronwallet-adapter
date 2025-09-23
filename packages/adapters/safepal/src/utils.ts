import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportSafepalWallet() {
    return !!window.safepalwallet;
}

export function openSafepalWallet() {
    if (isInMobileBrowser() && !supportSafepalWallet()) {
        const { origin, pathname, search, hash } = window.location;
        const url = origin + pathname + search + hash;
        location.href = `https://link.safepal.io/wallet/openurl?url=${encodeURIComponent(url)}`;
        return true;
    }
    return false;
}
