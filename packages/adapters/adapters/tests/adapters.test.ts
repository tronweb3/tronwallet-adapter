import { test, expect } from 'vitest';
import * as Adapters from '../src/index.js';

test('this library should expose all adapters', () => {
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
    expect(Adapters.GuardaAdapter).not.toBeUndefined();
    expect(Adapters.BinanceWalletAdapter).not.toBeUndefined();
    expect(Adapters.MetaMaskEvmAdapter).not.toBeUndefined();
    expect(Adapters.TronLinkEvmAdapter).not.toBeUndefined();
    expect(Adapters.BinanceEvmAdapter).not.toBeUndefined();
});
