# IOTA GasKit

**Open-source infrastructure toolkit for gas-sponsored IOTA transactions.**

[![Toolkit](https://img.shields.io/badge/IOTA-GasKit-5eead4?style=for-the-badge)](#iota-gaskit)
[![External showcase](https://img.shields.io/badge/showcase-ProofDrop-6366f1?style=for-the-badge)](https://proofdrop.xyz)
[![License](https://img.shields.io/badge/license-Apache--2.0-f8fafc?style=for-the-badge)](LICENSE)

IOTA GasKit helps IOTA builders deploy, secure, monitor, and integrate sponsored-transaction infrastructure around the official IOTA Gas Station component.

It is designed for teams building IOTA dApps, enterprise workflows, identity products, notarization systems, RWA/product-passport apps, supply-chain tools, games, wallets, and hackathon demos where users should not need to acquire IOTA tokens before experiencing product value.

> **Open-source scope:** this repository is the self-hostable toolkit. A future managed service may offer hosting, support, SLAs, and enterprise onboarding, but the core project remains independently deployable, inspectable, forkable, licensed open source, and useful without hosted GasKit.

## One-line pitch

IOTA GasKit is the missing production-readiness layer around IOTA Gas Station: deployment templates, policy controls, quotas, app keys, SDK wrappers, dashboard visibility, observability, and hardening docs.

## Why GasKit exists

The official IOTA Gas Station component solves the core sponsored-transaction primitive: an application can sponsor gas fees for its users.

Production teams still need the surrounding operator and developer layer:

- repeatable local and testnet deployment flows;
- app-level credentials and sponsorship budgets;
- package/function allowlists;
- wallet request limits and denylists;
- structured policy rejection reasons;
- request, execution, and spend visibility through sanitized gateway decision events;
- SDK helpers and backend integration examples;
- dashboard views for app keys, usage, health, and errors;
- sponsor-wallet, Redis, reverse-proxy, and KMS hardening guidance;
- reproducible demos and documentation;
- a real IOTA testnet sponsored execute script with documented public transaction digest evidence.

GasKit packages those pieces into a reusable open-source toolkit so every IOTA builder does not have to recreate the same safety and operations layer.

## What is in this repo now

This repository contains the open-source GasKit toolkit: a tested policy gateway, TypeScript SDK, local demo flows, integration examples, deployment templates, security docs, observability foundations, and documented IOTA testnet sponsored-execution evidence.

Some production surfaces remain planned roadmap work, including the full dashboard UI, production persistence, production monitoring, package publication, and final demo assets.

The repo currently includes:

- Apache-2.0 license;
- contribution and security policies;
- issue and pull request templates;
- policy reason-code/shared type scaffold;
- policy gateway decision engine scaffold with tests and a local policy simulation endpoint;
- TypeScript SDK scaffold with tests;
- demo app local integration scaffold and backend example scaffolds;
- sanitized policy gateway decision events, an in-memory local usage read model, a file-backed JSONL event-store foundation, and an authenticated local operator usage API foundation for observability;
- safe Gas Station config template;
- policy YAML example;
- architecture diagram and architecture docs;
- threat model and production hardening docs;
- reviewer checklist and demo script.

## Current proof status

The current scaffold verifies successfully locally:

```bash
npm install
npm run verify:local
```

Latest local verification:

- `npm test`: 132 deterministic package/app/script/example/reviewer-doc/usage-store/operator-usage/readiness/package-publish/live-execute compatibility tests passed locally after the latest documentation and API cleanup.
- `npm run typecheck`: passed locally.
- `npm run smoke:local`: deterministic local gateway smoke passed locally, including policy simulation, sanitized event, local usage read-model, file-backed usage event-store replay, and authenticated local operator usage API checks.
- `npm run smoke:demo-dapp`: deterministic local demo dApp smoke passed locally.
- `npm run smoke:demo-browser`: deterministic local browser-wrapper smoke passed locally.
- `npm run readiness:testnet:example`: deterministic example testnet-readiness preflight passed locally.
- `npm run pack:check`: workspace package dry-runs completed locally.
- `npm run execute:testnet-demo`: real sponsored IOTA testnet execute succeeded through the local policy gateway and Gas Station; public digest `2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H`.
- secret-oriented scan over tracked project files is wired into `npm run secrets:scan` and `npm run verify:local`.

See `docs/testnet-attempts.md` and `docs/reviewer-walkthrough.md` for exact evidence.

## External showcase dApps

### Gasless ProofDrop

[Gasless ProofDrop](https://proofdrop.xyz) is the standalone public M1 showcase dApp for GasKit. It demonstrates a backend-owned sponsorship flow where a visitor claims a "GasKit Launch Proof" badge without holding IOTA tokens. ProofDrop is kept in a [separate repository](https://github.com/0xCozart/ProofDrop) so the GasKit core remains focused on the self-hostable toolkit.

Current role: external M1 showcase app for the GasKit integration pattern. The hosted app runs at [proofdrop.xyz](https://proofdrop.xyz), safe mock verification remains available from a clean clone, and live execution has been proven through a configured GasKit gateway plus self-hosted IOTA Gas Station.

ProofDrop live evidence:

- Source: [github.com/0xCozart/ProofDrop](https://github.com/0xCozart/ProofDrop)
- Target: `0xd35b2cda222b21fcc7b6c46b00a5a172023d3de1f20c94a5ac553e290cf5f032::proofdrop_badge::claim_proof_badge`
- Latest hosted digest: [`GRVtucGZkKZXsXG8HssCPGmRkWbiBom9NGWzJDcVspnF`](https://explorer.iota.org/txblock/GRVtucGZkKZXsXG8HssCPGmRkWbiBom9NGWzJDcVspnF?network=testnet)
- Remaining work: real browser wallet connection and user-owned signing. The current live flow uses a constrained server-side ephemeral demo signer.

## Target architecture

![IOTA GasKit architecture](docs/assets/iota-gaskit-architecture.svg)

```mermaid
flowchart LR
  User[Demo dApp user] --> Demo[Demo dApp]
  Demo --> SDK[GasKit TypeScript SDK]
  SDK --> Gateway[GasKit Policy Gateway]
  Gateway --> Policy[(Policy Config + Usage Store)]
  Gateway --> GasStation[IOTA Gas Station]
  GasStation --> IOTA[IOTA Testnet/Mainnet RPC]
  Gateway --> Dashboard[Operator Dashboard]
  Gateway --> Metrics[Metrics + Logs]
```

## Repository layout

```txt
apps/
  demo-dapp/              # Minimal local dApp CLI/browser wrapper
  policy-gateway-service/ # Runnable local policy gateway smoke service
packages/
  sdk/                    # TypeScript SDK scaffold
  policy-gateway/         # Policy decision engine scaffold
  shared-types/           # Shared policy/request/response types
deploy/
  docker-compose/         # Local deployment templates
  gas-station/            # Safe Gas Station config templates
docs/
  architecture.md
  demo-script.md
  deployment.md
  product-requirements.md
  continuation-brief-2026-04-26.md
  reviewer-walkthrough.md
  observability.md
  policy.md
  production-hardening.md
  quickstart.md
  reviewer-checklist.md
  sdk.md
  threat-model.md
  testnet-readiness.md
examples/
  nextjs-api-route/
  node-backend/
  policies/
```

## Packages

The monorepo root is marked `private` to prevent accidental publication of the workspace root. The workspace packages are not claimed as published yet. Package release remains roadmap work; today the repo provides package READMEs, public prerelease publish metadata (`access=public`, `tag=next`), map-free packed artifacts, and local `npm pack --dry-run` verification for publishable packages.

Dry-run package checks:

```bash
npm run pack:check
npm publish --dry-run --tag next --access public -w @iota-gaskit/shared-types -w @iota-gaskit/policy-gateway -w @iota-gaskit/sdk
```

Do not run a real `npm publish` without explicit operator approval and registry credentials handled outside the repo.


### `@iota-gaskit/shared-types`

Shared TypeScript types for policy decisions, policy reason codes, sponsorship policy, and request context.

### `@iota-gaskit/policy-gateway`

Policy decision scaffold for validating app status, credentials, daily limits, gas budget, wallet denylist, package allowlist, and function allowlist.

Current tests cover:

- `AUTH_MISSING`
- `AUTH_INVALID`
- `APP_DISABLED`
- `APP_DAILY_REQUEST_LIMIT_EXCEEDED`
- `GAS_BUDGET_TOO_HIGH`
- `PACKAGE_NOT_ALLOWED`, including missing package metadata when an allowlist is configured
- `FUNCTION_NOT_ALLOWED`, including missing function metadata when an allowlist is configured
- `WALLET_DENIED`
- valid sponsorship request

### `@iota-gaskit/sdk`

TypeScript client scaffold for dApp backends.

Current SDK supports request construction for:

- `simulatePolicy()`
- `reserveGas()`
- `executeSponsoredTransaction()`

It also includes typed error classes for auth, policy, and malformed-response failures.

## Documentation site

GasKit includes a static docs site generated from the canonical Markdown files in this repo. The generated HTML is a hosting artifact; update the Markdown sources instead of editing `apps/docs-site/dist` directly.

Build the site:

```bash
npm run docs:build
```

Preview locally:

```bash
npm run docs:serve
```

Recommended static-host settings:

- build command: `npm run docs:build`
- output directory: `apps/docs-site/dist`
- Node version: `20`

## Agent access

AI coding agents should start with the repo-local GasKit skill at `skills/iota-gaskit/SKILL.md`. It gives agents the source map, Apex workflow expectations, safe verification ladder, and sponsor-gas boundaries for GasKit work.

The hosted agent guide is `docs/agent-guide.md`.

## Roadmap

- Clean local deployment path with reviewed environment templates and health checks.
- Expanded policy controls for app credentials, wallet limits, package/function allowlists, denylists, quotas, and structured reason codes.
- TypeScript SDK release workflow, Next.js example, Node backend example, and publication-ready package artifacts.
- Usage event store, operator usage views, rejection views, health views, quota views, and basic export/log tooling.
- Hardening guide, observability docs, alerting templates, and final walkthrough assets.

## Quickstart preview

Install dependencies and run the current scaffold checks:

```bash
npm install
npm test
npm run typecheck
npm run smoke:local
```

For live proof, configure the local policy gateway and Gas Station with operator-owned testnet credentials, then run `npm run execute:testnet-demo`. The command is intentionally opt-in and excluded from CI because it contacts live services and consumes sponsored testnet gas.

## Security posture

GasKit is designed to fail closed and prioritize sponsor-wallet safety.

Never commit:

- sponsor private keys;
- IOTA wallet mnemonics or exported keypairs;
- Gas Station bearer tokens;
- app API keys;
- JWT/session secrets;
- Stripe/Resend/Supabase credentials;
- local `.env` files or local databases.

See:

- `SECURITY.md`
- `docs/threat-model.md`
- `docs/production-hardening.md`
- `docs/observability.md`
- `docs/security/sponsor-wallet.md`
- `docs/security/secrets.md`
- `docs/testnet-readiness.md`

## Open-source vs future managed service

The open-source toolkit is designed to remain useful to any IOTA builder who wants to self-host.

A future managed service may later provide:

- hosted GasKit deployments;
- managed sponsor-wallet operations;
- paid support;
- enterprise onboarding;
- SLA-backed monitoring;
- compliance exports.

Those managed-service features are separate from the self-hostable open-source core. See `docs/managed-service-roadmap.md`.

## License

Apache-2.0. See `LICENSE`.

## Contributing

See `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.
