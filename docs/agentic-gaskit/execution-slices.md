# Executable Vertical Work Packets

Last updated: 2026-06-10.

Use these packets as the implementation queue. Each packet should be completed,
verified, and handed off before moving to the next unless the dependency graph
requires a small supporting change.

Global slice rules:

- Start each slice by reading the owning PRD, `docs/agentic-gaskit/module-specs.md`,
  `docs/agentic-gaskit/verification-hardening.md`, and `docs/agentic-gaskit/planning-structure-audit.md`.
- Run `git status --short --branch` before editing and preserve unrelated work.
- Refresh `docs/agentic-gaskit/external-api-notes.md` before any slice that touches IOTA,
  MCP, x402, AP2, A2A, package names, adapter interfaces, or protocol fields.
- Complete one user/operator-visible outcome per slice.
- End each slice with commands run, manual checks, evidence, risks, and commit
  hash in the handoff.
- Make a structured commit per completed slice unless the user explicitly asks
  not to commit.

## Slice 0.1: Repo Scaffold

User-visible outcome:
A clean checkout has install, lint, typecheck, test, and docs commands.

Likely files:

- `package.json`
- workspace config
- `.gitignore`
- `README.md`
- `.env.example`
- `packages/*`
- `contracts/*`

Acceptance criteria:

- Install works.
- Test script runs at least one starter test.
- Typecheck script runs.
- No secret values are committed.
- Git repository is initialized on the chosen default branch.
- Baseline planning commit exists before implementation commits.

Verification:

- install command
- lint command
- typecheck command
- unit test command
- `git status --short --branch`
- `git log --oneline --decorate -n 5`

Dependencies:
None.

Risk:
Medium. Wrong scaffold choices create churn.

Escalation triggers:

- Official IOTA tooling requires a different repo structure.
- Contract tests cannot run under the selected workspace layout.

## Slice 0.2: External API Refresh Notes

User-visible outcome:
Implementation agents know the current official API shape before coding against
IOTA or external standards.

Likely files:

- `docs/agentic-gaskit/external-api-notes.md`
- `README.md`

Acceptance criteria:

- Notes include current official links and exact implementation assumptions for
  Gas Station, TS SDK, Move tests, Names, Identity, MCP, x402, AP2, and A2A.
- Unknowns are labeled as blockers or follow-ups.

Verification:

- Manual review against official docs.

Dependencies:
None. Run the scaffold-critical parts before Slice 0.1 if package names,
tooling, localnet commands, or adapter interfaces could change scaffold
choices. Complete the full refresh before any Phase 1 slice begins unless the
user explicitly accepts a documented blocker.

Risk:
Medium. Protocol docs change over time.

Escalation triggers:

- Official docs contradict phase PRD assumptions.

## Slice 0.3: Existing IOTA GasKit Integration Map

User-visible outcome:
Future implementation agents know which existing IOTA GasKit surfaces to reuse
instead of rebuilding sponsorship infrastructure in this repo.

Likely files:

- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/roadmap.md`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/external-api-notes.md`

Acceptance criteria:

- The current fork documents existing GasKit sponsorship behavior as the
  foundation.
- Reusable existing surfaces are named: SDK, policy gateway, Gas Station
  boundary, app credentials, quotas, observability, testnet readiness,
  sponsor-wallet safety, and secret hygiene.
- Agentic GasKit-specific surfaces are separated: manifests, agent wallets,
  profiles, MCP/A2A, contracts, receipts, and standards bridges.
- Any duplicated gateway/SDK behavior requires an explicit migration or adapter
  reason.

Verification:

- Bounded read of existing GasKit README, product docs, security docs, and
  local skill.
- `git status --short --branch` in this fork, preserving unrelated dirty work.
- Docs check.

Dependencies:
Slices 0.1 and 0.2.

Risk:
Medium. Without this slice, agents may rebuild the wrong product.

Escalation triggers:

- User decides to replace this fork with a different remote or branch strategy.
- Existing GasKit APIs are incompatible with the agent-layer requirements.

## Slice 1.0: Agent Account And Wallet Manager Contract

User-visible outcome:
Agents can create wallets in mock/local mode, but receive signer references
rather than seeds or raw private keys.

Likely files:

- `packages/accounts/`
- `packages/sdk/src/accounts/`
- `packages/mcp-server/src/tools.ts`
- `packages/registry/src/profileSchema.ts`
- `docs/agentic-gaskit/account-wallet-safety.md`

Acceptance criteria:

- Agent wallet creation returns address, wallet id, signer reference, status,
  and allowed scopes.
- Returned values do not include seed, mnemonic, private key, or raw keypair.
- Wallet creation requires authenticated owner/agent context and rate limits.
- Signer references are opaque handles and cannot be accepted as standalone
  authorization for signing or sponsorship.
- Recovery/export is explicit and unavailable to autonomous agent runtimes by
  default.
- Agent-created wallets can be bound to profile metadata.
- SDK/MCP value-bearing use still routes through policy gateway.
- Humans/operators can fund agent wallets directly or through GasKit-controlled
  sponsorship without granting unrestricted signing authority.

Verification:

- Unit tests for in-memory wallet creation.
- Redaction tests for secret-looking fixture values.
- SDK/MCP tests proving signer refs are passed, not raw secrets.
- Negative tests proving possession of a signer ref without the matching
  owner/agent context does not authorize signing.
