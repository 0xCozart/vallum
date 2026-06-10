# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Continue actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

Slices 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, and 3.1 are
implemented and locally verified. The immediate target is Slice 3.2:
Pay-Per-Call Tool Contract. Use
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
- Slice 1.6 receipt state is implemented in `packages/receipts` as
  `@iota-gaskit/receipts`.
- Slice 1.6 receipt tests prove the local lifecycle, double-release denial,
  unauthorized verifier denial, refund after completion, expiry to a refunded
  receipt with expired escrow state, and divergent external/IOTA receipt state
  links without data loss.
- Slice 1.6 SDK helper `openEscrow` is implemented in
  `packages/sdk/src/contracts/openEscrow.ts`; it creates an attempted receipt,
  routes through `requestSponsoredAction`, and returns either sponsored or
  denied receipt state.
- Slice 1.6 Move contract packages are implemented in `contracts/escrow_v1`
  and `contracts/receipt_v1`.
- Slice 1.6 Move tests prove escrow create/release/refund, double-release
  denial, unauthorized verifier denial, and receipt lifecycle status updates.
- Slice 1.7 agent-to-agent escrow demo is implemented in
  `examples/agent-escrow`.
- Slice 1.7 demo proves a local requester agent opens escrow through the SDK
  and mock gateway, the provider completes work, the verifier releases escrow,
  receipt/log output is sanitized, and an over-budget manifest returns
  structured denial.
- Slice 2.1 Agent Profile schema is implemented in `packages/registry` as
  `@iota-gaskit/registry`.
- Slice 2.1 tests prove a valid profile passes, missing name/address/DID/
  capabilities/endpoints fail with typed errors, revoked and expired profiles
  have explicit states, unsupported/malformed profiles fail closed, and
  secret-bearing profile fields are rejected.
- Slice 2.2 local fixture resolver is implemented in `packages/registry`.
- Slice 2.2 SDK resolver helper is implemented in `packages/sdk`.
- Slice 2.2 profile capability policy check is implemented in
  `packages/policy-gateway`.
- Slice 2.2 tests prove local fixture profile resolution, typed resolver errors,
  revoked/expired and revoked-wallet denial, SDK pass-through resolution, and
  capability mismatch denial.
- Slice 2.3 IOTA Names adapter interface is implemented in `packages/registry`
  with mock GraphQL tests for `resolveIotaNamesAddress(name) { address }`,
  name/profile binding, unresolved names, and address mismatch failure.
- Slice 2.3 IOTA Identity adapter interface is implemented in
  `packages/registry` with mock DID and credential tests for agent/owner DID
  resolution, credential reference validation, DID mismatch failure, and revoked
  credential denial.
- Slice 3.1 Contract Metadata Registry is implemented in
  `packages/contracts-metadata` as `@iota-gaskit/contracts-metadata`.
- Slice 3.1 tests prove approved template/version metadata is accepted, unknown
  raw packages are denied when a template allow-list is configured, mismatched
  template versions are denied, and legacy package/function allow-list behavior
  remains compatible.
- `docs/agentic-gaskit/external-api-notes.md` was refreshed on 2026-06-10 for
  current IOTA Names GraphQL and IOTA Identity DID/VC assumptions.
- Root build, test, typecheck, package dry-run, docs, smokes, readiness example,
  contract tests, and secret scan include the accounts, manifest, MCP,
  registry, contracts metadata, receipts, escrow/receipt contract surfaces, and
  agent escrow demo smoke.

## What Is Not Complete

- A2A protocol tools and standards-compatible discovery are not implemented.
- Live IOTA Names/Identity proof, full verifiable credential validation, A2A
  mapping, and expanded contract workflows beyond local escrow/receipt metadata
  are not implemented.
- Slice 2.3 is locally verified only. Localnet/testnet deployment smoke has not
  run, and the demo/escrow contract does not custody real funds.
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

- Slice 1.6 Escrow And Receipt MVP, completed below.

## Completed Slice 1.6

Implemented the Escrow And Receipt MVP across local TypeScript state, SDK
gateway routing, and Move contract state packages.

`packages/receipts` owns the local receipt/escrow lifecycle state machine.
`packages/sdk/src/contracts/openEscrow.ts` creates an attempted receipt and
routes through the existing sponsored-action gateway path. `contracts/escrow_v1`
and `contracts/receipt_v1` provide minimal non-custodial Move state contracts
for verifier-gated escrow and receipt lifecycle status.

