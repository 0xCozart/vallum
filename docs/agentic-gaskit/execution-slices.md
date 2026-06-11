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

## Slice 2.8: IOTA Identity Live Proof Harness

User-visible outcome:
Operators have an opt-in command that can contact an operator-provided IOTA
Identity proof endpoint, validate a configured Agent Profile, resolve the
profile DIDs, validate credential refs, and apply the local VC trust policy
without printing endpoint, DID, or credential values.

Likely files:

- `scripts/smoke-iota-identity-live.ts`
- `scripts/iota-identity-live-smoke.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`
- `package.json`

Acceptance criteria:

- `npm run smoke:iota-identity-live` exists and builds before running.
- The command requires `IOTA_IDENTITY_PROOF_ENDPOINT`,
  `IOTA_IDENTITY_PROFILE_PATH`, and the VC trust-policy variables.
- Missing configuration reports exact variable names without printing values.
- Non-HTTPS non-loopback proof endpoints are blocked without printing endpoint
  values.
- The command validates the local Agent Profile before contacting the proof
  endpoint.
- The command routes DID resolution and credential validation through the
  existing registry identity verifier and trust-policy layer.
- The command is opt-in and not part of `npm run verify:local`.
- `npm run proof:live-status` reports Identity live config missing, invalid, or
  present instead of an unimplemented command blocker.

Verification:

- Focused Identity live smoke tests.
- Focused live proof status tests.
- Package-script wiring tests.
- `npm run proof:live-status`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 2.7.

Risk:
High. A proof endpoint can overclaim live Identity behavior unless it is backed
by a real IOTA Identity resolver and credential validator.

Escalation triggers:

- Product needs to bundle `@iota/identity-wasm` directly instead of using an
  operator proof endpoint.
- Operator wants this command to spend gas, publish identities, mutate
  revocation state, or accept credentials for production policy-gated actions.

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

## Slice 4.9: A2A Public Readiness Gate

User-visible outcome:
Operators and future agents have a non-networked readiness command that
separates local A2A proof from public hosting, production key distribution,
task authentication, streaming/push support, and external conformance evidence
before anyone claims live A2A interoperability.

Likely files:

- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/package-scripts.test.ts`
- `scripts/product-status.test.ts`
- `scripts/launch-readiness.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `apps/docs-site/docs.config.mjs`
- `package.json`

Acceptance criteria:

- `npm run proof:a2a-public-readiness` builds first and exits successfully
  after producing a non-networked readiness report.
- The command checks that local A2A proof commands and required source files
  are wired without operating a public server.
- Public Agent Card URL, public base URL, JWKS URL, task auth decision, and
  external conformance report inputs are classified without printing configured
  values or paths.
- Public URLs must be HTTPS and non-loopback before they can be reported as
  ready for operator approval.
- Streaming and push notifications remain explicit unsupported capabilities
  until a dedicated slice implements them.
- External A2A conformance remains blocked unless an operator supplies a local
  report path and the file exists.
- `npm run verify:local` includes only the non-networked readiness command and
  does not contact public A2A endpoints.
- Product-status, launch-readiness, and operator-gate reports point to the
  readiness command for the public A2A blocker without marking public A2A
  hosting complete.

Verification:

- Focused A2A public readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.8.

Risk:
Medium to high. A readiness report can be mistaken for public interoperability
unless it keeps public hosting, production keys, auth, streaming, push, and
external conformance blockers explicit.

Escalation triggers:

- Any request to make the readiness command fetch public A2A endpoints.
- Any request to mark public A2A hosting complete without operator-approved
  public hosting evidence, production key distribution, auth decisions, and
  external conformance evidence.

## Slice 4.10: A2A Local SSE Streaming Gate

User-visible outcome:
Agentic GasKit's local loopback A2A server can prove SSE task events from
`POST /message:stream` while keeping public hosting, push notifications,
production key distribution, and external conformance explicitly blocked.

Likely files:

