export function supportOneKey() {
    return typeof window !== 'undefined' && !!(window.$onekey && window.$onekey.tron);
}
