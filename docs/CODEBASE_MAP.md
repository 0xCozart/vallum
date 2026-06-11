# Codebase Map

Last updated: 2026-06-11.

## Current State

This repository is a local Agentic GasKit fork created from
`https://github.com/0xCozart/iota-gaskit`.

The current implemented codebase includes the original IOTA GasKit toolkit:

- policy gateway
- TypeScript SDK
- shared policy/request/response types
- runnable local policy gateway service
- demo dApp smoke paths
- examples
- deployment templates
- docs site
- security, readiness, observability, and hardening docs

It also includes the first Agentic GasKit implementation slices:

- account/wallet signer-reference contract package
- agent transaction manifest package
- pure agent action policy evaluator and mock sponsorship gateway
- SDK sponsored action and `openEscrow` helpers
- MCP sponsorship tool facade
- receipt state package
- local Move escrow and receipt state contracts
- deterministic local agent-to-agent escrow demo
- local Move pay-per-call state contract and paid MCP-style tool demo
- local Move data-license state contract and data-license demo
- local Move service-bounty state contract and service-bounty demo
- local Move reputation-receipt state contract and reputation-receipt demo
- local Move subscription state contract and subscription demo
- agent profile schema package with local fixture resolver
- mock-tested IOTA Names/Identity adapter interfaces
- bounded local IOTA Identity verification cache helpers with fail-closed stale
  refresh behavior
- local fail-closed IOTA Identity VC trust-policy evaluator for trusted
  issuers, verification methods, credential types, revocation status, expiry,
  max credential age, and cache-policy binding
- opt-in IOTA Identity live proof harness through an operator-provided proof
  endpoint and configured Agent Profile path
- local A2A Agent Card mapping from Agent Profiles
- local A2A Agent Card well-known serving helper and smoke proof
- local public JWKS response helper for Agent Card signing keys and loopback
  Node server JWKS route support
- local static A2A discovery bundle helper for signed Agent Card and public
  JWKS JSON artifacts at canonical well-known paths
- local static A2A discovery artifact writer for turning already-signed public
  Agent Card and public JWKS JSON into canonical `.well-known` files plus a
  sanitized header manifest for static hosting review
- local static A2A discovery artifact validator for checking generated
  `.well-known` files and manifest metadata before public hosting review,
  without fetching public URLs
- local static A2A discovery loopback host smoke for serving validated
  `.well-known` files with manifest-declared headers before public hosting
  review, without proving public hosting
- local A2A Agent Card JWS signing and trusted-key verification smoke proof
- local A2A task/message operation helpers and smoke proof
- local A2A HTTP-shaped handler and smoke proof for public discovery plus
  bearer-authenticated task routes
- local authenticated A2A extended Agent Card access through the HTTP-shaped
  handler
- local A2A loopback HTTP server smoke proof for signed discovery,
  authenticated task routes, and SSE task events
- local A2A push notification configuration CRUD with credential-storage and
  unsafe callback URL rejection
- local injected A2A push notification delivery envelopes without default
  outbound webhook calls
- local opt-in A2A push notification HTTP transport with safe URL checks,
  manual redirect handling, timeout handling, no stored webhook credentials,
  and status-only delivery results
- local A2A push callback URL admission hardening that rejects credentials,
  query strings, fragments, loopback hosts, and private network hosts before
  config storage or delivery
- local A2A push callback host allowlisting for exact callback-host admission
  before config storage or injected HTTP transport delivery
- local A2A push notification retry and in-memory attempt observability for
  explicitly injected transports, without request bodies or credential material
- local file-backed A2A push notification attempt evidence as sanitized JSONL
  status records, without request bodies, response bodies, webhook credentials,
  or raw transport errors
- local file-backed A2A push notification delivery queueing with sanitized
  delivery envelopes, public headers, and redacted task payloads
- local A2A push notification delivery worker that claims one sanitized queued
  job, uses an explicitly injected transport, records status-only attempt
  evidence, and completes or fails the local queue entry
