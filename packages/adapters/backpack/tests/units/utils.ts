import { vi } from 'vitest';

export async function wait(ms = 100): Promise<void> {
    const p = new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
    vi.advanceTimersByTime(ms);
    // Two awaits flush more than one round of microtasks so chained async work
    // kicked off during construction (`_checkExistingConnection` chains
    // `await checkSecurity()` → `await provider.request(...)`
    // → `_onAccountsChanged(...)`) has settled before assertions.
    await p;
    await p;
}

export const ONE_SECOND = 1000;
export const CHECK_TIMEOUT = 3000;
