# `@tronweb3/tronwallet-adapter-tomowallet`

This package provides an adapter to enable TRON DApps to connect wallet inside the [Tomo Wallet App](https://tomo.inc/)

## Demo

```typescript
import { TomoWalletAdapter } from '@tronweb3/tronwallet-adapter-tomowallet';
import TronWeb from 'tronweb';

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your api key' },
});

const adapter = new TomoWalletAdapter();
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

### API

-   `Constructor(config: TomoWalletAdapterConfig)`
    ```typescript
    interface TomoWalletAdapterConfig extends BaseAdapterConfig {
        /**
         * Timeout in millisecond for checking if Tomo wallet exists.
        * Default is 3 * 1000ms
        */
        checkTimeout?: number;
        /**
         * The icon of your dapp. Used when open Tomo app in mobile device browsers.
        */
        dappIcon?: string;
        /**
         * The name of your dapp. Used when open Tomo app in mobile device browsers.
        */
        dappName?: string;
    }
    ```
-   `network()` method is supported to get current network information. 
    Currently Tomo Wallet only supports TRON mainnet.  
    The type of returned value is `Network` as follows:

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

-   Deeplink is not supported in mobile device browsers.
-   `switchChain()` is not supported.
-   When `multiSign()` is called, the user must provide a private key. **It's not recommended to use this method.**

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)