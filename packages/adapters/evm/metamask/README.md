# `@tronweb3/tronwallet-adapter-metamask-evm`

This package provides an adapter to enable DApps to connect to the [MetaMask Wallet](https://metamask.io/).

## Demo

```typescript
import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';

const adapter = new MetaMaskEvmAdapter();
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

-   `Constructor(config: MetaMaskEvmAdapterOptions)`

    ```typescript
    import { MetaMaskEvmAdapter } from '@tronweb3/tronwallet-adapter-metamask-evm';
    interface MetaMaskEvmAdapterOptions {
        /**
         * Set if open MetaMask app when in mobile device.
         * Default is true.
         */
        useDeeplink?: boolean;
    }
    const metaMaskAdapter = new MetaMaskEvmAdapter({ useDeeplink: false });
    ```

More detailed API can be found in [Abstract Adapter](https://github.com/tronweb3/tronwallet-adapter/blob/main/packages/adapters/evm/abstract-adapter/README.md).
