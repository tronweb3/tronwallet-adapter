import { isInBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportGuarda() {
    return isInBrowser() && typeof window.guarda !== 'undefined';
}
