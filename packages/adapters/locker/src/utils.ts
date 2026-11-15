import {
    isInBrowser,
    TIP6963AnnounceProviderEventName,
    TIP6963RequestProviderEventName,
} from '@tronweb3/tronwallet-abstract-adapter';
import type { TIP1193Provider, TIP6963AnnounceProviderEvent } from '@tronweb3/tronwallet-abstract-adapter';

/** The reverse-DNS id Locker Wallet announces itself with through TIP-6963. */
export const LockerRdns = 'com.lockerprotocol.wallet';

/**
 * Locker Wallet's Tron provider: TIP-1193 (`request`, `on`, `removeListener`) with a `tronWeb` for signing, marked
 * `isLockerWallet`. It also answers the TronLink API (`isTronLink`), so sites that only know TronLink keep working.
 */
export type LockerTronProvider = TIP1193Provider & { isLockerWallet?: boolean };

/** `window.tron` as Locker Wallet sets it, read without redeclaring the global other adapters type their own way. */
function windowTron(): LockerTronProvider | undefined {
    return (window as unknown as { tron?: LockerTronProvider }).tron;
}

/**
 * Find Locker Wallet's provider: first through TIP-6963 (the announcement whose `rdns` is `com.lockerprotocol.wallet`,
 * which stays right when another Tron wallet owns `window.tron`), then through `window.tron.isLockerWallet`.
 * The request is synchronous: a wallet re-announces from inside its `TIP6963:requestProvider` listener.
 */
export function getLockerProvider(): LockerTronProvider | null {
    if (!isInBrowser()) return null;
    let announced = null as LockerTronProvider | null;
    const onAnnounce = (event: TIP6963AnnounceProviderEvent) => {
        if (event.detail?.info?.rdns === LockerRdns && event.detail.provider) {
            announced = event.detail.provider as LockerTronProvider;
        }
    };
    window.addEventListener(TIP6963AnnounceProviderEventName, onAnnounce);
    window.dispatchEvent(new Event(TIP6963RequestProviderEventName));
    window.removeEventListener(TIP6963AnnounceProviderEventName, onAnnounce);
    if (announced) return announced;
    const tron = windowTron();
    return tron?.isLockerWallet === true ? tron : null;
}

export function supportLocker(): boolean {
    return getLockerProvider() !== null;
}
