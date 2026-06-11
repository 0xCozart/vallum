# A2A Public Readiness

`npm run proof:a2a-public-readiness` is a non-networked proof-boundary command
for Agentic GasKit A2A interoperability claims.

It does not fetch public Agent Cards, operate a public A2A server, publish JWKS
material, run external conformance tools, deliver webhooks, or store webhook
credentials. Instead, it classifies the evidence needed before local A2A proof
can be described as public A2A interoperability.

Run it from the repository root:

```bash
npm run proof:a2a-public-readiness
```

Expected status in an unconfigured checkout:

```text
Agentic GasKit A2A public readiness blocked
localProofOk=true
publicReady=false
```

## What It Checks

- Local A2A well-known, signed-card, task/message, HTTP, and loopback server
  proof commands are wired into local verification.
- Required local source evidence for Agent Card mapping, well-known serving,
  HTTP task routes, and the loopback Node server exists.
- A public Agent Card URL is configured only as HTTPS, non-loopback, and using
  `/.well-known/agent-card.json`.
- Public base URL and production JWKS URL are HTTPS and non-loopback.
- Public task route authentication has an explicit decision: bearer, OAuth2,
  or mTLS.
- Authenticated extended Agent Card access is locally supported through the A2A
  HTTP boundary when an extended card is configured.
- Local loopback SSE streaming proof is configured through the A2A local
  server smoke.
- Local push notification configuration CRUD is supported through the A2A HTTP
  boundary without storing webhook credentials.
- Local push notification delivery envelopes are supported through an injected
  transport without default outbound webhook calls.
- Local push notification HTTP transport is supported as an explicitly
  constructed helper with safe URL checks, manual redirect handling, timeout
  handling, no stored webhook credentials, and status-only results.
- Local push notification retry and delivery-attempt observability are
  supported for explicitly injected transports with in-memory status-only
  attempt records.
- Public push notification webhook delivery remains blocked unless an operator
  supplies an existing local public push delivery report path after a dedicated
  approved public-infrastructure proof run.
- External conformance remains blocked unless an operator supplies a local
  report path and that file exists.

## Redaction Boundary

The report prints command names, blocker codes, and generic evidence strings.
It does not print configured public URLs, JWKS URLs, auth decisions, local
report paths, credentials, tokens, or secret-like values.

## What It Does Not Prove

- Public A2A hosting.
- Live public Agent Card discovery.
- Production Agent Card key management or key rotation.
- Production A2A task-route authentication.
- Production extended-card access control.
- Public streaming or webhook delivery by itself.
- Production push delivery queues/workers, persistent observability, auth, or
  SSRF infrastructure.
- External A2A conformance.
- Provider verification or production trust.

## Operator Inputs

The command can classify these optional inputs without contacting them:

- `A2A_PUBLIC_AGENT_CARD_URL`
- `A2A_PUBLIC_BASE_URL`
- `A2A_PUBLIC_JWKS_URL`
- `A2A_PUBLIC_TASK_AUTH_DECISION`
- `A2A_PUBLIC_PUSH_DELIVERY_REPORT`
- `A2A_EXTERNAL_CONFORMANCE_REPORT`

Supplying these values is not approval to operate public infrastructure. Treat a
`ready-approval` line as input for a dedicated operator-approved public A2A
proof slice, not as completion.
