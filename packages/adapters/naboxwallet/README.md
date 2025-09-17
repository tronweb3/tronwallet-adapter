# `@tronweb3/tronwallet-adapter-okxwallet`

This package provides an adapter to enable TRON DApps to connect to the [Okx Wallet extension](https://chromewebstore.google.com/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge) and [Okx Wallet App](https://www.okx.com/download).

## Demo

```typescript
import { NaboxWalletAdapter } from '@tronweb3/tronwallet-adapter-okxwallet';

const adapter = new NaboxWalletAdapter();
// connect to OkxWallet
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.NaboxWallet.tronLink.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await window.NaboxWallet.tronLink.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config: NaboxWalletAdapterConfig)`

```typescript
interface NaboxWalletAdapterConfig {
    /**
     * Set if open Wallet's website when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;
    /**
     * Timeout in millisecond for checking if TokenPocket wallet is supported.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
    /**
     * Set if open TokenPocket app using DeepLink on mobile device.
     * Default is true.
     */
    openAppWithDeeplink?: boolean;
}
```

-   `network()` method is supported to get current network information. The type of returned value is `Network` as follows:

    ```typescript
    export enum NetworkType {
        Mainnet = 'Mainnet',
        Shasta = 'Shasta',
        Nile = 'Nile',
        /**
         * When use custom node
         */
        Unknown = 'Unknown',
    }

    export type Network = {
        networkType: NetworkType;
        chainId: string;
        fullNode: string;
        solidityNode: string;
        eventServer: string;
    };
    ```

### Caveats

-   Nabox Wallet App and Extension doesn't implement `multiSign()` and `switchChain()`.
-   Nabox Wallet Extension only support these: `accountsChanged`,`connect`,`disconnect`.
-   Nabox Wallet App does not support any events.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
