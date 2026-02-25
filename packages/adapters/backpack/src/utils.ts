import { isInMobileBrowser } from '@tronweb3/tronwallet-abstract-adapter';

export interface BackpackTronProvider {
    isBackpack?: boolean;
    request: (args: { method: string; params?: unknown }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    connect?: () => Promise<void>;
    disconnect?: () => Promise<void>;
}

interface BackpackWindow {
    backpack?: {
        tron?: BackpackTronProvider;
    };
    tron?: BackpackTronProvider;
}

/**
 * Check if Backpack wallet is available
 * Backpack injects window.backpack.tron or identifies via isBackpack flag
 */
export function supportBackpack(): boolean {
    if (typeof window === 'undefined') return false;

    const win = window as unknown as BackpackWindow;

    // Check for Backpack's dedicated namespace
    if (win.backpack?.tron) {
        return true;
    }

    // Check for isBackpack flag on window.tron
    if (win.tron?.isBackpack) {
        return true;
    }

    return false;
}

/**
 * Get Backpack provider
 */
export function getBackpackProvider(): BackpackTronProvider | null {
    if (typeof window === 'undefined') return null;

    const win = window as unknown as BackpackWindow;

    // Prefer Backpack's dedicated namespace
    if (win.backpack?.tron) {
        return win.backpack.tron;
    }

    // Fallback to window.tron if it's Backpack
    if (win.tron?.isBackpack) {
        return win.tron;
    }

    return null;
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
    if (!isInBackpackApp() && isInMobileBrowser()) {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://backpack.app/ul/browse/${currentUrl}`;
        return true;
    }
    return false;
}
