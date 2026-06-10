# Handoff: Next Product Build

Last updated: 2026-06-10.

## Next Session Focus

Continue actual Agentic GasKit product implementation in
`/home/sacred/code/agentic-gaskit`.

Slices 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5,
2.6, 2.7, 2.8,
3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8,
5.1, 5.2, 6.1, 6.2, and 6.3 are implemented, reviewed, locally verified, or
explicitly deferred with a verified hardening gate.
Slice 5.1 is a readiness gate, not a marketplace implementation approval. Use
`docs/marketplace-readiness.md` before choosing the next slice. Do not start
production marketplace implementation unless the user explicitly approves the
new scope and its unresolved gates.

## Current State

- Canonical repo: `https://github.com/0xCozart/agentic-gaskit`
- Local path: `/home/sacred/code/agentic-gaskit`
- Branch: `main`
- GitHub visibility currently reports private.
- `origin` points to Agentic GasKit.
- `upstream` fetches from `https://github.com/0xCozart/iota-gaskit.git`.
- `upstream` push is disabled.

Recent commits to know:

- `6d9e64f` feat: add package install smoke
- `7ed27b1` feat: add package publish dry-run gate
- `45bf716` feat: add iota identity live proof smoke
- `9f10bad` feat: harden identity verification cache
- `faddf2f` feat: add subscription workflow
- `0de44a1` feat: add reputation receipt workflow
- `2a72b62` feat: add a2a agent card mapping
- `8e228cf` feat: add ap2 mandate bridge
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
- Slice 2.4 Identity Revocation Cache Hardening is implemented in
  `packages/registry` and `packages/policy-gateway`.
- Slice 2.4 tests prove successful local/mock DID and credential evidence can
  be cached only inside an explicit TTL; expired cache entries are not used for
  approval; stale evidence fails closed if refresh cannot complete; revoked
  credentials are detected after TTL expiry; protected-action resolution can
  force refresh inside the TTL; and capability policy denies stale, revoked,
  expired, unverifiable, or invalid resolved profiles.
- Slice 2.5 IOTA Names Live Resolution Smoke is implemented as an opt-in
  command that requires `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS`, resolves through the existing registry GraphQL
  adapter, fails closed on address mismatch, and reports missing configuration
  without printing secret-like values.
- Slice 2.6 Live Proof Status Report is implemented as a non-networked
  `npm run proof:live-status` command. It reports testnet readiness,
  IOTA Names, IOTA Identity, and VC proof blockers or ready-to-run
  configuration without contacting live services or printing configured values.
- Slice 2.7 Identity VC Trust Policy is implemented in `packages/registry`.
  It gives the injected credential validator a local fail-closed trust-policy
  layer for trusted issuer DIDs, issuer-controlled verification methods,
  required credential types, accepted revocation status mechanisms, revoked
  status evidence, credential expiry, max credential age, missing evidence, and
  cache-policy binding.
- Slice 2.8 IOTA Identity Live Proof Harness is implemented as an opt-in
  `npm run smoke:iota-identity-live` command. It can contact an
  operator-provided HTTPS or loopback proof endpoint, validate a configured
  Agent Profile, resolve profile DIDs, validate credential refs, and apply the
  local VC trust policy without printing endpoint, DID, or credential values.
- Slice 3.1 Contract Metadata Registry is implemented in
  `packages/contracts-metadata` as `@iota-gaskit/contracts-metadata`.
- Slice 3.1 tests prove approved template/version metadata is accepted, unknown
  raw packages are denied when a template allow-list is configured, mismatched
  template versions are denied, and legacy package/function allow-list behavior
  remains compatible.
- Slice 3.2 Pay-Per-Call Tool Contract is implemented with local
  `contracts/pay_per_call_v1`, SDK `callPaidTool`, pay-per-call receipt state,
  template metadata, and `examples/paid-mcp-tool`.
- Slice 3.2 tests prove the paid tool result is returned only after gateway
  policy approval, mock payment confirmation, and receipt submission; policy
  denial, failed payment, thrown payment confirmation, thrown tool invocation,
  blank proof fields, and malformed runtime proof fields withhold paid results.
- Slice 3.3 Data License Workflow is implemented with local
  `contracts/data_license_v1`, SDK `requestDataLicense`, data-license receipt
  state, template metadata, and `examples/data-license`.
- Slice 3.3 tests prove data-license access is granted only after
  policy-gateway approval and access proof evidence; policy denial, failed
  access proof, and malformed access proof withhold access; receipt state
  records grant/revoke/failure events; and Move tests cover provider-only grant
  and revoke controls plus invalid transitions.
- Slice 3.4 Service Bounty Workflow is implemented with local
  `contracts/service_bounty_v1`, SDK `fulfillServiceBounty`, service-bounty
  receipt state, template metadata, and `examples/service-bounty`.
- Slice 3.4 tests prove bounty release happens only after policy-gateway
  approval and completion proof evidence; policy denial, failed completion
  proof, thrown completion proof, and malformed proof withhold release; receipt
  state records completion/release/failure events; and Move tests cover
  provider-only completion, requester-only release, cancellation, and invalid
  transitions.
- Slice 3.5 Reputation Receipt Workflow is implemented with local
  `contracts/reputation_receipt_v1`, SDK `attestReputation`,
  reputation-receipt state, template metadata, and
  `examples/reputation-receipt`.
- Slice 3.5 tests prove reputation attestation happens only after
  policy-gateway approval and evidence collection; policy denial does not
  collect evidence; failed/thrown/malformed evidence withholds completion;
  raw review payloads fail closed instead of being stored as evidence hashes;
  receipt state records attested/denied/failed evidence; formatted demo output
  omits private material; and Move tests cover issuer-only attestation, invalid
  score denial, and invalid transitions.
- Slice 3.6 Subscription Workflow is implemented with local
  `contracts/subscription_v1`, SDK `startSubscription`/`renewSubscription`,
  subscription receipt state, template metadata, and `examples/subscription`.
- Slice 3.6 tests prove subscription activation and renewal happen only after
  policy-gateway approval and proof collection; policy denial does not collect
  activation proof; failed/thrown/malformed proof withholds activation or
  renewal; renewal receipt state records the renewal sponsorship id and
  transaction digest; receipt state records active/renewed/canceled/denied/
  failed states; formatted demo output omits private material; and Move tests
  cover subscriber/provider authorization, cancellation, invalid renewal
  periods, and invalid transitions.
- Slice 4.1 x402 Mapping is implemented in `packages/manifest`,
  `packages/receipts`, and `packages/standards` as `@iota-gaskit/standards`.
- Slice 4.1 tests prove x402 v2 payment requirements map to Agentic GasKit
  manifests; unsupported x402 protocol versions and unsupported schemes fail
  closed; malformed network ids and accepted indexes fail closed; receipt
  evidence preserves external payment state separately; sensitive payment
  metadata is redacted; and a local mock facilitator flow returns a tool result
  only after policy-gateway approval, verify, and settle.
- Slice 4.2 AP2 Mandate Mapping is implemented in `packages/manifest`,
  `packages/receipts`, and `packages/standards`.
- Slice 4.2 tests prove closed AP2 checkout/payment mandates map to Agentic
  GasKit manifests; unsupported AP2 mandate `vct` strings fail closed; agentic
  Trusted Surfaces fail closed; checkout/payment reference mismatches fail
  closed; AP2 receipt references and dispute evidence are preserved; sensitive
  mandate/payment metadata is redacted; and the local mock AP2 flow executes
  only after policy-gateway approval and successful checkout/payment receipts.
- Slice 4.3 A2A Agent Card mapping is implemented in `packages/registry` and
  exported through `packages/standards`.
- Slice 4.3 tests prove active Agent Profiles generate current A2A Agent Card
  fields; revoked/expired profiles fail closed and do not advertise skills;
  missing A2A endpoints and unsupported local A2A protocol versions fail
  closed; malformed auth requirements fail closed; and public card metadata
  omits credential refs, revocation refs, signer refs, wallet internals, payment
  addresses, and private profile metadata.
- Slice 4.4 A2A well-known serving is implemented in `packages/registry` and
  exported through `packages/standards`.
- Slice 4.4 tests prove canonical `GET /.well-known/agent-card.json` returns an
  `application/a2a+json` Agent Card response; non-GET methods and legacy
  discovery paths do not serve active cards; revoked/expired profiles return no
  active card; and response JSON omits signer refs, wallet internals, credential
  refs, revocation refs, payment addresses, and private profile metadata.
- Slice 4.5 A2A task/message local operations are implemented in
  `packages/standards`.
- Slice 4.5 tests prove local send-message validates current A2A protocol
  version, message shape, manifest, and policy metadata; policy denial returns
  rejected task state without artifacts; input-required tasks accept matching
  follow-up messages; terminal tasks reject follow-up; get/list/cancel preserve
  task state and omit artifacts by default; and task log output redacts prompt
  text, bearer tokens, payment credentials, signer refs, wallet internals, and
  key-like material.
- Slice 4.6 A2A local HTTP boundary is implemented in `packages/standards`.
- Slice 4.6 tests prove public Agent Card discovery remains unauthenticated,
  task routes require configured bearer auth, authorized `message:send`,
  get/list/cancel task routes use the existing local task store, artifacts are
  hidden by default, unsupported A2A versions fail closed, streaming and push
  notification routes are explicitly unsupported, and safe errors do not echo
  bearer tokens, private prompts, signer refs, wallet internals, or payment
  credentials.
- Slice 4.7 A2A signed Agent Card local proof is implemented in
  `packages/registry` and exported through `packages/standards`.
- Slice 4.7 tests prove local Agent Cards can carry A2A JWS-style signatures
  over canonical unsigned card payloads; verification succeeds only with a
  trusted matching public key and fails closed for tampered cards, wrong keys,
  required-key mismatches, unsupported algorithms, malformed signatures, missing
  signatures, stale signatures, not-yet-valid signatures, blank key ids,
  invalid JWKS URLs, invalid signature times, and private public-card metadata.
- Slice 4.8 A2A local loopback server smoke is implemented in
  `packages/standards` and `examples/a2a-local-server`.
- Slice 4.8 tests prove the local A2A handler can run behind a real
  loopback-only HTTP server with signed Agent Card discovery, trusted-key
  verification, bearer-authenticated task routes, send/get/list/cancel flow,
  default artifact hiding, explicit unsupported streaming, non-loopback bind
  refusal by default, oversized body handling, and safe output redaction.
- Slice 5.1 marketplace readiness review exists at
  `docs/marketplace-readiness.md`. It concludes that marketplace
  requirements/design work is justified only inside local/mock proof, while
  production marketplace implementation, live provider onboarding, real-money
  settlement, custody, staking, moderation, and provider verification remain
  blocked.
- Slice 5.2 Marketplace Access And Dispute Evidence Read Model is implemented
  in `packages/marketplace` as a local/read-only evidence package. It consumes
  existing registry profiles, capability policy checks, contract metadata,
  receipts, manifests, and standards evidence to prove provider labels, policy
  compatibility, receipt access control, and redacted dispute evidence bundles
  without operating a production marketplace.
- Slice 6.1 Package Namespace And Release Metadata Strategy is implemented in
  `docs/agentic-gaskit/package-release-strategy.md` and package metadata
  tests. It keeps the current `@iota-gaskit/*` prerelease namespace, defers any
  `@agentic-gaskit/*` rename to a dedicated compatibility slice, checks
  public package metadata, and keeps real npm publication operator-gated.
- Slice 3.7 Device Access Lease Safety Gate is implemented in
  `docs/agentic-gaskit/device-access-safety-gate.md` and
  `scripts/roadmap-safety.test.ts`. It explicitly blocks physical device
  operation and keeps any future device access proof virtual or simulated until
  an owner-approved safety design exists.
