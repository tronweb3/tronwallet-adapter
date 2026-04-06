export const METAMASK_RDNS = 'io.metamask';

export function isMetaMaskMobileWebView() {
    if (typeof window === 'undefined') {
        return false;
    }

    // @ts-ignore
    return Boolean(window.ReactNativeWebView) && Boolean(navigator.userAgent.endsWith('MetaMaskMobile'));
}

export function openMetaMaskWithDeeplink() {
    const { href, protocol } = window.location;
    const originLink = href.replace(protocol, '').slice(2);
    const link = `https://metamask.app.link/dapp/${originLink}`;
    const dappLink = `dapp://${originLink}`;
    const userAgent = window?.navigator?.userAgent || '';
    if (/\bAndroid(?:.+)Mobile\b/i.test(userAgent)) {
        window.location.href = dappLink;
    } else {
        window.open(link, '_blank');
    }
}
