import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export function supportGateWallet() {
    return !!(window.gatewallet && window.gatewallet.tronLink);
}

/**
 * Detect whether we are running inside the GateWallet App.
 *
 * Prefer this lazy function over the `isGateApp` constant in code that runs
 * after wallet injection: the provider is injected asynchronously, so a value
 * captured at import time can be stale. `navigator` is treated as optional
 * because newer GateApp versions may not expose a `GateApp` user-agent token,
 * so we fall back to the injected provider shape (`tronLink` present, `tron` absent).
 */
export function isInGateApp() {
    if (typeof window === 'undefined') {
        return false;
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return /GateApp/i.test(ua) || !!(window.gatewallet?.tronLink && !window.gatewallet.tron);
}

/**
 * Snapshot of {@link isInGateApp} evaluated at import time. Kept for backward
 * compatibility with consumers importing the constant; prefer `isInGateApp()`
 * for a reliable, lazily-evaluated check.
 */
export const isGateApp =
    (typeof navigator !== 'undefined' && /GateApp/i.test(navigator.userAgent)) ||
    !!(typeof window !== 'undefined' && window.gatewallet?.tronLink && !window.gatewallet.tron);
export function openGateWallet() {
    if (!isInGateApp() && isInMobileBrowser()) {
        // NOTE: The original deeplink (commented out below) that carried `dapp_url` and
        // opened the current dapp inside Gate's in-app browser no longer works, and we
        // haven't been able to find an up-to-date replacement. The only deeplink we can
        // currently obtain just launches the Gate app itself — it does not navigate back
        // to the dapp. Update this once a working dapp-aware deeplink is available.
        window.location.href = 'https://gate.onelink.me/Hls0/web3';
        // window.location.href =
        //     'https://gateio.onelink.me/DmA6/web3?dapp_url=' + encodeURIComponent(window.location.href);
        return true;
    }
    return false;
}
