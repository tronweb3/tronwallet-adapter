# `@tronweb3/tronwallet-adapter-trust`

This package provides an adapter to enable TRON DApps to connect to the [Trust extension](https://chrome.google.com/webstore/detail/trust-wallet/egjidjbpglichdcondbcbdnbeeppgdph) and the in-app browser of the [Trust Wallet App](https://trustwallet.com/) on iOS and Android.

## Demo

```typescript
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust';
import TronWeb from 'tronweb';
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your api key' },
});

const adapter = new TrustAdapter();

// connect to Trust
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
     * Must be a finite number between 0 and 600000 (10 minutes);
     * anything else throws at construction.
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

### Deeplink and URL privacy

`openAppWithDeeplink` is **enabled by default**.

When it is on and the dApp runs in a mobile browser outside the Trust app, the adapter opens the wallet through Trust's deeplink service. The **entire current page URL — including its query string and hash — is passed to that service** as the `url` parameter of `https://link.trustwallet.com/open_url`. If the app is not installed, or the universal link does not resolve to it, the browser requests that HTTPS address, so the URL reaches Trust's servers.

Because of that:

-   **Do not put sensitive values in the page URL** — access tokens, OAuth codes, session IDs, one-time credentials, and anything else that grants access. This is good practice regardless of this adapter (URLs end up in browser history, `Referer` headers and server logs), but the deeplink sends the URL somewhere it would otherwise never go.
-   **URL-encoding is not encryption.** `encodeURIComponent` only makes the value safe to carry inside a URL; the original text is trivially recoverable.
-   **If the URL can contain sensitive data, act before connecting.** Either strip it — move the value out of the URL, or clear it with `history.replaceState()` once it has been consumed — or turn the deeplink off:

    ```typescript
    const adapter = new TrustAdapter({ openAppWithDeeplink: false });
    ```

    With `openAppWithDeeplink: false` the adapter never hands the URL to the deeplink service. The trade-off is that a mobile user without the wallet's in-app browser is no longer prompted to open the app, so guide them there yourself.

### Security Check

`TrustAdapter` supports an optional `securityOptions` field for detecting wallet risks before `connect()`. When enabled, the adapter fetches a remote risk configuration and calls `onRiskDetected` if the wallet is flagged.

```typescript
const adapter = new TrustAdapter({
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

-   Only wallet that imported by mnemonic can be used on TRON network.
-   Trust Extension doesn't implement `multiSign()` and `switchChain()` and will throw error when call them.
-   Trust Extension only support: `accountsChanged`,`connect`,`disconnect` events.
-   On mobile, when a DApp opened in an external browser jumps to the Trust Wallet App (for example through the deeplink above), the Trust Wallet App currently does not inject the TRON provider (`window.trustwallet.tron`) into the opened page, so connecting and the other wallet features do not work there. Open the DApp directly in the Trust Wallet App's in-app browser instead.

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