The IOTA CLI was installed locally under ignored `tmp/tooling/` for verification
from the official Linux x86_64 release. `npm run contracts:test` uses
`IOTA_BIN`, a PATH `iota`, or that ignored local binary.

Acceptance references:

- `docs/agentic-gaskit/prds/phase-1-sponsored-policy-mvp.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 1.6
- `docs/agentic-gaskit/module-specs.md` contracts and receipts modules
- `docs/agentic-gaskit/verification-hardening.md` contract/receipt risks

Changed files:

- `.gitignore`
- `contracts/escrow_v1/Move.toml`
- `contracts/escrow_v1/sources/escrow.move`
- `contracts/escrow_v1/tests/escrow_tests.move`
- `contracts/receipt_v1/Move.toml`
- `contracts/receipt_v1/sources/receipt.move`
- `contracts/receipt_v1/tests/receipt_tests.move`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
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
- `scripts/run-move-tests.ts`

Commands run:

```bash
git status --short --branch
command -v iota
iota --version
iota move test --help
find . -maxdepth 3 -name Move.toml -o -name '*.move'
curl -s https://api.github.com/repos/iotaledger/iota/releases/latest
tmp/tooling/iota-v1.24.0/iota --version
tmp/tooling/iota-v1.24.0/iota move test -p tmp/iota-move-scaffold-check
tmp/tooling/iota-v1.24.0/iota move test -p contracts/escrow_v1
tmp/tooling/iota-v1.24.0/iota move test -p contracts/receipt_v1
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
npm run contracts:test
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
- Official IOTA docs and GitHub releases were checked for the current CLI
  install path. Release `v1.24.0` provided the Linux x86_64 binary used for
  local Move verification.
- Scaffold smoke passed with `tmp/tooling/iota-v1.24.0/iota move test -p
  tmp/iota-move-scaffold-check`.
- Focused receipt tests passed: 6 tests.
- Focused receipt plus SDK `openEscrow` tests passed: 8 tests.
- Focused policy gateway plus SDK plus MCP plus receipt regression tests
  passed: 31 tests.
- Focused Move escrow contract tests passed: 4 tests.
- Focused Move receipt contract tests passed: 4 tests.
- `npm run contracts:test` passed with 8 Move tests.
- `npm test` passed with 177 TypeScript tests after adding the contract test
  runner.
- `npm run typecheck` passed after `npm install` created the workspace link for
  `@iota-gaskit/receipts`.
- `npm run verify:local` passed with 177 TypeScript tests, 8 Move contract
  tests, typecheck, local gateway smoke, demo dApp smoke, browser wrapper
  smoke, readiness example, package dry-run, docs check, and secret scan.
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
- `contracts/escrow_v1` enforces verifier-gated release in Move through
  `tx_context::sender`, denies double release, and allows owner/verifier refund
  or expiry while open.
- `contracts/receipt_v1` keeps attempted, denied, approved, sponsored,
  submitted, completed, released, refunded, and failed status transitions
  explicit.
- Receipt links allow external payment and IOTA receipt state to diverge
  without overwriting the core receipt status.
- Secret scan passed; the only hardening search hits in the changed SDK/receipt
  surface were test `apiKey` fixtures and the expected `apiKey` option name.
- Move contract packages do not import Gas Station, SDK reserve/execute,
  signing, private-key, bearer-token, or payment APIs.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.6 scope was recorded locally under
  ignored `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- Localnet/testnet deployment smoke is not run.
- No actual fund custody, settlement, verifier oracle, published package ID,
  on-chain receipt write from SDK, or dispute resolution behavior exists.

Next recommended slice:

- Slice 1.7 Agent-To-Agent Escrow Demo.

## Completed Slice 1.7

Implemented the deterministic local agent-to-agent escrow demo.

The demo stays local/mock. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, or custody funds.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 1.7
- `docs/agentic-gaskit/codex-active-goal.md` Current Slice Acceptance

Changed files:

- `README.md`
- `apps/docs-site/docs.config.mjs`
- `docs/CODEBASE_MAP.md`
- `docs/demo-agent-escrow.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `examples/agent-escrow/README.md`
- `examples/agent-escrow/agent-escrow-demo.test.ts`
- `examples/agent-escrow/agent-escrow-demo.ts`
- `package.json`
- `scripts/package-scripts.test.ts`
- `scripts/smoke-agent-escrow.ts`

