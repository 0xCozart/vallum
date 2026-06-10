# Agentic GasKit Migration Plan

Last updated: 2026-06-10.

## Intent Read

The goal is to stop splitting the product across two confusing repos. GasKit is
the existing sponsorship toolkit. Agentic GasKit is the future direction of
that toolkit: sponsored gas plus agent accounts, signer references, manifests,
identity, contracts, receipts, MCP/A2A surfaces, and standards-compatible
payments.

Success means future agents can start in this fork and understand that it is
the canonical implementation path for the new direction. Failure means future
agents keep treating `/home/sacred/code/agents` as the product repo, rebuild
GasKit primitives from scratch, or expose wallet material while adding agent
features.

## Canonical Repo Decision

Implementation should move into the GasKit codebase, not remain in
`/home/sacred/code/agents`.

Local fork created for the new direction:

- fork path: `/home/sacred/code/agentic-gaskit`
- branch: `agentic-gaskit-direction`
- canonical GitHub repo: `https://github.com/0xCozart/agentic-gaskit`
- upstream source remote: `https://github.com/0xCozart/iota-gaskit`
- local Git remote state: `upstream` fetches from the source repo and has push
  disabled; `origin` pushes to the canonical Agentic GasKit repo

Existing local source checkouts:

- `/home/sacred/code/iota-gaskit` remains the old/current GasKit checkout.
- `/home/sacred/code/agents` remains a staging/planning source only.

Remote publishing is complete for the initial fork: `origin` points at
`https://github.com/0xCozart/agentic-gaskit`. Do not re-enable push to the
source GasKit remote as a shortcut.

## Product Framing

Use this framing in public docs:

Agentic GasKit is the IOTA-native toolkit for agent-safe sponsored execution:
Gas Station sponsorship, policy controls, agent-created wallets, signer
references, transaction manifests, receipts, contract workflows, and
standards-compatible agent integrations.

Do not frame Agentic GasKit as:

- a replacement for the official IOTA Gas Station
- a generic wallet or custody service
- a default seed-export product
- a marketplace-first product
- a new token or tokenomics project
- a replacement for MCP, A2A, AP2, or x402

## Migration Scope

This migration has three layers.

### Layer 1: Repo And Brand Orientation

Status: started in this fork.

Required work:

- Rename top-level docs from "IOTA GasKit only" to "Agentic GasKit" while
  preserving the existing GasKit sponsorship foundation.
- Update README, overview, docs site title, and agent guide so the new direction
  is obvious in the first viewport/read.
- Add this migration plan to the docs site.
- Keep the Apache-2.0 license and existing open-source self-hostable promise.
- Decide remote publishing target before pushing.

### Layer 2: Planning Docs Migration

Status: migrated into `docs/agentic-gaskit/`.

Migrated from `/home/sacred/code/agents`:

- `docs/agentic-gaskit/source-thesis.md`
- `docs/agentic-gaskit/roadmap.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/module-specs.md`
- `docs/agentic-gaskit/verification-hardening.md`
- `docs/agentic-gaskit/planning-structure-audit.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/codex-execution-prompt.md`
- `docs/agentic-gaskit/end-to-end-goal.md`
- `docs/agentic-gaskit/prds/*.md`

Required normalization:

- Replace old staging paths with this fork's paths.
- Separate "current implemented GasKit" from "Agentic future roadmap."
- Mark unimplemented agent packages as roadmap, not current capability.
- Keep external API notes refreshable before implementation.

### Layer 3: Code Migration And Package Evolution

Status: not started.

Do not create broad empty packages in one rewrite. Add code through vertical
slices.

First code slices:

1. `packages/agent-accounts` or `packages/accounts`
   - signer-reference-first account model
   - in-memory local signer for tests/demos
   - no raw seed/private-key returns
   - signer refs are opaque handles, not bearer auth
2. `packages/agent-manifest` or `packages/manifest`
   - versioned agent transaction manifest
   - expiry, scope, budget, counterparty, idempotency, simulation, receipt