- Slice 2.8 Live Proof Status Report currently reports these local blockers:
  `TESTNET_ENV_FILE_MISSING`, `IOTA_NAMES_LIVE_CONFIG_MISSING`,
  `IOTA_IDENTITY_LIVE_CONFIG_MISSING`, and
  `VC_TRUST_POLICY_CONFIG_MISSING`.
- `docs/agentic-gaskit/external-api-notes.md` was refreshed on 2026-06-10 for
  current IOTA Names GraphQL, IOTA Identity DID/VC, x402 v2, AP2 v0.2
  mandate/receipt, A2A Agent Card, A2A signed-card, and A2A task/message
  assumptions, including the local A2A loopback server proof boundary.
- Root build, test, typecheck, package dry-run, docs, smokes, readiness example,
  contract tests, and secret scan include the accounts, manifest, MCP,
  registry, contracts metadata, receipts, escrow/receipt/pay-per-call contract
  surfaces, x402/AP2/A2A standards bridges, agent escrow demo smoke, paid
  MCP-style tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP boundary smoke, and A2A
  local server smoke, marketplace read-model smoke, package dry-runs, docs
  check, and secret scan.

## What Is Not Complete

- Public signed Agent Card hosting, production Agent Card key management, live
  A2A discovery proof, live public A2A server operation beyond the local
  loopback smoke, streaming/push notification support, external A2A conformance
  proof, and production A2A authentication decisions are not implemented.
- Configured live IOTA Names proof, configured and passing IOTA Identity proof,
  live verifiable credential validation beyond the opt-in proof endpoint
  harness and local/mock trust-policy behavior, live
  standards-bridge proof, and expanded contract workflows beyond local
  escrow/receipt/pay-per-call/data-license/service-bounty/reputation-receipt/
  subscription metadata are not implemented.
- `npm run proof:live-status` is not live proof. It records blocker and
  ready-to-run status only; `npm run smoke:iota-names-live`,
  `npm run readiness:testnet`, or later live Identity/VC commands must pass
  before any live claim is made.
- Slice 2.3 and Slice 2.5 are locally verified only unless
  `smoke:iota-names-live` is run with operator-provided endpoint/name/address
  and passes. Localnet/testnet deployment smoke has not run, and the
  demo/escrow contract does not custody real funds.
- Real npm package publication is still not run. Any package namespace migration
  to `@agentic-gaskit/*` remains deferred to a dedicated compatibility slice.
- No `device_access_lease_v1` Move contract, SDK helper, receipt state,
  localnet/testnet deploy, live device workflow, physical-device approval, or
  device marketplace action is implemented.
- Production custody, KMS, and recovery/export are not designed or implemented.
- Production marketplace app/API implementation is not started. The local
  read-only Slice 5.2 package is not provider onboarding, public search UI,
  production session authorization, live settlement, provider verification,
  moderation, staking, bonding, custody, or a public marketplace launch.

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
8. `docs/marketplace-readiness.md`
9. `docs/agentic-gaskit/local-dirty-work-review.md`

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

At Slice 2.1 completion, the package was schema/validation only. Later slices
added local resolver/adapters and A2A Agent Card generation, but live IOTA
Names resolution, live IOTA Identity credential validation, IOTA RPC calls, and
testnet/mainnet services remain out of scope until a later explicit live-proof
slice.

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
  JWT validation, reverse-name enforcement, dashboard profile view, signed or
  public A2A Agent Card proof, or live testnet/manual resolution proof exists
  yet.

## Completed Slice 2.4

Implemented bounded local/mock IOTA Identity verification cache hardening and
resolved-profile capability policy denial handling.

Implementation commit:

- `9f10bad` feat: harden identity verification cache

