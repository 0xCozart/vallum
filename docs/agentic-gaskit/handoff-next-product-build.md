# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Continue actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

Slices 1.0, 1.1, 1.2, 1.3, 1.4, and 1.5 are implemented and locally verified.
Slice 1.6 has partial local receipt/SDK progress, but the real Move escrow and
receipt contracts are not implemented or tested. The immediate target remains
completing Slice 1.6: Escrow And Receipt MVP. Use
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
- Slice 1.4 SDK sponsored action is implemented in `packages/sdk` with
  `requestSponsoredAction` and `IotaAgent`.
- Slice 1.4 tests prove SDK calls submit manifests to the mock gateway, return
  typed approved and denied results, and use the gateway sponsorship route
  rather than reserve/execute or direct IOTA calls.
- Slice 1.5 MCP sponsorship tools are implemented in `packages/mcp-server`.
- Slice 1.5 tests prove `iota.request_sponsored_transaction` and
  `iota.open_escrow` route through the SDK/gateway, invalid inputs return typed
  MCP tool errors, gateway denials return structured errors, and MCP tools post
  only to the sponsorship gateway route.
- Slice 1.6 partial local receipt state is implemented in `packages/receipts`
  as `@iota-gaskit/receipts`.
- Slice 1.6 partial receipt tests prove the local lifecycle, double-release
  denial, unauthorized verifier denial, refund after completion, expiry to a
  refunded receipt with expired escrow state, and divergent external/IOTA
  receipt state links without data loss.
- Slice 1.6 partial SDK helper `openEscrow` is implemented in
  `packages/sdk/src/contracts/openEscrow.ts`; it creates an attempted receipt,
  routes through `requestSponsoredAction`, and returns either sponsored or
  denied receipt state.
- Root build, test, typecheck, package dry-run, docs, smokes, readiness example,
  and secret scan include the accounts, manifest, MCP, and receipts packages.

## What Is Not Complete

- A2A tools are not implemented.
- Registry and full contract workflows are not implemented.
- Real Move contracts under `contracts/escrow_v1` and `contracts/receipt_v1`
  are not implemented.
- Move contract tests for create/release/refund, double release denial, and
  unauthorized verifier denial have not run because the `iota` CLI is not
  available on this machine.
- Full Slice 1.6 is not complete. The current work is a local TypeScript
  receipt state machine plus SDK gateway helper, not deployed escrow custody or
  on-chain receipt behavior.
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

## Completed Slice 1.4

Implemented SDK sponsored action support in `packages/sdk`.

This slice adds a developer-facing `requestSponsoredAction` helper and an
`IotaAgent` wrapper. Both submit `{ manifest }` to the Slice 1.3 gateway route
`/v1/agent/sponsorships` and return typed approved or denied results.

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.4
- `docs/agentic-gaskit/module-specs.md` `packages/sdk`
- `docs/agentic-gaskit/verification-hardening.md` SDK verification matrix

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package-lock.json`
- `packages/sdk/package.json`
- `packages/sdk/src/IotaAgent.ts`
- `packages/sdk/src/client.ts`
- `packages/sdk/src/client.test.ts`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/requestSponsoredAction.ts`
- `packages/sdk/src/types.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/sdk/src/client.test.ts
node --import tsx --test packages/policy-gateway/src/server.test.ts packages/sdk/src/client.test.ts
npm install --package-lock-only
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused SDK tests passed: 14 tests.
- Focused mock gateway plus SDK tests passed: 18 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 165 tests, typecheck, local gateway smoke,
  demo dApp smoke, browser wrapper smoke, readiness example, package dry-run,
  docs check, and secret scan.

Hardening notes:

- `requestSponsoredAction` posts only to `/v1/agent/sponsorships`.
- The sponsored-action SDK path does not call live IOTA, Gas Station, SDK
  reserve/execute, MCP, custody, signing, or payment systems.
- Denied gateway decisions are returned as typed data instead of being
  converted into direct execution attempts.
- SDK results expose approved/denied decision data and mock sponsorship ids,
  not raw transaction bytes, user signatures, signer references, sponsor
  credentials, or gateway internals.
- Existing SDK reserve, execute, and policy simulation behavior was preserved.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.4 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this slice does not claim Apex verification.

Known unproven claims:

- MCP/A2A tools cannot yet call the SDK/gateway.
- `openEscrow`, idempotent sponsorship storage, receipts, escrow contracts, and
  live execution remain future slices.

Next recommended slice:

- Slice 1.5 MCP Sponsorship Tools.

## Completed Slice 1.5

Implemented MCP sponsorship tools in `packages/mcp-server`.

This slice adds MCP-shaped tool descriptors and a local callable server facade
for `iota.request_sponsored_transaction` and `iota.open_escrow`. Both tools
validate an Agent Transaction Manifest, call the SDK `IotaAgent`, and therefore
route through the policy gateway sponsorship endpoint.

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.5
- `docs/agentic-gaskit/module-specs.md` `packages/mcp-server`
- `docs/agentic-gaskit/verification-hardening.md` MCP verification matrix

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/mcp-server/README.md`
- `packages/mcp-server/package.json`
- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/server.ts`
- `packages/mcp-server/src/tools.ts`
- `packages/mcp-server/src/tools.test.ts`
- `packages/mcp-server/tsconfig.build.json`

Commands run:

```bash
git status --short --branch
npm view @modelcontextprotocol/sdk version --json
npm view @modelcontextprotocol/sdk exports --json
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/mcp-server/src/tools.test.ts
node --import tsx --test packages/policy-gateway/src/server.test.ts packages/sdk/src/client.test.ts packages/mcp-server/src/tools.test.ts
npm install --package-lock-only
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused MCP tool tests passed: 5 tests.
- Focused mock gateway plus SDK plus MCP tests passed: 22 tests.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 170 tests, typecheck, local gateway smoke,
  demo dApp smoke, browser wrapper smoke, readiness example, package dry-run,
  docs check, and secret scan.

