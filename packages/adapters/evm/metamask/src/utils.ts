import type { EIP1193Provider } from '@tronweb3/abstract-adapter-evm';

export const METAMASK_RDNS = 'io.metamask';

export function getMetaMaskProvider(): null | EIP1193Provider {
    const context = window as Window & {
        ethereum?: EIP1193Provider & { providers?: EIP1193Provider[] };
    };

    if (!context.ethereum) {
        return null;
    }
    if (context.ethereum.isMetaMask && !(context.ethereum as any).overrideIsMetaMask) {
        if ((context.ethereum as any).isTrust || (context.ethereum as any).isTrustWallet) {
            return null;
        }
        return context.ethereum as EIP1193Provider;
    }
    /**
     * When install CoinBase Wallet and MetaMask Wallet, ethereum will be override by CoinBase.
     */
    // @ts-ignore
    return (
        context.ethereum.providers?.find(
            (item: EIP1193Provider) =>
                item.isMetaMask && !(item as any).overrideIsMetaMask && !(item as any).isTrust && !(item as any).isTrustWallet
        ) || null
    );
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
