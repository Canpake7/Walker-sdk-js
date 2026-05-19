# Walker SDK JS Project Context

Walker-sdk-js is the JavaScript/TypeScript SDK for partner apps integrating with the Walker wallet system.

## Related Repositories

- `Walker`: FastAPI/Postgres backend and source of truth for wallet data
- `Walker-ios`: official iOS app that records HealthKit activity, manages local Screen Time access metering, and can approve partner connections
- `Walker-partner-demo`: small web app that consumes this SDK to test the partner flow

## Purpose

Partner apps use this SDK to:

- enroll a partner app with Walker
- create or refresh a Walker user connection
- create hosted or app-scheme Walker connect URLs
- read wallet balance
- list wallet transactions
- spend credits with idempotency

The SDK must never submit steps or activity events. The official Walker iOS app remains the trusted activity producer and owns local Screen Time allowance/blocking behavior.

The API deliberately exposes chunk credit deduction only. Partners use the SDK to read balances, list transactions, and spend explicit credit amounts. Time-based or product-specific spending rules should be implemented inside the partner app or Walker iOS client before calling `spendCredits`.

Wallet transaction history is the canonical source for partner-facing movement. Do not infer spending from activity events or balance-history summaries in SDK features.

## API Defaults

The SDK default backend is:

```text
https://walker-xl5k.onrender.com
```

Local backend testing can pass:

```ts
new WalkerClient({ baseUrl: "http://localhost:8000" })
```

## Partner Connect URLs

Use hosted connect URLs for cross-platform partner web flows:

```ts
createWalkerConnectUrl({
  baseUrl: "https://walker-xl5k.onrender.com",
  clientId: "wpk_...",
  externalUserId: "partner-user-123",
  redirectUri: "https://partner.example.com/callback",
  scopes: ["wallet:read", "wallet:spend"]
})
```

Without `baseUrl`, the helper creates the older iOS custom-scheme URL:

```text
walker://connect?...
```

Use `walker://connect` only as an iOS app shortcut. It is not reliable for desktop browsers or cross-platform web flows.

## Auth Concepts

- Partner client IDs begin with `wpk_` and are created by `enrollPartnerApp`.
- Partner connection tokens begin with `wct_` and authorize wallet read/spend calls.
- Google ID tokens identify Walker users and are sent to the backend as `Authorization: Bearer ...`.
- Development fallback can use `devPlayerEmail` while `DEV_AUTH_ENABLED=true`.

## Development

```bash
npm install
npm run typecheck
npm run build
```

The package builds ESM, CJS, and type declarations into `dist/`.

## Current Distribution Status

Keep the SDK GitHub-installed for now. It is not published to npm yet, and partners should install it with:

```bash
npm install git+https://github.com/Canpake7/Walker-sdk-js.git
```