Hardening notes:

- `packages/mcp-server` imports SDK and manifest packages only; it does not
  import IOTA SDK, Gas Station clients, or gateway reserve/execute paths.
- Tool calls validate manifests with `@iota-gaskit/manifest` before calling
  SDK.
- `iota.request_sponsored_transaction` and `iota.open_escrow` both call
  `IotaAgent.requestSponsoredAction`.
- Denied gateway decisions become structured MCP tool errors with reason codes.
- Tool results do not expose raw transaction bytes, user signatures, signer
  references, sponsor credentials, bearer tokens, app API keys, or private
  prompt text.
- The package exposes a local callable facade and MCP-shaped tool descriptors.
  It does not yet claim full stdio or Streamable HTTP transport
  interoperability.
- MCP external refresh checked current official TypeScript SDK docs and npm:
  `@modelcontextprotocol/sdk` reports `1.29.0`. Transport integration was
  intentionally deferred to keep this slice centered on tool validation and
  SDK/gateway routing.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.5 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this slice does not claim Apex verification.

Known unproven claims:

- Full MCP stdio or Streamable HTTP transport wiring is not implemented.
- A2A tools, registry, idempotent sponsorship storage, receipts, escrow
  contracts, and live execution remain future slices.

Next recommended slice:

- Slice 1.6 Escrow And Receipt MVP.

## Slice 1.6 Partial Progress

Implemented a local TypeScript receipt and escrow state machine in
`packages/receipts`, plus an SDK `openEscrow` helper that routes escrow opening
through the existing Slice 1.4 sponsored-action gateway path.

This is not the full Slice 1.6 acceptance target because the local machine does
not have the IOTA CLI or a Move test harness available. No Move contracts,
localnet deployment, testnet deployment, or real custody/settlement behavior is
claimed.

Acceptance references:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.6
- `docs/agentic-gaskit/module-specs.md` contracts and receipts modules
- `docs/agentic-gaskit/verification-hardening.md` contract/receipt risks

Changed files:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/receipts/README.md`
- `packages/receipts/package.json`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/receipts/tsconfig.build.json`
- `packages/sdk/package.json`
- `packages/sdk/src/contracts/openEscrow.ts`
- `packages/sdk/src/contracts/openEscrow.test.ts`
- `packages/sdk/src/index.ts`

Commands run:

```bash
git status --short --branch
command -v iota
iota --version
iota move test --help
find . -maxdepth 3 -name Move.toml -o -name '*.move'
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/receipts/src/receipts.test.ts
node --import tsx --test packages/sdk/src/contracts/openEscrow.test.ts
node --import tsx --test packages/receipts/src/receipts.test.ts packages/sdk/src/contracts/openEscrow.test.ts
node --import tsx --test packages/policy-gateway/src/server.test.ts packages/sdk/src/client.test.ts packages/mcp-server/src/tools.test.ts packages/receipts/src/receipts.test.ts packages/sdk/src/contracts/openEscrow.test.ts
npm install
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- `iota` CLI was unavailable: `command -v iota` returned no path, and
  `iota --version` plus `iota move test --help` failed with command not found.
- No `Move.toml` or `.move` files were present under the first three directory
  levels.
- Focused receipt tests passed: 6 tests.
- Focused receipt plus SDK `openEscrow` tests passed: 8 tests.
- Focused policy gateway plus SDK plus MCP plus receipt regression tests
  passed: 31 tests.
- `npm run typecheck` passed after `npm install` created the workspace link for
  `@iota-gaskit/receipts`.
- `npm run verify:local` passed with 176 tests, typecheck, local gateway smoke,
  demo dApp smoke, browser wrapper smoke, readiness example, package dry-run,
  docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- `packages/receipts` is a pure local state machine. It adds no custody, live
  IOTA, Gas Station, gateway reserve/execute, signing, or payment behavior.
- `openEscrow` calls `requestSponsoredAction`, so it uses the existing
  SDK/gateway sponsorship route instead of direct reserve/execute or raw
  transaction/user-signature paths.
- Denied gateway decisions become denied receipt state, not execution attempts.
- Double release is denied after release, only the configured verifier can
  release escrow, and refunded or expired escrow cannot be released.
- Receipt links allow external payment and IOTA receipt state to diverge
  without overwriting the core receipt status.
- Secret scan passed; the only hardening search hits in the changed SDK/receipt
  surface were test `apiKey` fixtures and the expected `apiKey` option name.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.6 partial scope was recorded locally under
  ignored `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- Real Move contracts `contracts/escrow_v1` and `contracts/receipt_v1` are not
  implemented.
- Move tests for create, release, refund, double release denial, and
  unauthorized verifier denial are not run.
- Localnet/testnet deployment smoke is not run.
- No actual fund custody, settlement, verifier oracle, on-chain receipt, or
  dispute resolution behavior exists.

Next recommended slice:

- Continue Slice 1.6 by setting up the Move harness or adding verified contract
  implementation and tests for escrow and receipts.

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

For the continuing escrow and receipt MVP slice, first verify whether the IOTA
CLI and Move harness are available. If they are not available, do not claim
contract acceptance. Add focused contract/receipt tests first and finish
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
