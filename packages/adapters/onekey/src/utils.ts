import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportOneKey() {
    return typeof window !== 'undefined' && !!(window.$onekey && window.$onekey.tron);
}
