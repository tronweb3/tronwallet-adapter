# tronwallet-adapter

This repository contains wallet adapters and components for Tron DApps. With out-of-box components and unified methods, developers can easily interact with multiple wallets, `select/connect/disconnect` wallets and `sign` a message or transaction.

## Wallet Integrations

### Supported

| Wallet Name                                 | platform          | version      |
| ------------------------------------------- |  ----------------- | ------------ |
| [TronLink](https://www.tronlink.org/)       | Android           | 4.17.1     |
|                                             | iOS               | 4.17.0     |
|                                             | Browser Extension | 4.5.0        |
| [BitGet](https://web3.bitget.com/en)        | Android           | 9.14.1     |
|                                             | iOS               | 9.14.0     |
|                                             | Browser Extension | 2.16.21     |
| [OkxWallet](https://okx.com/)               | Android           | 6.132.1     |
|                                             | iOS               | 6.134.0     |
|                                             | Browser Extension | 3.71.0     |
| [TokenPocket](https://www.tokenpocket.pro/) | Android           | 2.8.4     |
|                                             | iOS               | 2.10.0     |
|                                             | Browser Extension | 2.4.0     |
| [imToken](https://token.im/)                | Android           | 2.17.1.8031     |
|                                             | iOS               | 2.17.1.8031     |
|                                             | Browser Extension | Not Support  |
| [GateWallet](https://www.gate.io/web3)      | Android           | 7.18.5   |
|                                             | iOS               | 7.18.0    |
|                                             | Browser Extension | 2.68.0    |
| [FoxWallet](https://foxwallet.com/)         | Android           | 5.3.1     |
|                                             | iOS               | 5.5.10     |
|                                             | Browser Extension | Not Support  |
| [Bybit](https://bybit.com/web3)             | Android           | 5.2.5    |
|                                             | iOS               | 5.2.5    |
|                                             | Browser Extension | 4.1.3    |
| [Ledger](https://www.ledger.com/)           | -                 | All versions |
| [WalletConnect](https://walletconnect.org)  | -                 | v2.0      |
| [Trust](https://trustwallet.com)            | Android           | Not Support  |
|                                             | IOS               | Not Support  |
|                                             | Browser Extension | 2.48.0 <br> 2.49.0 <br> 2.50.1     |
| [Tomo](https://tomo.inc/)                 | Android           | 4.2.4        |
|                                             | iOS               | 4.2.4        |
|                                             | Browser Extension | Not Support  |
| [Binance](https://www.binance.com/en/binancewallet) | Android| 3.2.4       |
|                                             | iOS               | 3.2.3    |
|                                             | Browser Extension | Not Support  |

> **Note**: In case wallet developers intend to release breaking changes, you can [open an issue here](https://github.com/tronweb3/tronwallet-adapter/issues/new) to inform us, thus enabling us to update the new protocols accordingly.

### Add support for new wallet

Follow these steps to support new wallets:

1. List your wallet to [Tron Wallet](https://tron.network/wallet) .
2. Open an issue in this repository or fork the repository and implement the according adapter.

### Wallet Integration Standards
Wallets are encouraged to implement the following TRON interface standards to ensure compatibility with the TronWallet Adapter and the broader TRON dApp ecosystem:

- [TIP-1193](https://github.com/tronprotocol/tips/blob/master/tip-1193.md) – Defines a standard TRON provider interface for dApps to communicate with wallets.

By following these standards, wallets can be seamlessly integrated into modern TRON dApps using unified APIs and adapters.

### Tron Wallets Features Report

Please refer to [this document](https://walletadapter.org/docs/guide/wallet-reference.html) to see the features of Tron wallets.

## Introduction

### Adapters

Wallet adapters help you to access to TRON wallets with consistent API.

There are many wallets supporting TRON network such as TronLink, Ledger and so on . **Different wallets** and **different versions** of one wallet may have different interface to use. The aim of **Adapters** relavant packages is to shield these differences and offer consistent interface for DApp developers. DApps don't need to change their code frequently if they have accessed to the tron wallet adapters code.

For example if you want to connect to different wallets, you have to use different methods:

```js
// TronLink
window.tronLink.request({ method: 'tron_requestAccounts' });

// Ledger
const transport = await TransportWebHID.create();
const app = new Trx(transport);

// WalletConnect
const wallet = new WalletConnectWallet({
    network: this._config.network,
    options: this._config.options,
});
```

With adapter, you can use consistent APIs for different wallets:

```js
// TronLink
const tronlinkAdapter = new TronLinkAdapter();
await tronlinkAdapter.connect();
await tronlinkAdapter.signMessage(message);

// Ledger
const ledgerAdapter = new LedgerAdapter();
await ledgerAdapter.connect();
await ledgerAdapter.signMessage(message);

// WalletConnect
const walletconnectAdapter = new WalletConnectAdapter();
await walletconnectAdapter.connect();
await walletconnectAdapter.signMessage(message);
```

### Hooks and UI components for **React**

There are two libraries for React developers: `@tronweb3/tronwallet-adapter-react-hooks` and `@tronweb3/tronwallet-adapter-react-ui`.

React hook is a hook to manage the global state of wallet, such as current selected wallet and the connect state, address, and so on. It also provides some methods to interact with wallet.

When your dapp supports multiple wallets, with the help of `useWallet()` hook you can easily:

-   select which wallet to use
-   connect to the selected wallet
-   disconnect to the selected wallet
-   call `signMessage` or `signTransaction` of the selected wallet

Examples:

```jsx
function Comp() {
    const { wallet, address, connected, select, connect, disconnect, signMessage, signTransaction } = useWallet();
    return (
        <div>
            <button onClick={() => select('TronLink')}>Select Wallet</button>
            <button onClick={connect}>Connect</button>
            <button onClick={disconnect}>Disconnect</button>
            <button onClick={() => signMessage('Hello World')}>Sign Message</button>
        </div>
    );
}
```

`useWallet()` only contains logic to manage wallet state. Besides, we provide a set of out-of-box components to help you interact with wallets:

-   `WalletSelectButton`: Shows a wallet dialog to select a wallet
-   `WalletConnectButton`: Connects to the selected wallet
-   `WalletDisconnectButton`: Disconnects from the selected wallet
-   `WalletActionButton`: A button with multiple actions include `select/connect/disconnect`

Here is the demo image:

![example](./demo.png)

### Hooks and UI components for **Vue**

There are two libraries for Vue developers: `@tronweb3/tronwallet-adapter-vue-hooks` and `@tronweb3/tronwallet-adapter-vue-ui`.
Vue hook is a hook to manage the global state of wallet, such as current selected wallet and the connect state, address, and so on. It also provides some methods to interact with wallet.

When your dapp supports multiple wallets, with the help of `useWallet()` hook you can easily:

-   select which wallet to use
-   connect to the selected wallet
-   disconnect to the selected wallet
-   call `signMessage` or `signTransaction` of the selected wallet

Examples:

```html
<template>
<div>
    <button onClick={() => select('TronLink')}>Select Wallet</button>
    <button onClick={connect}>Connect</button>
    <button onClick={disconnect}>Disconnect</button>
    <button onClick={() => signMessage('Hello World')}>Sign Message</button>
</div>
</template>
<script setup>
    const { wallet, address, connected, select, connect, disconnect, signMessage, signTransaction } = useWallet();
</script>
```

`useWallet()` only contains logic to manage wallet state. Besides, we provide a set of out-of-box components to help you interact with wallets:

-   `WalletSelectButton`: Shows a wallet dialog to select a wallet
-   `WalletConnectButton`: Connects to the selected wallet
-   `WalletDisconnectButton`: Disconnects from the selected wallet
-   `WalletActionButton`: A button with multiple actions include `select/connect/disconnect`

## Documentation

-   [For Tron Apps](./App.md)

For more details, please refer to the [API Documentation](https://walletadapter.org/docs/api-reference/adapter.html).

## TronWallet Adapter Packages

This library is organized into several packages with few dependencies.

To add it to your app, you'll need abstract adapter package, some adapters for wallets, and UI components.

```bash
tronwallet-adapter
├─docs # documents
├─packages
|   ├─adapters
|   |   ├─abstract-adapter # abstract class for the specified adapter
|   |   ├─adapters # export all adapters
|   |   ├─tronlink # adapter for tronlink
|   |   ├─ledger # adapter for ledger
|   |   ├─walletconnect # adapter for walletconnect
|   |   ├─tokenpocket # adapter for TokenPocket
|   |   ├─bitkeep # adapter for Bitget Wallet
|   |   ├─okxwallet # adapter for Okx Wallet
|   |   ├─imtoken # adapter for imToken Wallet
|   |   ├─gatewallet # adapter for gate.io Wallet
|   |   ├─foxwallet # adapter for FoxWallet
|   |   ├─bybit # adapter for Bybit Wallet
|   |   ├─trust # adapter for Trust Wallet
|   |   ├─tomowallet # adapter for Tomo Wallet
|   |   ├─binance # adapter for Binance Wallet
|   ├─react
|   |   ├─react-hooks # react hooks to manage wallet state
|   |   ├─react-ui # react ui components to select/connect wallets
|   ├─vue
|   |   ├─vue-hooks # vue hooks to manage wallet state
|   |   ├─vue-ui # vue ui components to select/connect wallets
├─demos
|   ├─react-ui
|   |   ├─vite-app # demo for vitejs
|   |   ├─next-app # demo for nextjs
|   ├─vue-ui
|   |   ├─vite-app # demo for vitejs
|   ├─dev-demo # demo for development
|   ├─cdn-demo # demo for cdn usage of adapters
```

### TronWallet Adapters

These packages provide adapters for each wallet.
You can use the `@tronweb3/tronwallet-adapters` package, or add the individual wallet packages you want.

| package                                                                                                                  | description                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`@tronweb3/tronwallet-adapters`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapters)                           | Includes all the wallets (with tree shaking)                     |
| [`@tronweb3/tronwallet-adapter-tronlink`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-tronlink)           | Adapter for TronLink extention and TronLink app(iOS and Android) |
| [`@tronweb3/tronwallet-adapter-ledger`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-ledger)               | Adapter for Ledger                                               |
| [`@tronweb3/tronwallet-adapter-walletconnect`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-walletconnect) | Adapter for Walletconnect                                        |
| [`@tronweb3/tronwallet-adapter-tokenpocket`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-tokenpocket)     | Adapter for TokenPocket                    |
| [`@tronweb3/tronwallet-adapter-bitkeep`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-bitkeep)             | Adapter for BitKeep extension and BitKeep App(iOS and Android)   |
| [`@tronweb3/tronwallet-adapter-okxwallet`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-okxwallet)         | Adapter for Okx Wallet extension and App(Android)                |
| [`@tronweb3/tronwallet-adapter-imtoken`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-imtoken)             | Adapter for imToken Wallet App(iOS and Android)                  |
| [`@tronweb3/tronwallet-adapter-gatewallet`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-gatewallet)       | Adapter for gate.io Wallet App(iOS and Android) and Extension    |
| [`@tronweb3/tronwallet-adapter-foxwallet`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-foxwallet)         | Adapter for FoxWallet App(iOS and Android)                       |
| [`@tronweb3/tronwallet-adapter-bybit`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-bybit)                 | Adapter for Bybit Wallet App(iOS and Android) and Extension      |
| [`@tronweb3/tronwallet-adapter-trust`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-trust)                 | Adapter for TrustWallet Extension                                |
| [`@tronweb3/tronwallet-adapter-tomowallet`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-tomowallet)                 | Adapter for Tomo Wallet App(iOS and Android)                                |
| [`@tronweb3/tronwallet-adapter-binance`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-binance) | Adapter for Binance Wallet App(iOS and Android)    |

### React Components

These packages includes hooks and UI components in React.

| package                                                                                                              | description                         |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [`@tronweb3/tronwallet-adapter-react-hooks`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-react-hooks) | Provides a `useWallet()` react hook |
| [`@tronweb3/tronwallet-adapter-react-ui`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-react-ui)       | UI frameworks for react             |

### Vue Components

These packages includes hooks and UI components in Vue.

| package                                                                                                          | description                       |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [`@tronweb3/tronwallet-adapter-vue-hooks`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-vue-hooks) | Provides a `useWallet()` vue hook |
| [`@tronweb3/tronwallet-adapter-vue-ui`](https://www.npmjs.com/package/@tronweb3/tronwallet-adapter-vue-ui)       | UI frameworks for vue             |

## Packages Examples

### @tronweb3/tronwallet-adapters

This package contains all wallet adapters for Tron including:

-   [TronLink](https://www.tronlink.org/)
-   [Ledger](https://www.ledger.com/)
-   [WalletConnect](https://walletconnect.org)
-   [TokenPocket](https://tokenpocket.pro/)
-   [Bitget](https://bitkeep.com)
-   [OKX Wallet](https://okx.com)
-   [imToken Wallet](https://token.im/)
-   [Gate Wallet](https://www.gate.io/web3)
-   [Fox Wallet](https://foxwallet.com/)
-   [Bybit Wallet](https://www.bybit.com/web3)
-   [Trust](https://trustwallet.com)
-   [Tomo](https://tomo.inc/)
-   [Binance Wallet](https://www.binance.com/en/binancewallet)

Code example：

```jsx
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';

function App() {
    const adapter = useMemo(() => new TronLinkAdapter(), []);
    const onConnect = useCallback(() => {}, []);
    const onDisconnect = useCallback(() => {}, []);
    const onStateChanged = useCallback(() => {}, []);
    useEffect(() => {
        adapter.on('connect', onConnect);
        adapter.on('disconnect', onDisconnect);
        adapter.on('stateChanged', onStateChanged);
        return () => {
            adapter.removeAllListeners();
        };
    });

    const connect = useCallback(() => adapter.connect(), []);
    const disconnect = useCallback(() => adapter.connect(), []);

    return <div></div>;
}
```

### @tronweb3/tronwallet-adapter-react-hooks

This package contains react hooks to easily `select/connect/disconnect` wallets and manage the wallet state.

Code example：

```jsx
import { WalletProvider, useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';

function App() {
    const onError = useCallback((e) => {
        // handle error here
    }, []);
    return (
        <WalletProvider onError={onError}>
            <Content></Content>
        </WalletProvider>
    );
}
function Content() {
    const { address, wallet, connected, select, connect, disconnect } = useWallet();
    return (
        <div>
            <p>Current Address: {address}</p>
            <p>Connection Status: {wallet.state}</p>
            <button onClick={() => select('WalletAdapterName to be selected')}>Select Wallet</button>
            <button onClick={connect}>Connect</button>
            <button onClick={disconnect}>Disconnect</button>
        </div>
    );
}
```

### @tronweb3/tronwallet-adapter-react-ui

This package contains a set of out-of-the-box components to make it easy to `select/connect/disconnect` wallets.

Code example：

```jsx
import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { WalletModalProvider, WalletActionButton } from '@tronweb3/tronwallet-adapter-react-ui';
function App() {
    const onError = useCallback((e) => {
        // handle error here
    }, []);
    return (
        <WalletProvider onError={onError}>
            <WalletModalProvider>
                <WalletActionButton></WalletActionButton>
            </WalletModalProvider>
        </WalletProvider>
    );
}
```

<h3 id="vue-demos">@tronweb3/tronwallet-adapter-vue-hooks</h3>

This package contains vue hooks to easily `select/connect/disconnect` wallets and manage the wallet state.

Code example：

```html
<script setup>
    import { defineComponent, h } from 'vue';
    import { WalletProvider, useWallet } from '@tronweb3/tronwallet-adapter-vue-hooks';
    import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';
    const tronLink = new TronLinkAdapter();

    const adapters = [tronLink];

    function onConnect(address) {
        console.log('[wallet hooks] onConnect: ', address);
    }
    function onDisconnect() {
        console.log('[wallet hooks] onDisconnect');
    }

    const VueComponent = defineComponent({
        setup() {
            // Here you can use `useWallet` API
            const { wallet, connect, signMessage, signTransaction } = useWallet();
            return () =>
                h('div', [
                    h('div', { style: 'color: #222;' }, `Current Adapter: ${(wallet && wallet.adapter.name) || ''}`),
                ]);
        },
    });
</script>

<template>
    <WalletProvider :adapters="adapters" @connect="onConnect" @disconnect="onDisconnect">
        <VueComponent />
    </WalletProvider>
</template>
```

### @tronweb3/tronwallet-adapter-vue-ui

This package contains a set of out-of-the-box components to make it easy to `select/connect/disconnect` wallets.

Code example：

```html
<template>
    <WalletProvider @error="onError">
        <WalletModalProvider>
            <WalletActionButton></WalletActionButton>
            <Profile></Profile>
        </WalletModalProvider>
    </WalletProvider>
</template>
<script setup>
    import { h, defineComponent } from 'vue';
    import { useWallet, WalletProvider } from '@tronweb3/tronwallet-adapter-vue-hooks';
    import { WalletModalProvider, WalletActionButton } from '@tronweb3/tronwallet-adapter-vue-ui';
    // This is necessary to keep style normal.
    import '@tronweb3/tronwallet-adapter-vue-ui/style.css';
    import { WalletDisconnectedError, WalletError, WalletNotFoundError } from '@tronweb3/tronwallet-abstract-adapter';

    function onError(e: WalletError) {
        if (e instanceof WalletNotFoundError) {
            console.error(e.message);
        } else if (e instanceof WalletDisconnectedError) {
            console.error(e.message);
        } else console.error(e.message);
    }

    const ConnectComponent = defineComponent({
        setup() {
            return () => h(WalletActionButton);
        },
    });

    const Profile = defineComponent({
        setup() {
            const { wallet } = useWallet();
            return () => h('div', `Current adapter: ${wallet?.adapter.name}`);
        },
    });
</script>
```

## Quick Start

Clone this repo and run the following commands:

```bash
pnpm install
pnpm build
pnpm example
```

> As the repo uses `pnpm` to manage workspace, please install `Nodejs` and `pnpm` first.
> The following is required:
>
> -   Nodejs = 18.20.2
> -   pnpm = 9.6.0

## Which package should developers use ?

It's recommended to use `@tronweb3/tronwallet-adapter-react-hooks` or `@tronweb3/tronwallet-adapter-react-ui` for developing easily. There are also out-of-box libraries for Vue: `@tronweb3/tronwallet-adapter-vue-hooks` and `@tronweb3/tronwallet-adapter-vue-ui`.

If you don't want to customize your UI components and just want to accomplish functions rapidly, you can use components of `@tronweb3/tronwallet-adapter-react-ui` such as `WalletActionButton`. Its out-of-the-box components will help you `select/connect` the wallet and manage the wallet state.

If you want to have different appearance by developing components, you can use `@tronweb3/tronwallet-adapter-react-hooks` and call the `useWallet()` hook to `select/connect` the wallet.

`@tronweb3/tronwallet-adapters` and `@tronweb3/tronwallet-adapter-xxx` packages include adapters for specified wallets. If you need only one adapter and want to custom your logic and style, you can choose this package.

## Contributing

Welcome to contribute your idea!

1. Fork the repo and clone to your device.
    ```bash
    git clone https://github.com/tronweb3/tronwallet-adapter.git
    ```
2. Install Nodejs@18.20.2 and pnpm@9.6.0
3. Install dependencies
    ```bash
    pnpm install
    ```
4. You can run `pnpm watch` to rebuild the code when changes.
5. Commit the changes you've made and open a PR to this repository.

### Release

1. first update package version:

```shell
pnpm update-version
```

2. release the packages

```
pnpm release
```

## License

[MIT](https://opensource.org/licenses/MIT)
