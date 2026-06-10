# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Continue actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

Slices 1.0, 1.1, 1.2, and 1.3 are implemented and locally verified. The
immediate target is Slice 1.4: SDK sponsored action. Use
`docs/agentic-gaskit/execution-entry.md` as the entry doc, then continue
through `docs/agentic-gaskit/execution-slices.md`.

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
- Slice 1.1 manifest schema is implemented in `packages/manifest` as
  `@iota-gaskit/manifest`.
- Slice 1.1 tests prove a valid manifest fixture passes, missing required
  fields fail with typed errors, expired manifests fail closed, unsupported
  versions fail closed, malformed and oversized manifests fail, simulation and
  receipt requirements are explicit, and top-level or nested secret-bearing
  fields are rejected.
- Slice 1.2 pure policy evaluator is implemented in `packages/policy-gateway`
  and exported without replacing the existing app-level GasKit sponsorship
  evaluator.
- Slice 1.2 tests prove known valid agent actions are approved; unknown and
  revoked agents, missing manifests, expired manifests, over-budget actions,
  disallowed contracts/actions, unauthorized counterparties, missing simulation,
  human approval thresholds, and unsupported manifest versions are denied.
- Slice 1.3 gateway mock mode is implemented in `packages/policy-gateway` as a
  local-only agent sponsorship endpoint.
- Slice 1.3 tests prove the gateway starts locally, valid manifests return
  approved decisions with mock sponsorship ids, denied requests return reason
  codes without reserving sponsorship, redacted events omit prompt-like and
  secret-like request fields, and event sink failures do not affect request
  handling.
- Root build, test, typecheck, package dry-run, docs, smokes, readiness example,
  and secret scan include the accounts and manifest packages.

## What Is Not Complete

- SDK sponsored action helper is not implemented.
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

- Slice 1.1 Manifest Schema in `packages/manifest`, completed below.

## Completed Slice 1.1

Implemented `packages/manifest` with tests.

