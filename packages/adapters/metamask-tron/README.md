# `@tronweb3/tronwallet-adapter-metamask-tron`

This package provides an adapter to enable TRON DApps to connect to the [MetaMask Wallet](https://metamask.io/download).

## Demo

```typescript
import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask-tron';

const config = {
    openAppWithDeeplink: true, // open MetaMask app when wallet not found on mobile devices
    openUrlWhenWalletNotFound: true, // open MetaMask website when wallet not found
};
const adapter = new MetaMaskAdapter(config);
// connect to wallet
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await tronWeb.transactionBuilder.sendTrx(targetAddress, 100, adapter.address);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config?: MetaMaskAdapterConfig)`

    ```typescript
    interface MetaMaskAdapterConfig {
        /**
         * Set if open MetaMask app using DeepLink.
         * Default is true.
         */
        openAppWithDeeplink?: boolean;
        /**
         * Set if open MetaMask website when wallet is not found.
         * Default is true.
         */
        openUrlWhenWalletNotFound?: boolean;
    }
    ```

    **Example:**

    ```typescript
    import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask-tron';

    const adapter = new MetaMaskAdapter({
        openAppWithDeeplink: true, // open MetaMask app when wallet not found on mobile devices
        openUrlWhenWalletNotFound: true, // open MetaMask website when wallet not found
    });
    ```

### Caveats

-   `multiSign` is not supported yet.
-   Only wallet imported by mnemonic can be used on TRON network.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
