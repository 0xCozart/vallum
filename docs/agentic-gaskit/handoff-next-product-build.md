# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Start actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

The immediate target is Slice 1.0: account/wallet manager contract. Use
`docs/agentic-gaskit/execution-entry.md` as the entry doc.

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

## What Is Not Complete

- Agent account/wallet package is not implemented.
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

## First Concrete Slice

Implement `packages/accounts` with tests.

Use the conservative package name `@iota-gaskit/accounts` until a dedicated
namespace migration slice is approved.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-entry.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.0
- `docs/agentic-gaskit/module-specs.md` `packages/accounts`

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

## Verification To Start

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
