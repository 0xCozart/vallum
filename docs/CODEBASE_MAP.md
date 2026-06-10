# Codebase Map

Last updated: 2026-06-10.

## Current State

This repository is a local Agentic GasKit fork created from
`https://github.com/0xCozart/iota-gaskit`.

The current implemented codebase is still the IOTA GasKit toolkit:

- policy gateway
- TypeScript SDK
- shared policy/request/response types
- runnable local policy gateway service
- demo dApp smoke paths
- examples
- deployment templates
- docs site
- security, readiness, observability, and hardening docs

The Agentic GasKit direction is documented under `docs/agentic-gaskit/`. Agent
wallet/account packages, manifest packages, MCP/A2A tools, registry surfaces,
and receipt/contract workflow packages are roadmap unless later slices
implement and verify them.

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
- Policy gateway service: `apps/policy-gateway-service/src/`
- Demo dApp: `apps/demo-dapp/`
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

## Future Package Targets

Do not create all of these at once. Add them through vertical slices:

- `packages/accounts` or `packages/agent-accounts`
- `packages/manifest` or `packages/agent-manifest`
- gateway extensions for agent manifests and capabilities
- SDK extensions for agent sponsored actions
- `packages/mcp-server`
- `packages/registry`
- `packages/receipts`
- `packages/standards`
- contract packages for escrow, receipt, pay-per-call, data license, and device
  access workflows

## Verification Guidance

Safe local checks:

- `npm run docs:check`
- `npm run docs:build`
- `npm test`
- `npm run typecheck`
- `npm run smoke:local`
- `npm run secrets:scan`

Full local proof:

- `npm run verify:local`

Live commands such as `npm run execute:testnet-demo` contact live IOTA services
and spend sponsored testnet gas. Run them only with explicit operator intent and
operator-owned credentials configured outside the repo.
