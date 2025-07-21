# `@tronweb3/tronwallet-adapter-binance`

This package provides an adapter to enable TRON DApps to connect to the [Binance Wallet](https://www.binance.com/en/binancewallet).

## Demo

```typescript
import { BinanceWalletAdapter } from '@tronweb3/tronwallet-adapter-binance';

const adapter = new BinanceWalletAdapter();
// connect to BinanceWallet
await adapter.connect();

// then you can get address
console.log(adapter.address);

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
});

// create a send TRX transaction
const unSignedTransaction = await tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config: BinanceWalletAdapterConfig)`

```typescript
interface BinanceWalletAdapterConfig {
    /**
     * Set if open Wallet's website when wallet is not installed.
     * Default is true.
     */
    openUrlWhenWalletNotFound?: boolean;
    /**
     * Timeout in millisecond for checking if Binance wallet is supported.
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

-   Binance Wallet App doesn't implement `multiSign()` and `switchChain()`.
-   Binance Wallet App supports the following events:
    - `connect`
    - `disconnect`
    - `accountsChanged`

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
