# dev-demo

A Vite + React development sandbox for testing and validating features of `tronwallet-adapter` before release. It is **not** a production example — it is designed for internal QA and manual verification.

```bash
# from the monorepo root
pnpm example        # start dev server at http://localhost:3003
```

---

## Tabs

| Tab | Purpose |
|---|---|
| **Adapter Demo** | Basic connect / sign / switch-chain for all TRON adapters |
| **EVM Adapter Demo** | EVM-specific flows: send transaction (Legacy / EIP-2930 / EIP-1559), deploy contract, call contract |
| **Security Policy** | Test `securityOptions` at connect time — the main subject of this guide |

---

## Security Policy Demo

The **Security Policy** tab lets you verify how an adapter behaves when `securityOptions` is configured. The security check fires at `adapter.connect()`, before the wallet approval popup appears.

### How it works

```
adapter.connect()
  └─ _beforeConnect()
       ├─ _checkWallet()        waits until the extension is detected
       └─ checkSecurity()       fetches remote config → calls onRiskDetected if risks found
            └─ (if onRiskDetected throws) → connect() throws, wallet popup never opens
```

The remote config is a JSON file with this shape:

```json
{
  "v": "1.0.0",
  "ts": 1716000000000,
  "wallets": {
    "<adapter.name>": [
      { "noticeType": 3, "title": "High-severity risk notice" },
      { "noticeType": 2, "title": "Medium-severity risk notice" },
      { "noticeType": 1, "title": "Low-severity risk notice" }
    ]
  }
}
```

`noticeType` is an integer (`1` / `2` / `3`) whose meaning is entirely up to the DApp. The adapter delivers the value as-is — it is the DApp's `onRiskDetected` callback that decides what to do with each type (e.g. show a toast, block the connection, or prompt for confirmation). The labels info / warning / critical used here are just one possible interpretation. The `wallets` key must match the adapter's `name` property exactly (see **Wallet Adapter** section below).

### securityOptions JSON editor

Paste or edit the full `securityOptions` object in the JSON editor on the left. The adapter is re-created with the latest JSON every time you click **Connect**.

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Enables the security check. When `false` the config URL is never fetched. |
| `configUrls` | `string[]` | — | One or more remote config URLs. Required when `enabled` is `true`. Results from multiple URLs are **merged** (risks de-duplicated by title). |
| `timeout` | `number` (ms) | `2000` | Per-request fetch timeout. On timeout the request is silently dropped and the result falls back to the stale cache (if any), then to a safe allow. |
| `retries` | `number` | `0` | How many times to retry a failed fetch before giving up. |
| `cacheTTL` | `number` (ms) | `600000` | How long a successful response is cached. Within the TTL, subsequent connects skip the network request entirely. Set to `0` to always re-fetch. |
| `throwOnRisk` | `boolean` | `true` | **Demo-only field** (not part of `SecurityOptions`). When `true`, `onRiskDetected` throws and blocks `connect()`. When `false`, it only logs a warning and allows the connection to proceed. |

> **Note** `onRiskDetected` is a function and cannot be serialised to JSON. The demo attaches it automatically based on the `throwOnRisk` flag. The real `SecurityOptions` interface accepts any async callback.

#### Example — block connect on risk

```json
{
  "enabled": true,
  "configUrls": ["http://localhost:3003/mock-security-config.json"],
  "throwOnRisk": true,
  "timeout": 2000,
  "retries": 0,
  "cacheTTL": 600000
}
```

#### Example — log only (soft warning, connect still succeeds)

```json
{
  "enabled": true,
  "configUrls": ["http://localhost:3003/mock-security-config.json"],
  "throwOnRisk": false
}
```

---

### Local mock config files

The Vite dev server can serve local JSON files so you can test without a remote server. These files are **gitignored** — `pnpm dev` and `pnpm build` will automatically create them as empty files if they do not exist. You can then fill in the content you need.

The following files are served under `demos/dev-demo/`:

| Filename | URL served at |
|---|---|
| `mock-security-config.json` | `http://localhost:3003/mock-security-config.json` |
| `mock-security-config-partial.json` | `http://localhost:3003/mock-security-config-partial.json` |

File format:

```json
{
  "v": "1.0.0",
  "ts": 1716000000000,
  "wallets": {
    "<adapter.name>": [
      { "noticeType": 3, "title": "Your high-severity notice text" },
      { "noticeType": 2, "title": "Your medium-severity notice text" },
      { "noticeType": 1, "title": "Your low-severity notice text" }
    ]
  }
}
```

`noticeType` is an integer (`1` / `2` / `3`) whose meaning is entirely up to the DApp — the adapter just passes it through. Add as many wallet keys as needed — the key must match the adapter's `name` exactly (see **Wallet Adapter** section below). Changes take effect on the next connect without restarting the server (`Cache-Control: no-store`).

#### Simulating slow or failing responses

Append query parameters to any mock URL to simulate network conditions:

| Parameter | Effect | Example |
|---|---|---|
| `?delay=<ms>` | Server waits `<ms>` milliseconds before responding. Use with a low `timeout` value to trigger the timeout path. | `?delay=3000` |
| `?status=<code>` | Server returns the given HTTP status code instead of 200. Non-2xx responses are treated as fetch failures. | `?status=500` |

Parameters can be combined:

```
# 2 second delay then HTTP 500 — tests timeout + retry + error-fallback in one shot
http://localhost:3003/mock-security-config.json?delay=2000&status=500
```

---

### Wallet adapter selector

Select which wallet adapter to instantiate. The **Security config key** badge below the dropdown shows the exact string used as the key in the `wallets` object of the config JSON — it must match `adapter.name`.

| Label | `adapter.name` / config key |
|---|---|
| TronLink | `TronLink` |
| OKX Wallet | `OKX Wallet` |
| Bitget Wallet | `Bitget Wallet` |
| Bybit Wallet | `Bybit Wallet` |
| Trust | `Trust` |
| Guarda | `Guarda` |
| OneKey | `OneKey` |
| TokenPocket | `TokenPocket` |
| Gate Wallet | `Gate Wallet` |
| MetaMask | `MetaMask` |

---

### Common test scenarios

| Scenario | JSON to use | What to observe |
|---|---|---|
| **Risk blocks connect** | `enabled: true`, mock-all URL, `throwOnRisk: true` | `connect()` throws; error shown in Connection Result; wallet popup never appears |
| **Risk logged, connect succeeds** | `enabled: true`, mock-all URL, `throwOnRisk: false` | Warning logged in Event Log; connect completes normally |
| **Adapter not flagged** | `enabled: true`, mock-partial URL, select any adapter except TronLink/MetaMask | No risk → connect succeeds |
| **Timeout / fallback** | `enabled: true`, `?delay=5000`, `timeout: 2000` | Fetch times out; no cache → safe fallback; connect succeeds |
| **Error fallback** | `enabled: true`, `?status=500` | Fetch returns 500; treated as failure; safe fallback; connect succeeds |
| **Retry visible delay** | `enabled: true`, `?status=500`, `retries: 2`, `timeout: 1000` | Three attempts × 1 s each = ~3 s delay before connect succeeds |
| **Cache hit** | Any enabled config, connect twice within `cacheTTL` | Second connect is instant (no network request) |
| **Cache expired** | Any enabled config, `cacheTTL: 5000`, wait 5 s, connect again | Second connect re-fetches the config |
| **Security disabled** | `enabled: false` | Config URL is never fetched; connect proceeds immediately |

---

### Persisted state

The JSON editor content is saved to `localStorage` under the key `securityDemo.jsonText`. It is restored automatically after a page refresh, so you do not need to re-enter your config between reloads.