Commands run:

```bash
git status --short --branch
node --import tsx --test examples/agent-escrow/agent-escrow-demo.test.ts
npm run smoke:agent-escrow
node --import tsx --test examples/agent-escrow/agent-escrow-demo.test.ts scripts/package-scripts.test.ts
npm run docs:check
node --import tsx --test examples/agent-escrow/agent-escrow-demo.test.ts scripts/package-scripts.test.ts scripts/reviewer-docs.test.ts
npm run verify:local
git diff --check
```

Verification result:

- Initial demo test failed before implementation because
  `examples/agent-escrow/agent-escrow-demo.js` did not exist.
- Focused demo test passed after implementation.
- `npm run smoke:agent-escrow` passed and printed approved release plus
  over-budget denial output.
- Focused demo plus package-script tests passed.
- `npm run docs:check` passed after adding the hosted docs page.
- Focused demo, package-script, and reviewer-doc tests passed with 29 tests.
- `npm run verify:local` passed with 179 TypeScript tests, 8 Move contract
  tests, typecheck, local gateway smoke, demo dApp smoke, browser wrapper smoke,
  agent escrow smoke, readiness example, package dry-run, docs check, and
  secret scan.
- Secret scan checked 180 tracked/staged/untracked text files with 0 findings.
- `git diff --check` passed.

Hardening notes:

- The approved path calls `openEscrow`, which routes through the SDK and mock
  sponsorship gateway instead of direct reserve/execute or raw transaction
  paths.
- The denied path uses an over-budget manifest and returns
  `GAS_BUDGET_TOO_HIGH` with denied receipt state.
- Formatted output omits API keys, signer references, raw transaction bytes,
  user signatures, and secret-looking fields.
