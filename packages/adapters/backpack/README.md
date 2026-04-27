# @tronweb3/tronwallet-adapter-backpack

Backpack wallet adapter for Backpack Wallet browser extension.

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
import { BackpackAdapter } from '@tronweb3/tronwallet-adapter-backpack';

const adapter = new BackpackAdapter();

// Connect
await adapter.connect();

// Sign message
const signature = await adapter.signMessage('Hello TRON');

// Sign transaction
const signedTx = await adapter.signTransaction(transaction);

// Disconnect
await adapter.disconnect();
```

### Event Handling

```typescript
// Listen to connection events
adapter.on('connect', (address) => {
    console.log('Connected:', address);
});

adapter.on('disconnect', () => {
    console.log('Disconnected');
});

adapter.on('stateChanged', (state) => {
    console.log('State changed:', state);
});

adapter.on('error', (error) => {
    console.error('Error:', error);
});
```

### Error Handling

```typescript
import {
    WalletNotFoundError,
    WalletConnectionError,
    WalletDisconnectedError,
} from '@tronweb3/tronwallet-abstract-adapter';

try {
    await adapter.connect();
} catch (error) {
    if (error instanceof WalletNotFoundError) {
        console.error('Backpack wallet not found');
    } else if (error instanceof WalletConnectionError) {
        console.error('Connection failed:', error.message);
    }
}
```

## Browser Support

-   Chrome/Chromium-based browsers (extension)
-   Firefox (extension)

## Caveats

-   Currently Backpack wallet only support TRON on Browser Extension wallet.
-   Backpack wallet does not support `multiSign`.
-   Backpack wallet only support `Mainnet` and `Shasta`.
-   Backpack extension cannot be connected automatically after page refresh.
-   Backpack extension events cannot work fine currently.

## Troubleshooting

### Wallet Not Detected

If the adapter cannot detect Backpack wallet:

1. Ensure Backpack browser extension is installed
2. Refresh the page after installing the extension
3. Check browser console for errors

## License

MIT

## Links

-   [Backpack Wallet](https://www.backpack.app)
-   [TronWallet Adapter](https://github.com/tronweb3/tronwallet-adapter)
-   [Documentation](https://walletadapter.org/)
-   [TRON Wallet Integration Standards](https://walletadapter.org/docs/new-wallet-support/wallet.html#wallet-integration-standards)