Used the conservative package name `@iota-gaskit/manifest` until a dedicated
namespace migration slice is approved.

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.1
- `docs/agentic-gaskit/module-specs.md` `packages/manifest`
- `docs/agentic-gaskit/verification-hardening.md` Manifest verification matrix

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/manifest/README.md`
- `packages/manifest/package.json`
- `packages/manifest/src/fixtures.ts`
- `packages/manifest/src/index.ts`
- `packages/manifest/src/manifest.test.ts`
- `packages/manifest/src/schema.ts`
- `packages/manifest/src/validate.ts`
- `packages/manifest/tsconfig.build.json`
- generated ignored `packages/manifest/dist/`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/manifest/src/manifest.test.ts
npm install --package-lock-only
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused manifest tests passed: 7 tests.
- `npm test` passed with 146 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed, including local gateway smoke, demo dApp
  smoke, browser wrapper smoke, readiness example, package dry-run, docs check,
  and secret scan.
- `git diff --check` passed.

Hardening notes:

- Manifest validation fails closed on unsupported schema versions before policy
  or chain execution.
- Validator rejects top-level and nested secret-bearing fields such as private
  keys, raw transaction bytes, user signatures, bearer tokens, app API keys, and
  payment credentials.
- Manifest package does not make policy decisions, execute chain operations, or
  call IOTA/Gas Station.
- No live testnet commands were run.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.1 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this slice does not claim Apex verification.

Known unproven claims:

- Manifest signing, SDK submission, MCP tooling, gateway policy integration,
  idempotent sponsorship, receipts, and simulation binding beyond schema fields
  are not implemented yet.
- AP2/x402/A2A mapping helpers remain Phase 4 work.

Next recommended slice:

- Slice 1.2 Pure Policy Evaluator in `packages/policy-gateway`.

## Completed Slice 1.2

Implemented a pure agent-action policy evaluator in `packages/policy-gateway`.

This slice adds a new evaluator instead of replacing
`evaluateSponsorshipPolicy`, preserving the existing GasKit app credential,
quota, wallet deny-list, package/function allow-list, policy simulation, and
gateway service behavior.

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.2
- `docs/agentic-gaskit/module-specs.md` `packages/policy-gateway`
- `docs/agentic-gaskit/verification-hardening.md` Policy verification matrix

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/policy-gateway/package.json`
- `packages/policy-gateway/src/evaluatePolicy.ts`
- `packages/policy-gateway/src/evaluatePolicy.test.ts`
- `packages/policy-gateway/src/index.ts`
- `packages/policy-gateway/src/policySchema.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/policy-gateway/src/evaluatePolicy.test.ts
node --import tsx --test packages/policy-gateway/src/policy.test.ts
npm install
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused agent policy tests passed: 11 tests.
- Existing app sponsorship policy tests passed: 11 tests.
- `npm test` passed with 157 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed, including local gateway smoke, demo dApp
  smoke, browser wrapper smoke, readiness example, package dry-run, docs check,
  and secret scan.
- `git diff --check` passed.

Hardening notes:

- Policy remains deterministic and pure; no LLM judgment, live IOTA, Gas
  Station, SDK, MCP, custody, or secret-bearing behavior was added.
- Unknown agents and unsupported manifest versions fail closed.
- Revoked agents fail closed.
- Human approval thresholds cannot be bypassed by a manifest setting
  `humanMandate.required` to false.
- Manifest validation is reused from `@iota-gaskit/manifest`; root build order
  now compiles manifest before policy-gateway.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.2 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this slice does not claim Apex verification.

Known unproven claims:

- Gateway endpoint/mock mode for agent sponsorship requests is not implemented.
- SDK/MCP routing through the gateway is not implemented.
- Idempotent sponsorship, receipts, escrow contracts, and simulation binding
  beyond manifest fields remain future slices.

Next recommended slice:

- Slice 1.3 Gateway Mock Mode in `packages/policy-gateway`.

## Completed Slice 1.3

Implemented gateway mock mode for agent sponsored actions in
`packages/policy-gateway`.

This slice adds a package-level local agent sponsorship server and mock Gas
Station adapter instead of changing the existing app-level gateway service. The
endpoint is `/v1/agent/sponsorships` and accepts `{ manifest }` JSON bodies.

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.3
- `docs/agentic-gaskit/module-specs.md` `packages/policy-gateway`
- `docs/agentic-gaskit/verification-hardening.md` Gateway/mock-mode concerns

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `packages/policy-gateway/src/index.ts`
- `packages/policy-gateway/src/mockGasStationAdapter.ts`
- `packages/policy-gateway/src/routes.ts`
- `packages/policy-gateway/src/server.ts`
- `packages/policy-gateway/src/server.test.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/policy-gateway/src/server.test.ts
node --import tsx --test packages/policy-gateway/src/evaluatePolicy.test.ts packages/policy-gateway/src/policy.test.ts packages/policy-gateway/src/server.test.ts
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused gateway mock-mode tests passed: 4 tests.
- Focused policy gateway regression tests passed: 26 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 161 tests, typecheck, local gateway smoke,
  demo dApp smoke, browser wrapper smoke, readiness example, package dry-run,
  docs check, and secret scan.

Hardening notes:

- The mock gateway calls no live IOTA, Gas Station, SDK, MCP, custody, signing,
  or payment systems.
- Denied policy decisions do not call the mock sponsorship adapter.
- Redacted events store bounded metadata such as ids, action metadata, gas
  budget, intent length, and metadata presence, not signer refs, full intent
  text, prompt-like metadata, or secret-like request fields.
- Event sink failures are swallowed so observability cannot change local
  sponsorship decisions.
- The existing app-level gateway service contract was left unchanged.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.3 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this slice does not claim Apex verification.

Known unproven claims:

- The SDK cannot yet submit an agent manifest to this mock gateway.
- MCP/A2A routing through the gateway is not implemented.
- Idempotent sponsorship storage, receipts, escrow contracts, and live
  execution remain future slices.

Next recommended slice:

- Slice 1.4 SDK Sponsored Action in `packages/sdk`.

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

For the SDK sponsored action slice, add focused SDK tests first and finish
with:

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
