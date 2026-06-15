# `@tronweb3/tronwallet-adapter-gatewallet`

This package provides an adapter to enable DApps to connect to the [Gate Wallet extension](https://chromewebstore.google.com/detail/gate-wallet/cpmkedoipcpimgecpmgpldfpohjplkpp) and [Gate Wallet App](https://www.gate.io/mobileapp).

## Demo

```typescript
import { GateWalletAdapter } from '@tronweb3/tronwallet-adapter-gatewallet';

const adapter = new GateWalletAdapter();
// connect to TokenPocket
await adapter.connect();

// then you can get address
console.log(adapter.address);

// create a send TRX transaction
const unSignedTransaction = await window.gatewallet.tronLink.tronWeb.transactionBuilder.sendTrx(
    targetAddress,
    100,
    adapter.address
);
// using adapter to sign the transaction
const signedTransaction = await adapter.signTransaction(unSignedTransaction);
// broadcast the transaction
await window.gatewallet.tronLink.tronWeb.trx.sendRawTransaction(signedTransaction);
```

## Documentation

### API

-   `Constructor(config: GateWalletAdapterConfig)`

```typescript
interface GateWalletAdapterConfig {
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

### Security Check

`GateWalletAdapter` supports an optional `securityOptions` field for detecting wallet risks before `connect()`. When enabled, the adapter fetches a remote risk configuration and calls `onRiskDetected` if the wallet is flagged.

```typescript
const adapter = new GateWalletAdapter({
    securityOptions: {
        enabled: true,
        configUrls: ['https://your-server.com/security-config.json'],
        onRiskDetected: async ({ risks }) => {
            // Throw to block the connection, or log a warning
            throw new Error(`Wallet risk detected: ${risks[0].title}`);
        },
    },
});
```

For the full `SecurityOptions` API reference, see [walletadapter.org/docs](https://walletadapter.org/docs/index.html).

### Caveats

-   GateWallet App and extension doesn't implement `multiSign()` and `switchChain()` and will throw error when call them.
-   GateWallet **v8.22.0 and later** temporarily cannot sign messages; `signMessage()` is unavailable until the wallet restores support.
-   Wallet imported by keystore in GateWallet does not support Tron Dapp.
-   It may doesn't support Tron Dapp on some **old Android devices**.
-   Dapps can access all accounts in GateWallet Extension once the connection is built.
-   GateWallet Extension supports auto-reconnect after a page refresh, while the GateWallet App does not.
-   On mobile browsers the deeplink can only launch the GateWallet App itself; it cannot open the current dapp inside GateWallet's in-app browser. The original dapp-aware deeplink no longer works and an up-to-date replacement is not yet available.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