- The smoke is wired into `npm run verify:local` so future broad proof includes
  the local agent escrow demo.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 1.7 scope was recorded locally under
  ignored `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- No live IOTA, Gas Station, localnet/testnet deployment, real custody, payment
  settlement, verifier oracle, or published package ID behavior exists in this
  demo.
- A2A protocol tools and registry/profile discovery remain future slices.

Next recommended slice:

- Slice 2.1 Agent Profile Schema.

## Completed Slice 2.1

Implemented the local Agent Profile schema package.

The package is schema/validation only. It does not resolve live IOTA Names,
validate IOTA Identity credentials, generate A2A Agent Cards, call IOTA RPC, or
contact testnet/mainnet services.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.1
- `docs/agentic-gaskit/prds/phase-2-identity-registry.md`
- `docs/agentic-gaskit/module-specs.md` `packages/registry`
- `docs/agentic-gaskit/verification-hardening.md` Registry row

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `package-lock.json`
- `packages/registry/README.md`
- `packages/registry/package.json`
- `packages/registry/src/index.ts`
- `packages/registry/src/profileSchema.test.ts`
- `packages/registry/src/profileSchema.ts`
- `packages/registry/tsconfig.build.json`
- `scripts/package-scripts.test.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/profileSchema.test.ts
npm run build -w @iota-gaskit/registry
node --import tsx --test packages/registry/src/profileSchema.test.ts scripts/package-scripts.test.ts
npm install --package-lock-only
npm test
npm run verify:local
npm run secrets:scan
node --import tsx --test packages/registry/src/profileSchema.test.ts
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test` with 179
  TypeScript tests, and `npm run typecheck`.
- Initial focused profile-schema test failed before implementation because
  `packages/registry/src/index.js` did not exist.
- Focused registry schema tests passed with 5 tests.
- Focused registry schema plus package-script tests passed with 20 tests.
- `npm run build -w @iota-gaskit/registry` passed.
- `npm install --package-lock-only` completed with 0 vulnerabilities.
- `npm test` passed with 185 TypeScript tests after wiring the registry package.
- Initial `npm run verify:local` reached the final secret scan but failed
  because registry test fixture assignments used secret-like key names with
  non-fixture sentinel values.
- After changing those test values to explicit fixture sentinels, focused
  registry tests and `npm run secrets:scan` passed.
- Hardening found that secret-field rejection did not traverse object arrays.
  A focused regression test first failed for `$.capabilities[0].rawKeypair`,
  then passed after the validator was changed to recurse through arrays.
- Fresh `npm run verify:local` passed with 185 TypeScript tests, 8 Move
  contract tests, typecheck, local gateway smoke, demo dApp smoke, browser
  wrapper smoke, agent escrow smoke, readiness example, package dry-run
  including `@iota-gaskit/registry`, docs check, and secret scan.
- Secret scan checked 186 tracked/staged/untracked text files with 0 findings.
- `git diff --check` passed.

Hardening notes:

- The schema rejects secret-bearing fields including private keys, mnemonics,
  raw keypairs, raw transaction bytes, user signatures, sponsor keys, app API
  keys, bearer tokens, payment credentials, and signer secrets.
- Revoked and expired profiles are explicit validation failures with typed
  status.
- The registry package does not perform live resolution, policy decisions,
  signing, custody, payment settlement, or gateway sponsorship.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 2.1 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- No local fixture resolver, IOTA Names adapter, IOTA Identity adapter,
  capability policy integration, A2A Agent Card mapping, dashboard profile
  view, or live testnet/manual resolution path exists yet.

Next recommended slice:

- Slice 2.2 Resolver With Local Fixtures.

## Completed Slice 2.2

Implemented deterministic local Agent Profile resolution, SDK access to that
resolver, and a pure profile capability policy check.

This slice stays local. It does not call IOTA Names, IOTA Identity, IOTA RPC,
IOTA Gas Station, testnet, mainnet, paid APIs, or external identity providers.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.2
- `docs/agentic-gaskit/prds/phase-2-identity-registry.md`
- `docs/agentic-gaskit/module-specs.md` `packages/registry`
- `docs/agentic-gaskit/verification-hardening.md` Registry row and Phase 2
  gate

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package-lock.json`
- `packages/policy-gateway/package.json`
- `packages/policy-gateway/src/capabilityCheck.test.ts`
- `packages/policy-gateway/src/capabilityCheck.ts`
- `packages/policy-gateway/src/index.ts`
- `packages/registry/src/index.ts`
- `packages/registry/src/profileSchema.ts`
- `packages/registry/src/resolveAgent.test.ts`
- `packages/registry/src/resolveAgent.ts`
- `packages/sdk/package.json`
- `packages/sdk/src/index.ts`
- `packages/sdk/src/resolveAgent.test.ts`
- `packages/sdk/src/resolveAgent.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/resolveAgent.test.ts
node --import tsx --test packages/registry/src/profileSchema.test.ts packages/registry/src/resolveAgent.test.ts
npm run build -w @iota-gaskit/registry
node --import tsx --test packages/sdk/src/resolveAgent.test.ts
node --import tsx --test packages/policy-gateway/src/capabilityCheck.test.ts
node --import tsx --test packages/registry/src/resolveAgent.test.ts packages/sdk/src/resolveAgent.test.ts packages/policy-gateway/src/capabilityCheck.test.ts
node --import tsx --test packages/registry/src/profileSchema.test.ts packages/registry/src/resolveAgent.test.ts packages/sdk/src/resolveAgent.test.ts packages/policy-gateway/src/capabilityCheck.test.ts scripts/reviewer-docs.test.ts
npm run verify:local
git diff --check
npm install
npm install --package-lock-only
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test` with 185
  TypeScript tests, and `npm run typecheck`.
- Initial focused resolver test failed before implementation because
  `createLocalAgentResolver` was not exported.
- Focused resolver tests passed after adding `resolveAgent` and
  `createLocalAgentResolver`.
- Revoked-wallet resolver test failed until profile validation denied inactive
  wallet states; it passed after that hardening change.
- SDK resolver test initially failed because `@iota-gaskit/registry` was not
  linked as a workspace dependency; `npm install` added the local link, and the
  test passed after the registry package was rebuilt.
- Focused registry resolver, SDK resolver, and policy capability tests passed
  with 9 tests.
- Final focused registry/profile, SDK resolver, policy capability, and reviewer
  docs tests passed with 28 tests.
- Final `npm test` passed with 194 TypeScript tests.
- Final `npm run typecheck` passed.
- Final `npm run docs:check` passed with 27 HTML pages generated from 26
  Markdown sources.
