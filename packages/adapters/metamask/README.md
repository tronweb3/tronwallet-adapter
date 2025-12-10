# `@tronweb3/tronwallet-adapter-metamask`

This package provides an adapter to enable DApps to connect to the [MetaMask Wallet extension](https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn) and [MetaMask Wallet App](https://metamask.io/).

## Demo

```typescript
import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask';
import TronWeb from 'tronweb';

const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { 'TRON-PRO-API-KEY': 'your api key' },
});

const adapter = new MetaMaskAdapter();
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

The `MetaMaskAdapter` implements the standard TronWallet Adapter interface with the following properties and methods:

#### Properties

- `name`: The adapter name (`'MetaMask'`)
- `url`: MetaMask website URL
- `icon`: Base64 encoded icon data URL
- `readyState`: Current wallet ready state (`Loading`, `Found`, or `NotFound`)
- `state`: Current adapter state (`Disconnect` or `Connected`)
- `address`: Connected wallet address (or `null` if not connected)
- `connecting`: Boolean indicating if connection is in progress
- `connected`: Boolean indicating if wallet is connected (computed property)

#### Methods

##### `connect(options?: Record<string, unknown>): Promise<void>`
Connects to the MetaMask wallet.

```typescript
await adapter.connect();
```

##### `disconnect(): Promise<void>`
Disconnects from the wallet.

```typescript
await adapter.disconnect();
```

##### `signMessage(message: string): Promise<string>`
Signs a message with the connected wallet.

```typescript
const signature = await adapter.signMessage('Hello, TRON!');
```

##### `signTransaction(transaction: Transaction): Promise<SignedTransaction>`
Signs a transaction with the connected wallet.

```typescript
const signedTx = await adapter.signTransaction(unsignedTransaction);
```

##### `switchChain(chainId: string): Promise<void>`
Switches to a different blockchain network.

```typescript
await adapter.switchChain('0x2b6653dc'); // Mainnet
```

#### Not Supported

- `multiSign()`: Multi-signature operations are not supported by this adapter.

### Events

The adapter emits the following events:

- `connect`: Emitted when wallet is connected
- `disconnect`: Emitted when wallet is disconnected
- `accountsChanged`: Emitted when the active account changes
- `chainChanged`: Emitted when the network/chain changes
- `readyStateChanged`: Emitted when the wallet's ready state changes
- `stateChanged`: Emitted when the adapter state changes
- `error`: Emitted when an error occurs

For more information about tronwallet adapters, please refer to [`@tronweb3/tronwallet-adapters`](https://github.com/tronweb3/tronwallet-adapter/tree/main/packages/adapters/adapters)