- Policy integration tests proving signer refs do not bypass gateway.

Dependencies:
Slice 0.3.

Risk:
High. Wallet management can accidentally become a custody or secret-exposure
surface.

Escalation triggers:

- Need for production KMS, custody, or mainnet signer operation.
- Any requirement to expose raw seeds outside explicit recovery workflows.

## Slice 1.1: Manifest Schema

User-visible outcome:
Every agent action can be represented as a versioned signed intent before
policy or chain execution.

Likely files:

- `packages/manifest/src/schema.ts`
- `packages/manifest/src/validate.ts`
- `packages/manifest/test/fixtures.ts`

Acceptance criteria:

- Valid manifest fixture passes.
- Missing agent, counterparty, expiry, max spend, action, or idempotency key
  fails.
- Expired manifest fails.
- Unsupported schema version fails closed.

Verification:

- Unit tests.
- Typecheck.

Dependencies:
Slices 0.1, 0.2, and 0.3. Slice 1.0 can run before or alongside this if wallet
references are included in the manifest.

Risk:
Low.

Escalation triggers:

- AP2 mandate compatibility requires changing core manifest semantics.

## Slice 1.2: Pure Policy Evaluator

User-visible outcome:
Operators can deterministically approve or deny an action before sponsorship.

Likely files:

- `packages/policy-gateway/src/evaluatePolicy.ts`
- `packages/policy-gateway/src/policySchema.ts`
- `packages/policy-gateway/test/evaluatePolicy.test.ts`

Acceptance criteria:

- Known valid action is approved.
- Unknown agent denied.
- Missing manifest denied.
- Expired manifest denied.
- Over-budget action denied.
- Disallowed contract/action denied.
- Unauthorized counterparty denied.
- Missing simulation denied when required.
- Human approval required above threshold.

Verification:

- Unit tests covering allow/deny matrix.

Dependencies:
Slice 1.1.

Risk:
High. This is a security boundary.

Escalation triggers:

- Any rule depends on LLM judgment.
- Any fallback allows unknown actions.

## Slice 1.3: Gateway Mock Mode

User-visible outcome:
Agents can submit sponsorship requests to a local gateway and receive policy
decisions without live IOTA dependencies.

Likely files:

- `packages/policy-gateway/src/server.ts`
- `packages/policy-gateway/src/routes.ts`
- `packages/policy-gateway/src/mockGasStationAdapter.ts`

Acceptance criteria:

- Gateway starts locally.
- Valid request returns approved decision and mock sponsorship id.
- Denied request returns reason code.
- Logs are redacted.

Verification:

- Integration tests.
- Manual curl or script.

Dependencies:
Slice 1.2.

Risk:
Medium.

Escalation triggers:

- Gateway stores secrets or full prompt content in logs.

## Slice 1.4: SDK Sponsored Action

User-visible outcome:
Developer can call an SDK method instead of manually constructing gateway
requests.

Likely files:

- `packages/sdk/src/IotaAgent.ts`
- `packages/sdk/src/requestSponsoredAction.ts`
- `packages/sdk/test/`

Acceptance criteria:

- SDK submits manifest to gateway.
- SDK returns typed approved/denied result.
- SDK does not bypass gateway.

Verification:

- SDK integration tests against mock gateway.

Dependencies:
Slice 1.3.

Risk:
Medium.

Escalation triggers:

- SDK needs direct IOTA execution for value-bearing action before policy is
  stable.

## Slice 1.5: MCP Sponsorship Tools

User-visible outcome:
An agent runtime can request IOTA actions through MCP tools.

Likely files:

- `packages/mcp-server/src/tools.ts`
- `packages/mcp-server/src/server.ts`
- `packages/mcp-server/test/`

Acceptance criteria:

- `iota.request_sponsored_transaction` calls SDK/gateway.
- `iota.open_escrow` calls SDK/gateway.
- Invalid tool input returns typed error.
- MCP tools cannot directly sponsor or submit transactions.

Verification:

- MCP server smoke test.
- Gateway integration test.

Dependencies:
Slice 1.4.

Risk:
High. Tool bypass would break the security model.

Escalation triggers:

- MCP SDK API changed materially from assumptions.

## Slice 1.6: Escrow And Receipt MVP

User-visible outcome:
Demo can open escrow, release on verifier approval, refund/expire, and emit
receipt state.

Likely files:

- `contracts/escrow_v1/`
- `contracts/receipt_v1/`
- `packages/receipts/src/schema.ts`
- `packages/sdk/src/contracts/openEscrow.ts`

Acceptance criteria:

- Escrow create/release/refund tests pass.
- Double release denied.
- Unauthorized verifier denied.
- Receipt status updates through lifecycle.

Verification:

- Move tests.
- SDK/gateway integration test in mock/localnet.

Dependencies:
Slice 1.5.

Risk:
High. Contract semantics must be precise.

Escalation triggers:

- Need to custody real funds.
- Move test harness unavailable.

## Slice 1.7: Agent-To-Agent Escrow Demo

User-visible outcome:
A reproducible demo shows an agent hiring another agent and releasing escrow
after verification.

Likely files:

- `examples/agent-escrow/`
- `README.md`
- `docs/demo-agent-escrow.md`