- non-networked A2A public-readiness proof for local A2A evidence, public
  hosting inputs, production JWKS/auth decisions, local public JWKS serving,
  local static discovery bundle generation, local authenticated extended cards,
  local loopback streaming, local push configuration, local injected push
  delivery, local opt-in push HTTP transport, local callback URL admission
  hardening, local callback host allowlisting, local retry/attempt
  observability, local durable attempt evidence, local delivery queueing, a
  local injected-transport worker,
  redacted structured public discovery, public push delivery, and external
  conformance report inputs, and external conformance blockers
- opt-in public A2A discovery smoke for operator-approved public HTTPS Agent
  Card and JWKS probing with optional structured report output, excluded from
  default local verification
- opt-in IOTA Names GraphQL live resolution smoke with an exact missing-config
  blocker path
- non-networked live proof status command for testnet, IOTA Names, IOTA
  Identity, and VC blocker reporting
- opt-in sanitized testnet upstream diagnostic report gate that separates
  `.env` readiness from current IOTA RPC, Gas Station reachability, and
  reserve_gas compatibility proof
- local Gas Station config renderer and compose template for turning ignored
  `.env` values into an ignored official-style `config.local.yaml` before
  starting the `iotaledger/gas-station` container
- local Gas Station runtime preflight gate for checking ignored rendered config,
  Docker client, Docker daemon, and Docker Compose availability before upstream
  diagnostics
- non-networked testnet digest proof for documented public IOTA testnet
  evidence, plus an opt-in read-only live lookup command
- non-networked product status proof command for local proof, live/testnet,
  package publication, A2A hosting, payment, marketplace, custody, and device
  safety claim boundaries
- non-networked launch-readiness evidence matrix that maps roadmap areas to
  source evidence, local commands, blocker codes, and next gates
- non-networked operator live-gate runbook that classifies config blockers,
  approval-required live commands, production blockers, and safety deferrals
  before execution
- fast verification profile plus non-networked verification-profile audit that
  keeps day-to-day iteration bounded while preserving `verify:local` as the
  full reviewer/release/launch evidence gate
- local read-only marketplace evidence package with provider labels, policy
  compatibility, receipt access control, and dispute evidence bundle smoke
- package namespace and release metadata strategy for the current
  `@iota-gaskit/*` prerelease line
- opt-in package publish dry-run gate for public workspace packages
- local package install smoke for packed public workspace tarballs
- device access safety gate that blocks physical-device implementation and
  limits any future proof to virtual or simulated resources until a separate
  approved safety design exists
- pure profile capability policy check
- contract template metadata registry consumed by agent policy allow-lists

The remaining Agentic GasKit direction is documented under
`docs/agentic-gaskit/`. A configured IOTA Names live smoke path exists, but
actual live proof still requires an operator-provided endpoint/name/address and
a passing run. IOTA Identity live proof now has an opt-in proof-endpoint smoke
path, but actual proof still requires operator-provided endpoint/profile and
trust-policy configuration plus a passing run. Public signed A2A discovery,
external A2A conformance proof, device-access contract workflows, production
custody, production subscription operations, and live deployment proof remain
roadmap unless later slices implement and verify them.

## Start Here

- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `skills/iota-gaskit/SKILL.md`
- `docs/overview.md`
- `docs/architecture.md`
- `docs/agentic-gaskit/migration-plan.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/verification-hardening.md`

## Implemented Source Map

- SDK: `packages/sdk/src/`
- Policy engine: `packages/policy-gateway/src/`
- Shared types: `packages/shared-types/src/`
- Agent accounts: `packages/accounts/src/`
- Agent manifests: `packages/manifest/src/`
- Agent registry/profile schema, local resolver, and adapters:
  `packages/registry/src/`
- Contract template metadata: `packages/contracts-metadata/src/`
- Marketplace read model: `packages/marketplace/src/`,
  `scripts/smoke-marketplace-read-model.ts`
- Package release strategy: `docs/agentic-gaskit/package-release-strategy.md`,
  `scripts/package-publish-dry-run.ts`,
  `scripts/smoke-package-install.ts`,
  `scripts/package-install-smoke.test.ts`,
  `scripts/package-publish-dry-run.test.ts`,
  `scripts/package-publish.test.ts`, `scripts/package-scripts.test.ts`
