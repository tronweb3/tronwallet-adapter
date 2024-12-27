# `@tronweb3/tronwallet-adapter-foxwallet`

This package provides an adapter to enable TRON DApps to connect to the [FoxWallet App](https://www.foxwallet.com).

## Demo

```typescript
import { FoxWalletAdapter } from '@tronweb3/tronwallet-adapter-foxwallet';

const adapter = new FoxWalletAdapter();
// connect to FoxWallet
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.foxwallet.tronLink.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await window.foxwallet.tronLink.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config: FoxWalletAdapterConfig)`

```typescript
interface FoxWalletAdapterConfig {
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

-   FoxWallet App doesn't implement `switchChain()`.
-   Only support `NetworkType.Mainnet`, `NetworkType.Shasta` currently.
-   In FoxWallet, `tronWeb` is a dynamic instance that will be reinitialized when necessary, so the way to access `tronWeb` ​​instance from FoxWallet:
    -   Recommend:
    ```typescript
    const balance = await window.foxwallet.tronLink.tronWeb.trx.getBalance(address);
    ```
    -   Not recommend:
    ```typescript
    const tronWeb = window.foxwallet.tronLink.tronWeb;
    const balance = tronWeb.trx.getBalance(address);
    ```

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
