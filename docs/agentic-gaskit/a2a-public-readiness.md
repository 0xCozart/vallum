# A2A Public Readiness

`npm run proof:a2a-public-readiness` is a non-networked proof-boundary command
for Agentic GasKit A2A interoperability claims.

It does not fetch public Agent Cards, operate a public A2A server, publish JWKS
material, run external conformance tools, deliver webhooks, or store webhook
credentials. Instead, it classifies the evidence needed before local A2A proof
can be described as public A2A interoperability.

Operators can prepare static hosting inputs with
`npm run a2a:write-static-discovery-bundle`. That command writes canonical
local `/.well-known/agent-card.json` and `/.well-known/jwks.json` artifacts
plus a sanitized header manifest from already-signed public JSON inputs. It
does not sign cards, generate keys, fetch public URLs, deploy hosting, or prove
endpoint ownership.

Operators can then run `npm run a2a:check-static-discovery-bundle` against the
generated directory. That command validates the local files and manifest before
hosting review, without fetching public URLs or proving public hosting.

Operators can also run `npm run smoke:a2a-static-discovery-local` against the
same generated directory. That command serves only the canonical static
discovery files over loopback, applies the manifest-declared content headers,
fetches the Agent Card and JWKS back locally, and still prints
`publicHostingProven=false`.

Operators can then write a redacted static-hosting review packet with
`npm run a2a:write-static-hosting-review`. That command validates the same
generated directory and emits schema version, kind, canonical public paths,
required headers, command order, operator input names, and safety boundaries
without printing configured public URLs, local output paths, key ids, report
paths, credentials, response bodies, or raw artifact contents. It still reports
`publicHostingProven=false` and `publicDiscoveryProven=false`.

Operators can write a redacted local proof plan with
`npm run a2a:write-public-proof-plan`. That command reads the same
non-networked readiness gates and emits command order, blocker codes, operator
input names, and safety boundaries without printing configured URLs, auth
decisions, report paths, key ids, credentials, response bodies, or report
contents.

When the public A2A structured reports are missing, generate the status-only
templates first:

```bash
npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json
npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json
npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json
```

The generated templates are preparation material only. They do not fetch public
Agent Cards, publish JWKS material, operate public endpoints, deliver webhooks,
run external conformance tools, or prove endpoint ownership, and they are not
accepted as public A2A evidence until an operator completes the required proof
runs and sets the matching ignored structured report paths.

When an operator has approved public A2A infrastructure and supplied local
configuration, `npm run smoke:a2a-public-discovery` is the opt-in networked
probe for public Agent Card and JWKS discovery. It is not part of local
verification and must not be run as a default proof command.

Run it from the repository root:

```bash
npm run proof:a2a-public-readiness
npm run proof:a2a-public-readiness -- --json
npm run proof:a2a-public-readiness -- --out tmp/gaskit/a2a-public-readiness.json
```

Expected status in an unconfigured checkout:

```text
Agentic GasKit A2A public readiness blocked
localProofOk=true
publicReady=false
```

The `--json` and `--out` forms produce a redacted local audit artifact with
schema version, kind, timestamp, public readiness status, local proof status,
check ids grouped by status, blocker codes, checks, and safety boundaries. The
`--out` file is written with mode `600` and must stay outside committed files.
It does not prove public hosting or external conformance by itself.

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
- Local JWKS responses can be served for explicitly configured public signing
  keys without exposing private key material.
- Local static discovery bundles can package a signed Agent Card and public
  JWKS JSON response at canonical well-known paths, with the Agent Card
  signature `jku` bound to the configured public JWKS URL and every signing key
  id present in JWKS.
- Local static discovery bundles can be written as deployable well-known JSON
  files plus a sanitized manifest that records content headers for static
  hosting review.
- Generated static discovery directories can be validated locally before
  public hosting review, including manifest metadata, canonical paths, public
  URL binding, and private-field rejection.
- Generated static discovery directories can be served and fetched over
  loopback with manifest-declared content headers after local artifact
  validation.
- Generated static discovery directories can produce a redacted local
  static-hosting review packet before upload, including canonical public
  paths, required headers, command order, and public-proof boundaries without
  exposing configured URLs or local paths.
- A redacted local public proof plan can be generated from the current
  readiness gates before any operator-approved public probing.
- The opt-in public discovery smoke exists for operator-approved public HTTPS
  Agent Card and JWKS probing, but the non-networked readiness command does not
  run it. Readiness remains blocked unless an operator supplies a structured
  public discovery report generated by that approved smoke.
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
- Local push notification callback URL admission rejects credentials, query
  strings, fragments, loopback hosts, and private network hosts before config
  storage or delivery.
