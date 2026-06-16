# Codebase Map

Status: reviewed
Reviewed at: 2026-06-16T00:00:00.000Z
Last updated: 2026-06-16.

Purpose: fast, reviewed orientation for engineering work in Vallum.
Use this map before broad search. It is routing evidence, not product proof.

## High-Level Layout

Vallum is a local fork of the original IOTA GasKit sponsorship toolkit. It
preserves the gas sponsorship foundation and extends it with agent-safe accounts, signer
references, manifests, receipts, contract workflows, registry/identity
adapters, standards bridges, and readiness gates.

Top-level layout:

- `packages/` - TypeScript workspace packages.
- `apps/` - runnable services and demo/docs apps.
- `contracts/` - local Move contract packages.
- `examples/` - deterministic local examples and smoke inputs.
- `scripts/` - verification, readiness, proof, smoke, and artifact commands.
- `deploy/` - Docker and deployment templates.
- `docs/` - public product, operator, security, and verification docs.
- `skills/` - repo-local agent workflow skill.

Package manager: `npm`.

Primary source roots:

- `packages/sdk/src/`
- `packages/policy-gateway/src/`
- `packages/shared-types/src/`
- `packages/accounts/src/`
- `packages/manifest/src/`
- `packages/registry/src/`
- `packages/standards/src/`
- `packages/marketplace/src/`
- `packages/receipts/src/`
- `packages/mcp-server/src/`
- `packages/contracts-metadata/src/`
- `apps/policy-gateway-service/src/`

## Architecture Anchors

