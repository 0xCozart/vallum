# Node Backend Example

This example shows a minimal server-side integration using `@iota-gaskit/sdk` without exposing the app credential to browser code.

The example exports framework-neutral handlers from `gaskit-backend.ts` so it can be adapted to Express, Fastify, Hono, Next.js route handlers, or another backend. Your real backend owns the SDK client and app API key; frontend callers only provide transaction metadata and user signatures.

```ts
import { createGasKitClient } from "@iota-gaskit/sdk";
import { createGasKitBackendHandlers } from "./gaskit-backend.js";

const handlers = createGasKitBackendHandlers({
  client: createGasKitClient({
    baseUrl: process.env.GASKIT_GATEWAY_URL!,
    apiKey: process.env.GASKIT_DEMO_APP_KEY!,
  }),
});

const reservation = await handlers.reserve({
  walletAddress: "0xUSER",
  packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
  functionName: "mint_badge",
  gasBudget: 50_000_000,
  reserveDurationSecs: 30,
});

const executed = await handlers.execute({
  reservationId: reservation.body.reservationId,
  gasKitTransactionId: reservation.body.gasKitTransactionId,
  transactionBytes: "client-built-transaction-bytes",
  userSignature: "client-user-signature",
});
```

The safe response bodies include only the reservation identifiers, optional sponsor address, execution digest, and sanitized error codes/messages. The handlers map SDK policy/auth/gateway failures to frontend-safe error responses without returning thrown SDK messages or raw upstream error bodies. Policy error responses forward only known GasKit policy reason codes and omit unknown upstream-provided reason strings. They intentionally omit:

- app API keys and bearer tokens;
- raw upstream bodies;
- gas coin internals;
- transaction bytes;
- user signatures.

Run the example regression tests from the repo root:

```bash
node --import tsx --test examples/node-backend/gaskit-backend.test.ts
```

The root `npm test` command also includes checked example tests, and `npm run typecheck` includes `examples/**/*.ts`.
