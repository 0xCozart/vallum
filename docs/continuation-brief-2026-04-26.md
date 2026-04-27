# IOTA GasKit Continuation Brief

Date: 2026-04-26

## What we recovered

The pasted PRD belongs to the clean public-ready repo:

- Primary continuation repo: `/mnt/d/CURSOR/iota-gaskit`
- Public repo recorded in docs: `https://github.com/0xCozart/iota-gaskit`
- Source/incubator prototype: `/mnt/d/CURSOR/gas_station`
- Widget planning folder: `/mnt/d/CURSOR/gaas-embeddable-widget-plan`
- Related observability/status product: `/mnt/d/CURSOR/iotato`

The canonical PRD has been captured in:

- `docs/product-requirements.md`

## Status update after local readiness slices

The clean `iota-gaskit` repo has moved beyond the initial scaffold. It now has a deterministic local gateway/SDK/demo proof that remains intentionally separate from live/testnet execution.

Current local proof includes:

- Apache-2.0 open-source framing, contribution/security docs, grant scope, milestone docs, reviewer walkthrough/checklist, and Milestone 0 proof evidence.
- `@iota-gaskit/shared-types`, `@iota-gaskit/policy-gateway`, and `@iota-gaskit/sdk` packages.
- A runnable local policy gateway service under `apps/policy-gateway-service` with `GET /health`, reserve, execute, and authenticated local policy simulation routes.
- Deterministic local smoke coverage with a mock upstream, loopback gateway, public SDK calls, local demo dApp flow, browser wrapper flow, offline testnet-readiness example check, and package dry-run checks.
- The policy simulation endpoint is implemented as an authenticated gateway-local/offline preflight that evaluates existing policy/quota state without upstream Gas Station calls, reservation creation, quota mutation, or reserve/execute event emission.
- SDK is proven against deterministic local gateway and demo smoke paths, including `simulatePolicy()`, `reserveGas()`, and `executeSponsoredTransaction()`.
- sanitized gateway decision events and in-memory local usage read model are implemented, tested, and documented as a local foundation for durable usage/dashboard work.
- Node backend and Next.js API route examples are tested with server-side credential boundaries and safe frontend response projections.

Latest local proof documents are:

- `docs/milestone-0-proof.md`
- `docs/reviewer-walkthrough.md`
- `docs/reviewer-checklist.md`
- `docs/testnet-readiness.md`
- `docs/observability.md`
- `docs/policy.md`
- `docs/sdk.md`

## Current verification evidence

The latest documented full local command is:

```bash
npm run grant:check
```

`grant:check` expands to:

```text
npm test && npm run typecheck && npm run smoke:local && npm run smoke:demo-dapp && npm run smoke:demo-browser && npm run readiness:testnet:example && npm run pack:check
```

The current reviewer/proof docs also include guard tests in `scripts/reviewer-docs.test.ts` so stale proof claims fail the root `npm test` command.

Current local `npm test` evidence is documented in `docs/milestone-0-proof.md` and `README.md`.

## Current PRD coverage

### Mostly covered for deterministic local grant proof

- Open-source positioning and grant framing.
- License/contribution/security hygiene.
- Grant application narrative, milestone table, and budget framing.
- Shared type package and policy reason-code contract.
- SDK helper package with typed policy simulation, reserve, and execute flows.
- Runnable local gateway/SDK smoke path against a mock upstream.
- Demo dApp local CLI and loopback browser-wrapper smoke paths.
- Offline testnet-readiness example check that validates env/config shape without contacting IOTA RPC or Gas Station.
- Sanitized gateway decision events and local in-memory usage read-model foundation.
- Backend and framework-route examples that keep app credentials server-side.

### Partially covered

- Deployment kit: safe config template and docs exist, but a reviewer-grade Docker/local official Gas Station stack is not yet proven in this repo.
- Usage tracking: in-memory local read model exists, but durable store, dashboard API/UI, CSV export, retention, and access control remain future work.
- Observability/security pack: sanitized event docs and threat/hardening docs exist, but production metrics, alert rules, sponsor balance checks, and final demo proof remain future work.
- SDK/package readiness: local package dry-run exists, but external publish/release hygiene still needs final review.

