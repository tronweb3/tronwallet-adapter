# `@tronweb3/tronwallet-adapter-onekey`

This package provides an adapter to enable TRON DApps to connect to the [OneKey extension](https://chrome.google.com/webstore/detail/jnmbobjmhlngoefaiojfljckilhhlhcj).

## Demo

```typescript
import { OneKeyAdapter } from '@tronweb3/tronwallet-adapter-onekey';

const adapter = new OneKeyAdapter();

// connect to OneKey
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.$onekey.tron.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);

// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);

// broadcast the transaction
await window.$onekey.tron.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `constructor(config: OneKeyAdapterConfig)`

```typescript
interface OneKeyAdapterConfig {
    /**
     * Set if open Wallet's website when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;

    /**
     * Timeout in millisecond for checking if OneKey is supported.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;
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

-   Only wallet that imported by mnemonic can be used on TRON network.
-   OneKey Extension doesn't implement `multiSign()` and `switchChain()`.
-   OneKey Extension only support: `accountsChanged`,`connect`,`disconnect` events.
-   Deeplink is not supported.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
