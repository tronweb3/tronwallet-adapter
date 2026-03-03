export function supportOneKey() {
    return typeof window !== 'undefined' && !!window.$onekey?.tron;
}