- Device access safety gate:
  `docs/agentic-gaskit/device-access-safety-gate.md`,
  `scripts/roadmap-safety.test.ts`
- Live proof status: `docs/agentic-gaskit/live-proof-status.md`,
  `scripts/check-live-proof-status.ts`, `scripts/live-proof-status.test.ts`
- Testnet upstream diagnostics: `scripts/diagnose-gas-station-upstream.ts`,
  `scripts/testnet-upstream-report.ts`, `docs/testnet-attempts.md`
- Local Gas Station setup: `scripts/render-gas-station-config.ts`,
  `scripts/check-gas-station-runtime-preflight.ts`,
  `deploy/docker-compose/docker-compose.local.yml`,
  `deploy/gas-station/config.example.yaml`, `docs/deployment.md`
- Testnet digest proof: `docs/agentic-gaskit/testnet-digest-proof.md`,
  `scripts/check-testnet-digest-proof.ts`,
  `scripts/testnet-digest-proof.test.ts`
- A2A public readiness: `docs/agentic-gaskit/a2a-public-readiness.md`,
  `scripts/check-a2a-public-readiness.ts`,
  `scripts/a2a-public-readiness.test.ts`
- A2A static discovery artifact writer:
  `scripts/write-a2a-static-discovery-bundle.ts`,
  `scripts/write-a2a-static-discovery-bundle.test.ts`
- A2A static discovery artifact validator:
  `scripts/check-a2a-static-discovery-bundle.ts`,
  `scripts/check-a2a-static-discovery-bundle.test.ts`
- A2A static discovery local host smoke:
  `scripts/smoke-a2a-static-discovery-local.ts`,
  `scripts/smoke-a2a-static-discovery-local.test.ts`
- Product status proof: `docs/agentic-gaskit/product-status.md`,
  `scripts/check-product-status.ts`, `scripts/product-status.test.ts`
- Launch readiness evidence:
  `docs/agentic-gaskit/launch-readiness-evidence.md`,
  `scripts/check-launch-readiness.ts`, `scripts/launch-readiness.test.ts`
- Operator live gates:
  `docs/agentic-gaskit/operator-live-gates.md`,
  `scripts/check-operator-live-gates.ts`,
  `scripts/operator-live-gates.test.ts`
- Verification profiles:
  `docs/agentic-gaskit/verification-profiles.md`,
  `scripts/check-verification-profiles.ts`,
  `scripts/verification-profiles.test.ts`
- IOTA Identity live smoke:
  `scripts/smoke-iota-identity-live.ts`,
  `scripts/iota-identity-live-smoke.test.ts`
- MCP sponsorship tools: `packages/mcp-server/src/`
- Receipts: `packages/receipts/src/`
- Move escrow contract: `contracts/escrow_v1/`
- Move receipt contract: `contracts/receipt_v1/`
- Move pay-per-call contract: `contracts/pay_per_call_v1/`
- Move data-license contract: `contracts/data_license_v1/`
- Move service-bounty contract: `contracts/service_bounty_v1/`
- Move reputation-receipt contract: `contracts/reputation_receipt_v1/`
- Move subscription contract: `contracts/subscription_v1/`
- Policy gateway service: `apps/policy-gateway-service/src/`
- Demo dApp: `apps/demo-dapp/`
- Agent escrow demo: `examples/agent-escrow/`, `docs/demo-agent-escrow.md`,
  `scripts/smoke-agent-escrow.ts`
- Paid MCP-style tool demo: `examples/paid-mcp-tool/`,
  `scripts/smoke-paid-mcp-tool.ts`
- Data-license demo: `examples/data-license/`,
  `scripts/smoke-data-license.ts`
- Service-bounty demo: `examples/service-bounty/`,
  `scripts/smoke-service-bounty.ts`
- Reputation-receipt demo: `examples/reputation-receipt/`,
  `scripts/smoke-reputation-receipt.ts`
- Subscription demo: `examples/subscription/`,
  `scripts/smoke-subscription.ts`
