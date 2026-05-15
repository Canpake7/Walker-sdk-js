# Walker SDK JS

JavaScript/TypeScript SDK for partner apps integrating with the Walker Wallet API.

Walker is designed around a trusted Walker mobile app that accumulates steps and syncs them to the Walker API. Partner apps use this SDK to connect an existing Walker player to their own user, read the connected wallet balance, list transactions, and spend credits.

## Install

```bash
npm install @walker/walker-sdk-js
```

For local development before publishing:

```bash
npm install
npm run build
```

## Basic Usage

```ts
import { WalkerClient } from "@walker/walker-sdk-js";

const walker = new WalkerClient({
  baseUrl: "http://localhost:8000"
});

const connection = await walker.connectPartnerUser({
  clientId: "wpk_partner_client_id",
  externalUserId: "web-user-123",
  scopes: ["wallet:read", "wallet:spend"],
  playerAuth: {
    walkerBearerToken: "GOOGLE_ID_TOKEN_FROM_WALKER_USER"
  }
});

walker.setConnectionToken(connection.connectionToken);

const balance = await walker.getBalance();
console.log(balance.creditBalance);

const spend = await walker.spendCredits({
  amount: 500,
  reason: "reward_claim",
  externalReference: "reward-123",
  idempotencyKey: "web-user-123:reward-123",
  metadata: {
    description: "Example reward claim"
  }
});

console.log(spend.creditBalance, spend.idempotentReplay);
```

## Development Auth

While the Walker API is running with `DEV_AUTH_ENABLED=true`, connect a player using the development headers:

```ts
const connection = await walker.connectPartnerUser({
  clientId: "wpk_partner_client_id",
  externalUserId: "web-user-123",
  playerAuth: {
    devPlayerEmail: "test@example.com",
    devPlayerName: "Test Player"
  }
});
```

## Enroll A Partner App

The current Walker API MVP exposes app enrollment as an API endpoint. Later this should likely move behind a protected dashboard.

```ts
const partnerApp = await walker.enrollPartnerApp({
  name: "Demo Web App",
  allowedRedirectUrls: ["http://localhost:3000/walker/callback"]
});

console.log(partnerApp.clientId);
console.log(partnerApp.clientSecret);
```

The `clientSecret` is returned once and is reserved for future server-to-server partner APIs.

## API Surface

```ts
const walker = new WalkerClient({ baseUrl, connectionToken });

await walker.enrollPartnerApp(input);
await walker.connectPartnerUser(input);
await walker.getBalance();
await walker.listTransactions({ limit: 50 });
await walker.spendCredits(input);
walker.setConnectionToken(token);
const scoped = walker.withConnectionToken(token);
```

## Error Handling

Failed API responses throw `WalkerApiError`.

```ts
import { WalkerApiError } from "@walker/walker-sdk-js";

try {
  await walker.spendCredits({
    amount: 999999,
    reason: "reward_claim",
    idempotencyKey: "web-user-123:expensive-reward"
  });
} catch (error) {
  if (error instanceof WalkerApiError) {
    console.log(error.status, error.detail);
  }
}
```

## Notes For Partner Apps

- Do not collect or submit steps from this SDK. The official Walker mobile app remains the trusted step producer.
- Always provide an `idempotencyKey` for spend calls. Reusing the same key for the same spend will return the existing transaction instead of double-spending.
- For production web apps, store the connection token carefully. It authorizes reads and spends for the connected Walker wallet according to the granted scopes.