- Local push notification callback hosts can be constrained by an exact
  allowlist before config storage or injected HTTP transport delivery.
- Local push notification retry and delivery-attempt observability are
  supported for explicitly injected transports with status-only attempt
  records.
- Local push notification delivery attempts can be persisted as sanitized JSONL
  status evidence without request bodies, response bodies, webhook credentials,
  or raw transport errors.
- Local push notification delivery requests can be queued as sanitized
  file-backed jobs with public headers and redacted task payloads.
- A local push notification delivery worker can claim one sanitized queued job,
  call an explicitly injected transport, record status-only attempt evidence,
  and complete or fail the local queue entry without persisting raw transport
  errors or response bodies.
- Public push notification webhook delivery remains blocked unless an operator
  supplies an existing local structured public push delivery report after a
  dedicated approved public-infrastructure proof run.
- External conformance remains blocked unless an operator supplies an existing
  local structured conformance report after a dedicated approved proof run.
- Structured reports must be JSON objects with `schemaVersion: 1`, the expected
  `kind`, `result: "passed"`, a recent `observedAt` timestamp, and matching
  public URL fields when those URLs are configured. Empty, plain-text,
  malformed, failed, stale, wrong-kind, or endpoint-mismatched reports remain
  blocked.

## Redaction Boundary

The report prints command names, blocker codes, and generic evidence strings.
It does not print configured public URLs, JWKS URLs, auth decisions, local
report paths, report contents, credentials, tokens, or secret-like values.
The JSON artifact follows the same boundary and must not be used to store
configured endpoint values, report paths, raw payloads, response bodies,
webhook secrets, bearer tokens, or private key material.

## What It Does Not Prove

- Public A2A hosting.
- Live public Agent Card discovery.
- Deployed public JWKS hosting, production Agent Card key management, or key
  rotation.
- Deployed static discovery artifacts, endpoint ownership, or public discovery
  acceptance from local bundle generation, local file writing, local artifact
  validation, local loopback serving, or local static-hosting review alone.
- Production A2A task-route authentication.
- Production extended-card access control.
- Public streaming or webhook delivery by itself.
- Production push delivery workers, production observability, auth, or SSRF
  infrastructure beyond the local callback URL admission, host allowlist
  guards, local durable attempt evidence, local delivery queue proof, and local
  injected-transport worker proof.
- External A2A conformance.
- Provider verification or production trust.

## Static Discovery Artifact Writer

Run only with public JSON inputs that are safe to stage for static hosting:

```bash
npm run a2a:write-static-discovery-bundle -- \
  --agent-card tmp/a2a/agent-card.json \
  --jwks tmp/a2a/jwks.json \
  --public-base-url https://agents.example/a2a \
  --public-jwks-url https://agents.example/.well-known/jwks.json \
  --out-dir tmp/a2a-public
```

The output directory contains:

- `.well-known/agent-card.json`
- `.well-known/jwks.json`
- `a2a-discovery-bundle-manifest.json`

The command validates the signed Agent Card/JWKS binding through the same
static bundle rules used by the registry package and prints only local output
paths/counts. It is still local artifact generation only; public readiness
requires hosting the files on an operator-approved public HTTPS endpoint and
then recording structured public discovery evidence.

Validate the generated directory before upload:

```bash
npm run a2a:check-static-discovery-bundle -- \
  --out-dir tmp/a2a-public \
  --expected-public-base-url https://agents.example/a2a \
  --expected-public-jwks-url https://agents.example/.well-known/jwks.json
```

The check validates local files only and prints `publicHostingProven=false`.
Passing it means the local artifact directory is internally consistent; it is
not endpoint ownership, public discovery, external conformance, or production
key-management proof.

Optionally smoke the generated directory over loopback before upload:

```bash
npm run smoke:a2a-static-discovery-local -- \
  --out-dir tmp/a2a-public \
  --expected-public-base-url https://agents.example/a2a \
  --expected-public-jwks-url https://agents.example/.well-known/jwks.json
```

The smoke validates the artifacts first, binds an ephemeral loopback server,
serves only `/.well-known/agent-card.json` and `/.well-known/jwks.json`, checks
the manifest-declared content-type and cache metadata through local fetches,
and redacts public URLs and key ids from formatted output. It is host-semantics
proof only; public hosting still requires an operator-approved HTTPS endpoint,
structured public discovery evidence, and external conformance review.

Write a redacted static-hosting review packet for the generated directory:

