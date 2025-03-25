# `@tronweb3/tronwallet-adapter-bybit`

This package provides an adapter to enable TRON DApps to connect to the [Bybit Wallet extension](https://chromewebstore.google.com/detail/bybit-wallet/pdliaogehgdbhbnmkklieghmmjkpigpa) and [Bybit Wallet App](https://www.bybit.com/en/web3/home).

## Demo

```typescript
import { BybitWalletAdapter } from '@tronweb3/tronwallet-adapter-bybit';

const adapter = new BybitWalletAdapter();
// connect to Bybit
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.bybitWallet.tronLink.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await window.bybitWallet.tronLink.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config: BybitWalletAdapterConfig)`

```typescript
interface BybitWalletAdapterConfig {
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

-   Bybit Wallet App and Extension doesn't implement `multiSign()` and `switchChain()`.
-   Bybit Wallet Extension only support these events: `accountsChanged`,`connect`,`disconnect`.
-   Bybit Wallet App does not support any events.
-   Currently deeplink can only open the app but not dapp browser.
-   Keyless Wallet doesn't support Dapp connection.
-   Currently deeplink can not open App Store when app is not installed. 

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
