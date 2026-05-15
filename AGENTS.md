# Walker SDK JS Project Context

Walker-sdk-js is the JavaScript/TypeScript SDK for partner apps integrating with the Walker wallet system.

## Related Repositories

- `Walker`: FastAPI/Postgres backend and source of truth for wallet data
- `Walker-ios`: official iOS app that records HealthKit activity and can approve partner connections
- `Walker-partner-demo`: small web app that consumes this SDK to test the partner flow

## Purpose

Partner apps use this SDK to:

- enroll a partner app with Walker
- create or refresh a Walker user connection
- create hosted or app-scheme Walker connect URLs
- read wallet balance
- list wallet transactions
- spend credits with idempotency

The SDK must never submit steps. The official Walker app remains the trusted activity producer.

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