- Final `npm run secrets:scan` passed with 192 tracked/staged/untracked text
  files checked and 0 findings.
- Final `npm run verify:local` passed, including TypeScript tests, 8 Move
  contract tests, typecheck, local gateway smoke, demo dApp smoke, browser
  wrapper smoke, agent escrow smoke, readiness example, package dry-run, docs
  check, and secret scan.
- Final `git diff --check` passed.

Hardening notes:

- Resolver validates every local profile before returning it.
- Resolver fails closed for missing, malformed, unsupported-version, revoked,
  expired, and inactive-wallet profiles.
- SDK resolver helper delegates to the local resolver and adds no gateway,
  sponsorship, signing, or live-network behavior.
- Capability policy validates profile state before matching capability id,
  scope, or contract.
- Capability id, scope, and contract mismatches deny protected actions with
  `CAPABILITY_NOT_ALLOWED`.
- Live IOTA Names and IOTA Identity are intentionally left for Slice 2.3.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 2.2 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- No IOTA Names adapter, IOTA Identity adapter, credential validation, A2A Agent
  Card mapping, dashboard profile view, or live testnet/manual resolution path
  exists yet.

Next recommended slice:

- Slice 2.3 IOTA Names And Identity Adapters.

## Completed Slice 2.3

Implemented mock-tested IOTA Names and IOTA Identity adapter interfaces for the
Agent Profile registry.

This slice stays local by default. It does not call live IOTA GraphQL, IOTA
Identity, IOTA RPC, IOTA Gas Station, localnet, testnet, mainnet, paid APIs, or
external identity providers in automated verification.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.3
- `docs/agentic-gaskit/prds/phase-2-identity-registry.md`
- `docs/agentic-gaskit/module-specs.md` `packages/registry`
- `docs/agentic-gaskit/verification-hardening.md` IOTA adapters and Phase 2
  gate
