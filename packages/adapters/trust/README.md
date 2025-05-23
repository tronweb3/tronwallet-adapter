# `@tronweb3/tronwallet-adapter-trust`

This package provides an adapter to enable TRON DApps to connect to the [Trust extension](https://chrome.google.com/webstore/detail/trust-wallet/egjidjbpglichdcondbcbdnbeeppgdph).

## Demo

```typescript
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust';

const adapter = new TrustAdapter();

// connect to Trust
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.trustwallet.tronLink.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);

// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);

// broadcast the transaction
await window.trustwallet.tronLink.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `constructor(config: TrustAdapterConfig)`

```typescript
interface TrustAdapterConfig {
    /**
     * Set if open Wallet's website when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;

    /**
     * Timeout in millisecond for checking if Trust is supported.
     * Default is 2 * 1000ms
     */
    checkTimeout?: number;

    /**
     * Set if open Trust app using DeepLink on mobile devices.
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

-   Only wallet that imported by mnemonic can be used on TRON network.
-   Trust Extension doesn't implement `multiSign()` and `switchChain()`.
-   Trust Extension only support: `accountsChanged`,`connect`,`disconnect` events.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
