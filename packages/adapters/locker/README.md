# @tronweb3/tronwallet-adapter-locker

Wallet adapter for [Locker Wallet](https://lockerprotocol.com), a browser extension for Chrome, Brave and Firefox whose keys never sit in the browser: each request is shown as a QR code, checked and signed on Locker Vault, an app on an offline phone, and the signature comes back through the camera.

The adapter finds Locker Wallet through its TIP-6963 announcement (`rdns: com.lockerprotocol.wallet`), so it stays right when another Tron wallet owns `window.tron`, and through `window.tron.isLockerWallet` otherwise.

## Installation

```bash
npm install @tronweb3/tronwallet-adapter-locker
```

## Usage

```typescript
import { LockerAdapter } from '@tronweb3/tronwallet-adapter-locker';

const adapter = new LockerAdapter({
    checkTimeout: 2000,
    openUrlWhenWalletNotFound: true,
});

// Connect to wallet
await adapter.connect();

// Get address
console.log(adapter.address);

// Sign transaction (approved on the offline phone, by QR code)
const signedTx = await adapter.signTransaction(transaction);

// Sign message (TIP-191, as tronWeb.trx.signMessageV2)
const signature = await adapter.signMessage('Hello World');

// Disconnect
await adapter.disconnect();
```

## Configuration

| Option                      | Type      | Default | Description                                                   |
| --------------------------- | --------- | ------- | ------------------------------------------------------------- |
| `checkTimeout`              | `number`  | `2000`  | Timeout in millisecond for checking if Locker Wallet is found |
| `openUrlWhenWalletNotFound` | `boolean` | `true`  | Set if open the Locker Wallet website when wallet not found   |

## Events

The adapter extends the base adapter and emits the following events:

-   `readyStateChanged`: When the wallet ready state changes
-   `connect`: When the wallet connects
-   `disconnect`: When the wallet disconnects

## Caveats

-   `multiSign()`, `signTypedData()` and `switchChain(chainId: string)` are not supported.
-   Every signature waits for the user to scan the request with Locker Vault and the signed answer back: allow for it in your timeouts.

## License

MIT
