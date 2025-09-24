# `@tronweb3/tronwallet-adapter-safepal`

This package provides an adapter to enable TRON DApps to connect to the [SafePal Wallet App](https://safepal.com/).

## Demo

```typescript
import { SafepalAdapter } from '@tronweb3/tronwallet-adapter-safepal';
import TronWeb from 'tronweb';
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your api key' },
});

const adapter = new SafepalAdapter();
// connect
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

-   `Constructor(config: SafepalConfig)`

    ```typescript
    interface SafepalConfig {
        /**
         * Set if open Wallet's website when wallet is not installed.
         * Default is true.
         */
        openUrlWhenWalletNotFound?: boolean;
        /**
         * Timeout in millisecond for checking if Safepal wallet is supported.
         * Default is 2 * 1000ms
         */
        checkTimeout?: number;
        /**
         * Set if open Safepal app using DeepLink.
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
-   `multiSign()` and `switchChain()` are not supported in SafePal App and Extension.
-   SafePal App and Extension will reload current page so there is no need to listen `accountsChanged` event.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
