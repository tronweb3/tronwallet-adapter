import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export const METAMASK_RDNS = 'io.metamask';

function isMetaMaskProvider(provider: EIP1193Provider | null | undefined): boolean {
    return Boolean(provider?.isMetaMask && !(provider as any).overrideIsMetaMask);
}

export function getMetaMaskProvider(): null | EIP1193Provider {
    if (typeof window === 'undefined') {
        return null;
    }

    const context = window as Window & {
        ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] };
    };

    const ethereum = context.ethereum;
    if (!ethereum) {
        return null;
    }

    if (isMetaMaskProvider(ethereum)) {
        return ethereum;
    }

    return ethereum.providers?.find((item: EIP1193Provider) => isMetaMaskProvider(item)) || null;
}

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
