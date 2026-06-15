---
name: agentrail
description: Use when working in the agentrail repo or integrating AgentRail in another app, and when extending the AgentRail fork, including repo navigation, SDK/gateway/demo/docs changes, local verification, agent migration docs, wallet safety, testnet readiness, sponsor-gas safety, or IOTA sponsored transaction flows.
---

# AgentRail

## Purpose

Use this skill to work on AgentRail without losing the repo's safety boundaries.
AgentRail is built on the original IOTA GasKit sponsorship foundation around
the official IOTA Gas Station: app backends call the SDK or policy gateway,
AgentRail applies app auth and sponsorship policy, and only allowed requests
reach IOTA Gas Station.

AgentRail extends that foundation with agent accounts, signer references,
transaction manifests, receipts, contract workflows, MCP/A2A surfaces, and
standards-compatible payment bridges.

## Required Startup

1. Read `AGENTS.md`.
2. Read `docs/agentrail/migration-plan.md` if it exists.
3. If present, read `apex.workflow.json`; use `$apex-workflow` for meaningful
   execution only when that profile exists.
4. If present, read `CLAUDE.md` and `docs/CODEBASE_MAP.md`. If absent, use `docs/architecture.md` and `README.md` before broad search.
5. Check `git status --short --branch` and preserve unrelated dirty work.

When `apex.workflow.json` exists, use the lightest safe Apex mode:

- `tiny`: one obvious docs/test/config edit.
- `route-local`: one owner with direct callers, such as SDK docs plus docs-site config.
- `shared-surface`: policy gateway, SDK contracts, app auth, usage events, examples, or generated docs shell.
- `planning`: product, docs strategy, grants, architecture, or agent workflow decisions.

Create or update a local manifest under `tmp/apex-workflow/` for meaningful
code-facing slices only when Apex is configured. Do not commit runtime Apex
artifacts unless the repo explicitly moves them into reviewed evidence docs.

## Source Map

- Product truth: `docs/product-requirements.md`, `docs/overview.md`.
- Agentic migration: `docs/agentrail/migration-plan.md`,
  `docs/agentrail/roadmap.md`, `docs/agentrail/execution-slices.md`,
  `docs/agentrail/account-wallet-safety.md`.
- Architecture and concepts: `docs/architecture.md`, `docs/concepts.md`.
- Code examples: `docs/examples.md`, `examples/node-backend/`, `examples/nextjs-api-route/`, `apps/demo-dapp/`.
- SDK: `packages/sdk/src/client.ts`, `packages/sdk/src/types.ts`, `docs/sdk.md`.
- Policy engine: `packages/policy-gateway/src/`, `docs/policy.md`, `examples/policies/demo-dapp.yaml`.
- Policy gateway service: `apps/policy-gateway-service/src/server.ts`.
- Usage and observability: `apps/policy-gateway-service/src/events.ts`, `apps/policy-gateway-service/src/usage.ts`, `apps/policy-gateway-service/src/usage-store.ts`, `docs/observability.md`.
- Local readiness and live attempt boundary: `docs/testnet-readiness.md`, `docs/testnet-attempts.md`, `scripts/check-testnet-readiness.ts`, `scripts/execute-testnet-sponsored-demo.ts`.
- Secrets: `docs/security/secrets.md`, `docs/security/sponsor-wallet.md`, `scripts/scan-secrets.ts`.
- Hosted docs site: `apps/docs-site/`, `docs/best-practices.md`, `scripts/reviewer-docs.test.ts`.

## Safety Boundaries

- Keep browser flows thin. Browser code calls same-origin backend routes; backend routes own AgentRail app credentials.
- Never expose or log sponsor private keys, wallet mnemonics, Gas Station bearer tokens, app API keys, raw transaction bytes, user signatures, raw upstream error bodies, or local secret paths.
- Agent wallet APIs must return signer references and addresses, not seeds,
  mnemonics, private keys, or raw keypairs.
- Signer references are opaque scoped handles, not bearer credentials.
- Keep `GAS_STATION_AUTH` and `GAS_STATION_BEARER_TOKEN` distinct.
- Treat the sponsor wallet as a funded operational asset.
- Local smoke and readiness checks do not prove live reserve/execute.
- Run live commands such as `npm run execute:testnet-demo` only when the user explicitly asks and operator-owned local credentials are configured.
- Do not paste real `.env` values into docs, tests, screenshots, issues, PR text, or final answers.

## Task Routing

- Agentic migration, branding, or roadmap: start with
  `docs/agentrail/migration-plan.md`,
  `docs/agentrail/roadmap.md`, and
  `docs/agentrail/execution-slices.md`.
- Account/wallet behavior: start with
  `docs/agentrail/account-wallet-safety.md`.
- Docs or public positioning: start with `docs/overview.md`, `docs/concepts.md`, `docs/examples.md`, `docs/architecture.md`, and `apps/docs-site/docs.config.mjs`.
- SDK integration: start with `packages/sdk/src/client.ts`, `packages/sdk/src/types.ts`, `docs/examples.md`, and the example app route docs.
- Policy behavior: start with `packages/policy-gateway/src/`, `examples/policies/demo-dapp.yaml`, and tests under `packages/policy-gateway/src/*.test.ts`.
- HTTP gateway behavior: start with `apps/policy-gateway-service/src/server.ts` and matching tests.
- Usage events or operator visibility: start with `docs/observability.md`, `events.ts`, `usage.ts`, and `usage-store.ts`.
- Testnet readiness or secrets: start with `docs/testnet-readiness.md`, `docs/security/secrets.md`, and `scripts/check-testnet-readiness.ts`.
- Hosted docs UI: start with `apps/docs-site/scripts/build.mjs`, `apps/docs-site/src/styles.css`, and `npm run docs:check`.

## Verification Ladder

Prefer focused checks first, then broaden when the touched surface justifies it:

- Docs site source or rendering: `npm run docs:check`, then `npm run docs:build`.
- Docs contract tests: `npm test -- scripts/reviewer-docs.test.ts` (root script currently runs the full suite).
- SDK/gateway behavior: matching `node --import tsx --test ...` file, then `npm test`.
- TypeScript surface: `npm run typecheck`.
- Local deterministic proof: `npm run verify:local`.
- Secret hygiene: `npm run secrets:scan`.
- Testnet config only: `npm run readiness:testnet:example` for placeholders, `npm run readiness:testnet` for local real env.

If a command contacts live IOTA services or spends sponsor gas, say so before running it and require explicit user intent.

## Final Reporting

Report what changed, the files touched, the verification commands run, and what remains unproven. Keep local-only proof separate from live testnet or production claims.
