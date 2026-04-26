# Observability

GasKit observability starts at the policy gateway boundary, where every sponsorship decision should be visible without exposing sponsor-wallet secrets, app API keys, bearer tokens, transaction bytes, or user signatures.

## Local gateway decision events

`createGatewayServer()` accepts an optional `eventSink` callback:

```ts
import { createGatewayServer, type GatewayEvent } from "./server.js";

const events: GatewayEvent[] = [];
const server = createGatewayServer({
  apps,
  upstreamBaseUrl,
  upstreamBearerToken,
  eventSink: (event) => events.push(event),
});
```

The callback receives field-allowlisted structured events for reserve and execute paths. String fields are bounded and control-character sanitized before delivery.

Event fields include:

- `id`
- `timestamp`
- `operation`: `reserve` or `execute`
- `outcome`: `allowed`, `rejected`, or `upstream_failed`
- `httpStatus`
- `appId`
- `walletAddress`
- `packageId`
- `functionName`
- `gasBudget`
- `gasKitTransactionId`
- `upstreamReservationId`
- `reasonCode`
- `upstreamStatus`

The gateway omits unverified execute correlation IDs from rejection events. Once an execute request matches an in-memory reservation, the event can include the gateway-issued `gasKitTransactionId` and upstream reservation id for correlation.

The event payload intentionally does not include:

- app API keys
- Gas Station bearer tokens
- sponsor private keys
- JWT/session secrets
- raw request bodies
- transaction bytes
- user signatures
- raw upstream error bodies

If the event sink throws or rejects, the gateway ignores that failure and continues request handling. Observability must not become a new sponsorship availability dependency in the local gateway path.

## Current verification

`npm run smoke:local` asserts that the gateway emits sanitized events for:

- missing app credentials;
- invalid app credentials;
- package policy rejection;
- function policy rejection;
- allowed reserve;
- allowed execute.

`apps/policy-gateway-service/src/events.test.ts` also covers upstream failure events and event sink failure isolation.

## Production direction

Future production slices can route these events into a durable usage store, metrics endpoint, log sink, dashboard, or CSV export. Keep the same safety rules:

1. Store only the minimum fields needed for usage, rejection, health, and debugging.
2. Never store app API keys, bearer tokens, private keys, transaction bytes, or signatures.
3. Treat event logs as sensitive operational data because app IDs, wallet addresses, package IDs, and function names can still reveal product usage.
4. Alert on rejection spikes, upstream failures, execution failures, quota pressure, and unexpected request volume.
