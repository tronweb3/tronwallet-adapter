<div align="center">
  <h1><b>TronWallet Adapter </b></h2>
</div>

<div align="center">

[![Network](https://img.shields.io/badge/Network-TRON-red.svg)](https://tron.network/)
[![npm version](https://img.shields.io/npm/v/@tronweb3/tronwallet-adapters.svg)](https://www.npmjs.com/package/@tronweb3/tronwallet-adapters)
[![downloads](https://img.shields.io/npm/dm/@tronweb3/tronwallet-adapters.svg)](https://www.npmjs.com/package/@tronweb3/tronwallet-adapters)
[![license](https://img.shields.io/npm/l/@tronweb3/tronwallet-adapters.svg)](https://github.com/tronweb3/tronwallet-adapter/blob/main/LICENSE)
![last commit](https://img.shields.io/github/last-commit/tronweb3/tronwallet-adapter.svg)

<img src="./logo.svg" width="100">
</div>

`tronwallet-adapter` is a powerful Monorepo providing a high-quality suite of wallet adapters and UI components for the TRON ecosystem. It enables developers to integrate multiple wallets (both TRON native and EVM compatible) with a unified, modern API.

---

## 🧭 Which Package Should I Use?

Decide based on your framework and the level of UI control you need:

| Framework      | Quickest Integration (UI + Logic)       | Custom UI (Hooks / Logic Only)             | Core Only (Vanilla JS)          |
| :------------- | :-------------------------------------- | :----------------------------------------- | :------------------------------ |
| **React**      | `@tronweb3/tronwallet-adapter-react-ui` | `@tronweb3/tronwallet-adapter-react-hooks` | —                               |
| **Vue**        | `@tronweb3/tronwallet-adapter-vue-ui`   | `@tronweb3/tronwallet-adapter-vue-hooks`   | —                               |
| **Vanilla JS** | —                                       | —                                          | `@tronweb3/tronwallet-adapters` |

---

## ✨ Key Features

-   **Unified API**: Maintain a single codebase to support 15+ different wallets.
-   **Out-of-the-Box Components**: Ready-to-use modals and buttons for React and Vue.
-   **Developer Friendly**: Fully typed with TypeScript, including detailed error handling and state management.

---

## 📚 Documentation & Resources

-   **Quick Start Guide** Start with our [Official Documentation](https://walletadapter.org/docs/).
-   **Framework Guides**: [React Integration](https://walletadapter.org/docs/guide/react.html) | [Vue Integration](https://walletadapter.org/docs/guide/vue.html)
-   **Core API**: [API Reference](https://walletadapter.org/docs/api-reference/adapter.html)
-   **For EVM**: [EVM Adapter Integration](https://walletadapter.org/docs/guide/evm.html)

---

## 🔌 Supported Wallets

Each adapter offers a consistent interface. You can use this collective package or import individual ones.

| Wallet               | NPM Package                                                                                                          | Description                                                                  | Source                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **All-in-One**       | [`@tronweb3/tronwallet-adapters`](https://npmjs.com/package/@tronweb3/tronwallet-adapters)                           | Includes all adapters below                                                  | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)      |
| **TronLink**         | [`@tronweb3/tronwallet-adapter-tronlink`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-tronlink)           | Adapter for [TronLink](https://www.tronlink.org/)                            | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/tronlink)      |
| **WalletConnect**    | [`@tronweb3/tronwallet-adapter-walletconnect`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-walletconnect) | Adapter for [WalletConnect](https://walletconnect.com/)                      | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/walletconnect) |
| **Ledger**           | [`@tronweb3/tronwallet-adapter-ledger`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-ledger)               | Hardware wallet support                                                      | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/ledger)        |
| **TokenPocket**      | [`@tronweb3/tronwallet-adapter-tokenpocket`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-tokenpocket)     | Adapter for [TokenPocket](https://tokenpocket.pro/)                          | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/tokenpocket)   |
| **BitGet**           | [`@tronweb3/tronwallet-adapter-bitkeep`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-bitkeep)             | Adapter for [BitGet (BitKeep)](https://bitget.com/)                          | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/bitkeep)       |
| **Binance EVM**      | [`@tronweb3/tronwallet-adapter-binance-evm`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-binance-evm)     | Adapter for [Binance Wallet](https://www.binance.com/en/binancewallet) (EVM) | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/evm/binance)   |
| **MetaMask EVM**     | [`@tronweb3/tronwallet-adapter-metamask-evm`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-metamask-evm)   | Native EVM support                                                           | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/evm/metamask)  |
| **TronLink EVM**     | [`@tronweb3/tronwallet-adapter-tronlink-evm`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-tronlink-evm)   | Adapter for [TronLink](https://www.tronlink.org/) (EVM)                      | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/evm/tronlink)  |
| **Trust Wallet EVM** | [`@tronweb3/tronwallet-adapter-trust-evm`](https://npmjs.com/package/@tronweb3/tronwallet-adapter-trust-evm)         | Adapter for [Trust Wallet](https://trustwallet.com/) (EVM)                   | [View](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/evm/trust)     |

> ℹ️ For the full list of 15+ supported wallets, visit our [documentation](https://walletadapter.org/docs/guide/wallet-reference.html#supported-wallets-by-adapter).

> **Note**: In case wallet developers intend to release breaking changes, you can [open an issue here](https://github.com/tronweb3/tronwallet-adapter/issues/new) to inform us, thus enabling us to update the new protocols accordingly.

### Add support for new wallet

Follow these steps to support new wallets:

1. List your wallet to [Tron Wallet](https://tron.network/wallet) .
2. Open an issue in this repository or fork the repository and implement the according adapter.

### Wallet Integration Standards

Wallets are encouraged to implement the following TRON interface standards to ensure compatibility with the TronWallet Adapter and the broader TRON dApp ecosystem:

-   [TIP-1193](https://github.com/tronprotocol/tips/blob/master/tip-1193.md) – Defines a standard TRON provider interface for dApps to communicate with wallets.

By following these standards, wallets can be seamlessly integrated into modern TRON dApps using unified APIs and adapters.

---

## 🛠 Project Structure

This repository is managed using **pnpm** workspaces:

```text
tronwallet-adapter
├── packages
│   ├── adapters
│   │   ├── abstract-adapter  # Core interface definitions
│   │   ├── adapters          # Barrel package for all adapters
│   │   └── [specific-wallet] # Individual wallet implementations
│   ├── react
│   │   ├── react-hooks       # State management for React
│   │   └── react-ui          # Pre-built React components
│   └── vue
│       ├── vue-hooks         # State management for Vue
│       └── vue-ui            # Pre-built Vue components
├── demos                     # Example applications (Next.js, Vite, CDN)
└── docs                      # Detailed manual and API docs
```

---

## 🚀 Development & Contributing

We welcome contributions! To get started with the codebase:

### Prerequisites

-   **Node.js**: 20.18.0
-   **pnpm**: 9.6.0

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/tronweb3/tronwallet-adapter.git

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Start the development demo
pnpm example  # Runs our pre-built React/Vite example
```

### Commands

-   `pnpm watch`: Rebuild packages automatically on change.
-   `pnpm lint`: Run ESLint across all workspaces.
-   `pnpm test`: Run unit tests.
-   `pnpm update-version`: Update package versions for release.

---

## 📄 License

[MIT](./LICENSE)