This slice stays local by default. It does not call live IOTA Names, IOTA
Identity, IOTA RPC, IOTA Gas Station, localnet, testnet, mainnet, paid APIs, or
external identity providers in automated verification.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.4
- `docs/agentic-gaskit/prds/phase-2-identity-registry.md`
- `docs/agentic-gaskit/verification-hardening.md` Phase 2 gates
- `docs/marketplace-readiness.md` live identity/name proof gate

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `packages/registry/README.md`
- `packages/registry/src/iotaIdentityAdapter.test.ts`
- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/policy-gateway/src/capabilityCheck.test.ts`
- `packages/policy-gateway/src/capabilityCheck.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/iotaIdentityAdapter.test.ts
node --import tsx --test packages/policy-gateway/src/capabilityCheck.test.ts
node --import tsx --test packages/registry/src/resolveAgent.test.ts packages/registry/src/iotaIdentityAdapter.test.ts packages/registry/src/iotaNamesAdapter.test.ts packages/sdk/src/resolveAgent.test.ts packages/policy-gateway/src/capabilityCheck.test.ts
node --import tsx --test packages/registry/src/*.test.ts packages/policy-gateway/src/capabilityCheck.test.ts packages/sdk/src/resolveAgent.test.ts
npm run verify:local
npm run readiness:testnet
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan with 0 findings,
  `npm test` with 291 TypeScript tests, and `npm run typecheck`.
- Red tests failed before implementation for missing protected-action force
  refresh inside the TTL and missing resolved-profile policy evaluation.
- Focused identity adapter tests passed with 8 tests.
- Focused policy capability tests passed with 5 tests.
- Broader focused registry, SDK, and policy tests passed with 25 tests.
- Final focused registry, SDK, and policy tests passed with 39 tests.
- `npm run typecheck` passed.
- `npm run docs:check` passed.
- `npm run secrets:scan` passed with 267 tracked/staged/untracked text files
  checked and 0 findings.
- Final `npm run verify:local` passed with 297 TypeScript tests, 33 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  task/message smoke, testnet readiness example, package dry-runs, docs check,
  and secret scan.
- Final `git diff --check` passed.
- `npm run readiness:testnet` built successfully but stopped before live IOTA
  calls because `.env` is absent. The exact blocker was: "Readiness env file
  not found: .env".

Hardening notes:

- Identity verification cache entries record only successful DID and credential
  evidence and require an explicit finite positive TTL.
- Cache reads are keyed by profile identity, wallet status, profile status,
  revocation state, expiry, and credential references.
- Expired cache entries are deleted and never used for approval.
- Failed stale refresh fails closed as unverifiable profile resolution.
- Protected actions can set `forceRefresh` to delete the current cache entry
  before verification and detect revocation inside the TTL.
- Capability policy can evaluate `ResolveAgentResult` directly and deny stale,
  revoked, expired, unverifiable, or invalid profiles before granting a
  capability.
- This work does not claim Apex verification; verification used the repo-local
  npm, docs, readiness, and secret-scan checks listed above.

Known unproven claims:

- No live IOTA Names query, live IOTA Identity DID resolution, live credential
  JWT validation, trusted issuer policy, localnet, testnet, mainnet,
  production identity authority, provider verification, marketplace access
  control, or external standards proof exists yet.
- Slice 2.4 proves only local/mock bounded cache behavior.

Next recommended slice:

- Continue Packet C live readiness/proof only if operator credentials and
  endpoints are configured, or choose signed/live A2A discovery or marketplace
  access-control/dispute evidence as a local/read-only slice.

## Completed Slice 2.5

Implemented an opt-in IOTA Names live GraphQL resolution smoke for the existing
registry adapter.

Implementation commit:

- `70fd691` feat: add marketplace evidence read model

This slice does not run automatically during local verification. It is a
configured live smoke path for operator-owned IOTA Names endpoints and
name/address pairs. It does not call IOTA Gas Station, spend sponsored gas,
sign transactions, touch sponsor wallets, validate IOTA Identity credentials,
or prove production registry readiness.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.5
- `docs/agentic-gaskit/external-api-notes.md` IOTA Names notes
- `docs/testnet-readiness.md` opt-in IOTA Names resolution smoke
- official IOTA GraphQL docs for `resolveIotaNamesAddress`

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/marketplace-readiness.md`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`
- `scripts/iota-names-live-smoke.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/smoke-iota-names-live.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/iota-names-live-smoke.test.ts scripts/package-scripts.test.ts packages/registry/src/iotaNamesAdapter.test.ts
env -u IOTA_NAMES_GRAPHQL_URL -u IOTA_NAMES_NAME -u IOTA_NAMES_EXPECTED_ADDRESS npm run smoke:iota-names-live
npm run verify:local
git diff --check
```

Verification result:

- Focused IOTA Names adapter/live-smoke/script-wiring tests passed, including
  missing configuration, configured resolution, unsafe non-loopback HTTP
  endpoint denial, and resolved-address mismatch denial.
- The opt-in missing-config CLI proof returned blocker exit status `2` with
  `IOTA_NAMES_LIVE_CONFIG_MISSING` and missing variable names only.
- Final `npm run verify:local` passed with 328 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- Final secret scan checked 291 tracked/staged/untracked text files with 0
  findings.

Hardening notes:

- `smoke:iota-names-live` requires `IOTA_NAMES_GRAPHQL_URL`,
  `IOTA_NAMES_NAME`, and `IOTA_NAMES_EXPECTED_ADDRESS`.
- Missing required configuration exits with blocker status `2` and reports
  only variable names.
- The smoke accepts HTTPS endpoints and loopback HTTP endpoints only, avoiding
  accidental plain-HTTP live endpoints.
- The smoke uses the existing `resolveIotaNamesAddress(name) { address }`
  registry adapter path and fails closed on address mismatch.
- The command is intentionally not wired into `npm run verify:local`; local
  verification remains deterministic and does not contact live IOTA services.

Known unproven claims:

- No configured live IOTA Names run has passed unless an operator provides
  `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS` and reruns the smoke successfully.
- No live IOTA Identity DID resolution, live credential JWT validation, trusted
  issuer policy, reverse-name enforcement, production identity authority,
  provider verification, marketplace access control, or external standards
  proof is implemented by this slice.

Next recommended slice:

- Continue Packet C with live IOTA Names proof only when operator
  endpoint/name/address configuration is present, or choose the next local
  standards/marketplace access-control slice that does not require live
  credentials.

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

## Slice 3.2 Completion Evidence

Committed slice:

- `a933fdc feat: add pay per call tool flow`

Files changed:

- `contracts/pay_per_call_v1/Move.toml`
- `contracts/pay_per_call_v1/sources/pay_per_call.move`
- `contracts/pay_per_call_v1/tests/pay_per_call_tests.move`
- `examples/paid-mcp-tool/README.md`
- `examples/paid-mcp-tool/paid-mcp-tool-demo.test.ts`
- `examples/paid-mcp-tool/paid-mcp-tool-demo.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/sdk/src/contracts/payPerCall.test.ts`
- `packages/sdk/src/contracts/payPerCall.ts`
- `packages/sdk/src/index.ts`
- `scripts/package-scripts.test.ts`
- `scripts/run-move-tests.ts`
- `scripts/smoke-paid-mcp-tool.ts`
- `package.json`
- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/module-specs.md`
- `tmp/apex-workflow/pay-per-call-slice-3-2-scope.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/sdk/src/contracts/payPerCall.test.ts examples/paid-mcp-tool/paid-mcp-tool-demo.test.ts
npm run contracts:test
npm run build -w @iota-gaskit/receipts && npm run build -w @iota-gaskit/contracts-metadata && npm run build -w @iota-gaskit/sdk && node --import tsx --test packages/sdk/src/contracts/payPerCall.test.ts examples/paid-mcp-tool/paid-mcp-tool-demo.test.ts packages/contracts-metadata/src/registry.test.ts packages/receipts/src/receipts.test.ts scripts/package-scripts.test.ts
npm test
npm run typecheck
npm run verify:local
git diff --check
```

Evidence so far:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed because `payPerCall.js` and
  `paid-mcp-tool-demo.js` did not exist.
- `npm run contracts:test` now runs escrow, receipt, and pay-per-call Move
  packages.
- Pay-per-call Move tests pass for create/deliver, unauthorized delivery,
  double delivery denial, refund, and delivery-after-refund denial.
- Focused SDK/example/metadata/receipt/script tests pass after hardening:
  policy denial, failed payment, thrown payment confirmation, thrown tool
  invocation, blank evidence, and malformed runtime evidence all withhold paid
  results.
- Mid-slice `npm test` passed with 219 tests and `npm run typecheck` passed.
- Final `npm run verify:local` passed with 219 TypeScript tests, 13 Move tests
  across escrow/receipt/pay-per-call contracts, local gateway smoke, demo dApp
  smoke, browser wrapper smoke, agent escrow smoke, paid MCP tool smoke,
  readiness example, package dry-runs, docs check, and secret scan.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No real external payment rail, live MCP server, localnet/testnet/mainnet
  deployment, package-address proof, formal smart-contract audit, or IOTA Gas
  Station call was run for Slice 3.2.
- The pay-per-call package id is local metadata fixture data for policy tests,
  not a deployed address claim.

## Slice 4.1 Completion Evidence

Committed slice:

- `3c68e22 feat: add x402 standards bridge`

Files changed:

- `packages/manifest/src/index.ts`
- `packages/manifest/src/x402Mapping.ts`
- `packages/manifest/src/x402Mapping.test.ts`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/x402Receipt.ts`
- `packages/receipts/src/x402Receipt.test.ts`
- `packages/standards/README.md`
- `packages/standards/package.json`
- `packages/standards/src/index.ts`
- `packages/standards/src/x402.ts`
- `packages/standards/src/x402.test.ts`
- `packages/standards/tsconfig.build.json`
- `scripts/package-scripts.test.ts`
- `package.json`
- `package-lock.json`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `tmp/apex-workflow/x402-slice-4-1-scope.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/manifest/src/x402Mapping.test.ts packages/receipts/src/x402Receipt.test.ts packages/standards/src/x402.test.ts
npm run build -w @iota-gaskit/manifest && npm run build -w @iota-gaskit/receipts && npm run build -w @iota-gaskit/standards && node --import tsx --test packages/manifest/src/x402Mapping.test.ts packages/receipts/src/x402Receipt.test.ts packages/standards/src/x402.test.ts
npm install --package-lock-only --ignore-scripts
npm run typecheck
npm run verify:local
npm run build -w @iota-gaskit/standards && npm pack --dry-run -w @iota-gaskit/standards
git diff --check
```

Evidence:

- Official x402 docs and source types were rechecked on 2026-06-10 before
  coding. The implemented local bridge targets x402 v2 `PaymentRequired`
  objects with `resource` plus `accepts[]` payment requirements.
- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed because `x402Mapping.js`, `x402Receipt.js`, and
  `packages/standards/src/index.js` did not exist.
- Focused x402 tests pass for v2 requirement-to-manifest mapping,
  unsupported protocol version denial, unsupported scheme denial, malformed
  CAIP-2 network id denial, invalid accepted-index denial, external payment
  receipt linkage, payment metadata redaction, local mock facilitator success,
  policy denial before facilitator calls, verify failure before settlement/tool
  invocation, settle failure before tool invocation, and unsupported x402
  version denial.
- Hardening changed the standards helper to use the real
  `evaluateAgentActionPolicy` path instead of a duplicate local policy
  evaluator.
- Final `npm run verify:local` passed with 231 TypeScript tests, 13 Move tests
  across escrow/receipt/pay-per-call contracts, local gateway smoke, demo dApp
  smoke, browser wrapper smoke, agent escrow smoke, paid MCP tool smoke,
  readiness example, package dry-runs including `@iota-gaskit/standards`, docs
  check, and secret scan.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No production x402 facilitator, real payment credential, live external
  payment rail, localnet/testnet/mainnet deployment, formal protocol
  conformance suite, or live IOTA Gas Station call was run for Slice 4.1.
- The x402 facilitator flow is a local mock integration. It proves sequencing,
  policy-gateway enforcement, receipt linkage, and redaction, not live
  settlement.

Historical next recommendation before Slice 4.2 was implemented:

- Slice 4.2 AP2 Mandate Mapping.

## Completed Slice 4.2

Implemented AP2 closed checkout/payment mandate compatibility in
`packages/manifest`, `packages/receipts`, and `packages/standards`.

Implementation commit:

- `8e228cf` feat: add ap2 mandate bridge

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 4.2
- `docs/agentic-gaskit/codex-active-goal.md` as of the Slice 4.2 session
- Current official AP2 spec and schema links in
  `docs/agentic-gaskit/external-api-notes.md`

Changed files:

- `packages/manifest/src/ap2Mapping.ts`
- `packages/manifest/src/ap2Mapping.test.ts`
- `packages/manifest/src/index.ts`
- `packages/receipts/src/ap2Receipt.ts`
- `packages/receipts/src/ap2Receipt.test.ts`
- `packages/receipts/src/index.ts`
- `packages/standards/src/ap2.ts`
- `packages/standards/src/ap2.test.ts`
- `packages/standards/src/index.ts`
- `packages/standards/README.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/CODEBASE_MAP.md`
- `tmp/apex-workflow/ap2-slice-4-2-scope.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/manifest/src/ap2Mapping.test.ts packages/receipts/src/ap2Receipt.test.ts packages/standards/src/ap2.test.ts
npm run build -w @iota-gaskit/manifest && npm run build -w @iota-gaskit/receipts && npm run build -w @iota-gaskit/standards && node --import tsx --test packages/manifest/src/ap2Mapping.test.ts packages/receipts/src/ap2Receipt.test.ts packages/standards/src/ap2.test.ts
npm run typecheck
npm test
git diff --check
npm run verify:local
```

Evidence:

- Official AP2 specification and schema files were rechecked on 2026-06-10
  before coding. The implemented local bridge targets closed checkout/payment
  mandate `vct` strings `mandate.checkout.1` and `mandate.payment.1`.
- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed because AP2 mapping, AP2 receipt, and AP2 standards
  exports did not exist.
- Focused AP2 tests pass for mandate-to-manifest mapping, unsupported mandate
  version denial, agentic Trusted Surface denial, checkout/payment reference
  mismatch denial, AP2 receipt linkage, failed AP2 receipt state, receipt
  reference mismatch denial, sensitive metadata redaction, local mock AP2
  success, policy denial before receipt issuance/execution, payment receipt
  failure before execution, and standards-layer receipt mismatch rejection.
- Hardening added receipt-reference validation so checkout receipts must bind to
  the checkout hash and payment receipts must bind to the payment mandate id.
- Final `npm run verify:local` passed with 244 TypeScript tests, 13 Move tests
  across escrow/receipt/pay-per-call contracts, local gateway smoke, demo dApp
  smoke, browser wrapper smoke, agent escrow smoke, paid MCP tool smoke,
  readiness example, package dry-runs including `@iota-gaskit/standards`, docs
  check, and secret scan.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No live AP2 participant, real card/bank/wallet credential, PSP/PISP,
  production payment processor, live external payment rail, localnet/testnet/
  mainnet deployment, formal AP2 conformance suite, or live IOTA Gas Station
  call was run for Slice 4.2.
- The AP2 flow is a local mock integration. It proves mapping, fail-closed
  boundaries, policy-gateway sequencing, receipt linkage, dispute references,
  and redaction, not live AP2/payment settlement.

Historical next recommendation before Slice 4.3 was implemented:

- Slice 4.3 A2A Agent Card.

## Completed Slice 4.3

Implemented A2A Agent Card mapping from Agentic GasKit Agent Profiles in
`packages/registry` and exported it through `packages/standards`.

Implementation commit:

- `2a72b62` feat: add a2a agent card mapping

Acceptance is defined in:

- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`
- `docs/agentic-gaskit/execution-slices.md` Slice 4.3
- `docs/agentic-gaskit/codex-active-goal.md` as of the Slice 4.3 session
- Current official A2A spec and protobuf links in
  `docs/agentic-gaskit/external-api-notes.md`

Changed files:

- `packages/registry/src/a2aCard.ts`
- `packages/registry/src/a2aCard.test.ts`
- `packages/registry/src/index.ts`
- `packages/registry/README.md`
- `packages/standards/src/a2a.ts`
- `packages/standards/src/a2a.test.ts`
- `packages/standards/src/index.ts`
- `packages/standards/package.json`
- `packages/standards/README.md`
- `package-lock.json`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/CODEBASE_MAP.md`
- `tmp/apex-workflow/a2a-slice-4-3-scope.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/a2aCard.test.ts packages/standards/src/a2a.test.ts
npm run build -w @iota-gaskit/registry
npm run build -w @iota-gaskit/standards
npm run build -w @iota-gaskit/registry && npm run build -w @iota-gaskit/standards && node --import tsx --test packages/registry/src/a2aCard.test.ts packages/standards/src/a2a.test.ts
npm run typecheck
npm test
git diff --check
npm run verify:local
```

Evidence:

- Official A2A specification and protobuf files were rechecked on 2026-06-10
  before coding. The implemented local bridge targets the current Agent Card
  fields, `/.well-known/agent-card.json`, protocol version `1.0`, and the
  `HTTP+JSON` binding by default.
- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed because A2A Agent Card exports did not exist.
- Focused A2A tests pass for active profile-to-card mapping, current
  `supportedInterfaces`/auth/mode/capability/skill field shape,
  revoked/expired profile denial, missing A2A endpoint denial, unsupported
  local protocol version denial, malformed auth requirement denial, private
  extension metadata denial, and omission of credential refs, revocation refs,
  signer refs, wallet internals, payment addresses, and private profile
  metadata.
- Hardening added validation that final public cards cannot include private
  Agent Profile field names and that security requirements must reference
  declared security schemes.
- Final `npm run verify:local` passed with 250 TypeScript tests, 13 Move tests
  across escrow/receipt/pay-per-call contracts, local gateway smoke, demo dApp
  smoke, browser wrapper smoke, agent escrow smoke, paid MCP tool smoke,
  readiness example, package dry-runs including `@iota-gaskit/standards`, docs
  check, and secret scan.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No live A2A server, public well-known route, signed Agent Card, task/message
  protocol operation, external A2A client, localnet/testnet/mainnet deployment,
  formal A2A conformance suite, or live IOTA Gas Station call was run for Slice
  4.3.
- The A2A bridge is a local card-generation adapter. It proves current field
  mapping, fail-closed profile states, auth declaration shape, and public-card
  redaction, not live A2A interoperability.

Next recommended slice:

- Do not start production marketplace implementation from this handoff. Choose
  one explicit next slice from the remaining readiness gaps, such as configured
  live IOTA Names/Identity proof, live/public A2A discovery proof, package
  namespace/release strategy, production API/session authorization design, or
  another expanded contract workflow if still in scope.

## Completed Slice 5.1

Created `docs/marketplace-readiness.md`.

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 5.1 Marketplace Readiness
  Gate.
- `docs/agentic-gaskit/prds/phase-5-marketplace.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 5 gate and marketplace
  compliance/security escalation rules.

Evidence:

- The readiness review cites the previous Slice 4.3 full `npm run
  verify:local` proof as local evidence for Phases 1-4 primitives.
- The review separates local/mock proof from live IOTA testnet, production
  payment, provider verification, custody, moderation, and public marketplace
  proof.
- The review lists marketplace non-goals and unresolved production gates.
- Baseline and final docs/secret/whitespace checks were run for the docs-only
  slice.
- `npm test` passed with 250 TypeScript tests.
- `npm run typecheck` passed.

Known unproven claims:

- No marketplace app, API, provider onboarding, search UI, access-control test,
  dispute evidence walkthrough, data-license workflow, live payment settlement,
  live IOTA Names/Identity proof, live A2A discovery, localnet/testnet/mainnet
  deployment, provider verification, moderation process, custody, staking, or
  production operation was implemented by Slice 5.1.
- Slice 5.1 is a readiness decision. It does not approve production
  marketplace implementation.

## Completed Slice 5.2

Implemented `packages/marketplace` as a read-only local marketplace evidence
model.

Implementation commit:

- `70fd691` feat: add marketplace evidence read model

This slice stays local. It does not create a production marketplace UI/API,
provider onboarding, public search, live settlement, custody, staking, bonding,
moderation, provider verification, public scoring, or marketplace action
execution.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 5.2 Marketplace Access And
  Dispute Evidence Read Model.
- `docs/marketplace-readiness.md` marketplace non-goals and production gates.
- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet G marketplace
  working product boundary.

Changed files:

- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package-lock.json`
- `package.json`
- `packages/marketplace/README.md`
- `packages/marketplace/package.json`
- `packages/marketplace/src/index.ts`
- `packages/marketplace/src/marketplace.test.ts`
- `packages/marketplace/tsconfig.build.json`
- generated `packages/marketplace/dist/`
- `scripts/package-scripts.test.ts`
- `scripts/smoke-marketplace-read-model.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/marketplace/src/marketplace.test.ts scripts/iota-names-live-smoke.test.ts scripts/package-scripts.test.ts packages/registry/src/iotaNamesAdapter.test.ts
npm run smoke:marketplace-read-model
npm run verify:local
git diff --check
```

Verification result:

- Focused marketplace package and package-script tests passed, including
  provider listing labels, policy compatibility, contract metadata summaries,
  buyer/provider/operator/reviewer receipt access, dispute evidence stable
  hashing, and redaction of private prompt, bearer token, signer, wallet, and
  payment-secret material.
- `npm run smoke:marketplace-read-model` passed with `provider.profileLabel=active`,
  `policy.allowed=true`, `buyerReceipt.allowed=true`,
  `strangerReceipt.allowed=false`, a stable `sha256:` dispute bundle hash, and
  `logLeaksSecretMaterial=false`.
- Final `npm run verify:local` passed with 328 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- Final secret scan checked 291 tracked/staged/untracked text files with 0
  findings.

Hardening notes:

- Provider listings preserve `providerVerification: "unverified"` even when
  local evidence labels are present.
- Policy compatibility is computed through existing profile capability policy
  checks, not marketplace-only hints.
- Contract templates are read from the existing contract metadata registry.
- Receipt views enforce buyer/provider/operator/reviewer access and deny
  unrelated viewers.
- Dispute evidence bundles link manifest, receipt, contract template,
  transaction digest, and standards evidence while redacting private prompts,
  bearer tokens, signer refs, wallet internals, payment credentials, and
  provider private metadata.
- The smoke is wired into `npm run verify:local`.

Known unproven claims:

- No production marketplace API/session authorization, provider onboarding,
  public listing/search UI, public scoring, moderation, live payment
  settlement, live provider access proof, live IOTA Names/Identity proof,
  provider verification, custody, staking, bonding, or marketplace action
  execution is implemented by this slice.

Next recommended slice:

- Continue with configured live IOTA Names proof when operator
  endpoint/name/address values are present, or choose a non-live hardening slice
  such as package namespace/release strategy or production marketplace
  API/session authorization design.

## Completed Slice 6.1

Implemented package namespace and release metadata strategy.

Implementation commit:

- `6f1b407` docs: codify package release strategy

This slice keeps the current conservative `@iota-gaskit/*` prerelease package
namespace and explicitly defers any `@agentic-gaskit/*` rename to a dedicated
compatibility slice. It does not run or claim real npm publication.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 6.1 Package Namespace And
  Release Metadata Strategy.
- `docs/agentic-gaskit/package-release-strategy.md`.
- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet F Package
  Namespace, Release, And Installability.
- `docs/agentic-gaskit/migration-plan.md` package namespace decision.

Changed files:

- `README.md`
- `apps/docs-site/docs.config.mjs`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/migration-plan.md`
- `docs/agentic-gaskit/package-release-strategy.md`
- `scripts/package-publish.test.ts`
- `scripts/package-scripts.test.ts`

Commands run:

```bash
git status --short --branch
node --import tsx --test scripts/package-publish.test.ts scripts/package-scripts.test.ts
npm run docs:check
npm run secrets:scan
npm run typecheck
npm run verify:local
git diff --check
```

Verification result:

- Focused package release and package-script tests passed, including root
  `private: true`, conservative public package namespace checks, prerelease
  version checks, ESM entrypoint/export checks, package file allow-lists,
  public `next` publish config, internal dependency pins, private app workspace
  non-publication, and dynamic root build/pack coverage for every public
  package workspace.
- `npm run docs:check` passed with 29 generated HTML pages from 28 Markdown
  sources.
- `npm run typecheck` passed.
- Final `npm run verify:local` passed with 333 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- Final secret scan checked 292 tracked/staged/untracked text files with 0
  findings.

Hardening notes:

- Root package publication remains blocked by `private: true`.
- Public package metadata checks cover namespace, version, ESM entrypoints,
  exports, file allow-list, license, side-effect flag, Node engine, public
  prerelease publish config, and internal dependency pins.
- Private app workspaces are explicitly checked as non-publishable.
- Root `build` and `pack:check` now dynamically verify coverage for every
  public package workspace so newly added packages cannot silently skip package
  dry-run verification.
- Real `npm publish` remains operator-gated and was not run.

Known unproven claims:

- No package is published to npm.
- No `@agentic-gaskit/*` package namespace migration, downstream compatibility
  proof, npm provenance/signing, changelog, registry credential handling, or
  release automation is implemented by this slice.

Next recommended slice:

- Continue with configured live IOTA Names proof when operator endpoint/name/
  address values are present, choose production marketplace API/session
  authorization design, or choose a live/public A2A discovery and conformance
  blocker/proof slice.

## Completed Slice 3.7

Implemented Device Access Lease Safety Gate.

Implementation commit:

- `b773f9e` docs: add device access safety gate

This slice explicitly blocks physical device access and records that any future
device-access proof must start with virtual or simulated resources only. It is
a verified deferment and hardening gate, not a `device_access_lease_v1`
implementation.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 3.7 Device Access Lease
  Safety Gate.
- `docs/agentic-gaskit/device-access-safety-gate.md`.
- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet B Complete
  Remaining Phase 3 Contract Library Slices.
- `docs/agentic-gaskit/prds/phase-3-contract-block-library.md` device lease
  physical-safety escalation trigger.
- `docs/marketplace-readiness.md` no IoT-heavy marketplace gate.

Changed files:

- `apps/docs-site/docs.config.mjs`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/device-access-safety-gate.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/module-specs.md`
- `docs/agentic-gaskit/roadmap.md`
- `docs/marketplace-readiness.md`
- `docs/overview.md`
- `scripts/roadmap-safety.test.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/roadmap-safety.test.ts
npm run verify:local
git diff --check
```

Verification result:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before editing.
- Initial focused safety test failed because the new gate said "local or
  simulated workflow" where the intended invariant was "virtual or simulated
  workflow"; the doc was tightened and the focused test then passed.
- Focused roadmap safety test passed with 2 tests. It proves Slice 3.7 is
  present, the physical-device blocker is explicit, no
  `contracts/device_access_lease_v1` path exists, and root build/pack/verify
  scripts do not expose device access as a working product path.
- `npm run docs:check` passed with 30 generated HTML pages from 29 Markdown
  sources.
- `npm run secrets:scan` passed with 294 tracked/staged/untracked text files
  and 0 findings.
- Final `npm run verify:local` passed with 335 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- Physical device operation remains blocked.
- Future work is limited to virtual, simulated, emulator, or non-physical API
  fixtures until owner-approved physical safety design exists.
- The gate names physical-device, provider-accountability, revocation,
  emergency-stop, credential, privacy, dispute, compliance, and marketplace
  blockers.
- The docs and regression test intentionally avoid claiming a Move contract,
  SDK helper, receipt state, package metadata, marketplace action,
  localnet/testnet deployment, or live device workflow.

Known unproven claims:

- No `device_access_lease_v1` Move contract, SDK helper, receipt state,
  contract metadata, package script, localnet/testnet deployment, live device
  workflow, physical-device safety design, production provider verification,
  compliance review, or marketplace operation is implemented.

Next recommended slice:

- Continue with configured live IOTA Names proof when operator endpoint/name/
  address values are present, or choose another remaining proof gap such as
  live IOTA Identity/VC validation, public/live A2A discovery and conformance
  blocker/proof, live/testnet standards bridge proof, or package publication
  readiness. Do not implement physical device access without a new
  owner-approved safety design.

## Completed Slice 2.6

Implemented Live Proof Status Report.

Implementation commit:

- `2ccfe26` feat: add live proof status report

This slice adds `npm run proof:live-status`, a non-networked status command
that reports which live/testnet proof paths are ready to run and which are
blocked. It does not contact IOTA Names, IOTA Identity, IOTA RPC, Gas Station,
payment facilitators, A2A endpoints, npm, or any live service.

Acceptance is defined in:

- `docs/agentic-gaskit/execution-slices.md` Slice 2.6 Live Proof Status
  Report.
- `docs/agentic-gaskit/live-proof-status.md`.
- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet C Live IOTA
  Names/Identity And VC Validation.
- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet H Final Product
  E2E And Launch-Readiness Audit.

Changed files:

- `apps/docs-site/docs.config.mjs`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/overview.md`
- `package.json`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/package-scripts.test.ts`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/live-proof-status.test.ts scripts/package-scripts.test.ts
npm run proof:live-status
npm run verify:local
git diff --check
```

Verification result:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before editing.
- Initial focused status test failed because the command resolved `.env`
  relative to the process cwd instead of the supplied cwd; path handling was
  fixed and focused tests then passed.
- Focused live proof status and package-script tests passed with 34 tests.
- A hardening pass found optional `.env` loading could throw before the
  readiness checker reported a safe blocker; optional `.env` loading now fails
  closed to an empty config and the focused tests still pass.
- `npm run proof:live-status` passed on the current machine and reported
  blocked status with these exact codes:
  `TESTNET_ENV_FILE_MISSING`, `IOTA_NAMES_LIVE_CONFIG_MISSING`,
  `IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED`, and
  `VC_TRUST_POLICY_UNDEFINED`.
- Final `npm run verify:local` passed with 340 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- Final docs check generated 31 HTML pages from 30 Markdown sources.
- Final secret scan checked 297 tracked/staged/untracked text files with 0
  findings.
- `git diff --check` passed.

Hardening notes:

- The command returns status successfully even when proofs are blocked; blocked
  with exact reason is valid evidence for this goal.
- Missing configuration output names variables and readiness check ids only.
- Unsafe IOTA Names HTTP endpoints are blocked without printing endpoint
  values.
- The command is intentionally not part of `npm run verify:local` and does not
  replace live smoke commands.

Known unproven claims:

- No live IOTA Names resolution, live IOTA Identity DID resolution, live VC
  signature/revocation validation, IOTA testnet sponsorship, Gas Station
  availability, standards provider interoperability, package publication,
  public A2A discovery, production marketplace, custody, payment, or provider
  verification is proven by this slice.

Next recommended slice:

- Continue Packet C by implementing a live IOTA Identity/VC trust-policy proof
  design or runner, or run `npm run smoke:iota-names-live` only when
  operator-provided `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS` are configured outside committed files.

## Completed Slice 4.4

Implemented local A2A well-known serving proof for canonical Agent Card
discovery.

Implementation commit:

- `7619375` feat: add a2a well-known serving

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 4.4 A2A Well-Known Serving.
- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`.
- `docs/agentic-gaskit/verification-hardening.md` standards bridge and
  secret/log redaction boundaries.
- `docs/agentic-gaskit/external-api-notes.md` A2A Agent Card path and media
  type assumptions refreshed on 2026-06-10.

Changed files:

- `examples/a2a-well-known/`
- `packages/registry/src/a2aWellKnown.ts`
- `packages/registry/src/a2aWellKnown.test.ts`
- `packages/registry/src/index.ts`
- `packages/registry/README.md`
- `packages/standards/src/a2a.ts`
- `packages/standards/src/a2a.test.ts`
- `packages/standards/README.md`
- `scripts/smoke-a2a-well-known.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
npm run build && node --import tsx --test packages/registry/src/a2aWellKnown.test.ts packages/standards/src/a2a.test.ts examples/a2a-well-known/a2a-well-known-demo.test.ts scripts/package-scripts.test.ts
npm run smoke:a2a-well-known
npm run docs:check
npm run verify:local
git diff --check
```

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed because A2A well-known helper exports, the local
  demo module, and the smoke script wiring did not exist.
- Focused tests pass for canonical `GET /.well-known/agent-card.json`, content
  type `application/a2a+json`, cache-control default `no-store`, active profile
  card generation, private-field omission, non-GET method denial, legacy
  `/.well-known/agent.json` denial, revoked/expired profile denial, standards
  package re-export, and root verification script wiring.
- `npm run smoke:a2a-well-known` passes and reports canonical status 200,
  legacy path status 404, revoked status 410, and false for signer-ref,
  wallet-id, credential-ref, and payment-address exposure.
- Final `npm run verify:local` passed after the A2A well-known smoke was wired
  into the local verification script.
- `git diff --check` passed before the implementation commit.

Known unproven claims:

- No live A2A server, signed Agent Card, public well-known hosting, task/message
  protocol operation, external A2A client, localnet/testnet/mainnet deployment,
  formal A2A conformance suite, or live IOTA Gas Station call was run for Slice
  4.4.
- The A2A well-known helper is a local response-generation surface. It proves
  canonical path behavior, fail-closed inactive profile handling, standards
  package export, smoke wiring, and public response redaction, not live A2A
  interoperability.

Next recommended slice:

- Do not start production marketplace implementation from this handoff. Choose
  one explicit next slice from the readiness gaps, such as a read-only
  marketplace architecture/spec slice, marketplace access-control/
  dispute-evidence proof, live IOTA Names/Identity proof, signed/live A2A
  discovery proof, or another expanded contract workflow such as service bounty
  or subscription.

## Completed Slice 4.5

Implemented local/mock A2A Task And Message Local Operations.

Implementation commit:

- `f77f0be` feat: add a2a task message flow

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 4.5 A2A Task And Message
  Local Operations.
- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 4 A2A bridge gate and
  log privacy invariants.
- `docs/agentic-gaskit/external-api-notes.md` current A2A task/message
  operation assumptions.

Changed files:

- `examples/a2a-task-message/`
- `packages/standards/src/a2aTask.ts`
- `packages/standards/src/a2aTask.test.ts`
- `packages/standards/src/index.ts`
- `scripts/smoke-a2a-task-message.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation and public docs

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/standards/src/a2aTask.test.ts examples/a2a-task-message/a2a-task-message-demo.test.ts scripts/package-scripts.test.ts
npm run smoke:a2a-task-message
npm run build -w @iota-gaskit/standards && node --import tsx --test packages/standards/src/a2a.test.ts packages/standards/src/a2aTask.test.ts examples/a2a-task-message/a2a-task-message-demo.test.ts scripts/package-scripts.test.ts
npm run build -w @iota-gaskit/standards && node --import tsx --test packages/standards/src/a2a.test.ts packages/standards/src/a2aTask.test.ts examples/a2a-task-message/a2a-task-message-demo.test.ts scripts/package-scripts.test.ts && npm run smoke:a2a-task-message
npm run verify:local
git diff --check
```

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Focused red state failed before implementation because A2A task/message
  exports, example demo, and smoke script wiring did not exist.
- Focused A2A tests pass for approved completed task creation, unsupported
  protocol-version denial, malformed message denial, policy-denied rejected
  task state without artifacts, input-required follow-up, terminal follow-up
  denial, context-mismatch denial, get/list/cancel behavior, artifact omission
  by default, prompt/credential/signer/wallet/payment/file-byte redaction, and
  terminal failed/rejected/canceled artifact denial.
- `npm run smoke:a2a-task-message` passes and reports completed, rejected,
  follow-up completed, canceled, four listed tasks, and
  `logLeaksSecretMaterial=false`.
- Final `npm run verify:local` passed with 279 TypeScript tests, 23 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke, A2A
  well-known smoke, A2A task/message smoke, readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- Store writes redact task objects before persistence so direct `put()` calls do
  not become a secret retention path.
- Canceling a working task drops artifacts from stored task state.
- Terminal failed, rejected, and canceled processor outcomes cannot attach
  artifacts.
- Inline file bytes and signed URL token/signature query values are redacted
  from log-safe task output.

Known unproven claims:

- No live A2A server, external A2A client, public hosting, signed Agent Card,
  streaming, push notification, external conformance suite, live IOTA RPC, IOTA
  Gas Station, localnet/testnet/mainnet deployment, production authentication,
  production marketplace/provider workflow, custody, or live payment settlement
  was implemented by Slice 4.5.
- The A2A task/message helper proves local task state modeling, Agentic
  manifest/policy binding, and redaction behavior only.

Next recommended slice:

- Do not start production marketplace implementation from this handoff. Choose
  one explicit next slice from the remaining readiness gaps, such as signed
  Agent Card design/proof, live IOTA Names/Identity proof, read-only
  marketplace access-control/dispute-evidence proof, or another local contract
  workflow.

## Completed Slice 4.8

Implemented local/mock A2A loopback server smoke proof.

Implementation commit:

- `a40b62f` (`feat: add local a2a node server smoke`)

Primary docs and gates used:

- `docs/agentic-gaskit/full-roadmap-execution-goal.md` Packet D A2A Live
  Discovery, Server, Auth, And Conformance.
- `docs/agentic-gaskit/execution-slices.md` Slice 4.8 A2A Local Loopback
  Server Smoke.
- `docs/agentic-gaskit/verification-hardening.md` Phase 4 A2A bridge gate and
  secret/redaction gates.
- `docs/agentic-gaskit/handoff-next-product-build.md` Slice 4.7 next-step
  recommendation.

Code and docs added or changed:

- `examples/a2a-local-server/`
- `packages/standards/src/a2aNodeServer.ts`
- `packages/standards/src/a2aNodeServer.test.ts`
- `packages/standards/src/index.ts`
- `scripts/smoke-a2a-local-server.ts`
- `package.json`
- `scripts/package-scripts.test.ts`
- `README.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`

Focused commands already run:

```bash
node --import tsx --test packages/standards/src/a2aNodeServer.test.ts packages/standards/src/a2aHttp.test.ts packages/standards/src/a2aTask.test.ts
node --import tsx --test scripts/package-scripts.test.ts examples/a2a-local-server/a2a-local-server-demo.test.ts
npm run smoke:a2a-local-server
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
npm run verify:local
git diff --check
```

Focused evidence:

- Baseline `npm run typecheck` failed in the draft state because the example
  carried a private server wrapper with a missing `HttpJsonResponse` type and a
  nullable address guard. The implementation moved server lifecycle into the
  standards helper and fixed the example.
- Focused standards tests pass for the exported Node server helper, loopback
  host default, explicit non-loopback opt-in guard, real HTTP Agent Card
  discovery, bearer auth denial, authorized message send, task read/list/cancel,
  default artifact hiding, explicit artifact opt-in, unsupported streaming
  `501`, malformed body handling, oversized body `413`, safe JSON errors, and
  response redaction.
- Focused A2A local server demo test passes for signed Agent Card discovery
  over real HTTP, trusted-key signature verification, bearer auth denial,
  authorized message send, task read/list/cancel, default artifact hiding,
  unsupported streaming `501`, and redacted formatted output.
- Package-script wiring test passes and proves `smoke:a2a-local-server` is
  included in `npm run verify:local`.
- `npm run smoke:a2a-local-server` passes and reports loopback binding,
  Agent Card status `200`, signature verification `true`, unauthorized status
  `401`, task status `TASK_STATE_WORKING`, hidden artifacts `true`, list count
  `1`, canceled status `TASK_STATE_CANCELED`, streaming status `501`, and no
  secret-looking output leak.
- `npm run docs:check` passes after Slice 4.8 changes.
- `npm run secrets:scan` passes after Slice 4.8 changes with 283 checked
  tracked/staged/untracked text files and 0 findings.
- `npm test` passes with 316 TypeScript tests.
- `npm run typecheck` passes.
- `npm run verify:local` passes locally with 316 TypeScript tests, 33 Move
  tests, typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent
  escrow smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP boundary smoke, A2A
  local server smoke, testnet readiness example, package dry-runs, docs check,
  and secret scan.
- `git diff --check` passes.

Boundaries and non-claims:

- This is a loopback-only server smoke. It does not publish an Agent Card or
  operate a live public A2A server.
- Agent Card signing uses deterministic local key material for proof only. It
  does not define production JWKS hosting, key rotation, revocation, or provider
  verification.
- Streaming and push notifications remain unsupported.
- External A2A conformance and live discovery remain unproven.
- No IOTA testnet or mainnet operation was performed by this slice.

Next recommended slice:

- Continue Packet D with external A2A conformance-blocker documentation, public
  hosting/key-management design, or switch to Packet C live IOTA Names/Identity
  proof if operator credentials/endpoints are configured.

## Completed Slice 4.7

Implemented local/mock A2A signed Agent Card proof.

Implementation commit:

- `1ecb76f` (`feat: add signed a2a agent cards`)

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 4.7 A2A Signed Agent Card
  Local Proof.
- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 4 A2A bridge gate and
  log privacy invariants.
- `docs/agentic-gaskit/external-api-notes.md` current A2A Agent Card signing
  assumptions.

Changed files:

- `examples/a2a-signed-card/`
- `packages/registry/src/a2aCard.ts`
- `packages/registry/src/a2aCard.test.ts`
- `packages/registry/src/a2aWellKnown.test.ts`
- `packages/registry/README.md`
- `packages/standards/src/a2a.ts`
- `packages/standards/README.md`
- `scripts/smoke-a2a-signed-card.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation and public docs

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/a2aCard.test.ts packages/registry/src/a2aWellKnown.test.ts
node --import tsx --test packages/registry/src/a2aCard.test.ts packages/registry/src/a2aWellKnown.test.ts examples/a2a-signed-card/a2a-signed-card-demo.test.ts scripts/package-scripts.test.ts
npm run smoke:a2a-signed-card
git diff --check
npm run readiness:testnet
npm run verify:local
```

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Red focused signed-card tests failed before implementation because
  `canonicalizeA2AAgentCard`, `signA2AAgentCard`, and
  `verifyA2AAgentCardSignature` were not exported yet.
- Focused registry tests pass for local EdDSA JWS Agent Card signing, JWS
  protected header fields, canonical unsigned payload stability,
  `signatures` exclusion from canonicalization, trusted-key verification,
  tamper denial, wrong-key denial, required-key mismatch denial, unsupported
  algorithm denial, malformed protected-header denial, stale/not-yet-valid
  signature denial, blank key-id denial, invalid JWKS URL denial, invalid
  signature-time denial, and private public-card metadata denial.
- Focused well-known tests pass for serving signed Agent Cards through existing
  response options without leaking private profile fields.
- `npm run smoke:a2a-signed-card` passes and reports signature count 1,
  protected header `EdDSA`/`JOSE`/`agent-card-key-1`, JWKS URL and expiry
  presence, `verificationOk=true`, tamper denial
  `A2A_SIGNATURE_INVALID`, expiry denial `A2A_SIGNATURE_EXPIRED`, unsigned
  denial `A2A_SIGNATURE_MISSING`, and no signer ref, wallet id, credential
  ref, or private key exposure.
- `node --import tsx --test scripts/package-scripts.test.ts` passes and proves
  the smoke is wired into `npm run verify:local`.
- `npm test` passes with 311 TypeScript tests.
- `npm run typecheck` passes.
- `npm run docs:check` passes after documentation updates.
- `npm run secrets:scan` passes after Slice 4.7 changes with 277 checked
  tracked/staged/untracked text files and 0 findings.
- `git diff --check` passes.
- `npm run readiness:testnet` builds and stops before live testnet proof because
  this checkout has no `.env` configured.
- `npm run verify:local` passes locally with 311 TypeScript tests, 33 Move
  tests, typecheck, local gateway smoke, demo dApp smoke, browser wrapper
  smoke, agent escrow smoke, paid MCP tool smoke, data-license smoke,
  service-bounty smoke, reputation-receipt smoke, subscription smoke, A2A
  well-known smoke, A2A signed-card smoke, A2A task/message smoke, A2A HTTP
  smoke, testnet readiness example, package dry-runs, docs check, and secret
  scan.

Hardening notes:

- Signing is an explicit local option on Agent Card generation and well-known
  response helpers; unsigned cards remain supported for local-only flows.
- The signed payload excludes `signatures`, so added or rotated signatures do
  not create a circular payload.
- Verification uses a caller-provided trusted key map and optional required key
  id; it does not fetch remote JWKS, trust arbitrary `kid` values, or perform
  production provider verification.
- Temporal `nbf`/`exp` checks fail closed for stale or not-yet-valid
  signatures, but Slice 4.7 does not define production key rotation or
  revocation policy.
- Public card private-field scanning still runs before signing, so signatures
  cannot legitimize leaked signer refs, wallet internals, credential refs,
  revocation refs, payment credentials, or metadata.

Known unproven claims:

- No public Agent Card hosting, production JWKS hosting, production key
  rotation/revocation, external A2A conformance, live A2A discovery, live public
  A2A server, streaming, push notification, production authentication, live IOTA
  RPC, IOTA Gas Station, localnet/testnet/mainnet deployment, production
  marketplace/provider workflow, custody, or live payment settlement was
  implemented by Slice 4.7.
- The signed-card work proves deterministic local signing and trusted-key
  verification behavior only.

Next recommended slice:

- Continue Packet D with external A2A conformance-blocker documentation or
  local public-server smoke, or switch to Packet C live IOTA Names/Identity
  proof if operator credentials/endpoints are configured.

## Completed Slice 4.6

Implemented local/mock A2A HTTP boundary proof.

Implementation commit:

- `ba578aa` (`feat: add local a2a http boundary`)

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 4.6 A2A Local HTTP Boundary.
- `docs/agentic-gaskit/prds/phase-4-standards-bridges.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 4 A2A bridge gate and
  log privacy invariants.
- `docs/agentic-gaskit/external-api-notes.md` current A2A HTTP+JSON operation
  mapping assumptions.

Changed files:

- `examples/a2a-http/`
- `packages/standards/src/a2aHttp.ts`
- `packages/standards/src/a2aHttp.test.ts`
- `packages/standards/src/index.ts`
- `packages/standards/README.md`
- `scripts/smoke-a2a-http.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation and public docs

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/standards/src/a2aHttp.test.ts packages/standards/src/a2aTask.test.ts
node --import tsx --test packages/standards/src/a2aHttp.test.ts packages/standards/src/a2aTask.test.ts examples/a2a-http/a2a-http-demo.test.ts
npm run smoke:a2a-http
node --import tsx --test scripts/package-scripts.test.ts
git diff --check
npm run readiness:testnet
npm run verify:local
```

Evidence:

- Baseline `npm run docs:check` and `npm run secrets:scan` passed before
  implementation.
- Red focused A2A HTTP tests failed before implementation because
  `handleLocalA2AHttpRequest` was not exported yet.
- Focused implementation fixes covered Agent Card test-clock handling, malformed
  JSON error mapping, fixture A2A endpoint coverage, and demo route alignment
  with the exported local HTTP path constants.
- Focused A2A HTTP tests pass for public well-known Agent Card serving without
  task auth, missing/wrong/unconfigured bearer auth denial, authorized
  `POST /message:send`, `GET /tasks`, `GET /tasks/{id}`, and
  `POST /tasks/{id}:cancel`, artifact omission by default, safe error JSON,
  unsupported `A2A-Version` denial, auth-before-unsupported behavior on
  task-family routes, and explicit unsupported streaming/push responses.
- Focused A2A task/message regressions still pass.
- `npm run smoke:a2a-http` passes and reports Agent Card status 200,
  unauthorized status 401, task status `TASK_STATE_WORKING`, hidden artifacts,
  one listed task, canceled status `TASK_STATE_CANCELED`, and
  `logLeaksSecretMaterial=false`.
- `node --import tsx --test scripts/package-scripts.test.ts` passes and proves
  the smoke is wired into `npm run verify:local`.
- `npm test` passes with 304 TypeScript tests.
- `npm run typecheck` passes.
- `npm run docs:check` passes after documentation updates.
- `npm run secrets:scan` passes after Slice 4.6 changes with 273 checked
  tracked/staged/untracked text files and 0 findings.
- `git diff --check` passes.
- `npm run readiness:testnet` builds and stops before live testnet proof because
  this checkout has no `.env` configured.
- `npm run verify:local` passes locally with 304 TypeScript tests, 33 Move
  tests, typecheck, local gateway smoke, demo dApp smoke, browser wrapper
  smoke, agent escrow smoke, paid MCP tool smoke, data-license smoke,
  service-bounty smoke, reputation-receipt smoke, subscription smoke, A2A
  well-known smoke, A2A task/message smoke, A2A HTTP smoke, testnet readiness
  example, package dry-runs, docs check, and secret scan.

Hardening notes:

- The local HTTP handler keeps public Agent Card discovery separate from
  bearer-authenticated task routes.
- Task route auth must be configured; missing auth config fails closed with
  `503` rather than accidentally allowing local task operation.
- Unsupported `A2A-Version`, streaming, and push notification requests fail
  closed instead of silently falling back, and streaming/push routes still pass
  through the task auth boundary before returning unsupported.
- Error responses are fixed-shape JSON and do not echo request bodies or
  authorization headers.

Known unproven claims:

- No live public A2A server, signed Agent Card, public hosting, streaming,
  push notification, external conformance suite, live IOTA RPC, IOTA Gas
  Station, localnet/testnet/mainnet deployment, production authentication,
  production marketplace/provider workflow, custody, or live payment settlement
  was implemented by Slice 4.6.
- The A2A HTTP boundary proves local handler semantics, route auth, protocol
  version denial, unsupported-operation boundaries, and redaction behavior
  only.

Next recommended slice:

- Continue Packet D with signed Agent Card decision/proof or external A2A
  conformance-blocker documentation, or switch to Packet C live IOTA
  Names/Identity proof if operator credentials/endpoints are configured.

## Completed Slice 3.6

Implemented local/mock Subscription Workflow.

Implementation commit:

- `faddf2f` feat: add subscription workflow

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 3.6 Subscription Workflow.
- `docs/agentic-gaskit/prds/phase-3-contract-block-library.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 3 contract and receipt
  gates.
- `docs/marketplace-readiness.md` production marketplace/provider-verification
  gates.

Changed files:

- `contracts/subscription_v1/`
- `examples/subscription/`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/sdk/src/contracts/subscription.ts`
- `packages/sdk/src/contracts/subscription.test.ts`
- `packages/sdk/src/index.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `scripts/smoke-subscription.ts`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation docs, overview docs, and package README references

Commands run:

```bash
git status --short --branch
node --import tsx --test packages/receipts/src/receipts.test.ts
npm run typecheck
node --import tsx --test packages/receipts/src/receipts.test.ts packages/contracts-metadata/src/registry.test.ts packages/sdk/src/contracts/subscription.test.ts scripts/package-scripts.test.ts
npm run contracts:test
node --import tsx --test packages/receipts/src/receipts.test.ts packages/contracts-metadata/src/registry.test.ts packages/sdk/src/contracts/subscription.test.ts examples/subscription/subscription-demo.test.ts scripts/package-scripts.test.ts
npm run smoke:subscription
npm run docs:check
npm run secrets:scan
npm run verify:local
git diff --check
```

Evidence:

- Red test confirmed missing subscription receipt exports before
  implementation.
- `node --import tsx --test packages/receipts/src/receipts.test.ts` passed with
  20 receipt tests after subscription state was implemented.
- Focused subscription tests passed with 57 tests across receipt state,
  contract metadata, SDK start/renew flows, local demo redaction, and package
  script wiring.
- `npm run contracts:test` passed with 33 Move tests across escrow, receipt,
  pay-per-call, data-license, service-bounty, reputation-receipt, and
  subscription contracts. Subscription Move tests cover start/activate/renew/
  cancel, subscriber-only creation, provider-only activation, cancellation
  terminal behavior, and invalid renewal periods.
- `npm run typecheck` passed after subscription SDK and receipt exports were
  wired.
- `npm run smoke:subscription` passed with approved start, policy-denied start,
  failed-proof, renewed, and canceled paths.
- Hardening pass found and fixed missing renewal audit evidence by recording
  `renewalSponsorshipId` and `renewalTransactionDigest` on renewal receipts.
- Final `npm run verify:local` passed with 291 TypeScript tests, 33 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  task/message smoke, testnet readiness example, package dry-runs, docs check,
  and secret scan.
- `git diff --check` passed.

Known unproven claims:

- No live IOTA RPC, IOTA Gas Station, localnet/testnet/mainnet deployment, real
  recurring billing, payment-provider integration, private access-token
  issuance, legal entitlement enforcement, provider verification, live
  settlement, marketplace UI/API, custody, staking/bonding, slashing, public
  moderation, or production operation was implemented by Slice 3.6.
- The subscription workflow proves local policy-gated entitlement state and
  proof sequencing only.

Next recommended slice:

- Continue the full-roadmap goal with one remaining gated slice, such as
  device-access local proof only after physical-safety constraints are scoped,
  signed/live A2A discovery proof, live IOTA Names/Identity proof, or
  marketplace access-control/dispute-evidence proof that remains local/read-only
  until its gates are satisfied.

## Completed Slice 3.5

Implemented local/mock Reputation Receipt Workflow.

Implementation commit:

- `0de44a1` feat: add reputation receipt workflow

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 3.5 Reputation Receipt
  Workflow.
- `docs/agentic-gaskit/prds/phase-3-contract-block-library.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 3 contract and receipt
  gates.
- `docs/marketplace-readiness.md` production marketplace/provider-verification
  gates.

Changed files:

- `contracts/reputation_receipt_v1/`
- `examples/reputation-receipt/`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/sdk/src/contracts/reputationReceipt.ts`
- `packages/sdk/src/contracts/reputationReceipt.test.ts`
- `packages/sdk/src/index.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `scripts/smoke-reputation-receipt.ts`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation docs, readiness docs, and package READMEs

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
node --import tsx --test packages/receipts/src/receipts.test.ts packages/contracts-metadata/src/registry.test.ts scripts/package-scripts.test.ts
npm run typecheck
node --import tsx --test packages/receipts/src/receipts.test.ts packages/contracts-metadata/src/registry.test.ts packages/sdk/src/contracts/reputationReceipt.test.ts scripts/package-scripts.test.ts
npm run contracts:test
npm run smoke:reputation-receipt
npm run build
npm run verify:local
git diff --check
```

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, focused existing
  receipt/metadata/script tests, and `npm run typecheck` passed before
  implementation.
- Red tests failed for missing reputation-receipt exports/files, missing
  metadata, missing smoke wiring, and missing Move module before
  implementation.
- Hardening found and fixed an issuer-spoofing risk: `issuerId` must now match
  the manifest agent id in receipt creation, the SDK rejects mismatched issuer
  binding before gateway sponsorship, and the Move contract requires the
  transaction sender to match the issuer when creating the receipt.
- Focused TypeScript tests passed for receipt lifecycle, contract metadata, SDK
  reputation flow, issuer-binding denial, and package script wiring: 50 tests
  passed.
- `npm run contracts:test` passed with 28 Move tests across escrow, receipt,
  pay-per-call, data-license, service-bounty, and reputation-receipt contracts.
  Reputation-receipt Move tests cover create/attest, issuer-only create,
  issuer-only attestation, invalid score denial, and invalid transitions.
- `npm run smoke:reputation-receipt` passed with approved, policy-denied, and
  failed-evidence paths.
- Final `npm run verify:local` passed with 284 TypeScript tests, 28 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, A2A well-known smoke, A2A task/message smoke,
  testnet readiness example, package dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Known unproven claims:

- No live IOTA RPC, IOTA Gas Station, localnet/testnet/mainnet deployment, real
  provider credential, public reputation scoring, legal trust enforcement,
  live payment settlement, provider verification, marketplace UI/API, custody,
  staking/bonding, slashing, public moderation, or production operation was
  implemented by Slice 3.5.
- The reputation-receipt workflow proves local policy-gated
  receipt/evidence-attestation sequencing, not production marketplace ranking,
  public trust, provider verification, or live identity proof.

Next recommended slice:

- Do not start production marketplace implementation from this handoff. Choose
  one explicit next slice from the readiness gaps, such as subscription local
  contract workflow, signed/live A2A discovery proof, live IOTA Names/Identity
  proof, or marketplace access-control/dispute-evidence proof that remains
  local/read-only until its gates are satisfied.

## Completed Slice 3.4

Implemented local/mock Service Bounty Workflow.

Implementation commit:

- `063c2df` feat: add service bounty workflow

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 3.4 Service Bounty Workflow.
- `docs/agentic-gaskit/prds/phase-3-contract-block-library.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 3 contract and receipt
  gates.
- `docs/marketplace-readiness.md` production marketplace/provider-verification
  gates.

Changed files:

- `contracts/service_bounty_v1/`
- `examples/service-bounty/`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/sdk/src/contracts/serviceBounty.ts`
- `packages/sdk/src/contracts/serviceBounty.test.ts`
- `packages/sdk/src/index.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `scripts/smoke-service-bounty.ts`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation docs and package READMEs

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
npm run build && node --import tsx --test packages/receipts/src/receipts.test.ts packages/contracts-metadata/src/registry.test.ts packages/sdk/src/contracts/serviceBounty.test.ts examples/service-bounty/service-bounty-demo.test.ts scripts/package-scripts.test.ts
tsx scripts/run-move-tests.ts
npm run contracts:test
npm run smoke:service-bounty
npm run docs:check
npm run typecheck
npm run verify:local
```

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Red tests failed for missing service-bounty exports/files and missing smoke
  wiring before implementation.
- Focused TypeScript tests passed for receipt lifecycle, contract metadata, SDK
  service-bounty flow, example demo, and package script wiring.
- Direct `tsx scripts/run-move-tests.ts` failed because `tsx` is not available
  as a bare shell command in this environment; rerunning through the repo script
  `npm run contracts:test` passed.
- `npm run contracts:test` passed with 23 Move tests across escrow, receipt,
  pay-per-call, data-license, and service-bounty contracts. Service-bounty Move
  tests cover post, provider-only completion, requester-only release,
  cancellation, unauthorized completion/release, and invalid transitions.
- `npm run smoke:service-bounty` passed with approved, denied, and
  failed-completion paths.
- Final `npm run verify:local` passed with 269 TypeScript tests, 23 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke, A2A
  well-known smoke, testnet readiness example, package dry-runs, docs check,
  and secret scan.

Known unproven claims:

- No live IOTA RPC, IOTA Gas Station, localnet/testnet/mainnet deployment, real
  provider credential, production service delivery, legal service enforcement,
  live payment settlement, provider verification, marketplace UI/API, custody,
  staking/bonding, slashing, public dispute moderation, or production operation
  was implemented by Slice 3.4.
- The service-bounty workflow proves local policy-gated receipt/completion-proof
  sequencing, not production marketplace or provider-settlement behavior.

Next recommended slice:

- Do not start production marketplace implementation from this handoff. Choose
  one explicit next slice from the readiness gaps, such as a read-only
  marketplace architecture/spec slice, marketplace access-control/
  dispute-evidence proof, live IOTA Names/Identity proof, signed/live A2A
  discovery proof, or another expanded contract workflow such as subscription
  or reputation receipt.

## Completed Slice 3.3

Implemented local/mock Data License Workflow.

Slice and PRD coverage:

- `docs/agentic-gaskit/execution-slices.md` Slice 3.3 Data License Workflow.
- `docs/agentic-gaskit/prds/phase-3-contract-block-library.md`.
- `docs/agentic-gaskit/verification-hardening.md` Phase 3 data-license demo
  gate.
- `docs/marketplace-readiness.md` data-license production gate.

Changed files:

- `contracts/data_license_v1/`
- `examples/data-license/`
- `packages/receipts/src/index.ts`
- `packages/receipts/src/receipts.test.ts`
- `packages/sdk/src/contracts/dataLicense.ts`
- `packages/sdk/src/contracts/dataLicense.test.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/contracts-metadata/src/registry.test.ts`
- `scripts/smoke-data-license.ts`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- continuation docs and readiness docs

Evidence:

- Baseline `npm run docs:check`, `npm run secrets:scan`, `npm test`, and
  `npm run typecheck` passed before implementation.
- Red tests failed for missing data-license exports/files and missing smoke
  wiring before implementation.
- Focused TypeScript tests passed for contract metadata, receipt lifecycle,
  SDK data-license flow, example demo, and package script wiring.
- `npm run contracts:test` passed with 17 Move tests across escrow, receipt,
  pay-per-call, and data-license contracts. Data-license tests cover request,
  grant, provider-only grant/revoke, revoke, and invalid transition behavior.
- `npm run smoke:data-license` passed with approved, denied, and failed-access
  paths.
- Final `npm run verify:local` passed with 256 TypeScript tests, 17 Move tests,
  local gateway smoke, demo dApp smoke, browser wrapper smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, testnet readiness example,
  package dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Known unproven claims:

- No live IOTA RPC, IOTA Gas Station, localnet/testnet/mainnet deployment, real
  data-provider credential, private access-token issuance, production data
  delivery, live payment settlement, legal license enforcement, provider
  verification, marketplace UI/API, custody, staking, or production operation
  was implemented by Slice 3.3.
- The data-license workflow proves local policy-gated receipt/access-proof
  sequencing, not production data access or legal licensing.

## Guardrails

- Do not expose seeds, mnemonics, private keys, raw keypairs, raw transaction
  bytes, user signatures, sponsor keys, app API keys, bearer tokens, payment
  credentials, or private prompt text.
- Do not treat a signer reference as bearer authorization.
- Do not let SDK/MCP value-bearing flows bypass the policy gateway.
- IOTA testnet verification is allowed when relevant and configured with
  operator-owned local settings; do not expose secrets or claim local/mock proof
  as live AP2/payment/IOTA proof.
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

For the next slice, first read the readiness gate and then select one explicit
target. Suggested orientation commands:

```bash
sed -n '1,220p' docs/marketplace-readiness.md
sed -n '1,220p' docs/agentic-gaskit/verification-hardening.md
sed -n '1,180p' docs/agentic-gaskit/prds/phase-5-marketplace.md
```

Minimum checks still depend on the selected slice. For docs-only review work,
finish with:

```bash
npm run docs:check
npm run secrets:scan
git diff --check
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

## Completed Slice 2.7

Implemented Identity VC Trust Policy as a local/mock fail-closed Packet C
slice.

Implementation commit:

- `cce90e9` feat: add identity vc trust policy

Changed files:

- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/registry/src/iotaIdentityAdapter.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `README.md`

What landed:

- The injected IOTA Identity credential validator can now return normalized
  credential evidence for issuer DID, verification method, credential types,
  credential status, issuance time, and expiry.
- `evaluateIotaIdentityCredentialTrustPolicy` enforces trusted IOTA issuer
  DIDs, issuer-controlled verification methods, required credential types,
  accepted revocation status mechanisms, revoked status evidence, expiry,
  max credential age, and missing or malformed evidence.
- Identity verification cache keys now include trust-policy inputs, so evidence
  gathered under a weaker policy cannot satisfy a stronger policy.
- `npm run proof:live-status` now reports
  `VC_TRUST_POLICY_CONFIG_MISSING` or `VC_TRUST_POLICY_CONFIG_INVALID` instead
  of `VC_TRUST_POLICY_UNDEFINED`.
- Generated trust-policy error messages avoid echoing arbitrary credential refs
  or configured live values.

Commands run:

```bash
git status --short --branch
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test packages/registry/src/iotaIdentityAdapter.test.ts
node --import tsx --test scripts/live-proof-status.test.ts
node --import tsx --test packages/registry/src/iotaIdentityAdapter.test.ts scripts/live-proof-status.test.ts
npm run proof:live-status
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused registry identity adapter tests passed with 14 tests.
- Focused live proof status tests passed with 6 tests.
- Combined focused tests passed with 20 tests.
- `npm run proof:live-status` passed and reported these exact blockers:
  `TESTNET_ENV_FILE_MISSING`, `IOTA_NAMES_LIVE_CONFIG_MISSING`,
  `IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED`, and
  `VC_TRUST_POLICY_CONFIG_MISSING`.
- `npm run docs:check` passed: 31 HTML pages from 30 Markdown sources.
- `npm run secrets:scan` passed: 297 tracked/staged/untracked text files,
  findings 0.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 348 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- Official IOTA Identity VC and revocation docs were rechecked on 2026-06-10
  while touching this surface. The local evaluator matches the current
  assumption that issuers sign credentials with DID-controlled verification
  material and that revocation is represented through credential status
  mechanisms such as `RevocationBitmap2022` and `StatusList2021Entry`.
- A hardening pass removed credential-ref echoing from generated
  trust-policy failures and accepted `StatusList2021Entry` as a live
  configuration status type.
- Apex profile setup still has `setup.reviewNeeded: true`; this slice records
  local scope under ignored `tmp/apex-workflow/` and does not claim Apex
  verification.

Known unproven claims:

- No live IOTA Identity resolver, live credential JWT parsing, live signature
  validation, live revocation lookup, live VC proof command, or testnet
  Identity proof was implemented.
- No IOTA Names live smoke, testnet readiness against a real `.env`, Gas
  Station request, sponsored transaction, package publish, public A2A hosting,
  or production marketplace action was run.
- VC trust policy is local/mock configuration and evaluation proof only. Live
  policy-gated actions must wait for a later live Identity proof slice.

Next safe slice:

- Implement a live IOTA Identity proof command that consumes operator-provided
  resolver, trusted issuer, verification method, revocation status, credential
  type, and cache TTL configuration without printing secret values; or run
  `npm run readiness:testnet` / `npm run smoke:iota-names-live` only after the
  required local operator configuration exists.

## Completed Slice 2.8: IOTA Identity Live Proof Harness

Implementation commit: `45bf716` (`feat: add iota identity live proof smoke`).

What changed:

- Added `npm run smoke:iota-identity-live` as an opt-in live proof harness.
- Added `scripts/smoke-iota-identity-live.ts`, which validates a configured
  Agent Profile locally, contacts only an HTTPS or loopback proof endpoint, asks
  that endpoint to resolve agent/owner DIDs, asks it to validate credential
  refs, and then applies the existing local VC trust policy.
- Added `scripts/iota-identity-live-smoke.test.ts` to prove missing config,
  unsafe endpoint handling, happy-path proof endpoint calls, proof endpoint
  credential rejection, invalid profile preflight, and malformed trust policy
  handling.
- Updated `npm run proof:live-status` so IOTA Identity now reports
  `IOTA_IDENTITY_LIVE_CONFIG_MISSING`, `IOTA_IDENTITY_PROOF_ENDPOINT_UNSAFE`,
  or `IOTA_IDENTITY_LIVE_CONFIG_PRESENT` instead of the prior hardcoded
  `IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED`.
- Updated roadmap, active goal, live proof status, external API notes, README,
  overview, and codebase map docs to make this proof-endpoint boundary explicit.

Important boundary:

- This is a live-proof harness boundary, not bundled IOTA Identity WASM.
- It does not spend gas, mutate DIDs, publish credentials, prove production key
  management, or run against an operator Identity service by default.
- It is intentionally excluded from `npm run verify:local`; running it requires
  explicit operator configuration.

Commands run:

```bash
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/iota-identity-live-smoke.test.ts
node --import tsx --test scripts/iota-identity-live-smoke.test.ts scripts/live-proof-status.test.ts scripts/package-scripts.test.ts
npm run smoke:iota-identity-live
npm run proof:live-status
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused IOTA Identity live smoke tests passed with 6 tests.
- Combined focused script tests passed with 45 tests.
- `npm run smoke:iota-identity-live` with no config built successfully and then
  exited with the expected nonzero config gate: `IOTA_IDENTITY_LIVE_CONFIG_MISSING`.
- `npm run proof:live-status` passed and now reports these exact blockers:
  `TESTNET_ENV_FILE_MISSING`, `IOTA_NAMES_LIVE_CONFIG_MISSING`,
  `IOTA_IDENTITY_LIVE_CONFIG_MISSING`, and `VC_TRUST_POLICY_CONFIG_MISSING`.
- `npm run docs:check` passed: 31 HTML pages from 30 Markdown sources.
- `npm run secrets:scan` passed: 299 tracked/staged/untracked text files,
  findings 0.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 357 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- Proof endpoint and local profile paths are not printed in config errors.
- Unsafe non-loopback HTTP endpoints fail before any network call.
- Invalid local Agent Profiles fail before contacting the proof endpoint.
- Trust-policy parse errors do not echo configured values.
- Success output avoids printing endpoint, DID, or credential ref values.

Known unproven claims:

- No live proof endpoint is configured in this checkout.
- No real IOTA Identity resolver, credential parser, signature validator,
  revocation service, or testnet Identity proof was exercised.
- No IOTA Names live smoke, real `.env` testnet readiness, Gas Station request,
  sponsored transaction, package publish, public A2A hosting, or production
  marketplace action was run.
- Apex profile setup still has `setup.reviewNeeded: true`; this slice records
  local scope under ignored `tmp/apex-workflow/` and does not claim Apex
  verification.

Next safe slice:

- Provide operator configuration and run one of the live gates on IOTA testnet:
  `npm run readiness:testnet`, `npm run smoke:iota-names-live`, or
  `npm run smoke:iota-identity-live`; or continue with the next roadmap slice
  that does not require live credentials.

## Completed Slice 6.2: Package Publish Dry-Run Gate

Implementation commit: `7ed27b1` (`feat: add package publish dry-run gate`).

What changed:

- Added `npm run publish:dry-run` as an opt-in release-operator command.
- Added `scripts/package-publish-dry-run.ts`, which enumerates all non-private
  `packages/*` workspaces and invokes `npm publish --dry-run --tag next
  --access public` with explicit `-w` package names.
- Added `scripts/package-publish-dry-run.test.ts` to prove public package
  enumeration, private app exclusion, dry-run argument construction, and runner
  behavior without real publication flags.
- Extended package metadata/script tests to keep the command opt-in, excluded
  from `npm run verify:local`, and the only root package publication command.
- Updated package release docs, execution slices, README, overview, codebase
  map, active goal, full roadmap goal, and external API notes.

Important boundary:

- This is a dry-run release rehearsal, not npm publication.
- The command may print npm's normal dry-run login warning. That warning is
  acceptable and reinforces that this does not prove npm account ownership,
  package-name availability, 2FA readiness, provenance signing, registry
  authorization, or successful real publication.
- No npm token, OTP, provenance signing, package transfer, namespace rename, or
  real `npm publish` was run.

Commands run:

```bash
npm run proof:live-status
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/package-publish-dry-run.test.ts scripts/package-publish.test.ts scripts/package-scripts.test.ts
npm run publish:dry-run
node --import tsx --test scripts/reviewer-docs.test.ts scripts/package-publish-dry-run.test.ts scripts/package-publish.test.ts scripts/package-scripts.test.ts
npm run verify:local
git diff --check
```

Verification result:

- `npm run proof:live-status` passed and reported these exact blockers:
  `TESTNET_ENV_FILE_MISSING`, `IOTA_NAMES_LIVE_CONFIG_MISSING`,
  `IOTA_IDENTITY_LIVE_CONFIG_MISSING`, and `VC_TRUST_POLICY_CONFIG_MISSING`.
- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused package dry-run tests passed with 41 tests.
- `npm run publish:dry-run` passed. It built the repo and dry-ran npm
  publishing for 11 public workspaces with `tag=next` and public access. It did
  not publish packages.
- Reviewer/docs plus package dry-run focused tests passed with 55 tests after
  README command-shape wording was fixed.
- `npm run docs:check` passed: 31 HTML pages from 30 Markdown sources.
- `npm run secrets:scan` passed: 301 tracked/staged/untracked text files,
  findings 0.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 362 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- The helper prints package names and dry-run mode only; it does not print or
  accept npm tokens, OTPs, or credentials.
- Private app workspaces remain excluded.
- `npm run verify:local` keeps the existing `pack:check` gate but does not run
  `publish:dry-run`, preserving the release dry-run as an explicit operator
  action.
- Official npm CLI publish docs were checked on 2026-06-10 and referenced in
  `docs/agentic-gaskit/external-api-notes.md`.

Known unproven claims:

- No package is published to npm.
- No npm account ownership, namespace ownership, package-name availability,
  package install from registry, 2FA, provenance, registry authorization, or
  rollback plan is proven.
- No package namespace rename to `@agentic-gaskit/*` was performed.
- No live IOTA, Gas Station, IOTA Names, IOTA Identity, payment facilitator,
  public A2A hosting, production marketplace, custody, or provider
  verification behavior was changed.

Next safe slice:

- Continue with a non-live roadmap slice that improves installability or
  operator usability; or provide operator-owned local configuration to run one
  live gate: `npm run readiness:testnet`, `npm run smoke:iota-names-live`, or
  `npm run smoke:iota-identity-live`.

## Completed Slice 6.3: Package Install Smoke

Implementation commit: `6d9e64f` (`feat: add package install smoke`).

What changed:

- Added `npm run smoke:package-install` as a local bundle installability gate.
- Added `scripts/smoke-package-install.ts`, which builds the repo, packs every
  non-private package workspace into a temporary directory, installs the local
  tarballs together into a temporary consumer project, imports every public
  package root entrypoint, and deletes the temporary directory.
- Added `scripts/package-install-smoke.test.ts` to prove npm pack/install
  argument construction, temp consumer package JSON generation, root import
  smoke source generation, expected tarball discovery, cleanup on failure, and
  redacted failure logging.
- Wired `npm run smoke:package-install` into `npm run verify:local` after
  `npm run pack:check`.
- Updated package script, reviewer-doc, milestone proof, package release,
  README, overview, codebase map, active goal, full roadmap goal, and execution
  slice documentation.

Important boundary:

- This proves local tarball bundle install/import behavior only.
- It does not prove npm registry installability, package-name ownership,
  package publication, provenance signing, registry authorization, 2FA,
  downstream framework compatibility, live IOTA behavior, or package namespace
  rename readiness.

Commands run:

```bash
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
node --import tsx --test scripts/package-install-smoke.test.ts scripts/package-publish-dry-run.test.ts scripts/package-scripts.test.ts scripts/reviewer-docs.test.ts
npm run smoke:package-install
npm run docs:check
npm run secrets:scan
npm run typecheck
npm run verify:local
git diff --check
```

Verification result:

- Baseline before editing passed: docs check, secret scan, `npm test`, and
  `npm run typecheck`.
- Focused package install smoke tests passed with 54 tests across install smoke,
  package publish dry-run, package script wiring, and reviewer docs.
- `npm run smoke:package-install` passed. It built the repo, installed local
  tarballs into a temporary consumer, and imported 11 public package entrypoints:
  `@iota-gaskit/accounts`, `@iota-gaskit/contracts-metadata`,
  `@iota-gaskit/manifest`, `@iota-gaskit/marketplace`,
  `@iota-gaskit/mcp-server`, `@iota-gaskit/policy-gateway`,
  `@iota-gaskit/receipts`, `@iota-gaskit/registry`, `@iota-gaskit/sdk`,
  `@iota-gaskit/shared-types`, and `@iota-gaskit/standards`.
- `npm run docs:check` passed: 31 HTML pages from 30 Markdown sources.
- `npm run secrets:scan` passed: 303 tracked/staged/untracked text files,
  findings 0.
- `npm run typecheck` passed.
- `npm run verify:local` passed with 367 TypeScript tests, 33 Move tests,
  typecheck, local gateway smoke, demo dApp smoke, browser smoke, agent escrow
  smoke, paid MCP tool smoke, data-license smoke, service-bounty smoke,
  reputation-receipt smoke, subscription smoke, A2A well-known smoke, A2A
  signed-card smoke, A2A task/message smoke, A2A HTTP smoke, A2A local server
  smoke, marketplace read-model smoke, testnet readiness example, package
  dry-runs, package install smoke, docs check, and secret scan.
- `git diff --check` passed.

Hardening notes:

- The install smoke uses `npm install --ignore-scripts --no-audit
  --fund=false --package-lock=false` in the temporary consumer.
- The temporary consumer imports package root entrypoints only; it does not
  execute live network calls.
- Failure logging redacts the repo path and system temp directory.
- Temporary directories are removed in `finally` after success or failure.

Known unproven claims:

- No package is published to npm.
- No npm account ownership, namespace ownership, package-name availability,
  package install from the npm registry, 2FA, provenance, registry
  authorization, rollback plan, or downstream application compatibility is
  proven.
- No package namespace rename to `@agentic-gaskit/*` was performed.
- No live IOTA, Gas Station, IOTA Names, IOTA Identity, payment facilitator,
  public A2A hosting, production marketplace, custody, or provider verification
  behavior was changed.

Next safe slice:

- Continue with a non-live roadmap slice that improves release/operator
  readiness; or provide operator-owned local configuration to run one live gate:
  `npm run readiness:testnet`, `npm run smoke:iota-names-live`, or
  `npm run smoke:iota-identity-live`.
