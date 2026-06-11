# Codex Goal: Full Roadmap Execution To Working Agentic GasKit Product

Last updated: 2026-06-11.

## Goal Pointer

This is the active `/goal` target for continuing Agentic GasKit in
`/home/sacred/code/agentic-gaskit` after completion of the local Slice 4.19 A2A
Public Discovery Report Gate.

Primary continuation sources:

- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/agentic-gaskit/execution-entry.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/verification-hardening.md`
- `docs/agentic-gaskit/planning-structure-audit.md`
- `docs/marketplace-readiness.md`

## Intent Read

The visible ask is to stop treating individual local slices as the finish line
and drive the rest of the roadmap until Agentic GasKit is an actual working
product with objective-aligned evidence.

The underlying goal is a build/test/improve loop that turns the current
locally verified primitives into a coherent product: safe agent wallets,
policy-gated sponsored execution, contract workflows, registry/identity,
standards bridges, live testnet proof where applicable, and a marketplace or
operator-facing experience only after its gates are satisfied.

The success condition is not "more docs" or a happy-path demo. Success means a
future operator can clone the repo, run local verification, run approved
testnet checks with local credentials, exercise end-to-end agent workflows, and
see exact evidence for which claims are local, testnet, mock, or still blocked.

The failure mode is overclaiming production readiness from local mocks,
weakening GasKit sponsorship safety, leaking signer or payment material,
starting marketplace/compliance surfaces too early, or losing objective
traceability between the roadmap, code, tests, audits, and handoffs.

## Repo Term Normalization

| Raw term | Repo/product term | Assumption |
| --- | --- | --- |
| "rest of the full roadmap" | Remaining Agentic GasKit roadmap after locally verified Slices 1.0-4.5, Slices 3.5-3.6, and 5.1 readiness review | Continue from current code and handoff, not from the original Phase 0 starting point. |
| "proper evals" | Baseline, focused, broad, negative, smoke, testnet, and redaction checks | Every slice must define checks before editing and record exact command evidence. |
| "audits" | Hardening pass against `verification-hardening.md` and `planning-structure-audit.md` | Security, custody, policy, identity, payment, marketplace, and standards surfaces need adversarial review before acceptance. |
| "objectives" | Roadmap objective and traceability matrix | Each completion claim must cite the relevant PRD, slice, gate, evidence, and remaining risk. |
| "actual working product" | Local plus testnet-verifiable Agentic GasKit product | Working means reproducible product workflows, not mainnet/custody/production marketplace unless explicitly approved later. |
| "iotatestnet" | IOTA testnet verification path | Use when relevant and local credentials/config exist; keep secrets out of repo and logs. |

## Repo Reality Check

Confirmed current state:

- `docs/CODEBASE_MAP.md` says Agentic GasKit currently includes local agent
  accounts, manifests, policy evaluator, mock gateway, SDK/MCP routing,
  receipts, local Move contracts, local contract workflows, registry/profile
  schema, mock IOTA Names/Identity adapters, an opt-in IOTA Names live
  resolution smoke, bounded local IOTA Identity verification cache helpers,
  local VC trust-policy evaluation,
  x402/AP2/A2A mappings, local A2A well-known serving, local A2A signed-card
  verification, local A2A task/message helpers, a local A2A HTTP-shaped
  boundary, a loopback A2A server smoke, and a local read-only marketplace
  evidence package, plus a conservative package namespace/release metadata
  strategy and publish dry-run gate for the current `@iota-gaskit/*`
  prerelease line, plus a non-networked product-status proof gate that reports
  local proof, live/testnet readiness, package publication, A2A hosting,
  payment, marketplace, custody, and device-safety claim boundaries, and a
  non-networked launch-readiness evidence matrix that maps roadmap areas to
  source evidence, local commands, blocker codes, and next gates, plus a
  non-networked operator live-gate runbook that classifies config blockers,
  approval-required live commands, production blockers, and safety deferrals.
  Slice 7.4 adds a non-networked public testnet digest proof gate that checks
  the documented successful IOTA testnet digest is present in reviewer evidence
  docs, plus a separate opt-in read-only IOTA testnet lookup command that does
  not sign, sponsor, reserve gas, execute transactions, or use operator
  credentials.
  Slice 4.9 adds a non-networked A2A public-readiness gate that classifies
  local A2A proof, public hosting inputs, production JWKS/auth decisions,
  unsupported streaming/push capabilities, and external conformance blockers
  without fetching public endpoints or operating a public A2A server. Slice
  4.10 adds local loopback SSE streaming proof while keeping public A2A
  blockers explicit. Slice 4.11 adds local push notification configuration
  proof while keeping webhook delivery and public A2A blockers explicit. Slice
  4.12 adds local authenticated extended Agent Card proof while keeping public
  hosting, production auth, and external conformance blockers explicit. Slice
  4.13 adds local injected push delivery envelope proof while keeping
  default outbound webhook calls, public hosting, production auth, public
  webhook delivery, and external conformance blockers explicit. Slice 4.14
  adds local mocked opt-in push HTTP transport proof while keeping public
  webhook infrastructure, production auth, retry/observability infrastructure,
  and external conformance blockers explicit. Slice 4.15 adds opt-in local
  retry plus in-memory delivery-attempt observability for explicitly injected
  A2A push transports while keeping default delivery single-attempt and public
  webhook workers, persistent queues, production observability, public hosting,
  production auth, live IOTA proof, and external conformance blockers explicit.
  Slice 4.16 adds a redacted operator-supplied public push delivery report path
  gate for `npm run proof:a2a-public-readiness` while keeping public endpoint
  hosting/fetching, webhook POSTs, background workers, persistent queues,
  credential storage, live IOTA proof, and external conformance blockers
  explicit. Slice 4.17 tightens that gate so public push delivery and external
  conformance reports must be structured JSON evidence with schema version,
  expected kind, passing result, recent observation time, and matching
  configured public URL fields when present. Slice 4.18 adds an opt-in public
  discovery/JWKS smoke for operator-approved public HTTPS Agent Card and JWKS
  probing, while keeping it out of default local verification and keeping
  public hosting acceptance, production auth/key rotation, public push delivery,
  and external conformance blockers explicit. Slice 4.19 lets that opt-in
  smoke emit a structured public discovery report and requires
  `A2A_PUBLIC_DISCOVERY_REPORT` before A2A public readiness can become
  `publicReady=true`, while keeping the report approval-only and separate from
  external conformance, public push delivery, production key rotation, and
  launch readiness.
  Slice 7.5 adds a fast deterministic verification profile plus a
  non-networked profile audit, so ordinary build/test/improve loops can run a
  bounded subset while `verify:local` and `grant:check` remain the full
  reviewer/release/launch evidence gates.
  Slice 4.10 adds local loopback A2A SSE streaming proof for
  `POST /message:stream`; Slice 4.11 adds local A2A push notification
  configuration CRUD that rejects webhook credential storage and unsafe
  callback URLs; Slice 4.12 adds local authenticated extended Agent Card
  access; Slice 4.13 adds local injected push delivery envelopes; Slice 4.14
  adds local mocked opt-in push HTTP transport proof; Slice 4.15 adds local
  retry/attempt observability proof; Slice 4.16 adds redacted public push
  delivery report classification for a future operator-approved review; Slice
  4.17 adds structured public push/conformance report validation for that
  review path; Slice 4.18 adds opt-in public Agent Card/JWKS discovery proof;
  Slice 4.19 requires structured public discovery report evidence before
  public-readiness approval.
  Public hosting acceptance, production keys/auth, public webhook
  workers/queues, persistent production observability, and external conformance
  blockers remain.
- `docs/agentic-gaskit/handoff-next-product-build.md` records the latest
  completed/deferred slice set, including Slice 4.19, with exact local
  verification evidence and remaining live, production, publication, custody,
  payment, A2A, marketplace, and safety blockers.
- `docs/marketplace-readiness.md` permits marketplace requirements/design work
  only inside local/mock proof. Production marketplace implementation remains
  blocked.
- `apex.workflow.json` exists but has `setup.reviewNeeded: true`; do not claim
  Apex verification until a dedicated Apex setup/review slice resolves it.
- Slice 3.5 added the local/mock `reputation_receipt_v1` workflow, SDK helper,
  receipt state, metadata, smoke proof, and handoff evidence. It is local proof
  only, not live reputation scoring, provider-verification, marketplace, or
  public trust proof.
- Slice 3.6 added the local/mock `subscription_v1` workflow, SDK helper,
  receipt state, metadata, smoke proof, and handoff evidence. It is local
  entitlement evidence only, not recurring billing, production provider access
  enforcement, marketplace subscription operation, or live IOTA proof.
- Slice 3.7 adds the device access safety gate. Physical device operation is
  explicitly blocked; any future proof must start with virtual or simulated
  resources only and must not claim a `device_access_lease_v1` implementation.
- Slice 2.6 adds a non-networked live proof status command. It reports current
  testnet/IOTA Names/IOTA Identity/VC proof readiness or blockers without
  contacting live services or printing configured values.
- Slice 2.7 adds a local fail-closed VC trust-policy evaluator for IOTA
  Identity credential evidence. It defines trusted issuer DIDs, allowed
  verification methods, required credential types, accepted revocation status
  mechanisms, max credential age, expiry handling, and cache-policy binding.
  It is still local/mock evidence; live IOTA Identity proof remains blocked
  until an operator-configured live resolver and credential validator command
  exists and passes.
- Slice 2.8 adds an opt-in IOTA Identity live proof harness. It can contact an
  operator-provided HTTPS or loopback proof endpoint, validate a configured
  Agent Profile, resolve profile DIDs, validate credential refs, and apply the
  local VC trust policy. It is not part of local verification and does not
  prove production key management or provider verification by itself.

Confirmed remaining gaps:

- Public Agent Card hosting, production Agent Card key management, live A2A
  discovery proof, live public A2A server operation beyond the local loopback
  smoke, public streaming, public push webhook delivery, external A2A
  conformance proof, and production A2A authentication decisions.
- Configured live IOTA Names proof, live IOTA Identity proof, live verifiable
  credential validation beyond local/mock trust-policy behavior, and live
  standards-bridge proof.
- Testnet/localnet deployment proof for relevant Move contracts and demos.
- Expanded Phase 3 contract workflows beyond the implemented escrow, receipt,
  pay-per-call, data-license, service-bounty, reputation-receipt, and
  subscription paths remain unimplemented unless separately approved. Physical
  device access is explicitly deferred by the safety gate; no
  `device_access_lease_v1` contract exists.
- Package publication to npm. The current package namespace, prerelease
  metadata strategy, package pack dry-runs, local tarball install smoke, and
  publish dry-run are documented and locally checked, but no package is claimed
  as published.
- Production custody, KMS, and recovery/export design if the product ever
  needs those surfaces.
- Marketplace production app/API, provider verification/moderation decisions,
  live identity/name proof, live payment/provider-access proof, and
  standards-discovery proof before any live marketplace claim. Local receipt
  access-control and redacted dispute-evidence bundle proof now exists, but it
  is not production API/session authorization or live dispute operation.

## Objective Contract

Goal:
Execute the remaining Agentic GasKit roadmap in dependency-safe vertical slices
until the repository contains a locally and IOTA-testnet-verifiable working
product, with exact eval, audit, handoff, and commit evidence for every product
claim.

Why:
Agentic GasKit is only valuable if agents can safely use IOTA execution rails
through policy-gated sponsorship, signer-reference-first wallets, verifiable
identity/profile resolution, reusable contract workflows, standards-compatible
bridges, and auditable receipts without leaking secrets or creating premature
marketplace/custody obligations.

Current problem:
The repo has many strong local/mock primitives, but the full roadmap is not
complete. The active goal pointer now points at this full-roadmap execution
contract, and the remaining work spans live proof, additional contract slices,
standards hardening, marketplace access control, and productization gates.

Desired outcome:
Codex can resume from this document, finish the next incomplete slice, run the
right local and testnet checks, harden findings, record objective traceability,
commit cleanly, and repeat until the product can be honestly demonstrated as a
working local/testnet Agentic GasKit system.

Users affected:

- Agent developers who need safe IOTA actions without raw wallet secrets.
- IOTA dApp builders using sponsored execution.
- API/data/tool providers who need paid workflow contracts and receipts.
- Operators who fund, revoke, monitor, and audit agent actions.
- Future agents resuming implementation.

In scope:

- Preserve all existing GasKit sponsorship, gateway, SDK, credential, quota,
  readiness, and secret hygiene behavior unless a written migration reason and
  focused verification justify a change.
- Preserve the completed local/mock reputation-receipt proof and avoid turning
  it into public marketplace scoring or provider-verification claims without a
  new approved slice.
- Preserve the completed local/mock subscription proof and avoid turning it
  into production recurring billing, provider-access enforcement, or
  marketplace subscription claims without a new approved slice.
- Add missing vertical slices for remaining Phase 3 contract targets where the
  roadmap still requires them.
- Add local and testnet deployment/proof paths for contract and product flows
  where safe local credentials exist.
- Harden IOTA Names/Identity from mock adapters toward live testnet proof and
  full VC/revocation validation.
- Harden A2A from local helpers toward signed/public discovery, live server
  proof, task/message conformance, and explicit auth decisions.
- Harden standards bridges with current official docs, unsupported-version
  denial, partial-failure evidence, and live/provider proof only when safe.
- Build marketplace/operator product surfaces only after explicit gates:
  access control, dispute evidence, profile verification labels, policy
  compatibility, and no duplicated identity or receipt truth.
- Update docs, smokes, tests, and handoffs as product behavior changes.

Out of scope unless explicitly approved later:

- Mainnet execution or real funds.
- Production custody, KMS, staking, bonding, slashing, or default recovery
  export.
- Real payment credentials, production x402 facilitator operation, production
  payment processing, or AP2 participant credentials.
- Legal/KYC/KYB provider verification.
- Public marketplace launch, moderation, or provider onboarding.
- Replacing MCP, A2A, AP2, x402, IOTA Identity, IOTA Names, or official IOTA
  Gas Station.
- External issue tracker updates.

Constraints:

- Read `CLAUDE.md` and `docs/CODEBASE_MAP.md` before broad search.
- Run `git status --short --branch` before every edit and preserve unrelated
  dirty work.
- Do not claim Apex verification while `apex.workflow.json` has
  `setup.reviewNeeded: true`; use repo-local checks or create a dedicated Apex
  setup slice first.
- Treat the policy gateway, agent wallet creation, signer references, payment
  evidence, identity/profile resolution, and marketplace logs/receipts as
  security boundaries.
- Do not expose seeds, mnemonics, private keys, raw keypairs, raw transaction
  bytes, user signatures, sponsor keys, app API keys, bearer tokens, payment
  credentials, or private prompt text.
- IOTA testnet commands are allowed when relevant, local credentials are
  configured outside the repo, and command output is redacted. If credentials
  are absent, record the exact blocker and keep the claim local/mock.

## Execution Loop

Run this loop for every slice.

1. Orient
   - Read this goal, the latest handoff, the owning PRD, execution slice,
     module spec, verification hardening gates, and planning-structure audit.
   - Run `git status --short --branch`.
   - Identify unrelated dirty work and explicitly preserve it.

2. Choose the next vertical slice
   - Continue an in-progress dirty slice before starting a new one when it
     belongs to the roadmap.
   - If the roadmap gap has no vertical slice yet, add a narrow slice to
     `docs/agentic-gaskit/execution-slices.md` before implementing.
   - Define one user/operator-visible outcome, likely files, no-touch surfaces,
     acceptance criteria, checks, risks, and escalation triggers.

3. Baseline eval
   - Run the lightest checks needed to understand the current state.
   - For meaningful product work, include:

     ```bash
     npm run docs:check
     npm run secrets:scan
     npm test
     npm run typecheck
     ```

4. Test-first eval
   - Add failing tests before implementation where feasible.
   - Include positive, denial, redaction, revocation, idempotency, stale-data,
     and partial-failure cases for security or payment surfaces.

5. Implement
   - Make the smallest vertical change that satisfies the slice.
   - Reuse existing package patterns, scripts, fixtures, examples, and docs
     wiring.
   - Keep value-bearing SDK/MCP/marketplace actions routed through the policy
     gateway.

6. Focused eval
   - Run touched package tests, contract tests, example smokes, docs checks, or
     script tests first.
   - Fix failures before broadening scope.

7. Broad eval
   - Before accepting a meaningful product slice, run:

     ```bash
     npm run verify:local
     git diff --check
     ```

8. IOTA testnet eval
   - For slices that claim live IOTA behavior, first run readiness:

     ```bash
     npm run readiness:testnet
     ```

   - If local credentials are configured outside the repo and the slice
     requires it, run the relevant testnet smoke or demo command.
   - Record whether the proof is local, mock, localnet, testnet, or blocked.
   - Never print or commit secrets.

9. Audit and harden
   - Review against `docs/agentic-gaskit/verification-hardening.md`.
   - Review against the traceability matrix in
     `docs/agentic-gaskit/planning-structure-audit.md`.
   - Stress policy bypass, secret leakage, stale external APIs, revocation,
     replay/idempotency, payment split-brain, access control, dispute evidence,
     marketplace overclaiming, and live/mock claim boundaries.

10. Improve
    - Fix audit findings before calling the slice complete.
    - If a finding requires product, legal, custody, payment-provider, or
      protocol decisions, stop and record the blocker instead of guessing.

11. Handoff and commit
    - Update handoff docs with files changed, commands, manual checks, evidence,
      known unproven claims, risks, and commit hash.
    - Make a structured commit per completed slice unless the user explicitly
      asks not to.
    - Keep the final status honest: clean tree, or dirty tree explained by
      exact path and ownership.

## Remaining Work Packets

### Packet A: Reputation Receipt Completion

Outcome:
Complete. Slice 3.5 added local/mock reputation-receipt state, policy-gated SDK
attestation, template metadata, Move tests, example smoke, docs, and handoff
evidence.

Likely files:

- `contracts/reputation_receipt_v1/`
- `packages/sdk/src/contracts/reputationReceipt.ts`
- `packages/sdk/src/contracts/reputationReceipt.test.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/receipts/src/index.ts`
- `scripts/smoke-reputation-receipt.ts`
- `examples/reputation-receipt/`
- `package.json`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`

Acceptance criteria:

- Reputation receipt has explicit state semantics and anti-gaming limits.
- Policy and template metadata deny unknown or mismatched template versions.
- Receipts redact private prompts, bearer tokens, payment credentials, signer
  refs, wallet internals, and key-like material.
- Smoke is wired into local verification only after it passes reliably.
- Reputation receipt remains local/mock proof and is not public marketplace
  scoring, production provider verification, legal trust, or live IOTA proof.

Verification:

- Focused SDK, receipt, metadata, package-script, and Move tests.
- `npm run smoke:reputation-receipt`
- `npm run verify:local`
- `git diff --check`

Risk:
High. Reputation can be gamed and can become a marketplace trust claim before
provider verification exists; keep future work gated by identity, access
control, moderation, and dispute-evidence slices.

### Packet B: Complete Remaining Phase 3 Contract Library Slices

Outcome:
Complete for the current approved local/mock scope. Slice 3.6 added local/mock
subscription state,
policy-gated SDK activation/renewal, template metadata, Move tests, example
smoke, docs, and handoff evidence. Slice 3.7 adds the device access safety
gate: physical device operation remains blocked, and any future work is limited
to virtual or simulated resources until physical safety, provider
accountability, revocation, emergency-stop, credential, privacy, dispute, and
compliance requirements are approved.

Completed Packet B files:

- `contracts/subscription_v1/`
- `packages/sdk/src/contracts/subscription.ts`
- `packages/sdk/src/contracts/subscription.test.ts`
- `packages/contracts-metadata/src/index.ts`
- `packages/receipts/src/index.ts`
- `scripts/smoke-subscription.ts`
- `examples/subscription/`
- `package.json`
- `scripts/run-move-tests.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/device-access-safety-gate.md`
- `scripts/roadmap-safety.test.ts`

Acceptance criteria:

- Each target has a vertical slice in `execution-slices.md` before code.
- Each target has Move tests, SDK wrapper tests, receipt state tests, metadata
  allow-list tests, denial/failure cases, and a local smoke or explicit reason
  no smoke is safe.
- Device access lease is explicitly deferred with a hardening rationale unless
  a later approved virtual-device slice implements a non-physical local proof.

Verification:

- Focused contract and SDK tests per template.
- Roadmap safety regression test for the device access gate.
- `npm run contracts:test`
- `npm run smoke:subscription`
- `npm run verify:local`

Risk:
High. Contract workflows can create settlement, legal, device safety, or
marketplace obligations.

### Packet C: Live IOTA Names/Identity And VC Validation

Outcome:
Move registry identity from mock adapters toward testnet/live proof with
bounded revocation and credential validation. Slice 2.4 now provides local/mock
bounded cache behavior for successful DID and credential evidence, including
fail-closed stale refresh and revoked-credential detection after TTL expiry.
Slice 2.5 adds an opt-in IOTA Names GraphQL smoke and exact missing-config
blocker path. Slice 2.6 adds a non-networked status report for current live
proof readiness and blockers. Slice 2.7 adds local/mock VC trust-policy
evaluation for trusted issuers, verification methods, revocation status,
credential type, expiry, max-age, and cache-policy binding. Slice 2.8 adds the
opt-in `npm run smoke:iota-identity-live` command for an operator-provided
proof endpoint. Configured live IOTA Names proof, live IOTA Identity proof,
and live VC validation remain unproven unless operator-provided configuration
is present and the relevant live command passes.

Acceptance criteria:

- External API notes are refreshed against official docs before code.
- Testnet or official-environment proof is recorded when credentials/config are
  available.
- Exact blocker status is recorded when live/testnet configuration or live proof
  commands are unavailable.
- Full VC validation defines trusted issuers, verification method handling,
  revocation, cache TTL, stale behavior, and fail-closed cases.
- Policy-gated actions deny revoked, expired, mismatched, or stale profiles.

Verification:

- Registry adapter tests.
- Capability policy tests.
- `npm run proof:live-status`
- `npm run readiness:testnet`
- `npm run smoke:iota-names-live` when an operator supplies
  `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS`.
- Relevant testnet resolution command, or exact blocker if unavailable.
- `npm run verify:local`

Risk:
High. Stale identity or revocation data can allow revoked agents to spend.

### Packet D: A2A Live Discovery, Server, Auth, And Conformance

Outcome:
Turn local A2A cards, signed-card helpers, task/message helpers, and
HTTP-shaped handler into an honestly scoped live interoperability path. Slice
4.6 proves a local/mock HTTP boundary with public Agent Card discovery and
bearer-authenticated task routes. Slice 4.7 proves local JWS signing and
trusted-key verification for Agent Cards. Slice 4.8 proves the same local
handler behind a loopback HTTP server with signed discovery and authenticated
task routes. Slice 4.9 adds a non-networked public-readiness gate for local
A2A proof, public hosting inputs, production JWKS/auth decisions, unsupported
streaming/push capabilities, and external conformance evidence. Slice 4.10 adds
local loopback SSE streaming proof for `POST /message:stream`. Slice 4.11 adds
local push notification configuration CRUD with webhook credential-storage and
unsafe callback URL rejection. Slice 4.12 adds local authenticated extended
Agent Card access. Slice 4.13 adds local injected push delivery envelopes.
Slice 4.14 adds local mocked opt-in push HTTP transport proof. These slices are
not public hosting, production key management, public streaming, public push
webhook infrastructure proof, external conformance, or live A2A discovery
proof.

Acceptance criteria:

- Signed Agent Card decision is documented and implemented locally or
  explicitly deferred for production key distribution with reason.
- Public or local server proof serves canonical well-known Agent Card and
  task/message endpoints without leaking private metadata.
- Auth requirements are explicit and fail closed.
- Streaming, push notification configuration, injected push delivery, and the
  opt-in push HTTP transport helper are implemented locally or documented as
  unsupported capabilities; public webhook delivery infrastructure remains
  blocked until separately implemented and verified.
- External A2A conformance proof is recorded, or blocked with exact reason.
- Public A2A readiness command reports exact local proof, config, unsupported
  capability, and external conformance blockers without printing configured
  values or contacting public endpoints.

Verification:

- Standards and registry tests.
- Local server smoke.
- `npm run proof:a2a-public-readiness`
- External/client conformance command where available.
- `npm run verify:local`

Risk:
Medium to high. Discovery metadata can overclaim live interoperability or leak
private profile and payment data.

### Packet E: Live/Testnet Standards Bridge Proof

Outcome:
Harden x402/AP2/A2A bridges from local mapping to explicit live/testnet or
provider-compatible proof where safe.

Acceptance criteria:

- External protocol docs are refreshed before touched fields change.
- Unsupported protocol versions fail closed.
- Partial failures preserve separate external payment, mandate, manifest, IOTA
  receipt, and dispute evidence states.
- Live credentials are never committed or logged.
- Real payment/provider flows remain blocked unless explicitly approved.

Verification:

- Standards unit/integration tests.
- Mock facilitator/AP2/A2A smokes.
- Relevant live/provider proof only with safe credentials.
- `npm run verify:local`

Risk:
High. Payment and mandate bridges can leak business context or imply
settlement guarantees the product has not proven.

### Packet F: Package Namespace, Release, And Installability

Outcome:
Partially complete. Slice 6.1 documents the conservative current
`@iota-gaskit/*` prerelease namespace, defers any `@agentic-gaskit/*` rename to
a dedicated compatibility slice, and mechanically checks public package
metadata plus root build/pack coverage. Slice 6.2 adds an opt-in
`npm publish --dry-run` gate for public workspace packages. Slice 6.3 adds a
fresh-consumer local tarball install/import smoke. Real npm publication remains
operator-gated and unrun.

Acceptance criteria:

- Namespace decision is documented.
- Package exports and dry-runs pass.
- Local tarball install/import smoke passes.
- Publish dry-run command shape passes without real publication.
- Backward compatibility or migration notes exist.
- No package exposes unsupported production/custody claims.

Verification:

- `npm run pack:check`
- `npm run smoke:package-install`
- `npm run publish:dry-run`
- `npm run docs:check`
- `npm run verify:local`

Risk:
Medium. Naming churn can break consumers and docs.

### Packet G: Marketplace/Operator Working Product Slice

Outcome:
Partially complete. Slice 5.2 added a local read-only marketplace evidence
package that consumes existing registry, policy, contract metadata, receipts,
manifests, and standards evidence without duplicating truth. Production
marketplace UI/API, provider onboarding, live settlement, public scoring,
moderation, and provider verification remain blocked.

Acceptance criteria:

- Access-control tests cover logs and receipts before UI/API exposes them.
- Dispute evidence walkthrough proves redaction and stable links across
  mandate, manifest, payment, IOTA receipt, and task evidence.
- Provider verification labels distinguish active, revoked, expired,
  unverified, mock, local, testnet, and live states.
- Paid or sponsored workflows route through SDK and policy gateway.
- Production provider onboarding, real-money settlement, custody, staking,
  bonding, and moderation remain blocked unless explicitly approved.

Verification:

- Marketplace package tests.
- Local marketplace read-model smoke.
- Marketplace/API tests if implemented.
- Access-control tests.
- Search/filter tests.
- Manual dispute evidence walkthrough.
- `npm run verify:local`

Risk:
High. Marketplace work creates compliance, trust, moderation, payment, and
provider-verification obligations.

### Packet H: Final Product E2E And Launch-Readiness Audit

Outcome:
In progress. Slice 7.1 adds a non-networked product-status proof gate that
reports local proof gates, live/testnet readiness, and production blockers in
one machine-checkable command. It does not replace configured live/testnet
proof or final launch-readiness review; it prevents local proof from being
overclaimed as product completion. Slice 7.2 adds a non-networked
launch-readiness evidence matrix that maps each major roadmap area to source
evidence, local proof commands, blocker codes, and next gates. Slice 7.3 adds
a non-networked operator live-gate runbook that converts those blockers into
run-ready, config-blocked, approval-required, production-blocked, and
safety-deferred execution gates. Slice 7.4 adds a public testnet digest proof
gate: local verification checks documented digest evidence, while the optional
live command performs a read-only transaction lookup against IOTA testnet.
Slice 4.9 adds a non-networked A2A public-readiness gate so public A2A hosting
and conformance blockers are inspectable before any live interoperability
claim. Slice 7.5 adds a fast deterministic verification profile for iteration
and a profile audit that preserves `verify:local` as the full evidence gate.

Acceptance criteria:

- Clean checkout install/build/test/docs/smoke path passes.
- One or more documented end-to-end agent workflows run locally and, where
  configured, on IOTA testnet.
- Handoff maps every roadmap phase to source files, tests, smokes, manual
  checks, live/testnet evidence, risks, and commit hashes.
- Product status command reports `complete=false` while any live/testnet,
  publication, marketplace, custody, public A2A hosting, payment, or device
  safety blocker remains.
- Launch-readiness command reports `launchReady=false` while any live/testnet,
  publication, marketplace, custody, public A2A hosting, payment, or device
  safety blocker remains, and fails local evidence if required source paths are
  missing.
- Operator live-gate command reports which gates are blocked by configuration,
  ready for non-networked local checks, require explicit live/operator
  approval, remain production-blocked, or are safety-deferred.
- Verification-profile command reports whether the fast iteration path is
  bounded and whether `verify:local` plus `grant:check` remain full-gate proof.
- Testnet digest proof reports documented public IOTA testnet transaction
  evidence locally, and its opt-in live lookup remains read-only without gas
  spend, sponsor credentials, signing, or transaction execution.
- Production, custody, mainnet, real payment, provider verification, and
  marketplace launch claims are either proven with explicit approval or labeled
  blocked.

Verification:

- `npm run verify:local`
- `npm run readiness:testnet`
- `npm run proof:product-status`
- `npm run proof:launch-readiness`
- `npm run proof:operator-gates`
- `npm run proof:testnet-digest`
- `npm run proof:testnet-digest:live` when read-only IOTA testnet RPC lookup is
  intentionally being checked.
- `npm run proof:a2a-public-readiness`
- Relevant IOTA testnet commands with local credentials, if available.
- `git diff --check`
- Final hardening audit against verification and planning docs.

Risk:
High. This is where mock/local proof can be accidentally described as live
production readiness.

## Completion Standard

Do not mark this goal complete until all of the following are true or explicitly
blocked with owner-facing rationale:

- The local/mock reputation-receipt workflow remains verified and its proof is
  not overclaimed as live scoring or provider verification.
- The local/mock subscription workflow remains verified and its proof is not
  overclaimed as recurring billing, production access enforcement, or provider
  verification.
- The remaining Phase 3 contract workflows are implemented, tested, or
  explicitly deferred with hardening rationale.
- Live IOTA Names/Identity and VC validation gaps are either proven on
  testnet/official environment or blocked with exact missing config/API reason.
- A2A live discovery/server/auth/conformance gaps are implemented or blocked
  with exact unsupported capability boundaries.
- Standards bridges have current-doc refresh, fail-closed versioning,
  partial-failure evidence, and any safe live/provider proof available.
- Marketplace/operator product work has access-control and dispute-evidence
  proof before exposing logs, receipts, provider claims, or purchase actions.
- `npm run verify:local` and `git diff --check` pass from the final state.
- `npm run proof:product-status` reports the final product claim boundary and
  does not hide live/testnet, package publication, public A2A hosting,
  marketplace, custody, payment, or device-safety blockers.
- `npm run proof:launch-readiness` maps every major roadmap area to source
  evidence, local proof commands, blocker codes, and next gates without hiding
  local evidence gaps or live/production blockers.
- `npm run proof:operator-gates` classifies remaining live/testnet,
  publication, public A2A, payment, marketplace, custody, and safety gates
  without hiding required operator approval or external-service contact.
- `npm run proof:testnet-digest` verifies documented public IOTA testnet digest
  evidence locally without network access, and any `proof:testnet-digest:live`
  result is recorded as read-only lookup evidence or an exact RPC/blocker
  reason.
- `npm run proof:a2a-public-readiness` reports local A2A and loopback
  streaming proof while keeping public hosting, production key distribution,
  task auth, push, and external conformance blockers visible without operating
  public infrastructure.
- IOTA testnet readiness and any relevant testnet proof have been run where
  local credentials/config exist, or the blocker is recorded exactly.
- Every completed slice has a handoff with commands, manual checks, evidence,
  known unproven claims, risks, and commit hash.
- The final handoff states exactly what is local, mock, localnet, testnet,
  production-ready, and still out of scope.

## Next Safe Command Sequence

Start execution with:

```bash
git status --short --branch
sed -n '1,260p' docs/agentic-gaskit/full-roadmap-execution-goal.md
sed -n '1,260p' docs/agentic-gaskit/handoff-next-product-build.md
sed -n '1,220p' docs/marketplace-readiness.md
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
```

Then choose the next dependency-safe slice from the handoff. Do not run live
IOTA testnet commands until readiness and local credential configuration are
confirmed.