3. policy gateway extension
   - agent identity/capability checks
   - manifest validation before sponsorship
   - deny-by-default negative cases
4. SDK extension
   - agent-native wrappers around existing reserve/execute flows
   - no direct sponsored/value-bearing policy bypass
5. MCP server
   - tools route through SDK/gateway
   - no raw IOTA/Gas Station calls for sponsored execution

Package namespace decision is still open:

- Conservative path: keep existing `@iota-gaskit/*` packages and add
  `@iota-gaskit/agent-*` packages first.
- Full rebrand path: migrate package namespace to `@agentic-gaskit/*` in a
  dedicated compatibility slice with lockfile, examples, docs, and import
  tests.

Do not mix a package namespace rename with security-sensitive wallet/gateway
changes.

## Docs That Must Reflect The New Direction

These docs are first-read surfaces and must stay current:

- `README.md`
- `docs/overview.md`
- `docs/concepts.md`
- `docs/architecture.md`
- `docs/product-requirements.md`
- `docs/agent-guide.md`
- `docs/agentic-gaskit/migration-plan.md`
- `docs/agentic-gaskit/roadmap.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/execution-slices.md`
- `apps/docs-site/docs.config.mjs`
- `skills/iota-gaskit/SKILL.md`
- `AGENTS.md`

Do not edit generated docs output directly. Update Markdown sources and docs
site config.

## Configuration Checklist

- Docs site title and description use Agentic GasKit direction.
- Docs site includes migration, roadmap, wallet safety, execution slices, and
  hardening pages.
- `package.json` top-level name/description reflect the fork direction.
- Package namespace rename is deferred or executed in one isolated slice.
- `AGENTS.md` no longer points to missing setup as if it exists, or the missing
  setup is created deliberately.
- Skill docs describe both legacy GasKit work and Agentic GasKit work.
- Verification commands are listed in README and agent guide.
- Remote URL and branch policy are explicit before publishing.

## Safety Invariants

- Existing Gas Station sponsorship remains behind policy controls.
- Browser/mobile code must never own sponsor credentials.
- Agents can create wallets only through authenticated owner/agent context.
- Agent APIs return wallet address and signer reference, never seed, mnemonic,
  private key, or raw keypair.
- A signer reference is not bearer authorization.
- Recovery/export is explicit, audited, denied by default for autonomous agent
  runtimes, and not part of the MVP.
- Logs redact sponsor keys, app API keys, bearer tokens, raw transaction bytes,
  user signatures, seeds, private keys, payment credentials, and private prompt
  text.

## Verification Plan

For docs/config migration:

- `npm run docs:check`
- `npm run docs:build`
- `npm run secrets:scan`
- `git diff --check`
- focused `rg` scans for stale canonical-path and branding claims

For first code slices:

- `npm test`
- `npm run typecheck`
- focused package tests for new agent packages
- redaction tests for account/signer outputs
- policy negative tests for signer-ref-only requests
- `npm run smoke:local`

Live testnet commands such as `npm run execute:testnet-demo` must not be run
unless the operator explicitly asks and credentials are configured outside the
repo.

## Acceptance Criteria

- A future agent starting from this fork can identify it as the Agentic GasKit
  implementation path.
- The migrated planning docs are present under `docs/agentic-gaskit/`.
- The docs site links to the migration and wallet safety docs.
- Existing GasKit sponsorship capabilities are preserved as foundation, not
  overwritten by unimplemented claims.
- The migration plan names package namespace, remote publishing, Apex/profile,
  and wallet custody decisions as explicit gates.
- Verification has run for docs and secret hygiene.

## Remaining Decisions Before Push

- Public package namespace: `@iota-gaskit/agent-*` first or full
  `@agentic-gaskit/*` migration.
- Whether to expand the minimal `apex.workflow.json` into a full repo profile
  before code execution.
- Whether `/home/sacred/code/agents` should be archived, left as staging, or
  updated with a hard pointer to this fork.
