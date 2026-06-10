# Milestone 0 Proof Of Capability

Date: 2026-05-05

Purpose: document the current pre-grant proof that IOTA GasKit is more than a proposal. This repo is a clean open-source grant scaffold extracted from a working GaaS prototype and advanced with deterministic local gateway, SDK, demo, policy simulation, observability slices, and a real testnet sponsored execute path.

## Public repository

Repository:

```text
https://github.com/0xCozart/iota-gaskit
```

Initial scaffold commit:

```text
508453a chore: scaffold iota gaskit grant readiness repo
```

Current published proof commit: `24c6e0e Complete real testnet sponsored demo execute` on `main`.

## What exists now

Open-source hygiene:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- GitHub issue templates
- Pull request template

Grant-facing docs:

- `docs/product-requirements.md`
- `docs/continuation-brief-2026-04-26.md`
- `docs/grant-application.md`
- `docs/grant-scope.md`
- `docs/reviewer-checklist.md`
- `docs/reviewer-walkthrough.md`
- `docs/demo-script.md`
- `docs/architecture.md`
- `docs/assets/iota-gaskit-architecture.svg`
- `docs/testnet-readiness.md`
- `docs/observability.md`
- `docs/policy.md`
- `docs/sdk.md`

Security and operations docs:

- `docs/threat-model.md`
- `docs/production-hardening.md`
- `docs/security/sponsor-wallet.md`
- `docs/security/secrets.md`

Code/package surfaces:

- `packages/shared-types`
- `packages/policy-gateway`
- `packages/sdk`
- `apps/policy-gateway-service`
- `apps/demo-dapp`
- `examples/nextjs-api-route`
- `examples/node-backend`
- `examples/policies/demo-dapp.yaml`
- `deploy/gas-station/config.example.yaml`
- `scripts/execute-testnet-sponsored-demo.ts`

## Current verification commands

Install dependencies:

```bash
npm install
```

Run the current full local verification:

```bash
npm run verify:local
```

`verify:local` currently expands to:

```text
npm test && npm run typecheck && npm run smoke:local && npm run smoke:demo-dapp && npm run smoke:demo-browser && npm run readiness:testnet:example && npm run pack:check && npm run smoke:package-install && npm run docs:check && npm run secrets:scan
```

`grant:check` remains as a compatibility alias for grant-reviewer workflows.

Latest local `npm test` result:

```text
tests 132
pass 132
fail 0
cancelled 0
skipped 0
todo 0
```

This includes the product/package/app/script/example tests plus reviewer-document guard tests, package-script checks, and official Gas Station numeric reservation-id compatibility coverage that prevent proof docs from drifting behind the current surface.

Latest local full verification result:

```text
npm run grant:check
exit code 0
```

Additional focused slice checks have also run locally for policy simulation, SDK policy simulation, event sanitization, usage read-model hardening, route examples, real Gas Station diagnostics, real sponsored testnet execute, and Apex manifest detect files under `tmp/apex-workflow/`.

## Current test coverage

Policy gateway and service tests verify:

- missing auth rejects with `AUTH_MISSING`;
- app ID mismatch rejects with `AUTH_INVALID`;
- disabled app rejects with `APP_DISABLED`;
- daily request limit rejects with `APP_DAILY_REQUEST_LIMIT_EXCEEDED`;
- high gas budget rejects with `GAS_BUDGET_TOO_HIGH`;
- non-allowlisted package rejects with `PACKAGE_NOT_ALLOWED`;
- missing package metadata fails closed when package allowlists are configured;
- missing function metadata fails closed when function allowlists are configured;
- non-allowlisted function rejects with `FUNCTION_NOT_ALLOWED`;
- denied wallet rejects with `WALLET_DENIED`;
- valid reserve requests proxy to a mocked upstream;
- execute requests only proxy for known reservations and do not double-consume reservation quota;
- malformed JSON and non-object bodies return `BadRequest`;
- conflicting transaction id aliases are rejected before upstream calls;
- local policy simulation endpoint is authenticated, evaluates current policy/quota state, returns safe decision data, does not proxy upstream, does not create reservations, does not mutate quota counters, and does not emit reserve/execute events.

SDK tests verify:

- `simulatePolicy()` constructs the local policy preflight request;
- policy simulation rejections return as typed decision data;
- simulation auth and malformed transport failures throw SDK errors;
- `reserveGas()` constructs the expected request;
- malformed successful reserve responses throw `GasKitError`;
- `executeSponsoredTransaction()` returns a transaction digest;
- auth rejection throws `GasKitAuthError`;
- reserve policy rejection throws `GasKitPolicyError`.

