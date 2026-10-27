# LedgerEVM Adapter - Unit Tests

This directory contains comprehensive unit tests for the Ledger EVM adapter package.

## Test Files

### 1. **mocks.ts**

Mock implementations for Ledger device interaction:

-   `MockLedgerTransport` - Simulates Ledger USB transport layer
-   `MockLedgerEth` - Simulates Ledger Ethereum app with signing methods
-   Mock responses for address retrieval and signature generation

### 2. **ledger-wallet.test.ts**

Unit tests for the `LedgerWallet` class covering:

-   **signPersonalMessage** - Message signing with personal_sign
-   **signTransaction** - RLP encoded transaction signing
-   **signTypedData** - EIP-712 structured data signing
    -   Auto-adds missing EIP712Domain type definition
    -   Handles complex nested types
-   **getAccounts** - Fetch multiple accounts from Ledger
-   **getAddress** - Get single address with optional display confirmation
-   Edge cases and concurrent operations

### 3. **adapter.test.ts**

Unit tests for the `LedgerEvmAdapter` class covering:

-   **connect/disconnect** - Wallet connection lifecycle
-   **signMessage** - Personal message signing via adapter
-   **signTypedData** - EIP-712 support in adapter
-   **getProvider** - Provider interface (returns null for Ledger)
-   Error handling and user rejection scenarios
-   Multiple sequential operations

## Running Tests

### Prerequisites

-   Node.js 24.22.1 — pinned in the repo root `.nvmrc`
-   pnpm 11.21.0 — pinned by `packageManager` in the root `package.json`

### Commands

```bash
# Install dependencies (from root)
pnpm install

# Run tests for ledger-evm package
cd packages/adapters/evm/ledger
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm exec vitest run ledger-wallet.test.ts

# Run tests in watch mode
pnpm exec vitest
```

## Test Coverage

The test suite provides comprehensive coverage for:

✅ **Core Signing Methods**

-   EIP-712 structured data signing (with EIP712Domain auto-injection)
-   Personal message signing
-   Transaction signing

✅ **Ledger Integration**

-   Account retrieval and enumeration
-   Address display confirmation
-   Signature format validation

✅ **Error Handling**

-   Device not found errors
-   User denial of transactions
-   Malformed input handling
-   Connection failures

✅ **Type Safety**

-   TypeScript type definitions
-   Input validation
-   Output format verification

## Mock Implementation Details

### MockLedgerTransport

Simulates the USB HID transport layer without requiring actual hardware:

```typescript
- create() - Creates mock transport instance
- close() - Closes transport
- isOpen() - Check transport status
```

### MockLedgerEth

Simulates the Ledger Ethereum app with realistic signatures:

```typescript
- getAddress(path, display?) - Returns EIP-55 checksummed address
- signPersonalMessage(path, message) - Returns {v, r, s}
- signTransaction(path, tx) - Returns {v, r, s}
- signEIP712Message(path, message) - Returns {v, r, s}
```

## Implementation Notes

1. **EIP-712 Support**: Tests verify that missing EIP712Domain definitions are automatically added
2. **Signature Format**: Hex signatures include "0x" prefix with 130 hex characters (65 bytes)
3. **No Hardware Required**: All tests use mocks, no actual Ledger device needed
4. **Browser Compatible**: Tests use happy-dom environment for browser context testing

## Integration with Demo

The `demos/dev-demo` project includes the LedgerEvmAdapter for practical testing:

-   See `demos/dev-demo/src/AdapterBasicTest.tsx` for usage example
-   Try signing messages and typed data in the browser

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run Ledger Adapter Tests
  run: |
      cd packages/adapters/evm/ledger
      pnpm test:coverage
```

## Troubleshooting

### Node.js Version Error

If pnpm refuses to start and complains about the Node.js version, the active Node is
not the one this repo pins.

Solution: switch to the version in the repo root `.nvmrc`.

```bash
node --version  # Check the active version
nvm use         # From the repo root — reads .nvmrc, so it stays correct when the pin moves
```

### Module Not Found

If you see import errors, ensure dependencies are installed:

```bash
cd packages/adapters/evm/ledger
pnpm install
```

### Test Timeout

Increase timeout for slow hardware simulation:

```bash
pnpm exec vitest run --testTimeout=10000
```