Acceptance criteria:

- Demo runs from documented commands.
- Shows approve and deny paths.
- Shows receipt/log output.

Verification:

- Manual demo.
- Scripted smoke test where practical.

Dependencies:
Slice 1.6.

Risk:
Medium.

Escalation triggers:

- Demo requires live mainnet or external paid APIs.

## Slice 2.1: Agent Profile Schema

User-visible outcome:
Agent name/profile data is represented by a stable schema.

Likely files:

- `packages/registry/src/profileSchema.ts`
- `packages/registry/test/profileSchema.test.ts`

Acceptance criteria:

- Valid profile passes.
- Missing name/address/DID/capabilities/endpoints fails.
- Revoked and expired profiles have explicit states.

Verification:

- Unit tests.

Dependencies:
Slice 1.2.

Risk:
Low.

Escalation triggers:

- Current A2A Agent Card schema requires incompatible core fields.

## Slice 2.2: Resolver With Local Fixtures

User-visible outcome:
SDK can resolve a local/test profile and policy can use capabilities.

Likely files:

- `packages/registry/src/resolveAgent.ts`
- `packages/sdk/src/resolveAgent.ts`
- `packages/policy-gateway/src/capabilityCheck.ts`

Acceptance criteria:

- `resolveAgent` returns profile.
- Revoked/expired profiles deny policy-gated actions.
- Capability mismatch denies protected actions.

Verification:

- Unit and integration tests.

Dependencies:
Slice 2.1.

Risk:
Medium.

Escalation triggers:

- Live IOTA Names/Identity APIs needed to finish local behavior.

## Slice 2.3: IOTA Names And Identity Adapters

User-visible outcome:
Profile resolution can use IOTA Names and Identity on localnet/testnet after API
verification.

Likely files:

- `packages/registry/src/iotaNamesAdapter.ts`
- `packages/registry/src/iotaIdentityAdapter.ts`
- `docs/agentic-gaskit/external-api-notes.md`

Acceptance criteria:

- Adapter interfaces match current official APIs.
- Mock tests pass.
- Manual testnet resolution path documented.

Verification:

- Mock integration tests.
- Manual testnet command.

Dependencies:
Slice 2.2.

Risk:
High. External APIs may change.

Escalation triggers:

- IOTA Names cannot store/resolve required metadata safely.
- Identity integration requires third-party provider decisions.

## Slice 2.4: Identity Revocation Cache Hardening

User-visible outcome:
Profile identity verification can use bounded cached DID and credential
evidence without accepting stale identity data after the cache TTL expires.

Likely files:

- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/registry/src/iotaIdentityAdapter.test.ts`
- `packages/registry/README.md`
- continuation and overview docs

Acceptance criteria:

- Successful IOTA Identity DID and credential verification results can be
  cached only inside an explicit finite TTL.
- Cache keys bind to profile identity, wallet status, profile status,
  revocation state, expiry, and credential references.
- Expired cache entries are not used to approve active profiles.
- If stale identity evidence cannot refresh, profile resolution fails closed.
- If a credential is revoked after cache expiry, profile resolution returns a
  revoked profile error.
- Protected actions can force identity refresh even inside the cache TTL.
- The slice does not claim live IOTA Identity proof without operator-owned
  testnet credentials.

Verification:

- Focused registry identity adapter tests.
- `npm run typecheck`
- `npm run verify:local`
- `npm run readiness:testnet`, or exact local configuration blocker.

Dependencies:
Slice 2.3.

Risk:
High. Identity caches can accidentally accept revoked agents if cache TTL and
fail-closed behavior are not explicit.

Escalation triggers:

- Product requires live revocation freshness stronger than a bounded cache TTL.
- Live IOTA Identity credential validation requires issuer trust or third-party
  verifier decisions not represented in local configuration.

## Slice 2.5: IOTA Names Live Resolution Smoke

User-visible outcome:
Operators have an opt-in command that can prove a configured IOTA Names
GraphQL endpoint resolves an expected name/address pair, or reports an exact
configuration blocker without leaking endpoint secrets.

Likely files:

- `scripts/smoke-iota-names-live.ts`
- `scripts/iota-names-live-smoke.test.ts`
- `packages/registry/src/iotaNamesAdapter.ts`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/external-api-notes.md`

Acceptance criteria:

- The smoke requires `IOTA_NAMES_GRAPHQL_URL`, `IOTA_NAMES_NAME`, and
  `IOTA_NAMES_EXPECTED_ADDRESS`.
- Missing required configuration exits as a blocker and prints only variable
  names, not secret-like values.
- The smoke uses the existing registry adapter query shape for
  `resolveIotaNamesAddress(name) { address }`.
- Resolved-address mismatch fails closed.
- The command is opt-in and is not included in `npm run verify:local`.
- No Gas Station, sponsor wallet, signer, or transaction execution path is
  touched.

Verification:

- Focused live-smoke unit tests.
- Script-wiring tests proving the smoke is not part of local verification.
- Missing-config CLI blocker proof.
- `npm run typecheck`
- `npm run docs:check`
- `npm run secrets:scan`
- `npm run verify:local`

Dependencies:
Slice 2.3.

Risk:
Medium. Live GraphQL endpoints may require operator-specific deployment,
network, or IOTA Names setup.