- A2A well-known demo: `examples/a2a-well-known/`,
  `scripts/smoke-a2a-well-known.ts`
- A2A signed-card demo: `examples/a2a-signed-card/`,
  `scripts/smoke-a2a-signed-card.ts`
- A2A task/message demo: `examples/a2a-task-message/`,
  `scripts/smoke-a2a-task-message.ts`
- A2A HTTP boundary demo: `examples/a2a-http/`,
  `scripts/smoke-a2a-http.ts`
- A2A local server demo: `examples/a2a-local-server/`,
  `packages/standards/src/a2aNodeServer.ts`,
  `scripts/smoke-a2a-local-server.ts`
- A2A Node loopback server helper:
  `packages/standards/src/a2aNodeServer.ts`
- Docs site: `apps/docs-site/`
- Examples: `examples/node-backend/`, `examples/nextjs-api-route/`,
  `examples/policies/`
- Deployment templates: `deploy/`
- Readiness and smoke scripts: `scripts/`
- Security docs: `docs/security/`

## Agentic Planning Map

- Migration plan: `docs/agentic-gaskit/migration-plan.md`
- Roadmap: `docs/agentic-gaskit/roadmap.md`
- PRDs: `docs/agentic-gaskit/prds/`
- Execution slices: `docs/agentic-gaskit/execution-slices.md`
- Module specs: `docs/agentic-gaskit/module-specs.md`
- Wallet safety: `docs/agentic-gaskit/account-wallet-safety.md`
- Verification hardening: `docs/agentic-gaskit/verification-hardening.md`
- Source thesis: `docs/agentic-gaskit/source-thesis.md`

## Future Targets

Do not create all of these at once. Add them through vertical slices:

- gateway extensions for agent manifests and capabilities
- registry live adapters
- public signed Agent Card hosting, external A2A conformance proof, and live
  standards-compatible discovery
- expanded contract packages beyond pay-per-call, data-license, service-bounty,
  reputation receipt, and subscription. Device access workflows must stay
  virtual/simulated unless the safety gate is replaced by an approved physical
  device design.

## Verification Guidance

Safe local checks:

- `npm run docs:check`
- `npm run docs:build`
- `npm test`
- `npm run contracts:test`
- `npm run typecheck`
- `npm run smoke:local`
- `npm run smoke:agent-escrow`
- `npm run smoke:data-license`
- `npm run smoke:service-bounty`
- `npm run smoke:reputation-receipt`
- `npm run smoke:subscription`
- `npm run smoke:a2a-well-known`
- `npm run smoke:a2a-signed-card`
- `npm run smoke:a2a-task-message`
- `npm run smoke:a2a-http`
- `npm run smoke:a2a-local-server`
- `npm run smoke:marketplace-read-model`
- `npm run smoke:package-install`
- `npm run proof:live-status`
- `npm run gas-station:runtime-preflight`
- `npm run proof:testnet-digest`
- `npm run proof:a2a-public-readiness`
- `npm run proof:product-status`
- `npm run proof:launch-readiness`
- `npm run proof:operator-gates`
- `npm run verify:fast`
- `npm run proof:verification-profiles`
- `npm run secrets:scan`

Full local proof:

- `npm run verify:local`

Opt-in configured/live checks:

- `npm run proof:testnet-digest:live` performs a read-only IOTA testnet lookup
  for the documented public transaction digest; it does not spend gas or use
  sponsor credentials
- `npm run smoke:iota-names-live` only when an operator provides
  `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS`; this is not part of `npm run verify:local`
- `npm run proof:live-status` is non-networked and reports live/testnet proof
  blockers or ready-to-run configuration without printing configured values

`npm run contracts:test` requires the IOTA CLI. Set `IOTA_BIN` to a local
binary path, install `iota` on `PATH`, or use the ignored local release binary
under `tmp/tooling/iota-v1.24.0/iota`.

Live commands such as `npm run execute:testnet-demo` contact live IOTA services
and spend sponsored testnet gas. Run them only with explicit operator intent and
operator-owned credentials configured outside the repo.
