# `@tronweb3/tronwallet-adapter-walletconnect`

This package provides an adapter to enable TRON DApps to connect to [WalletConnect](https://walletconnect.com/).

## Install

```shell
npm i @tronweb3/tronwallet-adapter-walletconnect
# yarn add @tronweb3/tronwallet-adapter-walletconnect
```

> If you are working in a typescript project, you must set `skipLibCheck: true` in `tsconfig.json`.

## Demo

```typescript
import { WalletConnectAdapter } from '@tronweb3/tronwallet-adapter-walletconnect';
import TronWeb from 'tronweb';

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your api key' },
});

const adapter = new WalletConnectAdapter({
    network: 'Nile',
    options: {
        relayUrl: 'wss://relay.walletconnect.com',
        // example walletconnect app project ID
        projectId: '',
        metadata: {
            name: 'Example App',
            description: 'Example App',
            url: 'https://yourdapp-url.com',
            icons: ['https://yourdapp-url.com/icon.png'],
        },
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-z-index': 1000,
    },
});
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

-   `Constructor(config: WalletConnectAdapterConfig)`
    ```typescript
    interface WalletConnectAdapterConfig {
        /**
         * Network to use, one of Mainnet, Shasta, Nile
         * Default: Nile
         */
        network: 'Mainnet' | 'Shasta' | 'Nile';
        /**
         * Options passed to WalletConnect client
         */
        options: {
            projectId: '<YOUR PROJECT ID>';
            // optional parameters
            relayUrl: '<YOUR RELAY URL>';
            metadata: {
                name: 'Wallet name';
                description: 'A short description for your wallet';
                url: "<YOUR WALLET'S URL>";
                icons: ["<URL TO WALLET'S LOGO/ICON>"];
            };
        };
        /**
         * Theme mode configuration flag. By default themeMode option will be set to user system settings.
         * @default `system`
         * @type `dark` | `light`
         * @see https://docs.reown.com/appkit/react/core/theming
         */
        themeMode?: `dark` | `light`;
        /**
         * Theme variable configuration object.
         * @default undefined
         */
        themeVariables?: ThemeVariables;
    }
    interface ThemeVariables {
        /**
         * Base font family.
        */
        '--w3m-font-family'?: string;
        /**
         * Color used for buttons, icons, labels, etc.
        */
        '--w3m-accent'?: string;
        /**
         * The color that blends in with the default colors.
        */
        '--w3m-color-mix'?: string;
        /**
         * The percentage on how much “—w3m-color-mix” should blend in.
        */
        '--w3m-color-mix-strength'?: number;
        /**
         * The base pixel size for fonts.
        */
        '--w3m-font-size-master'?: string;
        /**
         * The base border radius in pixels.
        */
        '--w3m-border-radius-master'?: string;
        /**
         * The z-index of the modal.
        */
        '--w3m-z-index'?: number;
        /**
        * The color of the QRCode.
        */
        '--w3m-qr-color'?: string;
    }
    ```
- `getConnectionStatus(): Promise<{ address: string }>`: Get current connection status. If WalletConnect is connected, the address will be a non-empty value.

### Caveates

-   `multiSign()` and `switchChain(chainId: string)` are not supported.

For more information about wallet adapter, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters).