Escalation triggers:

- No safe IOTA Names GraphQL endpoint/name/address pair exists for testnet.
- The official IOTA Names GraphQL shape changes from the current documented
  `resolveIotaNamesAddress` operation.

## Slice 2.6: Live Proof Status Report

User-visible outcome:
Operators and future agents can run one safe command that reports which
live/testnet proof paths are ready to run and which are blocked, without
contacting live services or printing configured values.

Likely files:

- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`
- `package.json`

Acceptance criteria:

- `npm run proof:live-status` exists and builds before running.
- The status command does not contact IOTA Names, IOTA Identity, IOTA RPC, Gas
  Station, payment facilitators, A2A endpoints, or npm.
- Missing testnet `.env` is reported as `TESTNET_ENV_FILE_MISSING`.
- Missing IOTA Names configuration is reported as
  `IOTA_NAMES_LIVE_CONFIG_MISSING` with only variable names.
- Unsafe IOTA Names GraphQL endpoints are blocked without printing endpoint
  values.
- Live IOTA Identity and full VC validation are listed as blocked until live
  resolver, trusted issuer, verification method, revocation, and cache policy
  configuration exists.
- The command is not part of `npm run verify:local`.

Verification:

- Focused live proof status tests.
- Package-script wiring tests.
- `npm run proof:live-status` on the current machine.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run verify:local`.

Dependencies:
Slice 2.5.

Risk:
Medium. A proof-status command can be mistaken for live proof unless it clearly
separates ready-to-run configuration from actual live/testnet execution.

Escalation triggers:

- The command needs to contact live services.
- Live Identity/VC proof requires issuer trust, resolver configuration, or
  revocation decisions not represented in local config.

## Slice 2.7: Identity VC Trust Policy

User-visible outcome:
Operators have a local fail-closed VC trust-policy evaluator that can be wired
to an injected IOTA Identity credential validator before any policy-gated
action accepts credential evidence.

Likely files:

- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/registry/src/iotaIdentityAdapter.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`

Acceptance criteria:

- Credential validation can require trusted issuer DIDs.
- Credential validation can require allowed verification methods controlled by
  the trusted issuer.
- Credential validation can require credential types and accepted revocation
  status mechanisms.
- Revoked, expired, stale, unsupported-status, missing-evidence, and
  missing-validator paths fail closed.
- Identity verification cache keys include trust-policy inputs so evidence
  gathered under a weaker policy cannot satisfy a stronger policy.
- `npm run proof:live-status` reports exact missing or invalid live
  trust-policy configuration instead of saying the local VC policy is undefined.
- No live IOTA Identity SDK import, live DID resolution, live credential
  validation command, Gas Station request, or testnet transaction is added.

Verification:

- Focused registry identity adapter tests.
- Focused live proof status tests.
- `npm run proof:live-status`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 2.6.

Risk:
High. A local trust-policy evaluator must not be mistaken for live issuer
verification, live revocation lookup, or production provider verification.

Escalation triggers:

- Product needs live credential JWT parsing, issuer DID resolution, or
  revocation lookup.
- Operator wants to accept live policy-gated actions from VC evidence.
- Trust policy values need to be managed as production config or rotated.

## Slice 3.1: Contract Metadata Registry

User-visible outcome:
Policy can allow contracts by stable template id and version rather than raw
package addresses.

Likely files:

- `packages/contracts-metadata/`
- `packages/policy-gateway/src/contractAllowList.ts`

Acceptance criteria:

- Approved template/version accepted.
- Unknown package denied.
- Mismatched version denied.

Verification:

- Unit tests.

Dependencies:
Slice 1.6.

Risk:
Medium.

Escalation triggers:

- Package upgrade semantics conflict with stable template ids.

## Slice 3.2: Pay-Per-Call Tool Contract

User-visible outcome:
A paid MCP tool can require payment and issue a receipt.

Likely files:

- `contracts/pay_per_call_v1/`
- `packages/sdk/src/contracts/payPerCall.ts`
- `examples/paid-mcp-tool/`

Acceptance criteria:

- Pay-per-call tests pass.
- Tool result is delivered only after policy/payment/receipt path succeeds.
- Failed payment does not return paid result.

Verification:

- Move tests.
- Integration demo.

Dependencies:
Slice 3.1.

Risk:
High.

Escalation triggers:

- Real external payment rail required before mock proof.

## Slice 3.3: Data License Workflow

User-visible outcome:
A data buyer can request a local/mock data license through policy-gated
sponsorship and receive receipt evidence for granted, denied, failed, and
revoked access states.

Likely files:

- `contracts/data_license_v1/`
- `packages/receipts/src/index.ts`
- `packages/sdk/src/contracts/dataLicense.ts`
- `packages/contracts-metadata/src/index.ts`
- `examples/data-license/`

Acceptance criteria:

- Data-license Move tests pass.
- Contract metadata gates policy allow-list by `data_license_v1` template and
  version.
- SDK helper routes through `requestSponsoredAction` and does not grant access
  on policy denial or missing access proof.
- Receipt state records dataset id, terms hash, access proof hash, expiry,
  revocation, failure, sponsorship, and transaction digest without private
  access material.
- Local example proves approved, policy-denied, and access-proof-failed paths.

Verification:

- Move tests.
- Receipt and SDK unit/integration tests.
- Local data-license smoke.

Dependencies:
Slice 3.1.

Risk:
High. Data access can become a private-data, legal, or settlement surface if
the mock proof is overextended.

Escalation triggers:

- Real data-provider credentials, private access-token issuance, legal license
  enforcement, live settlement, provider verification, or production data
  delivery.

## Slice 3.4: Service Bounty Workflow

User-visible outcome:
A requester can post a local/mock service bounty through policy-gated
sponsorship and receive receipt evidence for provider completion, release,
denial, and failed completion states.

Likely files:

- `contracts/service_bounty_v1/`
- `packages/receipts/src/index.ts`
- `packages/sdk/src/contracts/serviceBounty.ts`
- `packages/contracts-metadata/src/index.ts`
- `examples/service-bounty/`

Acceptance criteria:

- Service-bounty Move tests pass.
- Contract metadata gates policy allow-list by `service_bounty_v1` template and
  version.
- SDK helper routes through `requestSponsoredAction` and does not release a
  bounty on policy denial or missing completion proof.
- Receipt state records bounty id, deliverable hash, completion proof, release
  proof, failure, sponsorship, and transaction digest without private provider
  payloads.
- Local example proves approved, policy-denied, and completion-proof-failed
  paths.

Verification:

- Move tests.
- Receipt and SDK unit/integration tests.
- Local service-bounty smoke.

Dependencies:
Slice 3.1.

Risk:
High. Service bounty flows can become marketplace, provider-verification,
dispute, or real settlement surfaces if the mock proof is overextended.

Escalation triggers:

- Production marketplace listing, real provider credentials, legal service
  enforcement, live settlement, provider verification, staking/bonding, or
  public dispute moderation.

## Slice 3.5: Reputation Receipt Workflow

User-visible outcome:
An issuer can record a local/mock reputation receipt for a completed agent
interaction through policy-gated sponsorship and receive receipt evidence for
attested, denied, and failed evidence states.

Likely files:

- `contracts/reputation_receipt_v1/`
- `packages/receipts/src/index.ts`
- `packages/sdk/src/contracts/reputationReceipt.ts`
- `packages/contracts-metadata/src/index.ts`
- `examples/reputation-receipt/`

Acceptance criteria:

- Reputation-receipt Move tests pass.
- Contract metadata gates policy allow-list by `reputation_receipt_v1` template
  and version.
- SDK helper routes through `requestSponsoredAction` and does not collect or
  complete reputation evidence on policy denial.
- Receipt state records issuer id, subject id, interaction id, criteria hash,
  score, evidence hash, attestation hash, failure, sponsorship, and transaction
  digest without private review payloads.
- Evidence references are hash-like values; raw review text, signer refs,
  bearer tokens, payment credentials, and private prompt material fail closed.
- Local example proves approved, policy-denied, and evidence-failed paths.
- Docs and demo output label reputation receipts as local evidence, not public
  marketplace scoring or provider verification.

Verification:

- Move tests.
- Receipt and SDK unit/integration tests.
- Local reputation-receipt smoke.

Dependencies:
Slice 3.1.

Risk:
High. Reputation receipts can become marketplace ranking, moderation, provider
verification, or legal trust claims if the mock proof is overextended.

Escalation triggers:

- Production marketplace scoring, real provider verification, legal trust
  enforcement, staking/bonding, public moderation, or live identity proof.

## Slice 3.6: Subscription Workflow

User-visible outcome:
A subscriber can start, renew, cancel, or fail a local/mock subscription through
policy-gated sponsorship and receive receipt evidence for active, renewed,
denied, canceled, and failed subscription states.

Likely files:

- `contracts/subscription_v1/`
- `packages/receipts/src/index.ts`
- `packages/sdk/src/contracts/subscription.ts`
- `packages/contracts-metadata/src/index.ts`
- `examples/subscription/`

Acceptance criteria:

- Subscription Move tests pass.
- Contract metadata gates policy allow-list by `subscription_v1` template and
  version.
- SDK helper routes start and renewal through `requestSponsoredAction` and does
  not activate or renew on policy denial or missing subscription proof.
- Receipt state records subscriber id, provider id, plan id, terms hash, period
  start/end, renewal count, activation proof, renewal proof, cancellation,
  failure, sponsorship, and transaction digest without private access tokens,
  payment credentials, or legal terms payloads.
- Evidence references are hash-like values; raw access tokens, bearer tokens,
  signer refs, payment credentials, and private prompt material fail closed.
- Local example proves approved start, policy-denied start, renewal, cancel,
  and failed-proof paths.
- Docs and demo output label subscription as local entitlement evidence, not
  production recurring billing, legal enforcement, live settlement, or
  marketplace subscription operation.

Verification:

- Move tests.
- Receipt and SDK unit/integration tests.
- Local subscription smoke.

Dependencies:
Slice 3.1.

Risk:
High. Subscription flows can become recurring billing, payment-provider,
provider-access, legal entitlement, or marketplace operation surfaces if the
mock proof is overextended.

Escalation triggers:

- Production recurring billing, real payment credentials, x402/AP2 settlement,
  private access-token issuance, legal subscription enforcement, provider
  verification, or public marketplace subscription listing.

## Slice 3.7: Device Access Lease Safety Gate

User-visible outcome:
The roadmap explicitly blocks physical device access and records the only safe
future path: a virtual or simulated device lease proof that cannot operate real
hardware.

Likely files:

- `docs/agentic-gaskit/device-access-safety-gate.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/marketplace-readiness.md`
- `scripts/roadmap-safety.test.ts`

Acceptance criteria:

- Physical device operation remains blocked.
- Future work is limited to virtual, simulated, emulator, or non-physical API
  fixtures until an owner-approved physical safety design exists.
- The gate names physical-device, provider-accountability, revocation,
  emergency-stop, credential, privacy, dispute, compliance, and marketplace
  blockers.
- Docs do not claim a `device_access_lease_v1` Move contract, SDK helper,
  receipt state, package metadata, marketplace action, localnet/testnet deploy,
  or live device workflow.
- A regression test keeps the blocker and non-implementation boundary visible.

Verification:

- Roadmap safety regression test.
- Docs check.
- Secret scan.
- `npm run verify:local`.

Dependencies:
Slice 3.6.

Risk:
High. Device access can create physical safety, regulatory, provider
accountability, and incident-response obligations if it is treated as another
generic payment contract.

Escalation triggers:

- Any request to operate real hardware, locks, vehicles, robots, sensors with
  actuators, industrial equipment, medical systems, or safety-critical devices.
- Any request for production device provider onboarding, marketplace listing,
  live credentials, custody, staking, bonding, slashing, insurance, or legal
  lease enforcement.

## Slice 4.1: x402 Mapping

User-visible outcome:
x402 payment requirements can become Agentic GasKit manifests and receipts.

Likely files:

- `packages/standards/x402/`
- `packages/manifest/src/x402Mapping.ts`
- `packages/receipts/src/x402Receipt.ts`

Acceptance criteria:

- x402 requirement maps to manifest.
- Unsupported protocol version fails closed.
- Logs redact payment metadata.

Verification:

- Unit tests.
- Mock facilitator integration.

Dependencies:
Slice 1.6.

Risk:
High. Active standard.

Escalation triggers:

- Need to run production facilitator or handle real payment credentials.

## Slice 4.2: AP2 Mandate Mapping

User-visible outcome:
AP2-style checkout/payment mandates map to manifests and dispute evidence.

Likely files:

- `packages/standards/ap2/`
- `packages/manifest/src/ap2Mapping.ts`
- `packages/receipts/src/ap2Receipt.ts`

Acceptance criteria:

- Checkout and payment mandate fixtures map to manifest and receipt.
- Trusted-surface boundary is represented.
- Dispute evidence pointer preserved.

Verification:

- Unit tests.

Dependencies:
Slice 1.1.

Risk:
High.

Escalation triggers:

- Need for real AP2 participant credentials or production payment processors.

## Slice 4.3: A2A Agent Card

User-visible outcome:
Agent profile can be exposed as an A2A-compatible discovery document.

Likely files:

- `packages/standards/a2a/`
- `packages/registry/src/a2aCard.ts`

Acceptance criteria:

- Card generation from profile works.
- Revoked/expired profiles do not advertise active skills.
- Auth and endpoint fields are present.

Verification:

- Unit tests.
- Manual schema check against current A2A docs.

Dependencies:
Slice 2.1.

Risk:
Medium.

Escalation triggers:

- Current A2A schema changes path or required fields.

## Slice 4.4: A2A Well-Known Serving

User-visible outcome:
Agent profile discovery can be served locally at the canonical A2A Agent Card
well-known path.

Likely files:

- `packages/registry/src/a2aWellKnown.ts`
- `packages/standards/src/a2a.ts`
- `examples/a2a-well-known/`
- `scripts/smoke-a2a-well-known.ts`

Acceptance criteria:

- `GET /.well-known/agent-card.json` returns a current A2A Agent Card response.
- Response content type is `application/a2a+json`.
- Revoked and expired profiles fail closed and do not advertise active skills.
- Non-GET methods and legacy discovery paths do not serve active cards by
  default.
- Response JSON omits signer refs, wallet internals, credential refs,
  revocation refs, payment addresses, and private profile metadata.

Verification:

- Unit tests.
- Local smoke script.
- `npm run verify:local`.

Dependencies:
Slice 4.3.

Risk:
Medium. Discovery metadata can overclaim live interoperability or leak private
profile fields.

Escalation triggers:

- Need for public hosting, signed Agent Cards, A2A task/message protocol
  operations, external conformance testing, or live A2A discovery proof.

## Slice 4.5: A2A Task And Message Local Operations

User-visible outcome:
Agentic GasKit can model local/mock A2A task and message operations using
current A2A task semantics while binding task initiation to Agentic GasKit
manifest and policy metadata.

Likely files:

- `packages/standards/src/a2aTask.ts`
- `packages/standards/src/a2aTask.test.ts`
- `examples/a2a-task-message/`
- `scripts/smoke-a2a-task-message.ts`

Acceptance criteria:

- Send-message validates protocol version, message id, role, parts, and
  Agentic manifest/policy metadata before creating or continuing a task.
- Policy-denied task requests return rejected task state without artifacts or
  sponsored/value-bearing output.
- Input-required tasks accept matching follow-up messages, while terminal tasks
  reject follow-up messages.
- Get/list/cancel helpers preserve task state semantics and omit artifacts by
  default unless requested.
- Task history and log-safe output redact private prompt text, bearer tokens,
  payment credentials, signer refs, wallet internals, and key-like material.
- Local smoke is wired into `npm run verify:local`.

Verification:

- Standards unit tests.
- Local A2A task/message smoke.
- `npm run verify:local`.

Dependencies:
Slice 4.4.

Risk:
Medium. Local A2A helpers can overclaim interoperability if described as a live
server or external conformance proof.

Escalation triggers:

- Need for live public hosting, signed Agent Cards, streaming, push
  notifications, external A2A client conformance, live discovery, or production
  agent authentication decisions.

## Slice 4.6: A2A Local HTTP Boundary

User-visible outcome:
Agentic GasKit can expose local/mock A2A Agent Card discovery and task/message
operations through a deterministic HTTP-shaped handler with explicit bearer
authentication for task routes.

Likely files:

- `packages/standards/src/a2aHttp.ts`
- `packages/standards/src/a2aHttp.test.ts`
- `examples/a2a-http/`
- `scripts/smoke-a2a-http.ts`
- `package.json`
- `scripts/package-scripts.test.ts`

Acceptance criteria:

- Public `GET /.well-known/agent-card.json` remains available without task
  bearer auth.
- Task/message routes fail closed when bearer auth is missing, wrong, or not
  configured.
- Authorized local task routes can send a message, get a task, list tasks, and
  cancel a task using the existing local A2A task store.
- Get/list task reads omit artifacts by default unless explicitly requested.
- Unsupported streaming and push-notification routes return explicit
  unsupported responses rather than silently pretending support.
- Safe error JSON never echoes bearer tokens, private prompts, signer refs,
  wallet internals, or payment credentials.
- Local smoke is wired into `npm run verify:local`.
- This slice does not claim public hosting, signed Agent Cards, streaming,
  push notifications, external conformance, or live A2A discovery proof.

Verification:

- Standards unit tests.
- Local A2A HTTP smoke.
- `npm run verify:local`.

Dependencies:
Slice 4.5.

Risk:
Medium to high. A local HTTP boundary can be mistaken for live public A2A
interoperability unless unsupported operations, auth, and deployment boundaries
stay explicit.

Escalation triggers:

- Need for public hosting, signed Agent Cards, streaming, push notifications,
  external A2A client conformance, live discovery, or production agent
  authentication decisions.

## Slice 4.7: A2A Signed Agent Card Local Proof

User-visible outcome:
Agentic GasKit can sign and verify local A2A Agent Cards using a current
A2A-shaped JWS signature envelope and canonicalized payload, without claiming
live public discovery or production provider trust.

Likely files:

- `packages/registry/src/a2aCard.ts`
- `packages/registry/src/a2aCard.test.ts`
- `packages/registry/src/a2aWellKnown.test.ts`
- `packages/standards/src/a2a.ts`
- `examples/a2a-signed-card/`
- `scripts/smoke-a2a-signed-card.ts`
- `package.json`
- `scripts/package-scripts.test.ts`

Acceptance criteria:

- Signing uses a JWS protected header with `alg`, `typ`, and `kid`, signs the
  canonical Agent Card payload, and excludes the `signatures` field from the
  signed payload.
- Verification succeeds only with a trusted matching public key and fails
  closed for tampered cards, wrong keys, required-key mismatches, unsupported
  algorithms, malformed protected headers, missing signatures, and stale or
  not-yet-valid signatures.
- Well-known response helpers can serve signed cards through existing options.
- Signing rejects blank key ids, invalid JWKS URLs, invalid signature times, and
  private metadata in public Agent Cards.
- Local smoke is wired into `npm run verify:local`.
- This slice does not claim public hosting, external A2A conformance, live
  discovery, production authentication, production provider verification, or
  production key management.

Verification:

- Registry unit tests.
- Local A2A signed-card smoke.
- `npm run verify:local`.

Dependencies:
Slice 4.6.

Risk:
Medium to high. Signatures can be mistaken for public trust or production key
management if key distribution, revocation, hosting, and external conformance
boundaries are not explicit.

Escalation triggers:

- Need for production JWKS hosting, key rotation policy, public discovery,
  external A2A conformance, live provider verification, or production A2A
  authentication decisions.

## Slice 4.8: A2A Local Loopback Server Smoke

User-visible outcome:
Agentic GasKit can run the local A2A discovery and task/message handler behind
a real loopback HTTP server, proving local server semantics over network
requests without claiming public hosting, live discovery, or external
conformance.

Likely files:

- `packages/standards/src/a2aNodeServer.ts`
- `packages/standards/src/a2aNodeServer.test.ts`
- `packages/standards/src/index.ts`
- `examples/a2a-local-server/`
- `scripts/smoke-a2a-local-server.ts`
- `package.json`
- `scripts/package-scripts.test.ts`

Acceptance criteria:

- The exported local Node server helper starts a loopback-only HTTP server on
  an ephemeral port by default and refuses non-loopback hosts unless explicitly
  opted in.
- `GET /.well-known/agent-card.json` works over HTTP and returns a signed Agent
  Card that verifies with a trusted local public key.
- Task/message routes require bearer authentication and fail closed without it.
- Authorized HTTP calls can send a message, get a task, list tasks, and cancel
  a task using the existing local A2A task store.
- Default task reads omit artifacts unless explicitly requested.
- Unsupported streaming remains explicit with a `501` response.
- Malformed and oversized request bodies return safe JSON errors.
- Smoke output does not expose bearer tokens, private prompts, signer refs,
  wallet internals, payment credentials, or private keys.
- Local smoke is wired into `npm run verify:local`.
- This slice does not claim public hosting, live A2A discovery, external A2A
  conformance, streaming support, push notification support, production Agent
  Card key management, or production A2A authentication.

Verification:

- Standards package Node server tests.
- Local A2A loopback server demo test.
- Package-script wiring test.
- Local A2A loopback server smoke.
- `npm run verify:local`.

Dependencies:
Slices 4.6 and 4.7.

Risk:
Medium to high. A local loopback server can be mistaken for a public A2A server
unless public hosting, key distribution, live discovery, and conformance
boundaries remain explicit.

Escalation triggers:

- Need for public hosting, external A2A client conformance, production JWKS
  hosting, key rotation policy, live discovery, streaming, push notifications,
  or production A2A authentication decisions.

## Slice 5.1: Marketplace Readiness Gate

User-visible outcome:
Team can decide whether marketplace work is justified by working primitives.

Likely files:

- `docs/marketplace-readiness.md`

Acceptance criteria:

- Phases 1-4 demos pass.
- Risks reviewed.
- Marketplace non-goals remain explicit.
- Compliance/security questions listed.

Verification:

- Manual readiness review.

Dependencies:
Phases 1-4.

Risk:
Medium.

Escalation triggers:

- Any real-money production use, custody, provider verification, or moderation
  requirements.

## Slice 5.2: Marketplace Access And Dispute Evidence Read Model

User-visible outcome:
Agentic GasKit can build a read-only local marketplace evidence view from
existing registry profiles, policy compatibility, contract template metadata,
receipts, manifests, and standards evidence without duplicating those sources
of truth or enabling production marketplace actions.

Likely files:

- `packages/marketplace/`
- `scripts/smoke-marketplace-read-model.ts`
- `package.json`
- `scripts/package-scripts.test.ts`
- `docs/marketplace-readiness.md`

Acceptance criteria:

- Provider listing labels distinguish active, revoked, expired, unverified,
  mock, local, testnet, and live evidence states without claiming provider
  verification.
- Policy compatibility is computed from existing profile capability policy
  checks rather than UI-only hints.
- Supported contract templates are exposed read-only from the existing contract
  metadata registry.
- Receipt views enforce buyer/provider/operator/reviewer access control.
- Dispute evidence bundles preserve stable links across manifest, receipt,
  contract template, transaction digest, and standards evidence references.
- Evidence bundles redact private prompts, bearer tokens, raw keys, signer
  refs, wallet internals, payment credentials, and provider private metadata.
- Local smoke is wired into `npm run verify:local`.
- This slice does not create a production marketplace UI/API, provider
  onboarding, real-money settlement, custody, staking, bonding, moderation, or
  provider verification.

Verification:

- Marketplace package tests.
- Package-script wiring tests.
- `npm run smoke:marketplace-read-model`.
- `npm run verify:local`.

Dependencies:
Slice 5.1.

Risk:
High. Marketplace evidence can become a trust, payment, moderation, or provider
verification claim if labels, access control, and local/mock boundaries are not
explicit.

Escalation triggers:

- Any production provider listing, public scoring, provider verification, live
  payment settlement, dispute moderation, custody, staking, bonding, or
  marketplace action execution.

## Slice 6.1: Package Namespace And Release Metadata Strategy

User-visible outcome:
Agentic GasKit has a documented package namespace decision and mechanical
release metadata checks so future package work is installable without mixing a
namespace migration into security-sensitive wallet, gateway, payment, identity,
A2A, or marketplace slices.

Likely files:

- `docs/agentic-gaskit/package-release-strategy.md`
- `docs/agentic-gaskit/migration-plan.md`
- `README.md`
- `apps/docs-site/docs.config.mjs`
- `scripts/package-publish.test.ts`
- `scripts/package-scripts.test.ts`

Acceptance criteria:

- The conservative current `@iota-gaskit/*` namespace decision is documented.
- Any future `@agentic-gaskit/*` rename is explicitly deferred to a dedicated
  compatibility slice.
- The monorepo root remains private.
- Publishable workspace package metadata is consistent for namespace, version,
  ESM entrypoints, exports, files, license, side-effect flag, Node engine,
  public prerelease publish config, and internal dependency pins.
- Private app workspaces are not treated as publishable package surfaces.
- Root `build` and `pack:check` cover every public package workspace.
- No real package publish is run or claimed.

Verification:

- Package publish metadata tests.
- Package script wiring tests.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 5.2.

Risk:
Medium. Package naming churn can break consumers, docs, examples, imports, and
lockfiles if it is mixed into product feature work.

Escalation triggers:

- Any request to rename packages to `@agentic-gaskit/*`.
- Any request to run real `npm publish`.
- Any package release requiring registry credentials, provenance, tags,
  changelogs, or downstream compatibility guarantees.
