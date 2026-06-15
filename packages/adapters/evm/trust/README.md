# `@tronweb3/tronwallet-adapter-trust-evm`

This package provides an adapter to enable DApps to connect to the [Trust Wallet](https://trustwallet.com/browser-extension).

## Demo

```typescript
import { TrustEvmAdapter } from '@tronweb3/tronwallet-adapter-trust-evm';

const adapter = new TrustEvmAdapter();
await adapter.connect();

console.log(adapter.address);

const transaction = {
    value: '0x' + Number(0.01 * Math.pow(10, 18)).toString(16),
    to: 'your target address',
    from: adapter.address,
};
await adapter.sendTransaction(transaction);
```

## Documentation

### API

-   `Constructor()`

    ```typescript
    import { TrustEvmAdapter } from '@tronweb3/tronwallet-adapter-trust-evm';

    const trustWalletEvmAdapter = new TrustEvmAdapter();
    ```

The adapter discovers the Trust Wallet extension using `EIP-6963` and supports the standard EVM wallet methods exposed by the shared abstract adapter.

More detailed API can be found in [Abstract Adapter](https://github.com/tronweb3/tronwallet-adapter/blob/main/packages/adapters/evm/abstract-adapter/README.md).