- current official IOTA docs recorded in
  `docs/agentic-gaskit/external-api-notes.md`

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `packages/registry/src/index.ts`
- `packages/registry/src/iotaIdentityAdapter.test.ts`
- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/registry/src/iotaNamesAdapter.test.ts`
- `packages/registry/src/iotaNamesAdapter.ts`
- `packages/registry/src/resolveAgent.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/iotaNamesAdapter.test.ts packages/registry/src/iotaIdentityAdapter.test.ts
node --import tsx --test packages/registry/src/profileSchema.test.ts packages/registry/src/resolveAgent.test.ts packages/registry/src/iotaNamesAdapter.test.ts packages/registry/src/iotaIdentityAdapter.test.ts
npm run verify:local
git diff --check
git diff --cached --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test` with 194
  TypeScript tests, and `npm run typecheck`.
- Initial focused adapter tests failed before implementation because
  `createIotaNamesAgentResolver` and `createIotaIdentityVerifiedResolver` were
  not exported.
- Focused adapter tests passed after adding Names and Identity adapters.
- Focused registry tests passed with 20 tests after adding adapter coverage and
  fail-closed hardening cases.
- Final `npm test` passed with 204 TypeScript tests.
- Final `npm run typecheck` passed.
- Final `npm run docs:check` passed with 27 HTML pages generated from 26
  Markdown sources.
- Final `npm run secrets:scan` passed with 196 tracked/staged/untracked text
  files checked and 0 findings.
- Final `npm run verify:local` passed, including TypeScript tests, 8 Move
  contract tests, typecheck, local gateway smoke, demo dApp smoke, browser
  wrapper smoke, agent escrow smoke, readiness example, package dry-run, docs
  check, and secret scan.
- Final `git diff --check` and `git diff --cached --check` passed.

Hardening notes:

- IOTA Names adapter follows the current official GraphQL
  `resolveIotaNamesAddress(name: String!): Address` query and selects
  `address`.
- Names resolution fails closed for unresolved names, GraphQL errors, malformed
  address responses, missing profile metadata, invalid profiles, profile-name
  mismatch, profile wallet-address mismatch, and profile metadata source
  failures.
- Identity adapter is dependency-injected around current IOTA Identity
  DID-resolution and JWT credential-validation shapes; automated tests use mock
  resolvers and validators only.
- Identity verification fails closed for DID-resolution failures, agent DID
  mismatch, owner DID mismatch, revoked credentials, expired credentials, and
  unverifiable or unavailable credential validation.
- Local fixture resolver behavior is preserved, and Identity verification can
  wrap any existing `AgentResolver`.
- Manual localnet/testnet path is documented in
  `docs/agentic-gaskit/external-api-notes.md` but was not run.
- Apex manifest helper remains unusable because the current
  `apex.workflow.json` lacks required mode definitions and
  `manifest.defaultDir`, so Slice 2.3 scope was recorded locally under ignored
  `tmp/apex-workflow/` and this work does not claim Apex verification.

Known unproven claims:

- No live IOTA Names query, live IOTA Identity DID resolution, live credential
  JWT validation, cache TTL policy, reverse-name enforcement, dashboard profile
  view, A2A Agent Card mapping, or live testnet/manual resolution proof exists
  yet.

Next recommended slice:

- Slice 3.2 Pay-Per-Call Tool Contract.

## Slice 3.1 Completion Evidence

Committed slice:

- `df125ff feat: add contract metadata registry`

Files changed:

- `packages/contracts-metadata/README.md`
- `packages/contracts-metadata/package.json`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `packages/contracts-metadata/tsconfig.build.json`
- `packages/manifest/src/fixtures.ts`
- `packages/manifest/src/schema.ts`
- `packages/manifest/src/validate.ts`
- `packages/policy-gateway/package.json`
- `packages/policy-gateway/src/contractAllowList.ts`
- `packages/policy-gateway/src/contractAllowList.test.ts`
- `packages/policy-gateway/src/evaluatePolicy.ts`
- `packages/policy-gateway/src/index.ts`
- `packages/policy-gateway/src/policySchema.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/module-specs.md`
- `tmp/apex-workflow/contract-metadata-slice-3-1-scope.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
node --import tsx --test packages/policy-gateway/src/*.test.ts
npm test
npm run typecheck
node --import tsx --test packages/contracts-metadata/src/*.test.ts packages/policy-gateway/src/contractAllowList.test.ts
npm install --ignore-scripts
npm run build -w @iota-gaskit/contracts-metadata
node --import tsx --test packages/contracts-metadata/src/*.test.ts packages/policy-gateway/src/contractAllowList.test.ts packages/policy-gateway/src/evaluatePolicy.test.ts packages/manifest/src/*.test.ts
node --import tsx --test scripts/package-scripts.test.ts packages/contracts-metadata/src/*.test.ts packages/policy-gateway/src/contractAllowList.test.ts
npm run build -w @iota-gaskit/contracts-metadata && node --import tsx --test packages/contracts-metadata/src/*.test.ts packages/policy-gateway/src/contractAllowList.test.ts packages/policy-gateway/src/evaluatePolicy.test.ts packages/manifest/src/*.test.ts scripts/package-scripts.test.ts
npm run verify:local
git diff --check
```

Evidence:

- Baseline `npm test` passed with 204 tests before implementation.
- Baseline `npm run typecheck`, `npm run docs:check`, and
  `npm run secrets:scan` passed before implementation.
- Focused red state failed because `packages/contracts-metadata/src/index.js`
  did not exist and template policy still denied approved metadata.
- Focused green state passed 25 metadata, manifest, and policy tests after
  implementation, then 43 hardening-focused tests after tightening module
  matching and incomplete metadata denial.
- Mid-slice `npm test` passed with 211 tests and `npm run typecheck` passed.
- Script/package wiring test now covers `@iota-gaskit/contracts-metadata`.
- Final `npm run verify:local` passed with 214 TypeScript tests, 8 Move tests
  across escrow/receipt contracts, local gateway smoke, demo dApp smoke,
  browser wrapper smoke, agent escrow smoke, readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No live localnet/testnet/mainnet contract deployment, package-address proof,
  formal smart-contract audit, or IOTA Gas Station call was run for Slice 3.1.
- The default template package ids are local metadata fixtures for policy tests,
  not deployed address claims.

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

For Slice 3.1, keep contract metadata work local unless the user explicitly
asks for live localnet/testnet proof and operator-owned credentials are
configured. Start with the baseline above plus:

```bash
node --import tsx --test packages/policy-gateway/src/*.test.ts
```

Finish with:

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