Read these first:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/overview.md`
- `docs/architecture.md`
- `docs/product-requirements.md`
- `docs/vallum/migration-plan.md`
- `docs/vallum/account-wallet-safety.md`
- `docs/vallum/execution-slices.md`
- `docs/vallum/verification-hardening.md`

Product authority:

- `docs/product-requirements.md`
- `docs/overview.md`
- `docs/architecture.md`
- `docs/vallum/roadmap.md`
- `docs/vallum/account-wallet-safety.md`

Execution evidence authority:

- `docs/vallum/execution-slices.md`
- `docs/vallum/launch-readiness-evidence.md`
- `docs/vallum/testnet-digest-proof.md`
- `docs/reviewer-walkthrough.md`
- `docs/vallum/verification-hardening.md`

Local Codex goal, handoff, raw thesis, scratch audit, and private planning docs
are intentionally ignored or marked non-authoritative for open-source product
truth. Do not cite them as public product evidence.

## Core Domains And Ownership Zones

- SDK and backend integration: `packages/sdk/src/`,
  `docs/vallum/package-integration-guide.md`, `docs/sdk.md`,
  `docs/examples.md`, `examples/node-backend/`,
  `examples/nextjs-api-route/`.
- Policy engine and app authorization: `packages/policy-gateway/src/`,
  `docs/policy.md`, `examples/policies/demo-dapp.yaml`.
- HTTP gateway service: `apps/policy-gateway-service/src/`.
- Shared request/response contracts: `packages/shared-types/src/`.
- Agent accounts and signer references: `packages/accounts/src/`,
  `docs/vallum/account-wallet-safety.md`.
- Agent manifests: `packages/manifest/src/`.
- Receipts: `packages/receipts/src/`.
- Contract template metadata: `packages/contracts-metadata/src/`.
- Registry, Agent Profiles, IOTA Names, IOTA Identity, and VC trust policy:
  `packages/registry/src/`.
- Standards bridges: `packages/standards/src/`.
- MCP sponsorship facade: `packages/mcp-server/src/`.
- Marketplace read model and readiness:
  `packages/marketplace/src/`, `docs/marketplace-readiness.md`.
- Local Move contract workflows: `contracts/*_v1/`.
- Docs site: `apps/docs-site/`.
- Testnet, Gas Station, live proof, and operator gates: `scripts/`,
  `docs/testnet-readiness.md`, `docs/testnet-attempts.md`,
  `docs/vallum/live-proof-status.md`,
  `docs/vallum/operator-live-gates.md`.
- Security and secret hygiene: `docs/security/`, `docs/threat-model.md`,
  `scripts/scan-secrets.ts`.

## Routes, Commands, And Entry Points

Runtime/service entry points:

- `apps/policy-gateway-service/src/server.ts`
- `apps/demo-dapp/`
- `apps/docs-site/`
- `examples/*/`

Core local verification:

- `npm test`
- `npm run typecheck`
- `npm run docs:check`
- `npm run secrets:scan`
- `npm run verify:fast`
- `npm run verify:local`
- `npm run grant:check`

Contract and smoke proof:

- `npm run contracts:test`
- `npm run smoke:local`
- `npm run smoke:demo-dapp`
- `npm run smoke:demo-browser`
- `npm run smoke:agent-escrow`
- `npm run smoke:paid-mcp-tool`
- `npm run smoke:data-license`
- `npm run smoke:service-bounty`
- `npm run smoke:reputation-receipt`
- `npm run smoke:subscription`
- `npm run smoke:marketplace-read-model`

A2A proof:

- `npm run smoke:a2a-well-known`
- `npm run smoke:a2a-signed-card`
- `npm run smoke:a2a-task-message`
- `npm run smoke:a2a-http`
- `npm run smoke:a2a-local-server`
- `npm run smoke:a2a-static-discovery-local`
- `npm run proof:a2a-public-readiness`
- `npm run a2a:write-public-proof-plan`
- `npm run a2a:write-public-proof-bundle`
- `npm run a2a:write-static-discovery-bundle`
- `npm run a2a:check-static-discovery-bundle`
- `npm run a2a:write-static-hosting-review`

Live/testnet and operator gates:

- `npm run readiness:testnet`
- `npm run readiness:testnet:example`
- `npm run gas-station:render-config`
- `npm run gas-station:runtime-preflight`
- `npm run gas-station:docker-direct`
- `npm run sponsor:check-funding`
- `npm run sponsor:write-funding-request`
- `npm run sponsor:request-faucet-funds`
- `npm run diagnose:gas-station`
- `npm run execute:testnet-demo`
- `npm run proof:live-status`
- `npm run live:write-proof-plan`
- `npm run live:write-identity-proof-bundle`
- `npm run smoke:iota-names-live`
- `npm run smoke:iota-identity-live`
- `npm run proof:testnet-digest`
- `npm run proof:testnet-digest:live`

Readiness/product gates:

- `npm run proof:product-status`
- `npm run proof:launch-readiness`
- `npm run proof:operator-gates`
- `npm run proof:roadmap-completion`
- `npm run roadmap:write-execution-proof-bundle`
- `npm run operator:write-live-gate-report`
- `npm run operator:write-report-template`
- `npm run proof:verification-profiles`
- `npm run proof:package-publication-readiness`
- `npm run package:write-publication-proof-plan`
- `npm run package:write-publication-proof-bundle`
- `npm run proof:payment-provider-readiness`
- `npm run payment:write-provider-proof-plan`
- `npm run payment:write-provider-proof-bundle`
- `npm run proof:marketplace-readiness`
- `npm run marketplace:write-production-proof-plan`
- `npm run marketplace:write-production-proof-bundle`
- `npm run proof:custody-readiness`
- `npm run custody:write-production-proof-plan`
- `npm run custody:write-production-proof-bundle`

Publication checks:

- `npm run pack:check`
- `npm run smoke:package-install`
- `npm run publish:dry-run`

## Data, State, Auth, And External Boundaries

Security boundaries:

- Policy gateway app credentials, quotas, allowlists, wallet denial, reserve
  proxying, and execute proxying.
- Sponsor wallet and Gas Station bearer token handling.
- Agent wallet creation and signer references.
- Manifest validation before sponsored or value-bearing actions.
- Payment-provider evidence and standards bridge reports.
- Registry/profile resolution and VC trust policy.
- Marketplace receipt access and dispute evidence bundles.
- A2A public discovery, Agent Card signing keys, bearer-authenticated task
  routes, push callback URLs, and public conformance reports.

Secret and redaction invariants:

- Never expose sponsor private keys, wallet mnemonics, seeds, raw keypairs,
  app API keys, bearer tokens, raw transaction bytes, user signatures, payment
  credentials, private prompts, raw upstream bodies, raw webhook bodies, or
  local secret paths.
- Browser/demo code must call same-origin backend routes; backend routes own
  Vallum app credentials.
- Signer references are opaque scoped handles, not bearer credentials.
- Live/testnet commands require explicit operator intent and operator-owned
  config outside committed files.

External proof boundaries:

- IOTA RPC, IOTA Gas Station, faucet, IOTA Names, IOTA Identity, VC proof
  endpoints, public A2A endpoints, npm, payment providers, marketplace
  systems, KMS providers, and physical devices are not contacted by default
  local verification.
- Readiness reports may classify blockers without proving the external system.

## Frequent Edit Hotspots

- Script-driven proof gates: `scripts/check-*.ts`, `scripts/write-*.ts`,
  `scripts/*report*.ts`, and matching `scripts/*.test.ts`.
- Live/product status evidence labels: `scripts/check-live-proof-status.ts`,
  `scripts/check-product-status.ts`, `scripts/live-proof-status.test.ts`,
  `scripts/product-status.test.ts`.
- Package-script wiring: `package.json`, `scripts/package-scripts.test.ts`.
- Public product and operator docs: `docs/overview.md`,
  `docs/vallum/*.md`, `docs/marketplace-readiness.md`,
  `docs/testnet-readiness.md`.
- Standards/A2A work: `packages/standards/src/`, `examples/a2a-*`,
  `scripts/smoke-a2a-*`, `scripts/check-a2a-public-readiness.ts`.
- Testnet/Gas Station work: `deploy/docker-compose/`,
  `deploy/gas-station/`, `scripts/check-testnet-readiness.ts`,
  `scripts/diagnose-gas-station-upstream.ts`,
  `scripts/check-sponsor-funding.ts`,
  `scripts/execute-testnet-sponsored-demo.ts`.
- Contract workflow additions: `contracts/*_v1/`,
  `packages/sdk/src/contracts/`, `packages/contracts-metadata/src/`,
  `examples/*/`, `scripts/smoke-*.ts`.
- Docs site navigation/rendering: `apps/docs-site/docs.config.mjs`,
  `apps/docs-site/src/`, `docs/*.md`.

## Risk And Coupling Areas

- SDK, policy gateway, MCP tools, and marketplace surfaces must not bypass
  policy-gated sponsorship.
- Account APIs must return addresses and signer references, never raw key
  material.
- Gas Station readiness must keep Docker/runtime, sponsor funding, upstream
  reachability, reserve compatibility, and sponsored execute as separate
  claims.
- Local/mock IOTA Names, Identity, VC, A2A, payment, marketplace, and custody
  proof must not be described as live or production proof.
- Package publication work must not mix namespace changes with wallet/gateway
  security changes.
- Public A2A work must keep key management, endpoint ownership, push delivery,
  external conformance, and public hosting separate.
- Physical device access remains safety-deferred; only virtual or simulated
  work is allowed until a separate safety design is approved.
- `.env`, Gas Station rendered config, local proof reports, Apex manifests,
  local handoffs, and generated runtime artifacts must stay ignored.

## Verification Path By Change Type

- Docs-only change: `npm run docs:check`, `npm run secrets:scan`,
  `git diff --check`.
- Package or script wiring: focused `node --import tsx --test
  scripts/package-scripts.test.ts`, then `npm run typecheck`,
  `npm run secrets:scan`, `git diff --check`.
- SDK/gateway/package code: focused package tests, `npm test`,
  `npm run typecheck`, `npm run secrets:scan`, `git diff --check`.
- Contract workflow: focused SDK/receipt/metadata tests, `npm run
  contracts:test`, relevant `npm run smoke:*`, then `npm run verify:local`.
- Testnet/Gas Station readiness: focused script tests, `npm run
  readiness:testnet` for local config, explicit operator approval before live
  commands, sanitized ignored reports for live diagnostics.
- A2A/public discovery: focused standards and script tests, local loopback
  smokes, `npm run proof:a2a-public-readiness`; public probes require
  operator-approved public config.
- Payment/marketplace/custody/stable package operations: local readiness proof
  and redacted structured report gates; production live-operator claims, future
  package releases, or registry migration claims require operator-approved
  reports outside committed files.
- Final/release-style evidence: `npm run verify:fast` for bounded iteration,
  `npm run verify:local` for full local proof, plus explicit live/operator
  reports for any live claim.

## Generated Or Ignored Paths

Ignored or local-only state includes:

- `.env*`
- `node_modules/`
- `dist/`
- `tmp/`
- `tmp/apex-workflow/`
- `tmp/vallum/`
- `deploy/gas-station/config.local.yaml`
- local Gas Station rendered configs and logs
- local proof reports and report templates
- local Codex goal and handoff docs under ignored planning paths

Do not commit generated docs output, runtime proof artifacts, raw upstream
responses, faucet task ids, private config paths, or secret-adjacent logs.

## Keeping This Map Current

Update this file when:

- a new package, app, Move contract, or example becomes part of the reviewed
  source map;
- a verification command is added, removed, or promoted;
- a readiness gate changes its proof boundary;
- a previously local/mock proof becomes live/testnet/prod proof;
- a new ignored artifact path, local report, or workflow manifest path is
  introduced;
- Apex doctor reports this map as stale, draft, or legacy.

After updates, run:

```bash
node /home/sacred/code/apex-workflow/scripts/apex-map-codebase.mjs --target=. --check --require-reviewed
node /home/sacred/code/apex-workflow/scripts/apex-doctor.mjs --target=. --config=apex.workflow.json
```

## Map Evidence

Current reviewed map evidence:

- `apex.workflow.json` names `docs/CODEBASE_MAP.md` in workflow rules and
  read-before-broad-search orientation.
- `node /home/sacred/code/apex-workflow/scripts/apex-map-codebase.mjs
  --target=. --check --require-reviewed` validates required Apex map
  sections and reviewed status.
- `node /home/sacred/code/apex-workflow/scripts/apex-doctor.mjs --target=.
  --config=apex.workflow.json` checks the map as part of repository workflow
  readiness.
- `scripts/package-scripts.test.ts` guards the reviewed map status and section
  set.
