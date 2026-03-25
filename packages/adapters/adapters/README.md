# @tronweb3/tronwallet-adapters

`@tronweb3/tronwallet-adapters` provides a comprehensive suite of wallet adapters, enabling developers to connect to both **Tron** and **EVM** wallets (such as [TronLink](https://www.tronlink.org/) and [MetaMask](https://metamask.io/)) through a unified and consistent API.

---

## 📦 Installation

This package is a "barrel package" that includes all individual adapters. You can install the entire suite or choose specific adapters to keep your bundle size small.

```bash
# Install the complete suite
npm install @tronweb3/tronwallet-abstract-adapter @tronweb3/tronwallet-adapters

# Or install individual adapters as needed
npm install @tronweb3/tronwallet-abstract-adapter @tronweb3/tronwallet-adapter-tronlink
npm install @tronweb3/tronwallet-abstract-adapter @tronweb3/tronwallet-adapter-walletconnect
```

---

## 🔌 Supported Wallets

Each adapter offers a consistent interface. You can use this collective package or import individual ones.

| Wallet | NPM Package | Description | Source |
| :--- | :--- | :--- | :--- |
| **All-in-One** | [`@tronweb3/tronwallet-adapters`](https://npmjs.com/package/@tronweb3/tronwallet-adapters) | Includes all adapters below | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters) |
| **TronLink** | [`@tronweb3/tronwallet-adapter-tronlink`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-tronlink) | Adapter for [TronLink](https://www.tronlink.org/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/tronlink) |
| **WalletConnect**| [`@tronweb3/tronwallet-adapter-walletconnect`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-walletconnect) | Adapter for [WalletConnect](https://walletconnect.com/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/walletconnect) |
| **MetaMask** | [`@tronweb3/tronwallet-adapter-metamask-tron`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-metamask-tron) | Tron support via [MetaMask](https://metamask.io/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/metamask-tron) |
| **Ledger** | [`@tronweb3/tronwallet-adapter-ledger`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-ledger) | Hardware wallet support | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/ledger) |
| **OKX Wallet** | [`@tronweb3/tronwallet-adapter-okxwallet`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-okxwallet) | Adapter for [OKX Wallet](https://okx.com/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/okxwallet) |
| **TokenPocket** | [`@tronweb3/tronwallet-adapter-tokenpocket`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-tokenpocket) | Adapter for [TokenPocket](https://tokenpocket.pro/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/tokenpocket) |
| **BitGet** | [`@tronweb3/tronwallet-adapter-bitkeep`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-bitkeep) | Adapter for [BitGet (BitKeep)](https://bitget.com/) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/bitkeep) |
| **MetaMask EVM** | [`@tronweb3/tronwallet-adapter-metamask-evm`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-metamask-evm) | Native EVM support | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/evm/metamask) |

> ℹ️ For the full list of 15+ supported wallets, visit our [documentation](https://walletadapter.org/docs/guide/wallet-reference.html#supported-wallets-by-adapter).

---

## 🚀 Usage

> **Note**: If you are using TypeScript, ensure `skipLibCheck: true` is set in your `tsconfig.json`.

### React

For React applications, while you can use the adapters directly, we highly recommend using our official **[React Hooks Package](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/react/react-hooks)** for the best developer experience.

#### Manual Usage (Low-level):
```tsx
import { useMemo, useEffect, useState } from 'react';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';

function WalletInterface() {
    const adapter = useMemo(() => new TronLinkAdapter(), []);
    const [address, setAddress] = useState(adapter.address);

    useEffect(() => {
        const onConnect = (addr: string) => setAddress(addr);
        adapter.on('connect', onConnect);
        
        return () => {
            adapter.off('connect', onConnect);
            adapter.removeAllListeners();
        };
    }, [adapter]);

    return (
        <button onClick={() => adapter.connect()}>
            {address ? `Connected: ${address}` : 'Connect TronLink'}
        </button>
    );
}
```

### Vue

In Vue 3, the Composition API is the recommended way to initialize and manage the adapter.

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapters';

const address = ref('');
const adapter = new TronLinkAdapter();

onMounted(() => {
    adapter.on('connect', (addr) => {
        address.value = addr;
    });
});

onBeforeUnmount(() => {
    adapter.removeAllListeners();
});

const connect = () => adapter.connect();
</script>

<template>
    <button @click="connect">
        {{ address || 'Connect Wallet' }}
    </button>
</template>
```

### 🌐 Vanilla JS / CDN

For environments without build tools, use our UMD bundle.

1. **Include the script**:
```html
<!-- peer dependency needed for LedgerAdapter -->
<script type="module">
    import bufferPolyfill from 'https://cdn.jsdelivr.net/npm/buffer-polyfill@6.0.3/+esm'
    window.Buffer = bufferPolyfill
</script>
<!-- peer dependency needed for WalletConnect -->
<script src="https://cdn.jsdelivr.net/npm/@walletconnect/sign-client/dist/index.umd.js"></script>
<!-- adapters bundle -->
<script src="https://cdn.jsdelivr.net/npm/@tronweb3/tronwallet-adapters/lib/umd/index.js"></script>
```

2. **Initialize**:
```js
const { TronLinkAdapter } = window['@tronweb3/tronwallet-adapters'];
const adapter = new TronLinkAdapter();

adapter.connect().then(() => {
    console.log('Connected to:', adapter.address);
});
```

---

## 🛠️ Configuration

### WalletConnect Support
`WalletConnectAdapter` requires a peer dependency. If you plan to use it, please install:
```bash
npm install @walletconnect/sign-client
```

---

## 📘 Documentation

- **API Reference**: Detailed class and method documentation is available at [walletadapter.org](https://walletadapter.org/docs/api-reference/adapter.html).
- **Guide**: Step-by-step integration guides for [React](https://walletadapter.org/docs/guide/react.html), [Vue](https://walletadapter.org/docs/guide/vue.html).
- **EVM Integration**: Learn how to use MetaMask and other EVM wallets on Tron [here](https://walletadapter.org/docs/guide/evm.html).
