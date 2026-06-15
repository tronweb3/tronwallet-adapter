# @tronweb3/tronwallet-adapter-guarda

Wallet adapter for Guarda Extension.

## Installation

```bash
npm install @tronweb3/tronwallet-adapter-guarda
```

## Usage

```typescript
import { GuardaAdapter } from '@tronweb3/tronwallet-adapter-guarda';

const adapter = new GuardaAdapter({
    checkTimeout: 2000,
    openUrlWhenWalletNotFound: true,
});

// Connect to wallet
await adapter.connect();

// Get address
console.log(adapter.address);

// Sign transaction
const signedTx = await adapter.signTransaction(transaction);

// Sign message
const signature = await adapter.signMessage('Hello World');

// Disconnect
await adapter.disconnect();
```

## Configuration

| Option                      | Type      | Default | Description                                             |
| --------------------------- | --------- | ------- | ------------------------------------------------------- |
| `checkTimeout`              | `number`  | `2000`  | Timeout in millisecond for checking if is in Guarda App |
| `openUrlWhenWalletNotFound` | `boolean` | `true`  | Set if open Guarda website when wallet not found        |

## Events

The adapter extends the base adapter and emits the following events:

-   `readyStateChanged`: When the wallet ready state changes
-   `connect`: When the wallet connects

## Security Check

`GuardaAdapter` supports an optional `securityOptions` field for detecting wallet risks before `connect()`. When enabled, the adapter fetches a remote risk configuration and calls `onRiskDetected` if the wallet is flagged.

```typescript
const adapter = new GuardaAdapter({
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

## Caveats

-   `multiSign()` and `switchChain(chainId: string)` are not supported.
-   Guarda does not support accounts switching and network switching.
-   Guarda does not support auto-reconnect after a page reload.

## License

MIT
