import { isInBrowser, isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export interface BackpackTronProvider {
    isBackpack?: boolean;
    accounts: string[];
    address: string;
    request: (args: { method: string; params?: unknown }) => Promise<unknown>;
    on?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
    on?(event: 'chainChanged', handler: (chainData: unknown) => void): void;
    on?(event: string, handler: (...args: unknown[]) => void): void;
    removeListener?(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
    removeListener?(event: 'chainChanged', handler: (chainData: unknown) => void): void;
    removeListener?(event: string, handler: (...args: unknown[]) => void): void;
    connect: () => Promise<void>;
    disconnect?: () => Promise<void>;
}

declare global {
    interface Window {
        backpack?: {
            tron?: BackpackTronProvider;
        };
        tron?: BackpackTronProvider;
    }
}

/**
 * Check if Backpack wallet is available
 * Backpack injects window.backpack.tron or identifies via isBackpack flag
 */
export function supportBackpack(): boolean {
    return isInBrowser() && !!(window.backpack?.tron || window.tron?.isBackpack);
}

/**
 * Get Backpack provider
 */
export function getBackpackProvider(): BackpackTronProvider | null {
    if (!isInBrowser()) return null;
    return window.backpack?.tron || (window.tron?.isBackpack ? window.tron : null) || null;
}

/**
 * Check if running inside Backpack app
 */
export function isInBackpackApp(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Backpack/i.test(navigator.userAgent);
}

/**
 * Open Backpack app via deep link on mobile
 */
export function openBackpack(): boolean {
    if (isInMobileBrowser() && !isInBackpackApp()) {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://backpack.app/ul/browse/${currentUrl}`;
        return true;
    }
    return false;
}
