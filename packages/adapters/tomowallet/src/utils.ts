import { isInBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportTomowallet() {
    return isInBrowser() && !!window.tomo_wallet?.tron;
}
