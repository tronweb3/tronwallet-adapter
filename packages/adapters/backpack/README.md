# @tronweb3/tronwallet-adapter-backpack

Backpack wallet adapter for [TronWallet Adapter](https://github.com/tronweb3/tronwallet-adapter).

## Installation

```bash
npm install @tronweb3/tronwallet-adapter-backpack
# or
yarn add @tronweb3/tronwallet-adapter-backpack
# or
pnpm add @tronweb3/tronwallet-adapter-backpack
```

## Usage

### Basic Usage

```typescript
import { BackpackAdapter } from "@tronweb3/tronwallet-adapter-backpack";

const adapter = new BackpackAdapter();

// Connect
await adapter.connect();

// Sign message
const signature = await adapter.signMessage("Hello TRON");

// Sign transaction
const signedTx = await adapter.signTransaction(transaction);

// Disconnect
await adapter.disconnect();
```

### Event Handling

```typescript
// Listen to connection events
adapter.on("connect", (address) => {
  console.log("Connected:", address);
});

adapter.on("disconnect", () => {
  console.log("Disconnected");
});

adapter.on("stateChanged", (state) => {
  console.log("State changed:", state);
});

adapter.on("error", (error) => {
  console.error("Error:", error);
});
```

### Error Handling

```typescript
import {
  WalletNotFoundError,
  WalletConnectionError,
  WalletDisconnectedError,
} from "@tronweb3/tronwallet-abstract-adapter";

try {
  await adapter.connect();
} catch (error) {
  if (error instanceof WalletNotFoundError) {
    console.error("Backpack wallet not found");
  } else if (error instanceof WalletConnectionError) {
    console.error("Connection failed:", error.message);
  }
}
```

### Chain Switching

```typescript
// Switch to Shasta testnet
await adapter.switchChain("tron:2494104990");

// Listen for chain changes
adapter.on("chainChanged", (chainId) => {
  console.log("Chain changed to:", chainId);
});
```

## Features

- ✅ TIP-1193: Standard TRON provider interface
- ✅ TIP-1102: `eth_requestAccounts` method support
- ✅ TIP-6963: Multiple provider coexistence
- ✅ Automatic provider detection
- ✅ Event-based state management

## Requirements

- For browser usage: Backpack extension installed
- For mobile usage: Backpack iOS or Android app installed
- Backpack wallet supports TRON network

## Browser Support

- Chrome/Chromium-based browsers (extension)
- Firefox (extension)
- Safari (extension)
- Mobile browsers (iOS Safari, Chrome Android) via deep linking

## API Reference

### Methods

- `connect()` - Connect to Backpack wallet
- `disconnect()` - Disconnect from wallet
- `signMessage(message: string)` - Sign a message
- `signTransaction(transaction: Transaction)` - Sign a transaction
- `switchChain(chainId: string)` - Switch to a different chain

### Properties

- `name` - Adapter name: "Backpack"
- `url` - Backpack wallet URL
- `icon` - Wallet icon (base64)
- `state` - Current adapter state
- `address` - Connected wallet address
- `connected` - Connection status
- `readyState` - Wallet ready state

### Events

- `connect` - Emitted when wallet connects
- `disconnect` - Emitted when wallet disconnects
- `stateChanged` - Emitted when adapter state changes
- `chainChanged` - Emitted when chain changes
- `error` - Emitted when an error occurs

## Troubleshooting

### Wallet Not Detected

If the adapter cannot detect Backpack wallet:

1. Ensure Backpack extension/app is installed
2. Refresh the page after installing the extension
3. Check browser console for errors
4. Verify TIP-6963 provider discovery is working

### Connection Fails

- Ensure the wallet is unlocked
- Check if the wallet supports TRON network
- Verify user approval in the wallet

### Transaction Signing Fails

- Ensure wallet is connected
- Verify transaction format is correct
- Check wallet has sufficient balance for fees

## License

MIT

## Links

- [Backpack Wallet](https://www.backpack.app)
- [TronWallet Adapter](https://github.com/tronweb3/tronwallet-adapter)
- [Documentation](https://walletadapter.org/)
- [TRON Wallet Integration Standards](https://github.com/tronprotocol/tips)

