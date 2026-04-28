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

## Local usage read model

`createGatewayUsageReadModel()` consumes the same sanitized `GatewayEvent` objects and produces a deterministic in-memory snapshot for local smoke tests and future dashboard work:

```ts
import { createGatewayUsageReadModel } from "./usage.js";

const usage = createGatewayUsageReadModel({ maxRecentEvents: 100 });
const server = createGatewayServer({
  apps,
  upstreamBaseUrl,
  upstreamBearerToken,
  eventSink: (event) => {
    usage.record(event);
  },
});

const snapshot = usage.snapshot();
```

The snapshot includes total event counts by operation, outcome, reason code, app ID, and wallet address, plus a bounded `recentEvents` list. Missing app, wallet, or reason metadata is grouped under `unknown`; a literal app ID or wallet address of `unknown` is escaped to `literal:unknown` so real metadata does not collide with the missing-metadata bucket. Set `maxRecentEvents: 0` to keep aggregate counters while retaining no recent event payloads. The read model also sums gas budget for allowed reserve events as a local usage signal.

The read model is intentionally not durable storage, an operator HTTP endpoint, or dashboard authentication. It is a pure local foundation for later usage-store, metrics, dashboard, or CSV-export slices. It copies only the allowlisted event fields, does not store extra fields if a caller passes a wider object, and uses safe dynamic counters for reason-code-like strings.

## Local file-backed usage event store

`createFileGatewayUsageEventStore()` is a deterministic local JSONL event-store foundation for replaying sanitized gateway events across process boundaries:

```ts
import { createFileGatewayUsageEventStore } from "./usage-store.js";

const store = createFileGatewayUsageEventStore({ filePath: "tmp/usage-events.jsonl" });
const server = createGatewayServer({
  apps,
  upstreamBaseUrl,
  upstreamBearerToken,
  eventSink: (event) => {
    void store.append(event);
  },
});

const snapshot = await store.loadReadModel({ maxRecentEvents: 100 });
```

The store writes one JSON object per line and uses the same field allowlist as the local usage read model. Extra fields on wider event-like objects are discarded before append, required fields and present optional fields are validated before storage, string fields are bounded and control-character sanitized at the store boundary, missing files replay as an empty store, blank lines are ignored, and malformed JSON/event shapes fail replay with bounded error messages that include only the line number, not raw corrupt content. Replay validates the file before invoking the caller's record callback, so corrupt later lines do not partially mutate caller state.

This is still a local foundation, not the final production usage database. It does not provide concurrency locks, retention/compaction, schema migrations, encryption at rest, access control, dashboard routes, or CSV export yet.

## Current verification

`npm run smoke:local` asserts that the gateway emits sanitized events for:

- missing app credentials;
- invalid app credentials;
- package policy rejection;
- function policy rejection;
- allowed reserve;
- allowed execute.

`apps/policy-gateway-service/src/events.test.ts` also covers upstream failure events and event sink failure isolation. `apps/policy-gateway-service/src/usage.test.ts` covers event aggregation, missing metadata grouping, bounded recent events, and read-model field allowlisting. `apps/policy-gateway-service/src/usage-store.test.ts` covers append/replay snapshots, missing files, blank lines, corrupt JSON, invalid stored event shapes, and field allowlisting. `npm run smoke:local` feeds the emitted local smoke events into both the usage read model and file-backed usage event store, then asserts deterministic snapshots do not contain app API keys, bearer tokens, or user signatures.

## Production direction

Future production slices can route these events into a durable usage store, metrics endpoint, log sink, dashboard, or CSV export. Keep the same safety rules:

1. Store only the minimum fields needed for usage, rejection, health, and debugging.
2. Never store app API keys, bearer tokens, private keys, transaction bytes, or signatures.
3. Treat event logs as sensitive operational data because app IDs, wallet addresses, package IDs, and function names can still reveal product usage.
4. Alert on rejection spikes, upstream failures, execution failures, quota pressure, and unexpected request volume.