- `packages/standards/src/a2aNodeServer.ts`
- `packages/standards/src/a2aNodeServer.test.ts`
- `examples/a2a-local-server/`
- `scripts/smoke-a2a-local-server.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The local Node loopback server intercepts `POST /message:stream`, reuses the
  existing authenticated task send path, and returns `200` with
  `text/event-stream`.
- Streaming responses emit sanitized task event payloads without bearer tokens,
  private prompts, signer refs, wallet internals, payment credentials, raw
  transaction bytes, user signatures, or private keys.
- The demo Agent Card advertises `capabilities.streaming: true` and
  `capabilities.pushNotifications: false`.
- The pure HTTP handler still fails closed for streaming and push routes when
  it cannot produce SSE.
- `npm run smoke:a2a-local-server` proves local SSE streaming instead of
  expecting unsupported streaming.
- `npm run proof:a2a-public-readiness` reports local streaming proof while
  keeping public hosting, production JWKS/auth, push, and external conformance
  blockers explicit.
- Product-status and launch-readiness wording no longer imply local streaming
  is missing, but they still do not mark public A2A interoperability complete.

Verification:

- Focused A2A Node server, HTTP handler, local server demo, and public-readiness
  tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run smoke:a2a-local-server`.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.9.

Risk:
Medium. Local streaming proof can be mistaken for public A2A conformance unless
the public-hosting, push-notification, production-key, auth, and conformance
blockers stay visible.

Escalation triggers:

- Any request to stream from a public host, configure push/webhooks, or claim
  external conformance without operator-approved public infrastructure and
  conformance evidence.

## Slice 4.11: A2A Push Notification Config Safety Gate

User-visible outcome:
Agentic GasKit can locally create, list, read, and delete A2A task push
notification configuration records while refusing webhook credential storage
and unsafe callback URLs. Webhook delivery remains explicitly unsupported.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aHttp.ts`
- `packages/standards/src/a2aHttp.test.ts`
- `examples/a2a-http/`
- `scripts/smoke-a2a-http.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The local A2A HTTP handler supports authenticated
  `/tasks/{task_id}/pushNotificationConfigs` collection create/list and item
  get/delete routes when a local push config store is supplied.
- Push config creation requires the route task to exist and rejects mismatched
  body task ids.
- Callback URLs must be HTTPS and must not include credentials, fragments,
  loopback hosts, private IPs, link-local IPs, or multicast/reserved IP ranges.
- Webhook `token` and authentication credential material are rejected and are
  not stored or echoed in responses.
- Authentication scheme declarations are preserved as non-secret metadata.
- `npm run smoke:a2a-http` proves local push config create/list and credential
  rejection without delivering a webhook.
- `npm run proof:a2a-public-readiness` reports local push configuration proof
  while keeping webhook delivery, public hosting, production JWKS/auth, and
  external conformance blockers explicit.
- Product-status and launch-readiness wording no longer imply all push
  capability is missing, but they still do not mark public A2A interoperability
  complete.

Verification:

- Focused A2A HTTP handler, A2A HTTP demo, and public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run smoke:a2a-http`.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.10.

Risk:
Medium. Local config storage can be mistaken for push delivery unless webhook
delivery and public-infrastructure blockers stay visible. URL validation also
must not become the only SSRF control for any future outbound delivery feature.

Escalation triggers:

- Any request to deliver push webhooks, store callback credentials, operate a
  public A2A host, or claim external conformance without a separate
  operator-approved security and infrastructure slice.

## Slice 4.12: A2A Authenticated Extended Agent Card Gate

User-visible outcome:
Agentic GasKit can locally serve an authenticated A2A extended Agent Card at
`/extendedAgentCard` when configured, while the public Agent Card advertises
extended-card availability and public A2A hosting/auth/conformance remain
blocked.

Likely files:

- `packages/standards/src/a2aHttp.ts`
- `packages/standards/src/a2aHttp.test.ts`
- `examples/a2a-http/`
- `scripts/smoke-a2a-http.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/external-api-notes.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- Public `GET /.well-known/agent-card.json` advertises
  `capabilities.extendedAgentCard: true` only when an extended card profile is
  configured.
- `GET /extendedAgentCard` requires the existing local A2A bearer auth
  boundary.
- `GET /extendedAgentCard` returns an Agent Card generated through the same
  redaction and validation path as public cards.
- Missing extended-card configuration fails closed without exposing skills,
  profile details, signer refs, wallet internals, credential refs, or payment
  material.
- Unsupported methods return `405` with `Allow: GET`.
- `npm run smoke:a2a-http` proves authenticated extended-card access and safe
  output.
- `npm run proof:a2a-public-readiness` reports local extended-card proof while
  keeping public hosting, production JWKS/auth, webhook delivery, and external
  conformance blockers explicit.
- Product-status and launch-readiness wording no longer imply all
  extended-card work is missing, but they still do not mark public A2A
  interoperability complete.

Verification:

