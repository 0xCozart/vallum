# Observability

GasKit observability starts at the policy gateway boundary, where sponsorship decisions should be visible through a minimal event schema that omits known secret-bearing fields such as app API keys, bearer tokens, transaction bytes, and user signatures.

## Local gateway decision events

`createGatewayServer()` accepts an optional `eventSink` callback:

```ts
import { createGatewayServer, type GatewayEvent } from "./server.js";

const events: GatewayEvent[] = [];
const server = createGatewayServer({
  apps,
  upstreamBaseUrl,
  upstreamBearerToken,
  eventSink: (event) => {
    events.push(event);
  },
});
```

The callback receives field-allowlisted structured events for reserve and execute paths. String fields are bounded to 256 characters and ASCII/C1 control-character sanitized before delivery. This sanitizer is not a secret scanner or redactor: app IDs, wallet addresses, package IDs, function names, and verified correlation IDs remain sensitive operational metadata and should not be populated with secrets.

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

Malformed JSON, non-object JSON bodies, and oversized payloads are rejected before sponsorship policy evaluation. Those gateway-level parse failures are intentionally outside the decision-event contract in this local slice; a future abuse-monitoring slice can add separate request-error telemetry without including raw bodies.

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