### Not yet proven in this repo

- Real sponsored testnet transaction using operator-provided secrets.
- Sponsor wallet funding, sponsor private-key validity, or upstream official Gas Station liveness.
- Durable app/project persistence and API-key lifecycle.
- Durable/shared quota counters for multi-process production operation.
- Authenticated operator dashboard, app/wallet usage views, rejection/error/quota views, and CSV export.
- Production monitoring, alerts, reverse proxy/TLS deployment, and final reviewer demo assets.

## Related folders and how they should feed the project

### `/mnt/d/CURSOR/gas_station`

This is the private/incubator prototype. It includes SaaS-shaped GaaS product material such as Express backend patterns, API-key auth, quota/reservation ideas, billing/dashboard concepts, Docker/NGINX/monitoring assets, and partial widget implementation.

Use it as source material only. Do not publish or copy wholesale without scrubbing.

Reasons:

- It is SaaS-shaped rather than grant-toolkit-shaped.
- It can contain local sensitive-looking sponsor/recovery/config material in working-tree files; values must stay redacted and should be rotated if ever real.
- Git state may not be a clean public repo state.
- It can contain build/runtime artifacts that should not be extracted into the clean repo.

Best use:

- Extract gateway/proxy concepts only when they can be minimized, scrubbed, tested, and reframed as open-source toolkit functionality.
- Extract quota/reservation patterns after correcting race/mainnet-safety issues.
- Extract dashboard/monitoring ideas after the public repo has a safe durable usage boundary.
- Extract Docker/NGINX/Grafana patterns only after removing secrets and SaaS-only assumptions.

### `/mnt/d/CURSOR/gaas-embeddable-widget-plan`

This widget planning/design folder is relevant to future managed-service UX, but it is not the core GasKit grant proof path.

Useful pieces later:

- hosted iframe widget plan;
- partner/origin validation;
- widget session-token design;
- design-token and code-sample generation ideas;
- component inventory and execution sequence.

Do not prioritize this before durable usage/dashboard and live testnet proof unless the explicit goal is demo polish.

### `/mnt/d/CURSOR/iotato`

This appears to be IOTA infrastructure monitoring/status product material. It is not GasKit, but it can inform observability.

Useful pieces later:

- IOTA RPC health checks;
- endpoint/check/incident model;
- cron locking/worker checks;
- alert routing abstractions;
- public status page model.

Do not merge wholesale. Adapt only observability/status patterns after GasKit has the durable usage and production monitoring boundaries needed to receive them safely.

## Recommended next deterministic local slices

1. Finish and commit the reviewer/proof docs refresh so grant-facing docs match the current local proof and do not overclaim live/testnet work.
2. Add the smallest durable usage-store foundation behind tests, while keeping it local-only and private to operator/server code.
3. Add a minimal authenticated operator usage API or dashboard foundation only after the durable usage boundary is safe.
4. Review SDK/package publish readiness with dry-run checks only.
5. Prepare live/testnet execution separately, requiring explicit operator approval and secrets handled interactively.

## Guardrails for the next pass

- Work in `/mnt/d/CURSOR/iota-gaskit`, not `/mnt/d/CURSOR/gas_station`, unless explicitly extracting source material.
- Treat `/mnt/d/CURSOR/gas_station` as private/incubator source only.
- Do not copy secrets, `.env` values, sponsor keys, recovery material, local config values, billing credentials, or private prototype code.
- Keep all default slices deterministic and local-only: mock upstream, loopback services, no real IOTA/testnet network calls, no Docker requirement, and no sponsor keys.
- Keep grant scope distinct from future managed SaaS features.
- After each completed slice, audit for mistakes, second-order effects, and edge cases; improve confirmed issues; then continue to the next smallest safe slice.