Examples and demo tests verify:

- Node backend and Next.js API route examples keep app credentials server-side;
- example handlers return safe frontend projections without raw upstream bodies, transaction bytes, user signatures, or credentials;
- local demo dApp CLI and browser-wrapper flows drive the public SDK against a loopback gateway and mock upstream;
- browser wrapper rejects cross-origin POSTs and malformed request bodies before gateway calls.

Observability and usage tests verify:

- sanitized gateway decision events are emitted for reserve/execute allowed, rejected, and upstream-failed paths;
- event payloads omit app API keys, bearer tokens, raw request bodies, transaction bytes, signatures, and raw upstream error bodies;
- event string fields are bounded and control-character sanitized;
- event sink failures do not break request handling;
- the in-memory local usage read model consumes sanitized events, counts by operation/outcome/app/wallet/reason, bounds recent events, distinguishes missing metadata from literal `unknown`, and stores only allowlisted fields;
- the file-backed usage event store appends only sanitized allowlisted event fields, replays deterministic snapshots, treats missing files as empty, and fails corrupt JSON/stored event lines without exposing raw corrupt content;
- the authenticated local operator usage API is absent unless configured, requires a separate bearer token, marks responses `Cache-Control: no-store`, returns sanitized local usage snapshots, and hides usage-store load failures without leaking token, app key, upstream bearer, file-path, or corrupt-line details.

Readiness and package tests verify:

- offline testnet readiness checks validate env/config shape without contacting IOTA RPC or Gas Station;
- secret-like values are hidden in readiness output;
- `.env.example` intentionally documents placeholders while real readiness fails on placeholders;
- workspace package build and `npm pack --dry-run` succeed for publishable packages, with package READMEs and safe prerelease publish metadata present locally;
- `npm run execute:testnet-demo` builds and submits a real sponsored testnet transaction when operator-owned live configuration is present.

## Secret-oriented scan

A local scan was run over non-ignored project files, excluding `node_modules`, `.git`, `dist`, and `.next`, for obvious sensitive patterns including:

- IOTA private-key prefix patterns
- Stripe secret keys
- Stripe webhook secrets
- Resend keys
- private key blocks
- Postgres connection URLs

Latest documented local result:

```text
Secret scan passed: checked tracked text files, findings 0.
```

This is not a substitute for a full professional secret scan before every release, but it confirms the grant scaffold does not contain obvious copied sponsor keys or service credentials.

## Prototype evidence inherited from source project

The clean repo was extracted from a separate non-public GaaS source prototype. That source prototype has verified:

- Express gas sponsorship gateway;
- API-key authentication;
- quota and reservation controls;
- transaction logging;
- dashboard UI;
- code sample generation;
- Docker Compose deployment shape;
- Prometheus/Grafana monitoring assets.

The source prototype remains external evidence only. Do not copy secrets, local config, sponsor keys, recovery material, or deployment assumptions from it into this public repo.

## What Milestone 0 plus the local readiness sprint now proves

The current repo proves:

1. The repo exists publicly and is safely framed as an open-source toolkit.
2. The project has a realistic architecture and grant milestone plan.
3. The core policy, gateway, SDK, examples, smoke, readiness, and observability surfaces are scaffolded with passing deterministic local tests.
4. The local policy gateway can enforce app-key auth, quotas, package/function allowlists, wallet denial, policy simulation, and safe reserve/execute proxy semantics against a mocked upstream.
5. The demo dApp has deterministic CLI and browser-wrapper proof paths that do not expose app credentials to the browser.
6. The real sponsored IOTA testnet execute path has been proven through the local policy gateway, local Gas Station, and IOTA testnet RPC.
7. The project is ready to proceed into remaining milestone work where not already locally scaffolded: package/SDK finalization, production usage storage, dashboard UI, monitoring/alerts, and final demo assets.

## What this proof does not claim

This proof does not claim that:

- production sponsor wallet operations, KMS signing, or mainnet execution have been verified;
- usage tracking is a complete production database with dashboard UI;
- the operator dashboard has all PRD views yet;
- production monitoring, alerting, KMS/external signer integration, reverse proxy/TLS, or final demo video assets are complete.

A real testnet sponsored transaction did execute from this repo with operator-owned local configuration: digest `2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H`. Remaining grant milestone deliverables are production persistence, dashboard UI, monitoring/alerts, hardening beyond the documented baseline, package release operations, and final demo assets.
