# Milestone 0 Proof Of Capability

Date: 2026-04-26

Purpose: document the current pre-grant proof that IOTA GasKit is more than a proposal. This repo is a clean open-source grant scaffold extracted from a working GaaS prototype and advanced with deterministic local gateway, SDK, demo, policy simulation, and observability slices.

## Public repository

Repository:

```text
https://github.com/0xCozart/iota-gaskit
```

Initial scaffold commit:

```text
508453a chore: scaffold iota gaskit grant readiness repo
```

Current local continuation note: the working branch can be ahead of the published remote while deterministic slices are being prepared. Treat this proof document as local verification evidence until the corresponding commits are pushed or reviewed.

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
- `docs/grant-milestones.md`
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

## Current verification commands

Install dependencies:

```bash
npm install
```

Run the current full local grant check:

```bash
npm run grant:check
```

`grant:check` currently expands to:

```text
npm test && npm run typecheck && npm run smoke:local && npm run smoke:demo-dapp && npm run smoke:demo-browser && npm run readiness:testnet:example && npm run pack:check
```

Latest local `npm test` result:

```text
tests 98
pass 98
fail 0
cancelled 0
skipped 0
todo 0
```

This includes the product/package/app/script/example tests plus reviewer-document guard tests that prevent proof docs from drifting behind the current local surface.

Latest local full verification result:

```text
npm run grant:check
exit code 0
```

Additional focused slice checks have also run locally for policy simulation, SDK policy simulation, event sanitization, usage read-model hardening, route examples, and Apex manifest detect files under `tmp/apex-workflow/`.

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
- the in-memory local usage read model consumes sanitized events, counts by operation/outcome/app/wallet/reason, bounds recent events, distinguishes missing metadata from literal `unknown`, and stores only allowlisted fields.

Readiness and package tests verify:

- offline testnet readiness checks validate env/config shape without contacting IOTA RPC or Gas Station;
- secret-like values are hidden in readiness output;
- `.env.example` intentionally documents placeholders while real readiness fails on placeholders;
- workspace package build and `npm pack --dry-run` succeed for publishable packages.

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
findings_count 0
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
6. The project is ready to proceed into remaining milestone work where not already locally scaffolded: live/local Gas Station integration, package/SDK finalization, durable usage storage, dashboard, monitoring, and real testnet demo.

## What this proof does not claim

This proof does not claim that:

- a real sponsored testnet transaction has executed from this repo;
- sponsor wallet funding, sponsor key validity, or live IOTA RPC connectivity has been verified;
- the full Docker Compose local stack has been proven end-to-end against official IOTA Gas Station;
- usage tracking is durable across process restarts;
- the operator dashboard has all PRD views yet;
- production monitoring, alerting, KMS/external signer integration, reverse proxy/TLS, or final demo video assets are complete.

Those remain grant milestone deliverables.