```bash
npm run a2a:write-static-hosting-review -- \
  --out-dir tmp/a2a-public \
  --expected-public-base-url https://agents.example/a2a \
  --expected-public-jwks-url https://agents.example/.well-known/jwks.json \
  --out tmp/a2a-static-hosting-review.json
```

The review packet validates the local artifact bundle first, then records only
reviewable metadata: schema version, kind
`agentic-gaskit.a2a-static-hosting-review`, canonical public file paths,
required response headers, command order, operator input names, and boundaries.
It is safe for local handoff review but still reports
`publicHostingProven=false` and `publicDiscoveryProven=false`; public proof
requires hosting the files on an approved HTTPS endpoint and recording a
structured public discovery report.

## Public Proof Plan

Generate a redacted local operator plan before any public A2A proof run:

```bash
npm run a2a:write-public-proof-plan
```

To write the JSON artifact to a local ignored path:

```bash
npm run a2a:write-public-proof-plan -- --out tmp/gaskit/a2a-public-proof-plan.json
```

The plan writes `kind=agentic-gaskit.a2a-public-proof-plan` and includes
command order, `contactsPublicNetwork` flags, remaining blocker codes,
`ready-approval` codes, operator input variable names, and safety boundaries.
It is still local planning evidence only. It does not fetch public URLs,
validate public hosting, deliver push webhooks, run external conformance tools,
or approve production auth/key management.

## Opt-In Public Discovery Smoke

Run only after operator approval and with public A2A configuration outside
committed files:

```bash
npm run smoke:a2a-public-discovery
```

The command contacts the configured public Agent Card URL and JWKS URL. It
requires public HTTPS, rejects loopback URLs, bounds response size and timeout,
validates Agent Card JSON shape, verifies the advertised HTTP+JSON interface
matches `A2A_PUBLIC_BASE_URL`, checks auth scheme alignment with
`A2A_PUBLIC_TASK_AUTH_DECISION`, and rejects secret-like public Agent Card
fields or private JWK material. Its formatted output redacts configured URLs,
auth decisions, response bodies, and key ids.

To save structured discovery evidence for later readiness review:

```bash
npm run smoke:a2a-public-discovery -- --report tmp/a2a-public-discovery-report.json
```

Passing this smoke is still not external conformance, public push webhook
delivery, production key-rotation approval, or provider verification.

## Operator Inputs

The command can classify these optional inputs without contacting them:

- `A2A_PUBLIC_AGENT_CARD_URL`
- `A2A_PUBLIC_BASE_URL`
- `A2A_PUBLIC_JWKS_URL`
- `A2A_PUBLIC_TASK_AUTH_DECISION`
- `A2A_PUBLIC_DISCOVERY_REPORT`
- `A2A_PUBLIC_PUSH_DELIVERY_REPORT`
- `A2A_EXTERNAL_CONFORMANCE_REPORT`

Supplying these values is not approval to operate public infrastructure. Treat a
`ready-approval` line as input for a dedicated operator-approved public A2A
proof slice, not as completion.

## Structured Report Shape

Public discovery evidence uses:

```json
{
  "schemaVersion": 1,
  "kind": "a2a-public-discovery",
  "result": "passed",
  "observedAt": "2026-06-11T12:00:00.000Z",
  "publicAgentCardUrl": "https://agents.example/.well-known/agent-card.json",
  "publicBaseUrl": "https://agents.example/a2a",
  "publicJwksUrl": "https://agents.example/.well-known/jwks.json",
  "taskAuthDecision": "bearer",
  "checks": ["public-config", "public-agent-card", "public-jwks"]
}
```

Public push delivery evidence uses:

```json
{
  "schemaVersion": 1,
  "kind": "a2a-public-push-delivery",
  "result": "passed",
  "observedAt": "2026-06-11T12:00:00.000Z",
  "publicBaseUrl": "https://agents.example/a2a",
  "callbackStatus": 202,
  "attempts": 1
}
```

External conformance evidence uses:

```json
{
  "schemaVersion": 1,
  "kind": "a2a-external-conformance",
  "result": "passed",
  "observedAt": "2026-06-11T12:00:00.000Z",
  "publicAgentCardUrl": "https://agents.example/.well-known/agent-card.json",
  "publicBaseUrl": "https://agents.example/a2a",
  "checks": ["agent-card", "task-route"]
}
```

The examples show shape only. Use operator-owned local paths outside committed
files for real reports, and keep raw payloads, headers, callback tokens,
bearer credentials, and private infrastructure details out of the report.
