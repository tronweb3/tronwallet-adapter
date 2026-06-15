# `@tronweb3/tronwallet-adapter-okxwallet-evm`

This package provides an adapter to enable DApps to connect to the [OKX Wallet](https://www.okx.com/web3) on EVM-Compatible Chains.

## Demo

```typescript
import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';

const adapter = new OkxWalletEvmAdapter();
// connect
await adapter.connect();

// then you can get address
console.log(adapter.address);

// just use the sendTransaction method to send a transfer transaction.
const transaction = {
    value: '0x' + Number(0.01 * Math.pow(10, 18)).toString(16), // 0.01 is 0.01ETH
    to: 'your target address',
    from: adapter.address,
};
await adapter.sendTransaction(transaction);
```

## Documentation

### API

-   `Constructor(config: OkxWalletEvmAdapterOptions)`

    ```typescript
    import { OkxWalletEvmAdapter } from '@tronweb3/tronwallet-adapter-okxwallet-evm';
    interface OkxWalletEvmAdapterOptions {
        /**
         * Set if open OKX Wallet app when in mobile device.
         * Default is true.
         */
        useDeeplink?: boolean;
    }
    const okxWalletAdapter = new OkxWalletEvmAdapter({ useDeeplink: false });
    ```

More detailed API can be found in [Abstract Adapter](https://github.com/tronweb3/tronwallet-adapter/blob/main/packages/adapters/evm/abstract-adapter/README.md).