- Focused A2A HTTP handler, A2A HTTP demo, and public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run smoke:a2a-http`.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slices 4.7 and 4.11.

Risk:
Medium. Extended cards can include more capability metadata than public cards,
so local proof must keep the same private-field redaction and must not be
described as production auth or public access control.

Escalation triggers:

- Any request to expose extended cards publicly, add production OAuth/mTLS
  auth, fetch public hosts, or claim external conformance without an
  operator-approved public infrastructure and auth slice.

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

## Slice 6.2: Package Publish Dry-Run Gate

User-visible outcome:
Release operators have one opt-in local command that builds all workspaces and
runs an npm publish dry-run for every public package, proving publication
command shape without publishing packages or requiring committed credentials.

Likely files:

- `scripts/package-publish-dry-run.ts`
- `scripts/package-publish-dry-run.test.ts`
- `scripts/package-publish.test.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/package-release-strategy.md`
- `package.json`

Acceptance criteria:

- `npm run publish:dry-run` builds first.
- The dry-run helper enumerates all non-private packages under `packages/*`.
- Private app workspaces are excluded.
- The helper invokes `npm publish --dry-run --tag next --access public` with
  explicit `-w` workspace arguments.
- The command prints package names and dry-run mode, but no registry tokens,
  one-time passwords, or credentials.
- The command is opt-in and not part of `npm run verify:local`.
- No real `npm publish` script is wired at the root.
- Docs state that dry-run proof is not publication, installability, npm
  account ownership, provenance, package-name availability, or release
  approval.

Verification:

- Focused package publish dry-run tests.
- Package metadata and package-script wiring tests.
- `npm run publish:dry-run`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 6.1.

Risk:
Medium. Dry-run output can be mistaken for a real release or for proof that
npm account ownership, package-name availability, 2FA, provenance, and
registry permissions are ready.

Escalation triggers:

- Any request to run real `npm publish`.
- Any npm token, OTP, provenance signing, organization ownership, package name
  transfer, namespace rename, or post-publish rollback decision.

## Slice 6.3: Package Install Smoke

User-visible outcome:
Release operators and reviewers have a deterministic local command that packs
all public workspace packages, installs them together into a fresh temporary
consumer project, and imports every published root entrypoint.

Likely files:

- `scripts/smoke-package-install.ts`
- `scripts/package-install-smoke.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/package-release-strategy.md`
- `docs/milestone-0-proof.md`
- `package.json`

Acceptance criteria:

- `npm run smoke:package-install` builds first.
- The smoke packs all public `packages/*` workspaces.
- Private app workspaces are excluded.
- The temporary consumer installs local tarballs with lifecycle scripts, audit,
  funding prompts, and package-lock writes disabled.
- The smoke imports every public package root entrypoint from the temporary
  consumer project.
- The smoke is wired into `npm run verify:local` after `pack:check`.
- The smoke does not claim registry installability, real npm publication,
  package-name ownership, package provenance, or downstream compatibility.

Verification:

- Focused package install smoke tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run smoke:package-install`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 6.2.

Risk:
Medium. Local tarball install can be mistaken for npm registry installability
or broader downstream compatibility if the non-claims are not explicit.

Escalation triggers:

- Any request to install packages from the npm registry.
- Any external consumer compatibility guarantee, package provenance decision,
  real publish, package rename, or registry ownership check.

## Slice 7.1: Product Status Proof Gate

User-visible outcome:
Operators and future agents have one non-networked command that reports the
current Agentic GasKit product evidence boundary: local proof gates configured,
live/testnet gates ready or blocked, and production-only claims still blocked
or safety-gated.

Likely files:

- `scripts/check-product-status.ts`
- `scripts/product-status.test.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`

Acceptance criteria:

- `npm run proof:product-status` builds first and exits successfully after
  producing a report.
- The command does not contact IOTA services, run live proof endpoints, publish
  packages, run payment providers, or operate public A2A endpoints.
- The report includes `complete=false` while live/testnet, publication,
  marketplace, custody, A2A hosting, payment, or device-safety blockers remain.
- The report reuses the existing live proof status checks without printing
  endpoint, credential, profile path, or secret-like configured values.
- Local verification and package release gates are checked mechanically from
  root script wiring.
- Real publish and live proof commands remain opt-in.
- `npm run verify:local` includes the product-status gate after local package
  install smoke and before docs/secret checks.
- Docs explain that product-status proof is an audit boundary, not product
  completion.

Verification:

- Focused product-status tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:product-status`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 6.3.

Risk:
Medium. A status report can be mistaken for product completion unless
`complete=false`, blocker codes, and non-claims remain explicit.

Escalation triggers:

- Any request to turn product status into a live proof run.
- Any request to mark production marketplace, payment, custody, package
  publication, public A2A hosting, or physical device access as complete
  without dedicated live/operator-approved proof.

## Slice 7.2: Launch Readiness Evidence Matrix

User-visible outcome:
Operators and future agents have one non-networked command that maps every
major roadmap area to source evidence, local proof commands, current blocker
codes, and next gates before any launch or completion claim.

Likely files:

- `scripts/check-launch-readiness.ts`
- `scripts/launch-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/product-status.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`

Acceptance criteria:

- `npm run proof:launch-readiness` builds first and exits successfully after
  producing a matrix.
- The command does not contact IOTA services, run live proof endpoints, publish
  packages, run payment providers, or operate public A2A endpoints.
- The matrix covers Phase 1 sponsored policy, Phase 2 identity/VC, Phase 3
  contracts/device safety, Phase 4 standards, Phase 5 marketplace/operator,
  Phase 6 packages, and Packet H final product status.
- Each area lists source evidence paths, local proof commands, blocker codes,
  and next gates.
- Missing source evidence fails the local evidence check.
- The matrix imports product-status blockers so launch readiness remains
  `launchReady=false` while live/testnet, publication, marketplace, custody,
  A2A hosting, payment, or device-safety blockers remain.
- `npm run verify:local` includes the launch-readiness gate after
  product-status and before docs/secret checks.
- Docs explain that launch-readiness evidence is a matrix, not live proof or
  product completion.

Verification:

- Focused launch-readiness tests.
- Product-status tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:launch-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 7.1.

Risk:
Medium. A launch-readiness matrix can become stale or be mistaken for actual
launch readiness unless blocker import, source-path checks, and
`launchReady=false` remain enforced.

Escalation triggers:

- Any request to mark the product launch-ready while product-status still
  reports blockers.
- Any request to bypass live/testnet proof, production marketplace gates,
  registry publication proof, public A2A proof, custody review, payment proof,
  or device safety approval.

## Slice 7.3: Operator Live-Gate Runbook

User-visible outcome:
Operators and future agents have one non-networked command that converts the
current product-status blockers into an executable live-gate runbook before any
testnet, endpoint, publication, payment, marketplace, custody, or device action
is attempted.

Likely files:

- `scripts/check-operator-live-gates.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `package.json`

Acceptance criteria:

- `npm run proof:operator-gates` builds first and exits successfully after
  producing a report.
- The command does not contact IOTA services, IOTA Names, IOTA Identity, npm,
  payment providers, public A2A endpoints, marketplace systems, or physical
  devices.
- The report imports product-status checks and classifies gates as
  `proven-local`, `ready-to-run`, `blocked-config`, `requires-approval`,
  `blocked-production`, or `deferred-safety`.
- Testnet readiness can be `ready-to-run` for the non-networked readiness
  command when local config is present.
- Configured IOTA Names and IOTA Identity endpoint smokes remain
  `requires-approval` because they contact live services.
- Publication, public A2A, payment/provider, marketplace, custody, and
  physical-device gates remain approval-gated, production-blocked, or
  safety-deferred until dedicated slices record stronger evidence.
- Output lists command names and next gates without printing configured
  endpoint URLs, names, addresses, profile paths, credentials, tokens, OTPs, or
  secret-like values.
- `npm run verify:local` includes the operator-gates proof after
  launch-readiness and before docs/secret checks.
- Docs explain that operator-gates is a runbook, not live proof or approval.

Verification:

- Focused operator live-gate tests.
- Product-status tests.
- Launch-readiness tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:operator-gates`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 7.2.

Risk:
Medium. A runbook can be mistaken for approval to run live endpoints or
publish packages unless approval, external-contact, and safety flags remain
explicit.

Escalation triggers:

- Any request to make `proof:operator-gates` execute live commands directly.
- Any request to run configured live endpoint, npm publication, payment,
  public A2A, marketplace, custody, or device commands without explicit
  operator intent and a dedicated proof slice.

## Slice 7.4: Testnet Digest Proof Gate

User-visible outcome:
Reviewers and future agents have one deterministic local command proving that
the repo's documented successful IOTA testnet digest is present in the public
evidence docs, plus a separate opt-in read-only IOTA testnet lookup command.
The slice strengthens testnet evidence without requiring sponsor credentials,
private `.env` values, gas reservation, signing, or transaction execution.

Likely files:

- `scripts/check-testnet-digest-proof.ts`
- `scripts/testnet-digest-proof.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/testnet-digest-proof.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/testnet-readiness.md`
- `docs/milestone-0-proof.md`
- `docs/reviewer-walkthrough.md`
- `docs/quickstart.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `apps/docs-site/docs.config.mjs`
- `package.json`

Acceptance criteria:

- `npm run proof:testnet-digest` builds first and exits successfully after
  checking local docs only.
- The local command verifies that the documented public testnet digest appears
  in required reviewer evidence docs.
- `npm run proof:testnet-digest:live` is available as an opt-in read-only IOTA
  testnet lookup for that digest.
- The live lookup command does not sign, sponsor, reserve gas, execute
  transactions, use sponsor credentials, or print secret-like values.
- `npm run verify:local` includes only the non-networked digest proof command,
  not the opt-in live lookup.
- Product-status, launch-readiness, operator-gate, reviewer, quickstart, and
  overview docs distinguish documented digest proof from new sponsored testnet
  execution.
- Live lookup failures record an exact RPC/testnet blocker without invalidating
  local proof unless required local digest docs are missing.

Verification:

- Focused testnet digest proof tests.
- Product-status tests.
- Launch-readiness tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:testnet-digest`.
- `npm run proof:testnet-digest:live` when intentionally checking read-only
  testnet RPC reachability.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slices 7.1-7.3 and the prior documented successful testnet digest evidence.

Risk:
Medium. Read-only testnet lookup can be mistaken for fresh sponsored execution
unless command names, docs, and launch-readiness blockers keep the boundary
explicit.

Escalation triggers:

- Any request to put the live lookup in `verify:local`.
- Any request to treat a successful digest lookup as proof of current sponsor
  credentials, production custody, package publication, marketplace launch, or
  fresh transaction execution.

## Slice 7.5: Verification Profile Speed Gate

User-visible outcome:
Developers and reviewers have a faster deterministic iteration command for
ordinary build/test/improve loops, while the full local verification gate
remains the only reviewer, release, handoff, and launch evidence surface.

Likely files:

- `scripts/check-verification-profiles.ts`
- `scripts/verification-profiles.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/product-status.test.ts`
- `scripts/launch-readiness.test.ts`
- `scripts/reviewer-docs.test.ts`
- `docs/agentic-gaskit/verification-profiles.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/full-roadmap-execution-goal.md`
- `docs/agentic-gaskit/codex-active-goal.md`
- `docs/agentic-gaskit/handoff-next-product-build.md`
- `docs/milestone-0-proof.md`
- `docs/reviewer-walkthrough.md`
- `docs/quickstart.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `apps/docs-site/docs.config.mjs`
- `package.json`

Acceptance criteria:

- `npm run verify:fast` exists for bounded deterministic iteration.
- `verify:fast` includes build, TypeScript tests, docs check, secret scan, and
  non-networked product-status, launch-readiness, and operator-gate reports.
- `verify:fast` does not run Move tests, product smokes, package dry-runs,
  publication dry-runs, live testnet commands, live IOTA Names/Identity smokes,
  payment/provider commands, public A2A hosting, or physical-device commands.
- `npm run proof:verification-profiles` reports the fast profile, confirms the
  full `verify:local` gate is preserved, and confirms `grant:check` still uses
  `verify:local`.
- `npm run verify:local` includes the verification-profile audit before
  product-status, launch-readiness, and operator-gates.
- Docs explain that `verify:fast` is not launch evidence by itself.

Verification:

- Focused verification-profile tests.
- Product-status tests.
- Launch-readiness tests.
- Package-script wiring tests.
- Reviewer-docs regression tests.
- `npm run proof:verification-profiles`.
- `npm run verify:fast`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slices 7.1-7.4 and Slice 4.9.

Risk:
Medium. A fast command can be mistaken for release evidence unless
`grant:check`, product-status, launch-readiness, and docs keep the full gate
explicit.

Escalation triggers:

- Any request to replace `verify:local` or `grant:check` with `verify:fast`.
- Any request to remove safety-critical negative tests merely to reduce the
  subtest count.
- Any request to put live, publication, payment, public A2A, marketplace,
  custody, or physical-device commands in the fast profile.
