import { test, expect } from 'vitest';
import '../../lib/umd/index.js';

test("window['@tronweb3/tronwallet-adapters'] should exist", () => {
    const Adapters = (window as any)['@tronweb3/tronwallet-adapters'];
    expect(Adapters).not.toBeUndefined();
    expect(Adapters.TronLinkAdapter).not.toBeUndefined();
    expect(Adapters.BitKeepAdapter).not.toBeUndefined();
    expect(Adapters.TokenPocketAdapter).not.toBeUndefined();
    expect(Adapters.LedgerAdapter).not.toBeUndefined();
    expect(Adapters.WalletConnectAdapter).not.toBeUndefined();
    expect(Adapters.ImTokenAdapter).not.toBeUndefined();
    expect(Adapters.OkxWalletAdapter).not.toBeUndefined();
    expect(Adapters.FoxWalletAdapter).not.toBeUndefined();
    expect(Adapters.BybitWalletAdapter).not.toBeUndefined();
    expect(Adapters.TrustAdapter).not.toBeUndefined();
    expect(Adapters.SafepalAdapter).not.toBeUndefined();
    expect(Adapters.GuardaAdapter).not.toBeUndefined();
});
