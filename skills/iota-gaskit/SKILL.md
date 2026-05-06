---
name: iota-gaskit
description: Use when working in the iota-gaskit repo or integrating GasKit in another app, including repo navigation, SDK/gateway/demo/docs changes, local verification, testnet readiness, sponsor-gas safety, or IOTA sponsored transaction flows.
---

# IOTA GasKit

## Purpose

Use this skill to work on GasKit without losing the repo's safety boundaries. GasKit is a self-hostable toolkit around the official IOTA Gas Station: app backends call the SDK or policy gateway, GasKit applies app auth and sponsorship policy, and only allowed requests reach IOTA Gas Station.

## Required Startup

1. Read `AGENTS.md`.
2. Read `apex.workflow.json`; this repo uses `$apex-workflow` for meaningful execution.
3. If present, read `CLAUDE.md` and `docs/CODEBASE_MAP.md`. If absent, use `docs/architecture.md` and `README.md` before broad search.
4. Check `git status --short --branch` and preserve unrelated dirty work.

Use the lightest safe Apex mode:

- `tiny`: one obvious docs/test/config edit.
- `route-local`: one owner with direct callers, such as SDK docs plus docs-site config.
- `shared-surface`: policy gateway, SDK contracts, app auth, usage events, examples, or generated docs shell.
- `planning`: product, docs strategy, grants, architecture, or agent workflow decisions.

Create or update a local manifest under `tmp/apex-workflow/` for meaningful code-facing slices. Do not commit runtime Apex artifacts unless the repo explicitly moves them into reviewed evidence docs.

## Source Map

- Product truth: `docs/product-requirements.md`, `docs/overview.md`.
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

- Keep browser flows thin. Browser code calls same-origin backend routes; backend routes own GasKit app credentials.
- Never expose or log sponsor private keys, wallet mnemonics, Gas Station bearer tokens, app API keys, raw transaction bytes, user signatures, raw upstream error bodies, or local secret paths.
- Keep `GAS_STATION_AUTH` and `GAS_STATION_BEARER_TOKEN` distinct.
- Treat the sponsor wallet as a funded operational asset.
- Local smoke and readiness checks do not prove live reserve/execute.
- Run live commands such as `npm run execute:testnet-demo` only when the user explicitly asks and operator-owned local credentials are configured.
- Do not paste real `.env` values into docs, tests, screenshots, issues, PR text, or final answers.

## Task Routing

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
