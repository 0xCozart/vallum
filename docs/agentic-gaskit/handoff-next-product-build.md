# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Continue actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

Slice 1.0 is implemented and locally verified. The immediate target is Slice
1.1: manifest schema. Use `docs/agentic-gaskit/execution-entry.md` as the entry
doc, then continue through `docs/agentic-gaskit/execution-slices.md`.

## Current State

- Canonical repo: `https://github.com/0xCozart/agentic-gaskit`
- Local path: `/home/sacred/code/agentic-gaskit`
- Branch: `main`
- GitHub visibility currently reports private.
- `origin` points to Agentic GasKit.
- `upstream` fetches from `https://github.com/0xCozart/iota-gaskit.git`.
- `upstream` push is disabled.

Recent commits to know:

- `b49daba` docs: rename agentic fork branch to main
- `fe5a6ee` docs: record agentic gaskit github remote
- `b2d9928` chore: migrate reviewed gaskit local changes
- `3b34cef` docs: create agentic gaskit migration fork

## What Is Complete

- Repo migration foundation is complete.
- Planning docs were migrated into `docs/agentic-gaskit/`.
- The old `/home/sacred/code/agents` repo now points to this fork.
- Safe package dependency pins from the dirty source GasKit worktree were
  migrated.
- Unsafe tmp/live experiment scripts were not migrated as runnable product
  code; see `docs/agentic-gaskit/local-dirty-work-review.md`.
- Last full verification after package migration passed with `npm run
  verify:local`.
- Active Codex goal document exists at
  `docs/agentic-gaskit/codex-active-goal.md`.
- Slice 1.0 account/wallet manager contract is implemented in
  `packages/accounts` as `@iota-gaskit/accounts`.
- Slice 1.0 tests prove in-memory wallet creation returns address plus scoped
  signer reference, not secret material.
- Slice 1.0 tests prove signer-reference possession alone does not authorize
  signing, owner/agent context is required, scope mismatches deny, disabled and
  revoked wallet states deny, local creation limits apply, recovery export is
  denied with audit metadata, profile metadata can bind to the wallet, and
  signer refs plus secret-looking fixture values are redacted.
- Root build, test, typecheck, package dry-run, docs, smokes, readiness example,
  and secret scan include the accounts package.

## What Is Not Complete

- Manifest package is not implemented.
- Agent-aware policy extensions are not implemented.
- MCP/A2A tools are not implemented.
- Registry, receipts, and contract workflows are not implemented.
- Package namespace strategy is still open.
- Production custody, KMS, and recovery/export are not designed or implemented.

## Suggested Skills

- `$objective-alignment-flow` for any fuzzy scope or product-direction change.
- `$iota-gaskit` for repo navigation, GasKit safety boundaries, and verification
  ladder.
- `$harden` before accepting any wallet, signer, gateway, MCP, payment, or
  recovery/export design.
- `$tdd` or equivalent red-green loop for `packages/accounts` and later
  manifest/policy packages.
- `$handoff` at the end of each meaningful implementation slice.

## Read First

Read in this order:

1. `CLAUDE.md`
2. `docs/CODEBASE_MAP.md`
3. `docs/agentic-gaskit/execution-entry.md`
4. `docs/agentic-gaskit/account-wallet-safety.md`
5. `docs/agentic-gaskit/module-specs.md`
6. `docs/agentic-gaskit/execution-slices.md`
7. `docs/agentic-gaskit/verification-hardening.md`
8. `docs/agentic-gaskit/local-dirty-work-review.md`

## Completed Slice 1.0

Implemented `packages/accounts` with tests.

Used the conservative package name `@iota-gaskit/accounts` until a dedicated
namespace migration slice is approved.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-entry.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.0
- `docs/agentic-gaskit/module-specs.md` `packages/accounts`

Changed files:

- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/accounts/README.md`
- `packages/accounts/package.json`
- `packages/accounts/src/accounts.test.ts`
- `packages/accounts/src/index.ts`
- `packages/accounts/tsconfig.build.json`
- generated `packages/accounts/dist/`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/accounts/src/accounts.test.ts
npm install --package-lock-only
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused account tests passed: 6 tests.
- `npm test` passed with 139 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed, including local gateway smoke, demo dApp
  smoke, browser wrapper smoke, readiness example, package dry-run, docs check,
  and secret scan.
- `git diff --check` passed.

Hardening notes:

- Recovery/export denial now keeps audit reason metadata without returning
  secret material.
- No live testnet commands were run.
- No SDK/MCP value-bearing route was added in this slice; policy-gateway routing
  remains for later slices.
- Apex manifest helper was attempted but the current `apex.workflow.json` lacks
  required mode definitions and `manifest.defaultDir`, so Slice 1.0 scope was
  recorded locally under ignored `tmp/apex-workflow/` and this slice does not
  claim Apex verification.

Known unproven claims:

- No production custody, KMS, encrypted local keystore, seed export, or live
  signing behavior is implemented.
- SDK/MCP integration for signer references is not implemented yet.
- Policy integration proving signer refs cannot bypass the gateway remains a
  Phase 1 follow-up after manifest/policy wiring exists.

Next recommended slice:

- Slice 1.1 Manifest Schema in `packages/manifest`.

## Guardrails

- Do not expose seeds, mnemonics, private keys, raw keypairs, raw transaction
  bytes, user signatures, sponsor keys, app API keys, bearer tokens, payment
  credentials, or private prompt text.
- Do not treat a signer reference as bearer authorization.
- Do not let SDK/MCP value-bearing flows bypass the policy gateway.
- Do not run live testnet commands unless the user explicitly asks.
- Do not commit tmp live scripts as product code.
- Do not clean or revert `/home/sacred/code/iota-gaskit` dirty files unless the
  user explicitly asks.

## Verification To Start Next Slice

Before editing:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
```

For the account package slice, add focused tests first and finish with:

```bash
npm run verify:local
```

## Known Adjacent Dirty State

`/home/sacred/code/iota-gaskit` still has local dirty files from before the
fork:

- `apps/policy-gateway-service/package.json`
- `package.json`
- `package-lock.json`
- `tmp/`

Those were inspected. The package pins were migrated. The tmp live scripts were
documented but not copied as product code.
