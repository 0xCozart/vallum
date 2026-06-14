# Executable Vertical Work Packets

Last updated: 2026-06-10.

Use these packets as the implementation queue. Each packet should be completed,
verified, and handed off before moving to the next unless the dependency graph
requires a small supporting change.

Global slice rules:

- Start each slice by reading the owning public roadmap/status section and
  `docs/agentic-gaskit/verification-hardening.md`.
- Run `git status --short --branch` before editing and preserve unrelated work.
- Refresh current official provider documentation before any slice that touches IOTA,
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

- current official provider documentation
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
- current official provider documentation

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

## Slice 1.0.1: Production Custody Readiness Gate

User-visible outcome:
Operators have a non-networked custody readiness command that separates local
signer-reference account proof from production custody, KMS, recovery,
staking, bonding, slashing, or signer-operation claims.

Likely files:

- `scripts/check-custody-readiness.ts`
- `scripts/custody-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/package-scripts.test.ts`
- `scripts/product-status.test.ts`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `package.json`

Acceptance criteria:

- `npm run proof:custody-readiness` builds first and does not contact a KMS,
  external signer, IOTA services, Gas Station endpoints, custody provider, or
  live wallet infrastructure.
- The readiness command checks account signer-reference source, tests, package
  README, wallet safety docs, verification hardening docs, account build
  coverage, and local verification coverage.
- The command remains excluded from `verify:fast`, `verify:local`, and
  `grant:check` because it is an operator production-readiness gate, not a
  default local proof command.
- Missing `CUSTODY_PRODUCTION_REPORT` keeps production custody blocked with an
  exact blocker code.
- A valid structured report requires status-only evidence for signer-reference
  contract review, no agent secret exposure, KMS/external signer review,
  recovery/export review, rotation/revocation review, audit logging,
  legal/security review, and incident response.
- Unsafe report fields such as seeds, mnemonics, private keys, raw keypairs,
  signer material, credentials, payloads, headers, signatures, or local secret
  paths are rejected.
- Product status, launch readiness, and operator gates point production custody
  at the readiness command without claiming production custody launch.

Verification:

- Focused custody readiness tests.
- Account package tests.
- Product-status, launch-readiness, operator-gate, and package-script tests.
- `npm run proof:custody-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 1.0.

Risk:
High. A custody readiness report can be mistaken for production custody,
recovery/export approval, staking/bonding/slashing approval, or live signer
operation unless it stays redacted, opt-in, and manually reviewed.

Escalation triggers:

- Any production KMS integration, external signer operation, custody of user or
  provider funds, recovery export, staking, bonding, slashing, or mainnet
  signer behavior.

## Slice 1.0.2: Custody Production Proof Plan Packet

User-visible outcome:
Custody operators have a non-networked proof-plan command that turns the
custody production readiness gate into command order, required structured
report fields, required check ids, blocker codes, and proof boundaries before
any production custody, KMS, external signer, recovery, staking, bonding,
slashing, or signer-operation review.

Likely files:

- `scripts/write-custody-production-proof-plan.ts`
- `scripts/write-custody-production-proof-plan.test.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/launch-readiness.test.ts`
- `docs/agentic-gaskit/account-wallet-safety.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/CODEBASE_MAP.md`
- `package.json`

Acceptance criteria:

- `npm run custody:write-production-proof-plan` builds first and does not
  contact KMS, external signers, custody providers, IOTA services, Gas Station,
  or live wallet infrastructure.
- The plan reports current blocker codes, ready approval codes, command order,
  required operator input names, required structured report fields, required
  structured report check ids, and safety boundaries.
- The plan can write a mode-0600 ignored local JSON artifact.
- The plan does not print or require seeds, mnemonics, private keys, raw
  keypairs, signer material, credentials, authorization headers, payloads,
  signatures, exported keys, or local secret paths.
- Operator live gates point production custody review at the plan before
  custody readiness and any dedicated custody/security design slice.
- Launch readiness includes the plan as Phase 1 custody evidence without
  clearing production custody blockers.

Verification:

- Focused custody production proof-plan tests.
- Focused custody-readiness, package-script, operator-gate, product-status,
  and launch-readiness tests.
- `npm run custody:write-production-proof-plan -- --out
  tmp/gaskit/custody-production-proof-plan.json`.
- `npm run proof:custody-readiness`.
- `npm run proof:operator-gates`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 1.0.1.

Risk:
High. A proof plan can be mistaken for production custody, KMS readiness,
recovery/export approval, staking, bonding, slashing, or signer-operation
approval unless the artifact stays redacted, opt-in, and manually reviewed.

Escalation triggers:

- Any request to create production custody infrastructure, integrate KMS or
  external signers, export recovery material, handle signer material, stake,
  bond, slash, or approve custody operations.

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
- current official provider documentation

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
- current official provider documentation

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

## Slice 2.9: Live Proof Plan Packet

User-visible outcome:
Operators have a non-networked live-proof plan command that turns the current
testnet, Gas Station, IOTA Names, IOTA Identity, and VC readiness state into a
redacted command-order artifact before any live proof command runs.

Likely files:

- `scripts/write-live-proof-plan.ts`
- `scripts/write-live-proof-plan.test.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/launch-readiness.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/CODEBASE_MAP.md`
- `package.json`

Acceptance criteria:

- `npm run live:write-proof-plan` builds first and does not contact IOTA RPC,
  Gas Station HTTP, IOTA Names, IOTA Identity, payment providers, A2A
  endpoints, npm, marketplace systems, custody providers, or physical devices.
- The plan reports current blocker codes, ready codes, command order, required
  operator input names, required evidence artifact names, and safety
  boundaries.
- The plan can write a mode-0600 ignored local JSON artifact.
- The plan does not print configured endpoint values, profile paths, names,
  addresses, credentials, tokens, private keys, raw transaction bytes, user
  signatures, credential payloads, response bodies, or local secret paths.
- Operator live gates point IOTA Names, IOTA Identity, and VC live proof prep
  at the plan before live smoke commands.
- Launch readiness includes the plan as Phase 2 evidence without clearing live
  proof blockers.

Verification:

- Focused live proof plan tests.
- Focused live proof status, package-script, operator-gate, product-status, and
  launch-readiness tests.
- `npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json`.
- `npm run proof:operator-gates`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slices 2.6, 2.7, 2.8, and the Gas Station runtime preflight/testnet upstream
gates.

Risk:
Medium. A proof plan can be mistaken for live IOTA Names, live IOTA Identity,
live VC validation, or sponsored testnet execution unless the artifact stays
clearly non-networked and approval-gated.

Escalation triggers:

- Operator wants the plan to run live smokes automatically.
- The plan needs to include configured endpoint values, profile paths, names,
  addresses, credential payloads, response bodies, or local secret paths.
- Product needs production provider verification or public trust acceptance
  from live Identity evidence.

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
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
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
- current official provider documentation
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
- current official provider documentation
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
- current official provider documentation
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

## Slice 4.13: A2A Local Push Delivery Envelope Gate

User-visible outcome:
Agentic GasKit can locally prove A2A push notification delivery envelopes
through an injected transport, while public webhook delivery, default outbound
network calls, production auth, public hosting, and external conformance remain
blocked.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `packages/standards/src/a2aHttp.ts`
- `packages/standards/src/a2aHttp.test.ts`
- `examples/a2a-http/`
- `scripts/smoke-a2a-http.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- Push delivery request construction uses sanitized task payloads and the A2A
  media type.
- Delivery uses only an explicitly injected local transport; there is no
  default outbound HTTP client.
- Delivery requests do not include webhook credentials, bearer authorization
  headers, signer refs, wallet internals, payment material, or private prompt
  text.
- Transport errors are captured as failed delivery attempts and do not fail the
  task route.
- The A2A HTTP demo proves local push config plus injected delivery after a
  task update.
- `npm run proof:a2a-public-readiness` reports local injected delivery proof
  separately from public webhook delivery blockers.
- Product-status and launch-readiness wording no longer imply all push
  delivery work is missing, but they still do not mark public A2A
  interoperability complete.

Verification:

- Focused A2A push, A2A HTTP handler, A2A HTTP demo, and public-readiness
  tests.
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
Slices 4.10, 4.11, and 4.12.

Risk:
Medium to high. Local injected transport proof can be mistaken for production
webhook delivery unless public hosting, SSRF hardening for outbound workers,
production task auth, credential handling, and external conformance blockers
stay visible.

Escalation triggers:

- Any request to add default outbound webhook delivery, store callback
  credentials, operate a public A2A host, or claim external conformance without
  a separate operator-approved security and infrastructure slice.

## Slice 4.14: A2A Push HTTP Transport Safety Gate

User-visible outcome:
Agentic GasKit has an opt-in A2A push notification HTTP transport helper that
can be locally tested against mocked `fetch`, while public webhook delivery,
default outbound delivery, webhook credentials, production auth, public
hosting, and external conformance remain blocked until operator-approved
infrastructure proof exists.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The HTTP transport helper must be explicitly constructed and injected; no
  default outbound webhook delivery is added to task routes.
- The helper reuses the same safe public HTTPS callback URL boundary as push
  config creation and rejects unsafe destinations before calling `fetch`.
- The helper posts the sanitized A2A task payload with the existing A2A media
  type and protocol-version headers.
- The helper does not add authorization headers or store webhook credentials.
- The helper disables redirects or treats redirects as failure, applies a
  bounded timeout, and returns only status-level delivery evidence.
- Tests prove successful mocked delivery, unsafe URL rejection before network
  contact, redirect/failure handling, timeout handling, and no secret-looking
  material in emitted requests or results.
- `npm run proof:a2a-public-readiness` reports local opt-in HTTP transport
  readiness separately from external public webhook proof, which remains
  blocked.
- Product-status and launch-readiness wording make clear that public webhook
  infrastructure proof remains missing.

Verification:

- Focused A2A push and public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.13.

Risk:
High. A safe-looking HTTP helper can become a production webhook delivery
claim unless it remains opt-in, locally mocked, credential-free, and separated
from public endpoint proof, SSRF controls beyond static URL validation,
production auth, retry policy, observability, and conformance evidence.

Escalation triggers:

- Any request to enable the HTTP transport by default in task routes, store
  callback credentials, follow redirects, fetch DNS/IP ranges for full SSRF
  proof, operate a public A2A host, run an external conformance suite, or claim
  public webhook delivery without operator-approved infrastructure evidence.

## Slice 4.15: A2A Push Delivery Retry Observability Gate

User-visible outcome:
Agentic GasKit can locally prove retry and delivery-attempt observability for
A2A push notification delivery through explicitly injected transports, while
public webhook delivery workers, default outbound delivery, webhook
credentials, production auth, public hosting, and external conformance remain
blocked.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- Retry is opt-in and applies only to explicitly supplied transports.
- Default delivery behavior remains a single attempt so existing HTTP route
  semantics do not create background retries.
- Retry attempts stop after first success or configured max attempts.
- Retry metadata records config id, task id, status, HTTP status/error code,
  attempt number, observed time, and next retry time without request bodies,
  bearer headers, signer refs, wallet internals, payment material, or private
  prompt text.
- Retry delay calculation is bounded and deterministic in tests.
- Attempt recording is local and in-memory only.
- `npm run proof:a2a-public-readiness` reports local retry/observability proof
  separately from public webhook infrastructure proof, which remains blocked.

Verification:

- Focused A2A push and public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.14.

Risk:
High. Retry and observability primitives can be mistaken for a production
delivery worker unless the implementation stays local, in-memory, opt-in,
credential-free, and separated from public endpoint proof, persistent queues,
production auth, full SSRF protection, and conformance evidence.

Escalation triggers:

- Any request to run a background delivery worker, persist webhook attempts,
  store callback credentials, contact public endpoints by default, claim
  production delivery observability, or mark public webhook delivery complete
  without operator-approved infrastructure evidence.

## Slice 4.16: A2A Public Push Delivery Evidence Gate

User-visible outcome:
Agentic GasKit can classify an operator-supplied local public push delivery
report path after an approved public webhook proof run, while the default
checkout remains blocked and no public endpoints are contacted by the readiness
command.

Likely files:

- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- `A2A_PUBLIC_PUSH_DELIVERY_REPORT` is classified as missing, configured but
  not found, or ready for approval without printing configured paths.
- Unconfigured checkouts keep `publicReady=false` and an explicit public push
  delivery blocker.
- A configured public push delivery report can make the public push delivery
  check `ready-approval` only when the file exists locally.
- `publicReady=true` is possible only when all local proof checks are
  `proven-local` and every public/config/conformance evidence check is
  `ready-approval`; this remains a review state, not live execution.
- The readiness command remains non-networked and does not fetch public Agent
  Cards, post webhooks, run conformance tooling, publish JWKS, or store
  credentials.
- Product-status and launch-readiness wording distinguish redacted report
  classification from public hosting, production key distribution, production
  auth, persistent delivery infrastructure, and external conformance proof.

Verification:

- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:local`.

Dependencies:
Slice 4.15.

Risk:
High. A local report path can be mistaken for live public webhook delivery
unless the command keeps paths redacted, performs no network calls, and treats
`ready-approval` as evidence for a future human/operator review rather than
automatic interoperability acceptance.

Escalation triggers:

- Any request to generate the public push report by contacting endpoints from
  this command, store webhook credentials, run background delivery workers,
  persist queue state, mark production delivery complete, or claim external
  conformance without operator-approved public infrastructure evidence.

## Slice 4.17: A2A Public Evidence Report Schema Gate

User-visible outcome:
Agentic GasKit validates operator-supplied public A2A evidence reports as
structured JSON review evidence instead of accepting any existing local file.

Likely files:

- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- Public push delivery and external conformance report paths are still
  redacted, but the file content must be a JSON object with `schemaVersion: 1`,
  the expected `kind`, `result: "passed"`, and a recent `observedAt`
  timestamp.
- When public base URL or public Agent Card URL configuration is present, the
  structured report must match those configured URLs without printing them.
- Empty, plain-text, malformed, failed, stale, wrong-kind, or
  endpoint-mismatched reports remain `blocked-conformance`.
- Valid structured reports can produce `ready-approval`, but that remains a
  future human/operator review state rather than live public interoperability.
- The readiness command remains non-networked and does not fetch public Agent
  Cards, post webhooks, run conformance tooling, publish JWKS, operate workers,
  persist queues, store credentials, or print report contents.

Verification:

- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.16.

Risk:
Medium. The stricter report schema improves audit quality, but `ready-approval`
can still be mistaken for live public interoperability unless docs and status
reports keep public hosting, production auth/key management, public webhook
infrastructure, and external conformance acceptance separate.

Escalation triggers:

- Any request to read or print raw report payloads, store credentials, call
  public endpoints from the readiness command, or treat a structured report as
  automatic public A2A completion without operator review.

## Slice 4.18: A2A Public Discovery Proof Harness

User-visible outcome:
Operators get an opt-in command for public Agent Card and JWKS discovery proof
after public A2A infrastructure is approved and configured outside the repo.

Likely files:

- `scripts/smoke-a2a-public-discovery.ts`
- `scripts/a2a-public-discovery-smoke.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-operator-live-gates.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- `npm run smoke:a2a-public-discovery` is available as an opt-in command and is
  excluded from `verify:fast`, `verify:local`, and `grant:check`.
- Missing or unsafe public discovery configuration is blocked before network
  contact and formatted output redacts configured values.
- The command only probes public HTTPS, non-loopback Agent Card and JWKS URLs,
  with bounded response size, timeout, and no redirects followed automatically.
- Public Agent Card validation checks JSON shape, `HTTP+JSON` interface binding
  to `A2A_PUBLIC_BASE_URL`, configured task-auth decision alignment, and absence
  of secret-like public fields.
- JWKS validation checks non-empty public keys with key ids and rejects private
  JWK material.
- Passing proof remains public discovery/JWKS evidence only. It is not external
  conformance, public push webhook delivery, production key-rotation approval,
  production auth approval, provider verification, live IOTA proof, or launch
  readiness.

Verification:

- Focused public discovery smoke tests.
- Package-script tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.17.

Risk:
Medium to high. This is an opt-in networked public A2A proof command, so it
must stay outside default local verification, redact configured values, and
avoid turning public discovery/JWKS reachability into broader conformance or
production-readiness claims.

Escalation triggers:

- Any request to put the public discovery smoke in default verification, print
  configured URLs or response bodies, send task messages, post webhooks, store
  credentials, follow redirects automatically, or claim external conformance
  from discovery/JWKS reachability alone.

## Slice 4.19: A2A Public Discovery Report Gate

User-visible outcome:
Operators can turn an approved public discovery/JWKS smoke run into structured
local evidence, and the public-readiness gate requires that evidence before
`publicReady=true` is possible.

Likely files:

- `scripts/smoke-a2a-public-discovery.ts`
- `scripts/a2a-public-discovery-smoke.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- `npm run smoke:a2a-public-discovery -- --report <path>` writes a structured
  local report only after public Agent Card and JWKS validation passes.
- The structured report uses `schemaVersion: 1`, kind
  `a2a-public-discovery`, result `passed`, a recent `observedAt`, configured
  public Agent Card/base/JWKS URLs, task-auth decision, and passed check ids.
- `npm run proof:a2a-public-readiness` requires
  `A2A_PUBLIC_DISCOVERY_REPORT` before `publicReady=true` is possible.
- Missing, absent, malformed, stale, failed, wrong-kind, endpoint-mismatched,
  JWKS-mismatched, or task-auth-mismatched discovery reports remain blocked
  with redacted output.
- Valid discovery reports are `ready-approval` only. They are not external A2A
  conformance, public push delivery, production auth approval, production key
  rotation approval, live IOTA proof, provider verification, or launch
  readiness.

Verification:

- Focused public discovery smoke tests.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.18.

Risk:
Medium. This connects public network proof output to the readiness gate, so it
must stay redacted, operator-approved, and approval-only.

Escalation triggers:

- Any request to make the readiness command fetch public endpoints, accept a
  report without structured validation, treat discovery as external
  conformance, or put public network calls in default verification.

## Slice 4.20: A2A Push Callback URL Hardening

User-visible outcome:
Operators get local proof that A2A push callback URLs cannot smuggle webhook
tokens or credentials through URL query strings before public webhook delivery
infrastructure is considered.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- A2A push callback URLs with query strings are rejected before config storage.
- A2A push callback URLs with query strings are rejected before injected HTTP
  transport delivery.
- Rejection errors do not print query parameter names or values.
- Existing public HTTPS callback URLs without credentials, query strings, or
  fragments continue to work through injected/local tests.
- A2A public-readiness, product-status, launch-readiness, and public docs
  classify this as local callback admission hardening only, not public webhook
  delivery infrastructure or external conformance.

Verification:

- Focused `packages/standards/src/a2aPush.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.19.

Risk:
Medium. URL query strings often carry webhook secrets; tightening them must not
be mistaken for public webhook delivery proof.

Escalation triggers:

- Any request to allow query-token callback URLs, store webhook credentials,
  run background delivery workers, persist queues, or mark public webhook
  delivery complete without operator-approved public infrastructure evidence.

## Slice 4.21: A2A Push Callback Host Allowlist

User-visible outcome:
Operators get local proof that A2A push callback URLs can be constrained to an
exact callback hostname allowlist before public webhook delivery infrastructure
is considered.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- Push config creation can require an exact callback hostname allowlist.
- Injected HTTP transport can require the same exact callback hostname
  allowlist even if a caller supplies a mutated request URL.
- Disallowed callback hosts are rejected before storage or delivery without
  printing configured hostnames or URL values.
- Safe public HTTPS callbacks without query strings/fragments still work when
  their hostname is allowlisted.
- A2A public-readiness, product-status, launch-readiness, and public docs
  classify this as local host-admission proof only, not public webhook delivery
  infrastructure or external conformance.

Verification:

- Focused `packages/standards/src/a2aPush.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.20.

Risk:
Medium. Host allowlisting is necessary for future public webhook delivery, but
it is not endpoint ownership proof, production auth, production observability,
or external conformance.

Escalation triggers:

- Any request to treat host allowlisting as public webhook delivery proof,
  accept wildcard or query-token callback patterns without a separate design,
  store webhook credentials, run background delivery workers, or persist
  queues in this slice.

## Slice 4.23: A2A Push Durable Attempt Evidence

User-visible outcome:
Operators get local file-backed A2A push delivery-attempt evidence without
storing task bodies, webhook credentials, response bodies, or raw transport
errors.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- A local JSONL attempt store can append and list delivery-attempt records.
- Durable records preserve status-only metadata: config id, task id, callback
  URL, attempt number, observed time, retry time, HTTP status, and safe error
  code.
- Durable records do not include request JSON, task body/history/artifacts,
  response bodies, raw transport errors, bearer tokens, private prompt text,
  signer refs, wallet internals, payment secrets, or webhook credentials.
- Unsafe callback URLs are rejected before they enter durable attempt evidence.
- A2A public-readiness, product-status, launch-readiness, and public docs
  classify this as local durable attempt evidence only, not public webhook
  delivery workers, persistent delivery queues, production observability, or
  external conformance.

Verification:

- Focused `packages/standards/src/a2aPush.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.21.

Risk:
Medium. Durable status evidence is useful operator infrastructure, but it can
be mistaken for public delivery, worker, queue, or production observability
proof.

Escalation triggers:

- Any request to persist task bodies, webhook credentials, raw transport
  errors, response bodies, queue jobs, or request payloads in this slice.
- Any request to run public webhooks, background workers, public A2A hosts, or
  external conformance from this local evidence store.

## Slice 4.24: A2A Push Local Delivery Queue

User-visible outcome:
Operators get a local file-backed A2A push delivery queue primitive with
sanitized delivery envelopes, claim state, and completion state before any
public webhook worker is considered.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- A local file-backed queue can enqueue sanitized A2A push delivery requests.
- Queue records can be claimed and marked complete locally.
- Queued delivery requests use public headers only and safe public HTTPS
  callback URLs.
- Queued payloads reuse existing A2A task redaction and do not persist raw
  private prompt text, bearer values, signer refs, wallet internals, payment
  secrets, webhook credentials, authorization headers, cookie headers, response
  bodies, or raw transport errors.
- Unsafe callback URLs are rejected before they enter the local queue file.
- A2A public-readiness, product-status, launch-readiness, and public docs
  classify this as local queue proof only, not public webhook worker proof,
  public delivery proof, endpoint ownership proof, production auth, production
  observability, or external conformance.

Verification:

- Focused `packages/standards/src/a2aPush.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.23.

Risk:
Medium to high. A local queue can be mistaken for production worker or public
webhook delivery infrastructure if the docs and status gates do not keep those
claims blocked.

Escalation triggers:

- Any request to operate public webhooks, run background workers, prove endpoint
  ownership, persist webhook credentials, or claim public push delivery from
  this local queue.
- Any request to persist raw task prompts, authorization/cookie headers,
  response bodies, raw transport errors, signer refs, wallet internals, or
  payment secrets in queued jobs.

## Slice 4.25: A2A Push Local Delivery Worker

User-visible outcome:
Operators get a local A2A push delivery worker primitive that processes one
sanitized queued job with an explicitly injected transport and records
status-only attempt evidence before any public webhook worker is considered.

Likely files:

- `packages/standards/src/a2aPush.ts`
- `packages/standards/src/a2aPush.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- The worker claims the next queued local delivery job only when an injected
  transport is supplied.
- Successful 2xx transport responses record a delivered attempt and mark the
  queue entry complete.
- Non-2xx responses or thrown transport errors record a failed status-only
  attempt and mark the queue entry failed.
- Empty queues return a no-op result.
- Worker results and durable attempt files do not persist raw task prompts,
  bearer values, signer refs, wallet internals, payment secrets, webhook
  credentials, authorization headers, cookie headers, response bodies, or raw
  transport error text.
- A2A public-readiness, product-status, launch-readiness, and public docs
  classify this as local worker proof only, not public webhook operation,
  public delivery proof, endpoint ownership proof, production auth, production
  observability, or external conformance.

Verification:

- Focused `packages/standards/src/a2aPush.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.24.

Risk:
Medium to high. A local worker can be mistaken for public webhook operation or
production delivery infrastructure if the docs and status gates do not keep
those claims blocked.

Escalation triggers:

- Any request to operate public webhooks, prove endpoint ownership, store
  webhook credentials, claim public push delivery, or treat the injected local
  worker as production auth or observability evidence.
- Any request to persist raw task prompts, response bodies, raw transport
  errors, authorization/cookie headers, signer refs, wallet internals, or
  payment secrets in worker output or attempt evidence.

## Slice 4.26: A2A Local JWKS Hosting Helper

User-visible outcome:
Operators get local `/.well-known/jwks.json` response and loopback route
support for Agent Card signing public keys before any public A2A hosting proof
is attempted.

Likely files:

- `packages/registry/src/a2aJwks.ts`
- `packages/registry/src/a2aJwks.test.ts`
- `packages/registry/src/index.ts`
- `packages/registry/README.md`
- `packages/standards/src/a2aNodeServer.ts`
- `packages/standards/src/a2aNodeServer.test.ts`
- `packages/standards/README.md`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- A local JWKS helper serves `GET /.well-known/jwks.json` with public key
  material only.
- The JWKS helper rejects empty key sets, blank key ids, private JWK fields,
  and private key objects before response generation.
- Unsupported JWKS paths and methods return safe errors without key ids or
  private material.
- The local loopback A2A Node server can serve the JWKS route only when public
  keys are explicitly configured.
- Existing Agent Card, task, streaming, and local push behavior remains
  unchanged.
- Public-readiness, product-status, launch-readiness, and public docs classify
  this as local JWKS hosting support only, not deployed public JWKS hosting,
  endpoint ownership, production key management, key rotation approval, public
  discovery acceptance, or external conformance.

Verification:

- Focused `packages/registry/src/a2aJwks.test.ts`.
- Focused `packages/standards/src/a2aNodeServer.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.25.

Risk:
Medium. Local JWKS serving can be mistaken for deployed public key management if
docs/status gates do not keep public hosting, endpoint ownership, and key
rotation blocked.

Escalation triggers:

- Any request to store private keys, expose private JWK fields, commit key
  material, bind a public server, claim endpoint ownership, or accept public
  discovery from this local helper alone.
- Any request to treat a locally served JWKS as production key rotation,
  revocation, or external conformance evidence.

## Slice 4.27: A2A Static Discovery Bundle

User-visible outcome:
Operators get a local static discovery bundle primitive that packages a signed
Agent Card and public JWKS response as deployable
`/.well-known/agent-card.json` and `/.well-known/jwks.json` artifacts before
any public A2A hosting proof is attempted.

Likely files:

- `packages/registry/src/a2aDiscoveryBundle.ts`
- `packages/registry/src/a2aDiscoveryBundle.test.ts`
- `packages/registry/src/index.ts`
- `packages/registry/README.md`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- current official provider documentation
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`
- `docs/reviewer-walkthrough.md`

Acceptance criteria:

- The bundle contains exactly the canonical Agent Card and JWKS paths.
- Bundle content types and cache headers are explicit.
- The helper requires public HTTPS URLs without credentials, query strings,
  fragments, loopback hosts, or private network hosts.
- The signed Agent Card must reference the configured public JWKS URL through
  signature `jku` values.
- Every signing key id must have a matching public JWKS key.
- The helper fails closed when signatures are missing, JWKS URL binding is
  mismatched, signing key ids are absent from JWKS, private/secret-like fields
  are present, or JWKS paths are non-canonical.
- Public-readiness, product-status, launch-readiness, and public docs classify
  this as local static bundle support only, not deployed public hosting,
  endpoint ownership, production key management, key rotation approval, public
  discovery acceptance, or external conformance.

Verification:

- Focused `packages/registry/src/a2aDiscoveryBundle.test.ts`.
- Focused `packages/registry/src/a2aJwks.test.ts`.
- Focused A2A public-readiness tests.
- Product-status tests.
- Launch-readiness tests.
- Operator-gate tests.
- Reviewer-docs regression tests.
- `npm run proof:a2a-public-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 4.26.

Risk:
Medium. Static bundle generation can be mistaken for deployed public A2A
hosting if docs/status gates do not keep endpoint ownership, production key
management, public discovery acceptance, and conformance blocked.

Escalation triggers:

- Any request to write deployment artifacts to disk by default, store private
  keys, expose private JWK fields, commit key material, bind a public server,
  claim endpoint ownership, or accept public discovery from this local bundle
  alone.

## Slice 4.28: A2A Static Discovery Artifact Writer

User-visible outcome:
Operators can turn an already-signed public Agent Card and public JWKS JSON into
canonical local static hosting artifacts, including a sanitized header manifest,
without generating keys, signing cards, fetching public URLs, or claiming public
hosting proof.

Likely files:

- `packages/registry/src/a2aDiscoveryBundle.ts`
- `packages/registry/src/a2aDiscoveryBundle.test.ts`
- `scripts/write-a2a-static-discovery-bundle.ts`
- `scripts/write-a2a-static-discovery-bundle.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The registry bundle writer writes exactly `.well-known/agent-card.json`,
  `.well-known/jwks.json`, and `a2a-discovery-bundle-manifest.json` under an
  operator-selected output directory.
- The writer fails closed on missing, duplicate, or unexpected bundle paths.
- The manifest records public base/JWKS URLs plus per-file content-type and
  cache-control headers without raw key material, credentials, tokens, signer
  references, private wallet fields, or response bodies beyond the sanitized
  static JSON files.
- The CLI reads already-signed public Agent Card JSON plus public JWKS JSON,
  validates them through the existing static bundle helper, writes local files,
  and prints only local output paths/counts.
- The CLI is opt-in and excluded from `verify:fast`, `verify:local`, and
  `grant:check`.
- A2A public-readiness reports the artifact writer as local proof only and
  keeps public hosting, endpoint ownership, production key management, public
  discovery acceptance, public push delivery, and external conformance blocked
  until operator-approved reports exist.

Verification:

- Focused `packages/registry/src/a2aDiscoveryBundle.test.ts`.
- Focused `scripts/write-a2a-static-discovery-bundle.test.ts`.
- Focused A2A public-readiness tests.
- Focused package-script tests.
- `npm run proof:a2a-public-readiness`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slice 4.27.

Risk:
Medium. Local static files can be mistaken for public hosting, endpoint
ownership, external conformance, or production key-management proof unless the
readiness and launch gates keep those claims blocked.

Escalation triggers:

- Any request to generate or store production signing keys in this CLI.
- Any request to commit generated static artifacts that contain operator-owned
  public endpoint details before review.
- Any request to treat generated local files as public A2A discovery proof
  without hosting them and accepting a structured public discovery report.

## Slice 4.29: A2A Static Discovery Artifact Validator

User-visible outcome:
Operators can validate a generated local A2A static discovery directory before
uploading it to a public host, without fetching public URLs or claiming public
hosting proof.

Likely files:

- `packages/registry/src/a2aDiscoveryBundle.ts`
- `packages/registry/src/a2aDiscoveryBundle.test.ts`
- `scripts/check-a2a-static-discovery-bundle.ts`
- `scripts/check-a2a-static-discovery-bundle.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `package.json`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The registry validator reads `a2a-discovery-bundle-manifest.json`,
  `.well-known/agent-card.json`, and `.well-known/jwks.json` from a local
  output directory.
- The validator requires schema version, manifest kind, public base/JWKS URLs,
  exactly canonical file metadata, content-type metadata, and generated JSON
  files that still pass the existing static bundle validation rules.
- The validator can compare expected public base/JWKS URLs supplied outside
  committed files.
- The validator fails closed on tampered Agent Card/JWKS files, unexpected or
  missing manifest paths, malformed headers, mismatched expected public URLs,
  and secret-like manifest fields.
- `npm run a2a:check-static-discovery-bundle` is opt-in, prints only local
  paths/counts and `publicHostingProven=false`, and stays excluded from
  `verify:fast`, `verify:local`, and `grant:check`.
- A2A public-readiness reports artifact validation as local pre-hosting proof
  only and keeps public hosting, endpoint ownership, public discovery
  acceptance, production key management, public push delivery, and external
  conformance blocked until operator-approved reports exist.

Verification:

- Focused `packages/registry/src/a2aDiscoveryBundle.test.ts`.
- Focused `scripts/check-a2a-static-discovery-bundle.test.ts`.
- Focused `scripts/write-a2a-static-discovery-bundle.test.ts`.
- Focused A2A public-readiness tests.
- Focused package-script tests.
- Product-status tests.
- Launch-readiness tests.
- `npm run proof:a2a-public-readiness`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slice 4.28.

Risk:
Medium. A passing local artifact check can be mistaken for endpoint ownership
or external discovery proof unless status gates keep public hosting and
conformance blocked.

Escalation triggers:

- Any request to make local artifact validation satisfy public discovery
  readiness by itself.
- Any request to fetch public URLs or run public conformance from this local
  check without explicit operator approval.
- Any request to store private signing keys, webhook credentials, bearer tokens,
  or private infrastructure details in the artifact manifest.

## Slice 4.30: A2A Static Discovery Local Host Smoke

User-visible outcome:
Operators can smoke-test a generated local A2A static discovery directory over
loopback before uploading it to a public host, without fetching public URLs or
claiming public hosting proof.

Likely files:

- `scripts/smoke-a2a-static-discovery-local.ts`
- `scripts/smoke-a2a-static-discovery-local.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/launch-readiness.test.ts`
- `package.json`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/overview.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- The smoke command validates the generated artifact directory before serving
  it.
- The local server binds only to loopback hosts.
- The server serves only `/.well-known/agent-card.json` and
  `/.well-known/jwks.json`.
- Served responses use manifest-declared content-type and cache-control
  headers.
- The command fetches the served Agent Card and JWKS over loopback and confirms
  JSON shape and response metadata.
- The command prints only redacted status, file count, `localOnly=true`, and
  `publicHostingProven=false`; it does not print public URLs, key ids,
  response bodies, credentials, local secret paths, or private material.
- Non-loopback host attempts fail closed.
- The command is opt-in and excluded from `verify:fast`, `verify:local`, and
  `grant:check`.
- A2A public-readiness reports the smoke as local host-semantics proof only and
  keeps public hosting, endpoint ownership, public discovery acceptance,
  production key management, public push delivery, and external conformance
  blocked until operator-approved reports exist.

Verification:

- Focused `scripts/smoke-a2a-static-discovery-local.test.ts`.
- Focused `scripts/check-a2a-static-discovery-bundle.test.ts`.
- Focused `scripts/write-a2a-static-discovery-bundle.test.ts`.
- Focused `packages/registry/src/a2aDiscoveryBundle.test.ts`.
- Focused A2A public-readiness tests.
- Focused package-script tests.
- Product-status tests.
- Launch-readiness tests.
- `npm run proof:a2a-public-readiness`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slice 4.29.

Risk:
Medium. A passing loopback smoke can be mistaken for deployed public hosting
unless readiness gates keep public discovery and conformance blocked.

Escalation triggers:

- Any request to bind this smoke to a non-loopback host.
- Any request to make local loopback serving satisfy public discovery readiness
  by itself.
- Any request to store private signing keys, webhook credentials, bearer
  tokens, public endpoint secrets, or raw response bodies in the smoke output.

## Slice 4.31: A2A Public Proof Plan Packet

User-visible outcome:
Operators can generate a redacted, non-networked public A2A proof plan that
turns current readiness gates into command order, blocker codes, operator input
names, and safety boundaries before any public endpoint is probed.

Likely files:

- `scripts/write-a2a-public-proof-plan.ts`
- `scripts/write-a2a-public-proof-plan.test.ts`
- `scripts/check-a2a-public-readiness.ts`
- `scripts/a2a-public-readiness.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/agentic-gaskit/a2a-public-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `README.md`

Acceptance criteria:

- `npm run a2a:write-public-proof-plan` builds first and contacts no public
  endpoints.
- The command reuses `proof:a2a-public-readiness` classification and emits a
  JSON plan with schema version, status, command order, `contactsPublicNetwork`
  flags, blocker codes, `ready-approval` codes, required operator input names,
  checks, and safety boundaries.
- The plan can be written to a local ignored output path with `--out`.
- The plan does not print configured public URLs, auth decisions, report paths,
  key ids, credentials, response bodies, raw report contents, or local secret
  paths.
- A2A public-readiness reports the proof plan as local planning proof only and
  keeps public discovery, public push delivery, external conformance,
  production auth, and key-management claims blocked until operator-approved
  structured evidence exists.
- The command remains excluded from `verify:fast`, `verify:local`, and
  `grant:check` because it is an operator planning artifact, not a default
  proof gate.

Verification:

- Focused public proof-plan tests.
- Focused A2A public-readiness tests.
- Focused package-script tests.
- `npm run a2a:write-public-proof-plan`.
- `npm run proof:a2a-public-readiness`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 4.19, 4.28, 4.29, and 4.30.

Risk:
Medium. A proof plan can be mistaken for public proof unless it remains
non-networked, redacted, and explicitly separate from public discovery,
public push delivery, and external conformance evidence.

Escalation triggers:

- Any request to have the proof-plan command probe public URLs.
- Any request to print configured public URLs, auth decisions, local report
  paths, key ids, credentials, raw payloads, response bodies, or report
  contents.
- Any request to treat proof-plan generation as public A2A readiness,
  production auth approval, endpoint ownership proof, or external conformance.

## Slice 4.32: Payment Provider Proof Plan Packet

User-visible outcome:
Operators can generate a redacted, non-networked payment-provider proof plan
that turns the x402/AP2 readiness gate into command order, required structured
report shape, blocker codes, operator input names, and safety boundaries before
any live facilitator, processor, AP2 participant, or settlement path is used.

Likely files:

- `scripts/write-payment-provider-proof-plan.ts`
- `scripts/write-payment-provider-proof-plan.test.ts`
- `scripts/check-payment-provider-readiness.ts`
- `scripts/payment-provider-readiness.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`

Acceptance criteria:

- `npm run payment:write-provider-proof-plan` builds first and contacts no
  payment providers, public endpoints, IOTA services, or Gas Station
  endpoints.
- The command reuses `proof:payment-provider-readiness` classification and
  emits a JSON plan with schema version, status, command order,
  `contactsPaymentProvider` flags, blocker codes, ready-approval codes,
  required operator input names, required structured report fields, required
  structured report check ids, checks, and safety boundaries.
- The plan can be written to a local ignored output path with `--out`.
- The plan does not print configured report paths, provider endpoints, payment
  credentials, authorization headers, payment instruments, raw payloads, raw
  response bodies, settlement ids, user signatures, private keys, bearer
  tokens, or local secret paths.
- Payment-provider readiness remains blocked until an operator-approved
  structured report exists and passes validation.
- The command remains excluded from `verify:fast`, `verify:local`, and
  `grant:check` because it is an operator planning artifact, not a default
  proof gate.

Verification:

- Focused payment proof-plan tests.
- Focused payment-provider readiness tests.
- Focused package-script tests.
- `npm run payment:write-provider-proof-plan`.
- `npm run proof:payment-provider-readiness`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slice 4.1, Slice 4.2, and the payment-provider readiness gate.

Risk:
Medium to high. A proof plan can be mistaken for live settlement proof unless
it remains non-networked, redacted, and explicitly separate from facilitator,
processor, AP2 participant, and settlement evidence.

Escalation triggers:

- Any request to have the proof-plan command call live payment providers.
- Any request to print configured report paths, provider endpoints, payment
  credentials, authorization headers, payment instruments, raw payloads,
  response bodies, settlement ids, private keys, bearer tokens, or report
  contents.
- Any request to treat proof-plan generation as live payment/provider proof,
  production settlement proof, AP2 conformance, or payment processor approval.

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

## Slice 5.3: Marketplace Production Readiness Gate

User-visible outcome:
Operators have a non-networked marketplace readiness command that separates
local read-only marketplace evidence from production marketplace claims and
accepts only a redacted structured operator report before those claims move to
manual review.

Likely files:

- `scripts/check-marketplace-readiness.ts`
- `scripts/marketplace-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/package-scripts.test.ts`
- `scripts/product-status.test.ts`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`
- `docs/overview.md`
- `package.json`

Acceptance criteria:

- `npm run proof:marketplace-readiness` builds first and does not contact live
  marketplace systems, payment providers, public endpoints, IOTA services, or
  Gas Station endpoints.
- The readiness command checks marketplace read-model source, tests, docs,
  smoke wiring, package build coverage, and local verification coverage.
- The command remains excluded from `verify:fast`, `verify:local`, and
  `grant:check` because it is an operator production-readiness gate, not a
  default local proof command.
- Missing `MARKETPLACE_PRODUCTION_REPORT` keeps production marketplace blocked
  with an exact blocker code.
- A valid structured report requires status-only evidence for provider
  onboarding, provider verification, moderation/abuse response, session auth,
  receipt access, payment settlement, dispute workflow, and operations/incident
  review.
- Unsafe report fields such as provider secrets, session data, payment
  credentials, authorization headers, signatures, raw payloads, private
  prompts, or local secret paths are rejected.
- Product status, launch readiness, and operator gates point production
  marketplace work at the readiness command without claiming production
  marketplace launch.

Verification:

- Focused marketplace readiness tests.
- Product-status, launch-readiness, operator-gate, and package-script tests.
- `npm run proof:marketplace-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 5.2.

Risk:
High. A marketplace readiness report can be mistaken for provider
verification, public scoring, moderation approval, custody approval, or live
settlement unless it stays redacted, opt-in, and manually reviewed.

Escalation triggers:

- Any production provider listing, provider verification, moderation action,
  public scoring, live settlement, custody, staking, bonding, slashing,
  public marketplace launch, or marketplace action execution.

## Slice 5.4: Marketplace Production Proof Plan Packet

User-visible outcome:
Marketplace operators have a non-networked proof-plan command that turns the
marketplace production readiness gate into command order, required structured
report fields, required check ids, blocker codes, and proof boundaries before
any production marketplace review.

Likely files:

- `scripts/write-marketplace-production-proof-plan.ts`
- `scripts/write-marketplace-production-proof-plan.test.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/launch-readiness.test.ts`
- `docs/marketplace-readiness.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/CODEBASE_MAP.md`
- `package.json`

Acceptance criteria:

- `npm run marketplace:write-production-proof-plan` builds first and does not
  contact production marketplace systems, provider systems, payment systems,
  IOTA services, public A2A endpoints, or Gas Station endpoints.
- The plan reports current blocker codes, ready approval codes, command order,
  required operator input names, required structured report fields, required
  structured report check ids, and safety boundaries.
- The plan can write a mode-0600 ignored local JSON artifact.
- The plan does not print or require provider credentials, session tokens,
  authorization headers, payment instruments, raw payloads, response bodies,
  moderation payloads, provider secrets, private prompts, signatures, or local
  secret paths.
- Operator live gates point production marketplace review at the plan before
  marketplace readiness and any dedicated production marketplace readiness
  slice.
- Launch readiness includes the plan as Phase 5 marketplace evidence without
  clearing production marketplace blockers.

Verification:

- Focused marketplace production proof-plan tests.
- Focused marketplace-readiness, package-script, operator-gate,
  product-status, and launch-readiness tests.
- `npm run marketplace:write-production-proof-plan -- --out
  tmp/gaskit/marketplace-production-proof-plan.json`.
- `npm run proof:marketplace-readiness`.
- `npm run proof:operator-gates`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slices 5.2 and 5.3.

Risk:
High. A proof plan can be mistaken for provider verification, moderation
approval, public scoring approval, payment settlement proof, custody approval,
or production marketplace launch unless the artifact stays redacted, opt-in,
and manually reviewed.

Escalation triggers:

- Any request to operate a production marketplace, list production providers,
  verify providers, moderate listings, run live settlement, expose production
  session/API authorization, approve custody, public-score providers, or
  execute marketplace actions.

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
- `docs/agentic-gaskit/launch-readiness-evidence.md`
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

## Slice 6.4: Package Publication Readiness Gate

User-visible outcome:
Release operators have a non-networked readiness command that separates local
package release proof from real npm registry publication and accepts only a
redacted structured operator report before publication claims move to manual
review.

Likely files:

- `scripts/check-package-publication-readiness.ts`
- `scripts/package-publication-readiness.test.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/package-scripts.test.ts`
- `docs/agentic-gaskit/package-release-strategy.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`
- `package.json`

Acceptance criteria:

- `npm run proof:package-publication-readiness` builds first and does not
  contact npm or run `npm publish`.
- The readiness command checks package release docs, dry-run helper, local
  install smoke helper, package tests, public workspace coverage in
  `pack:check`, and opt-in publish dry-run wiring.
- `publish:dry-run` and package publication readiness stay outside
  `verify:fast`, `verify:local`, and `grant:check`.
- Missing `PACKAGE_PUBLICATION_REPORT` keeps registry publication blocked with
  an exact blocker code.
- A valid structured report requires status-only npm publication evidence with
  every current public package name, recent observation time, registry install,
  provenance review, and rollback review checks.
- Unsafe report fields such as tokens, OTPs, npmrc contents, credentials,
  headers, signatures, or raw payloads are rejected.
- Product status, launch readiness, and operator gate reports point npm
  publication at the readiness command without claiming real publication.

Verification:

- Focused package-publication readiness tests.
- Product-status, launch-readiness, operator-gate, and package-script tests.
- `npm run proof:package-publication-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slice 6.3.

Risk:
Medium. A publication-readiness report can be mistaken for real registry
publication unless it stays redacted, opt-in, and manually reviewed.

Escalation triggers:

- Any request to run real `npm publish`.
- Any npm token, OTP, npm organization ownership, provenance signing,
  registry install, package-name transfer, namespace rename, or rollback
  decision.

## Slice 6.5: Package Publication Proof Plan Packet

User-visible outcome:
Release operators have a non-networked proof-plan command that turns the
package publication readiness gate into command order, package names, required
structured report fields, required check ids, blocker codes, and proof
boundaries before any real npm registry work.

Likely files:

- `scripts/write-package-publication-proof-plan.ts`
- `scripts/write-package-publication-proof-plan.test.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/package-scripts.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/launch-readiness.test.ts`
- `docs/agentic-gaskit/package-release-strategy.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/CODEBASE_MAP.md`
- `package.json`

Acceptance criteria:

- `npm run package:write-publication-proof-plan` builds first and does not
  contact npm or run real `npm publish`.
- The plan reports current public package names, current blocker codes, ready
  approval codes, command order, required operator input names, required
  structured report fields, required structured report check ids, and safety
  boundaries.
- The plan can write a mode-0600 ignored local JSON artifact.
- The plan does not print or require npm tokens, OTPs, npmrc contents,
  credentials, authorization headers, raw registry responses, signatures,
  package-owner account details, or local secret paths.
- Operator live gates point npm publication review at the plan before package
  publication readiness and any operator-approved publish workflow.
- Launch readiness includes the plan as Phase 6 package-release evidence
  without clearing npm publication blockers.

Verification:

- Focused package publication proof-plan tests.
- Focused package-publication readiness, package-script, operator-gate,
  product-status, and launch-readiness tests.
- `npm run package:write-publication-proof-plan -- --out
  tmp/gaskit/package-publication-proof-plan.json`.
- `npm run proof:package-publication-readiness`.
- `npm run proof:operator-gates`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `npm run typecheck`.
- `npm run verify:fast`.

Dependencies:
Slices 6.1, 6.2, 6.3, and 6.4.

Risk:
Medium. A proof plan can be mistaken for real registry publication,
account-ownership proof, package-name availability, provenance signing,
registry installability, or rollback approval unless the artifact stays
redacted, opt-in, and manually reviewed.

Escalation triggers:

- Any request to run real `npm publish`.
- Any npm token, OTP, npm organization ownership, provenance signing,
  registry install, package-name transfer, namespace rename, or rollback
  decision.

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
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
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
- `docs/agentic-gaskit/launch-readiness-evidence.md`
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

## Slice 7.7: Testnet Upstream Diagnostic Report Gate

User-visible outcome:
Operators and future agents can distinguish local `.env` readiness from current
IOTA RPC, Gas Station reachability, and reserve_gas compatibility evidence
before attempting a fresh sponsored testnet transaction.

Likely files:

- `scripts/diagnose-gas-station-upstream.ts`
- `scripts/testnet-upstream-report.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/product-status.test.ts`
- `scripts/launch-readiness.test.ts`
- `scripts/operator-live-gates.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/testnet-attempts.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run diagnose:gas-station -- --report <ignored-json-path>` writes a
  sanitized JSON report without storing bearer tokens, keypairs, app keys, raw
  request bodies, raw upstream response bodies, or private paths.
- The report records schema version, kind, observation time, Gas Station root
  status, Gas Station `/v1/health` status, IOTA RPC status, reserve_gas probe
  status, and overall pass/fail.
- `npm run proof:live-status` includes a non-networked `testnet-upstream` gate
  that reads the configured report path and fails closed on missing, invalid,
  stale, failed, or reserve-skipped reports.
- `npm run proof:product-status`, `npm run proof:launch-readiness`, and
  `npm run proof:operator-gates` surface `testnet-upstream` as a separate
  blocker from `testnet-readiness`.
- A passing upstream report requires current IOTA RPC reachability, Gas Station
  reachability, and reserve_gas compatibility.
- The live sponsored execution command remains opt-in and is not added to
  `verify:local`, `verify:fast`, or `grant:check`.

Verification:

- Focused live-proof, product-status, launch-readiness, operator-gate, and
  package-script tests.
- `npm run build`.
- `npm run diagnose:gas-station -- --skip-reserve --report
  tmp/gaskit/testnet-upstream-diagnostic.json` on the current machine.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.

Dependencies:
Slices 7.1-7.5 and local `.env` testnet-readiness setup.

Risk:
Medium. A diagnostic report can be mistaken for sponsored execution unless the
report gate remains separate from `execute:testnet-demo` and requires reserve
compatibility before it can pass.

Escalation triggers:

- Any request to run `execute:testnet-demo` without a passing upstream report
  and explicit operator intent.
- Any request to commit local diagnostic reports or `.env` values.
- Any request to treat a skipped reserve probe as fresh sponsored execution
  readiness.

## Slice 7.8: Local Gas Station Config Render

User-visible outcome:
Operators have a concrete, reproducible local setup step that renders the
official Gas Station config from ignored `.env` values and starts from a
loopback-only Redis plus Gas Station Compose template.

Likely files:

- `scripts/render-gas-station-config.ts`
- `scripts/render-gas-station-config.test.ts`
- `scripts/package-scripts.test.ts`
- `deploy/docker-compose/docker-compose.local.yml`
- `deploy/gas-station/config.example.yaml`
- `.gitignore`
- `package.json`
- `docs/deployment.md`
- `docs/quickstart.md`
- `docs/testnet-attempts.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run gas-station:render-config` builds first and renders
  `deploy/gas-station/config.local.yaml` from local `.env`.
- The rendered file is ignored by Git and contains sponsor signer material
  only in local config, not in committed docs or terminal output.
- The renderer converts local `iotaprivkey...` values and raw base64 secret
  keys into the 33-byte base64 local signer shape expected by the official Gas
  Station config.
- The renderer fails closed on placeholder keys and invalid numeric config.
- Local Compose runs Redis plus the official `iotaledger/gas-station` image on
  loopback-only host ports and mounts the ignored rendered config as
  `/app/config.yaml`.
- Docs explain the sequence: readiness, render config, start Compose, run
  diagnostic report, then attempt sponsored execution only after passing
  upstream proof and explicit operator intent.

Verification:

- Focused renderer and package-script tests.
- `npm run build`.
- `npm run gas-station:render-config`.
- Shape-only rendered config check without printing key material.
- Docker/Compose runtime check on the current machine.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.

Dependencies:
Slices 7.6-7.7 and local `.env` testnet-readiness setup.

Risk:
High. The rendered config contains sponsor key material and must remain ignored
and local-only. The Compose path can be mistaken for production deployment
unless loopback, local-only, and production-hardening boundaries remain clear.

Escalation triggers:

- Any request to commit `deploy/gas-station/config.local.yaml`.
- Any request to expose Gas Station publicly or bind it off loopback without a
  production hardening slice.
- Any request to run `execute:testnet-demo` before Docker/Gas Station
  diagnostics pass and explicit operator intent is present.

## Slice 7.9: Gas Station Runtime Preflight Gate

User-visible outcome:
Operators and future agents can distinguish rendered Gas Station config from
local runtime readiness before attempting upstream diagnostics or sponsored
testnet execution.

Likely files:

- `scripts/check-gas-station-runtime-preflight.ts`
- `scripts/check-gas-station-runtime-preflight.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/product-status.test.ts`
- `scripts/launch-readiness.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run gas-station:runtime-preflight` builds first and checks only local
  prerequisites: ignored rendered config, Docker client, Docker daemon, and
  Docker Compose plugin or standalone command.
- The preflight returns a typed blocker code for missing config, missing Docker
  client, unreachable Docker daemon, or missing Compose.
- The report prints command/status metadata only; it does not print config
  paths, environment values, Docker output, bearer tokens, app keys, signer
  material, raw transaction bytes, or raw errors.
- `npm run proof:live-status` surfaces `gas-station-runtime` separately from
  `testnet-readiness` and `testnet-upstream`.
- `npm run proof:product-status`, `npm run proof:launch-readiness`, and
  `npm run proof:operator-gates` include the runtime preflight as a local
  prerequisite before upstream diagnostics or `execute:testnet-demo`.
- The runtime preflight remains excluded from `verify:fast`, `verify:local`,
  and `grant:check` because it depends on local Docker state.

Verification:

- Focused runtime-preflight, live-proof, product-status, launch-readiness,
  operator-gate, and package-script tests.
- `npm run gas-station:runtime-preflight` on the current machine, recording the
  typed local blocker if Docker/Compose is unavailable.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.

Dependencies:
Slices 7.7-7.8 and local `.env` testnet-readiness setup.

Risk:
Medium. Docker/runtime checks are machine-specific and can be mistaken for live
Gas Station or sponsored execution proof unless they remain local-only and
separate from upstream diagnostics.

Escalation triggers:

- Any request to treat preflight success as Gas Station health or reserve_gas
  compatibility proof.
- Any request to commit rendered local Gas Station config or diagnostic reports.
- Any request to run `execute:testnet-demo` before runtime preflight, upstream
  diagnostics, and explicit operator intent are all present.

## Slice 7.10: Direct Docker Gas Station Fallback

User-visible outcome:
Operators can start the local Gas Station stack on machines where Docker is
available but Docker Compose is not installed. The default command prints a
sanitized dry-run plan; actual container startup remains opt-in.

Likely files:

- `scripts/gas-station-docker-direct.ts`
- `scripts/gas-station-docker-direct.test.ts`
- `scripts/check-gas-station-runtime-preflight.ts`
- `scripts/check-gas-station-runtime-preflight.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/launch-readiness-evidence.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- `npm run gas-station:docker-direct` builds first and defaults to
  `--dry-run`.
- The dry-run prints container, network, image, loopback port, and redacted
  mount/auth metadata only; it does not print `.env` values, signer material,
  bearer tokens, raw Docker output, or absolute local config paths.
- `--execute` remains explicit and may start Redis and Gas Station containers
  on a loopback-bound local Docker network.
- `npm run gas-station:runtime-preflight` can report ready through direct
  Docker fallback when the ignored local config, Docker client, and Docker
  daemon are ready but Compose is unavailable.
- The direct Docker command remains excluded from `verify:fast`,
  `verify:local`, and `grant:check` because it depends on local Docker state
  and `--execute` can start containers.
- Public docs describe this as local runtime readiness only, not Gas Station
  HTTP health, reserve_gas compatibility, sponsor funding, or sponsored
  execution proof.

Verification:

- Focused direct-Docker, runtime-preflight, live-proof, product-status,
  launch-readiness, operator-gate, and package-script tests.
- `npm run gas-station:docker-direct -- --dry-run`.
- `npm run gas-station:runtime-preflight` on the current machine, recording
  the typed status without printing local secrets.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.

Dependencies:
Slices 7.8-7.9 and local `.env` testnet-readiness setup.

Risk:
Medium. A direct Docker helper can be mistaken for deployment automation unless
the default remains dry-run and execution stays opt-in. Runtime readiness can
also be mistaken for live upstream proof unless it remains separated from
diagnostics and sponsored execution.

Escalation triggers:

- Any request to run `gas-station:docker-direct -- --execute` without
  operator intent to pull/start local containers.
- Any request to bind Redis or Gas Station off loopback.
- Any request to print local `.env`, rendered config, Docker output that may
  include secret-like values, or raw upstream errors.
- Any request to treat direct Docker dry-run or preflight success as live
  Gas Station availability, reserve_gas compatibility, or sponsored execution
  proof.

## Slice 7.11: Direct Docker Runtime Hardening

User-visible outcome:
The direct Docker fallback and runtime preflight distinguish a real reachable
Docker daemon from Docker Desktop/WSL false-ready output before attempting to
start Redis or Gas Station containers.

Likely files:

- `scripts/gas-station-docker-direct.ts`
- `scripts/gas-station-docker-direct.test.ts`
- `scripts/check-gas-station-runtime-preflight.ts`
- `scripts/check-gas-station-runtime-preflight.test.ts`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- The direct Docker Redis container has a `redis` network alias so it matches
  the rendered default `redis://redis:6379` Gas Station config.
- `npm run gas-station:docker-direct -- --execute` reports the failed sanitized
  plan step without printing Docker stderr, `.env` values, rendered config,
  sponsor key material, or bearer tokens.
- Required Docker start steps retry with best-effort cleanup for transient
  Docker Desktop/WSL daemon availability.
- `npm run gas-station:runtime-preflight` treats empty Docker server-version
  output as `GAS_STATION_DOCKER_DAEMON_UNAVAILABLE`, even when the Docker CLI
  command itself does not surface a normal process error.
- Public status docs record the current machine blocker as Docker daemon
  availability when that is the actual preflight result.

Verification:

- Focused direct-Docker, runtime-preflight, status, and package-script tests.
- `npm run gas-station:docker-direct -- --dry-run`.
- `npm run gas-station:docker-direct -- --execute`, recording only sanitized
  failure step output if Docker daemon availability blocks startup.
- `npm run gas-station:runtime-preflight`, recording the typed current blocker.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.

Dependencies:
Slice 7.10 and local `.env` testnet-readiness setup.

Risk:
Medium. Docker CLI behavior varies by host and can appear successful while the
daemon is unavailable. Treat daemon reachability as machine-specific evidence
and keep it separate from Gas Station HTTP health, reserve_gas compatibility,
and sponsored execution proof.

Escalation triggers:

- Any request to ignore `GAS_STATION_DOCKER_DAEMON_UNAVAILABLE` and proceed to
  live reserve or execute anyway.
- Any request to print raw Docker logs, rendered Gas Station config, local
  `.env`, bearer tokens, signer material, or raw upstream errors.
- Any request to claim direct Docker startup without confirmed running
  containers and a passing sanitized upstream diagnostic.

## Slice 7.12: Managed Gas Station Runtime Mode

User-visible outcome:
Operators who intentionally use a separately managed Gas Station can satisfy
the runtime preflight without local Docker, while the testnet execute path
still requires a current passing sanitized upstream diagnostic report before
reserve or execute.

Likely files:

- `scripts/check-gas-station-runtime-preflight.ts`
- `scripts/check-gas-station-runtime-preflight.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/execute-testnet-sponsored-demo.ts`
- `scripts/execute-testnet-sponsored-demo.test.ts`
- `scripts/check-product-status.ts`
- `scripts/product-status.test.ts`
- `.env.example`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`
- `README.md`

Acceptance criteria:

- `npm run gas-station:runtime-preflight` defaults to `local-docker` and keeps
  the existing local config, Docker client, Docker daemon, Compose, and direct
  Docker fallback checks.
- Setting `GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream` makes the
  preflight skip Docker inspection and require only a configured
  `GAS_STATION_URL` without printing its value.
- Unsupported runtime modes fail closed with an exact blocker code.
- Managed-upstream mode does not contact the managed Gas Station endpoint,
  does not prove reachability, and does not prove reserve_gas compatibility.
- `npm run execute:testnet-demo` still requires local testnet readiness,
  runtime preflight, and a current passing `GASKIT_TESTNET_UPSTREAM_REPORT`
  before building/signing a transaction or reserving gas.
- Product status, live proof status, launch readiness, and operator docs keep
  runtime readiness separate from the `testnet-upstream` gate.

Verification:

- Focused runtime-preflight, live-proof, execute-prerequisite,
  product-status, launch-readiness, operator-gate, and package-script tests.
- `GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream npm run
  gas-station:runtime-preflight`.
- `npm run readiness:testnet`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7, 7.8, 7.9, 7.10, and 7.11.

Risk:
Medium. Managed upstream mode can be mistaken for live Gas Station proof unless
it remains a configuration-only runtime preflight and the sanitized upstream
diagnostic remains mandatory before sponsored execution.

Escalation triggers:

- Any request to treat managed-upstream runtime readiness as Gas Station HTTP
  health, reserve_gas compatibility, sponsor funding, or sponsored execution
  proof.
- Any request to print managed endpoint URLs, bearer tokens, response bodies,
  sponsor signer material, raw transaction bytes, or user signatures.

## Slice 7.13: Testnet Upstream Operator Template

User-visible outcome:
Operators can generate an ignored, non-networked checklist template for the
self-hosted or managed Gas Station upstream proof path, while the live
testnet gate still only accepts the sanitized diagnostic report emitted by
`npm run diagnose:gas-station`.

Likely files:

- `scripts/write-operator-report-template.ts`
- `scripts/write-operator-report-template.test.ts`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run operator:write-report-template -- --kind testnet-upstream --out
  <ignored-json-path>` writes a private local JSON template with
  `result=pending-operator-proof`.
- The template lists local or managed runtime selection, IOTA RPC JSON-RPC,
  Gas Station root or health, reserve_gas compatibility, and redaction review
  checks.
- The template names `GASKIT_TESTNET_UPSTREAM_REPORT` and the accepted
  diagnostic report kind, but it does not have the accepted diagnostic report
  shape and cannot clear the upstream gate.
- Public docs route operators to the template as planning/checklist evidence
  only, then to `npm run diagnose:gas-station -- --report <ignored-json-path>`
  for accepted upstream proof.
- No live IOTA RPC, Gas Station endpoint, reserve_gas call, Docker startup,
  sponsored execute, or secret-printing path is added.

Verification:

- Focused operator-template and upstream-report tests.
- `npm run operator:write-report-template -- --kind testnet-upstream --out
  tmp/gaskit/testnet-upstream-report-template.json`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.12.

Risk:
Low to medium. A checklist template can be mistaken for accepted live proof
unless the accepted diagnostic report shape remains separate and tests prove
the template cannot satisfy `GASKIT_TESTNET_UPSTREAM_REPORT`.

Escalation triggers:

- Any request to accept the template itself as upstream proof.
- Any request to skip reserve_gas compatibility while claiming fresh sponsored
  execute readiness.
- Any request to include endpoint URLs, bearer tokens, raw responses, signer
  material, raw transaction bytes, or user signatures in the template.

## Slice 7.14: Direct Docker Stack Status

User-visible outcome:
Operators can inspect whether the expected direct-Docker local Gas Station
network, Redis container, and Gas Station container are running before moving
to upstream HTTP diagnostics, without starting containers or contacting live
services.

Likely files:

- `scripts/gas-station-docker-direct.ts`
- `scripts/gas-station-docker-direct.test.ts`
- `scripts/write-operator-report-template.ts`
- `scripts/write-operator-report-template.test.ts`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run gas-station:docker-direct -- --status` inspects only local Docker
  network and container state.
- The status command reports whether `gaskit-local`, `gaskit-redis`, and
  `gaskit-gas-station` are present/running.
- The status command does not start containers, fetch Gas Station HTTP health,
  contact IOTA RPC, reserve gas, execute a transaction, or print raw Docker
  error output.
- The status command returns non-zero when the expected local stack is not
  running.
- Public docs and the testnet upstream operator template route operators to
  the status check as local Docker evidence only, not as upstream health or
  reserve_gas compatibility proof.

Verification:

- Focused direct-Docker and operator-template tests.
- `npm run gas-station:docker-direct -- --status`, recording only sanitized
  status output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.13 and local Docker runtime access.

Risk:
Low to medium. Container status can be mistaken for upstream readiness unless
docs and reports keep it separate from Gas Station HTTP health, IOTA RPC,
reserve_gas compatibility, and sponsored execution proof.

Escalation triggers:

- Any request to treat direct Docker status as upstream diagnostic proof.
- Any request to ignore a failed status check and proceed to reserve or execute.
- Any request to print raw Docker errors, rendered config, `.env`, bearer
  tokens, signer material, raw transaction bytes, or user signatures.

## Slice 7.15: Sponsor Funding Diagnostic

User-visible outcome:
Operators can diagnose reserve_gas failures caused by sponsor wallet funding or
coin shape without printing sponsor signer material or attempting another
sponsored transaction.

Likely files:

- `scripts/check-sponsor-funding.ts`
- `scripts/check-sponsor-funding.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/write-operator-report-template.ts`
- `scripts/write-operator-report-template.test.ts`
- `package.json`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run sponsor:check-funding` derives the public sponsor address from the
  ignored Gas Station signer key without printing the key or full address.
- The command queries IOTA RPC for total IOTA balance, coin object count, and a
  bounded sampled max coin balance.
- The command reports whether the configured sponsor can satisfy the requested
  reserve budget without signing, reserving gas, executing transactions, or
  printing raw RPC responses.
- The command is opt-in and excluded from `verify:fast`, `verify:local`, and
  `grant:check`.
- Public docs and the testnet upstream operator template route reserve failures
  through the funding diagnostic before retrying reserve_gas.

Verification:

- Focused sponsor-funding, operator-template, and package-script tests.
- `npm run sponsor:check-funding`, recording only redacted address and numeric
  funding fields.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.14 and local `.env` testnet signer configuration.

Risk:
Medium. A read-only funding diagnostic still touches a live RPC endpoint and
derives a public address from private signer material. Keep output redacted and
do not treat funding readiness as reserve_gas compatibility or sponsored
execution proof.

Escalation triggers:

- Any request to print the sponsor private key, full sponsor address, rendered
  Gas Station config, raw RPC response, bearer token, or transaction material.
- Any request to treat sponsor funding readiness as successful reserve_gas,
  transaction execution, or production readiness.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.16: Sponsor Funding Request Artifact

User-visible outcome:
Operators can retrieve the configured public sponsor address for IOTA testnet
funding through an ignored local JSON artifact, while normal stdout and tracked
docs keep the address redacted and no live service or transaction path runs.

Likely files:

- `scripts/write-sponsor-funding-request.ts`
- `scripts/write-sponsor-funding-request.test.ts`
- `scripts/package-scripts.test.ts`
- `package.json`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run sponsor:write-funding-request -- --out
  tmp/gaskit/sponsor-funding-request.json` derives the configured public
  sponsor address from ignored signer config and writes it to the requested
  ignored artifact.
- The command summary prints only a redacted sponsor address, not the full
  address or signer material.
- The artifact includes the public sponsor address, redacted address,
  requested minimum balance, safety notes, and next command order.
- The command does not contact IOTA RPC, call Gas Station, reserve gas, sign,
  execute transactions, print raw config, or print raw secret material.
- The command is opt-in and excluded from `verify:fast`, `verify:local`, and
  `grant:check`.
- Public docs route reserve-funding blockers through the funding request
  artifact, then `npm run sponsor:check-funding`, then the sanitized upstream
  diagnostic.

Verification:

- Focused sponsor funding request, sponsor funding, and package-script tests.
- `npm run sponsor:write-funding-request -- --out
  tmp/gaskit/sponsor-funding-request.json`, recording only the redacted
  summary output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.15 and local `.env` testnet signer configuration.

Risk:
Medium. A full public address is required for funding, but it should not
become normal console output or tracked repository content. Keep the address in
ignored local artifacts only and continue treating funding as separate from
reserve_gas compatibility and sponsored execution proof.

Escalation triggers:

- Any request to print the sponsor private key, rendered Gas Station config,
  bearer token, raw transaction bytes, user signatures, or raw RPC responses.
- Any request to treat the funding request artifact as proof that reserve_gas
  or sponsored execution is ready.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.17: Sponsor Faucet Request Helper

User-visible outcome:
Operators can request IOTA testnet faucet funds for the configured sponsor
address through an explicit opt-in command that uses only operator-provided
faucet configuration, writes sanitized ignored evidence, and keeps faucet
funding separate from reserve_gas and sponsored execution proof.

Likely files:

- `scripts/request-sponsor-faucet-funds.ts`
- `scripts/request-sponsor-faucet-funds.test.ts`
- `scripts/package-scripts.test.ts`
- `scripts/write-operator-report-template.ts`
- `scripts/write-operator-report-template.test.ts`
- `package.json`
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run sponsor:request-faucet-funds` without `--execute` does not contact
  the faucet and writes a blocked ignored report.
- `npm run sponsor:request-faucet-funds -- --execute --out
  tmp/gaskit/sponsor-faucet-request.json` requires `IOTA_FAUCET_URL` or
  `--faucet-url`.
- Faucet URLs must be HTTPS or loopback HTTP.
- The command sends only the configured public sponsor address to the faucet,
  never signer material, bearer tokens, raw transaction bytes, or user
  signatures.
- Stdout and the ignored report include only a redacted sponsor address,
  sanitized result code, optional transferred amount, and next command order.
- The command does not sign, reserve gas, execute transactions, call Gas
  Station, or treat faucet success as reserve_gas compatibility.
- The command is opt-in and excluded from `verify:fast`, `verify:local`, and
  `grant:check`.
- Public docs and the testnet upstream operator template route funding through
  funding request, optional faucet request, funding diagnostic, then upstream
  diagnostic.

Verification:

- Focused sponsor faucet request, sponsor funding request, sponsor funding,
  operator-template, and package-script tests.
- `npm run sponsor:request-faucet-funds`, recording only the blocked redacted
  summary output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.16 and local `.env` testnet signer configuration. Actual faucet
execution also requires an operator-provided `IOTA_FAUCET_URL` or
`--faucet-url`.

Risk:
Medium. Faucet requests contact an external service and reveal the public
sponsor address to that service. Keep execution opt-in, require safe URLs,
sanitize reports, and continue requiring funding diagnostics plus reserve_gas
diagnostics before any sponsored execute.

Escalation triggers:

- Any request to use an unsafe HTTP faucet URL outside loopback.
- Any request to print the full sponsor address in stdout, sponsor private key,
  rendered Gas Station config, bearer token, raw faucet responses, raw
  transaction bytes, or user signatures.
- Any request to treat faucet success as reserve_gas compatibility or
  sponsored execution readiness.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.18: Sponsor Funding Report Gate

User-visible outcome:
Operators can convert the read-only sponsor funding diagnostic into a sanitized
ignored JSON report that live proof, product status, launch readiness, and
operator gates consume before reserve_gas proof. This keeps sponsor funding
readiness separate from Docker runtime readiness and Gas Station upstream
compatibility.

Likely files:

- `scripts/sponsor-funding-report.ts`
- `scripts/check-sponsor-funding.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/check-product-status.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/write-operator-report-template.ts`
- focused tests for those scripts
- `docs/testnet-readiness.md`
- `docs/deployment.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/product-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/CODEBASE_MAP.md`

Acceptance criteria:

- `npm run sponsor:check-funding -- --report
  tmp/gaskit/sponsor-funding-report.json` writes a mode-0600 sanitized report
  whether funding is ready or blocked.
- The report includes only a redacted sponsor address and aggregate numeric
  funding fields; it never includes the full sponsor address, signer material,
  bearer tokens, raw RPC bodies, raw transaction bytes, or user signatures.
- `npm run proof:live-status` reports `sponsor-funding` separately from
  `gas-station-runtime` and `testnet-upstream`, using
  `GASKIT_SPONSOR_FUNDING_REPORT`.
- Product status, launch readiness, and operator gates inherit the
  `sponsor-funding` blocker or readiness without contacting live services
  themselves.
- Operator gates classify `sponsor-funding` as a live-service command requiring
  explicit approval because the diagnostic contacts IOTA RPC.
- The testnet upstream operator template includes the sponsor funding report
  command and accepted environment variable before upstream diagnostics.

Verification:

- Focused sponsor funding, live proof status, product status, launch readiness,
  operator gate, operator template, and package-script tests.
- `npm run sponsor:check-funding -- --report
  tmp/gaskit/sponsor-funding-report.json`, recording only redacted output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run proof:live-status`.
- `npm run proof:product-status`.
- `npm run proof:launch-readiness`.
- `npm run proof:operator-gates`.
- `npm run verify:fast`.

Dependencies:
Slices 7.15-7.17 and local `.env` testnet signer configuration.

Risk:
Medium. The command contacts IOTA RPC and derives a public sponsor address
locally, so the report must remain redacted and ignored. A passing funding
report is still not reserve_gas compatibility or sponsored execution proof.

Escalation triggers:

- Any request to commit or print the full sponsor address, private key,
  rendered Gas Station config, bearer token, raw RPC response, raw transaction
  bytes, or user signatures.
- Any request to treat a passing funding report as proof that reserve_gas or
  sponsored execution is ready.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.19: Sponsor Faucet Compatibility And Safe Failure Metadata

User-visible outcome:
Operators can use the sponsor faucet helper against the IOTA faucet batch API
and receive actionable, sanitized failure metadata when the faucet accepts the
request at the HTTP layer but rejects it at the faucet layer.

Likely files:

- `scripts/request-sponsor-faucet-funds.ts`
- `scripts/request-sponsor-faucet-funds.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- The default faucet requester submits `FixedAmountRequest` to `/v1/gas` and
  polls `/v1/status/<task>` without printing task ids, raw faucet responses, or
  the full sponsor address.
- The helper still requires `--execute`, still accepts only HTTPS or loopback
  HTTP faucet URLs, and still sends only the public sponsor address.
- Sanitized reports can include `faucetApiVersion`, HTTP status, and a bounded
  failure kind, but never raw faucet response bodies.
- Live faucet failures do not count as sponsor funding proof.
- Funding diagnostics still decide whether sponsor funding is ready.

Verification:

- Focused sponsor faucet and package-script tests.
- `npm run sponsor:request-faucet-funds -- --execute --faucet-url
  https://faucet.testnet.iota.cafe --out
  tmp/gaskit/sponsor-faucet-request.json`, recording only sanitized output.
- `npm run sponsor:check-funding -- --report
  tmp/gaskit/sponsor-funding-report.json`, recording only redacted output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.15-7.18 and local `.env` testnet signer configuration.

Risk:
Medium. Faucet requests contact a public testnet service and reveal the public
sponsor address to that service. The helper must continue to redact stdout and
reports, and a faucet failure or success must remain separate from reserve_gas
compatibility and sponsored execution proof.

Escalation triggers:

- Any request to print raw faucet response bodies, task ids, full sponsor
  address, sponsor private key, rendered Gas Station config, bearer token, raw
  transaction bytes, or user signatures.
- Any request to treat faucet success as reserve_gas compatibility or
  sponsored execution readiness.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.20: Testnet Upstream Diagnostic Stdout Redaction

User-visible outcome:
Operators can refresh Gas Station/IOTA RPC upstream diagnostics with Docker
connected while stdout and tracked evidence remain status-only and do not print
raw upstream response bodies.

Likely files:

- `scripts/diagnose-gas-station-upstream.ts`
- `scripts/diagnose-gas-station-upstream.test.ts`
- `docs/testnet-attempts.md`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run diagnose:gas-station -- --report <ignored-json-path>` still checks
  Gas Station root reachability, Gas Station `/v1/health`, IOTA RPC status, and
  the reserve_gas compatibility probe.
- Diagnostic stdout prints only endpoint names, pass/fail state, and HTTP
  status for HTTP checks.
- Raw upstream response bodies are not returned by diagnostic helper APIs,
  printed to stdout, written into tracked docs, or stored in the sanitized JSON
  report.
- The existing upstream report shape remains compatible with live-status,
  product-status, launch-readiness, operator gates, and execute prerequisites.
- Sponsor funding remains a separate blocker from reserve_gas compatibility.

Verification:

- Focused diagnostic and package-script tests.
- `npm run sponsor:check-funding -- --report
  tmp/gaskit/sponsor-funding-report.json`, recording only redacted output.
- `GASKIT_SPONSOR_FUNDING_REPORT=tmp/gaskit/sponsor-funding-report.json npm
  run proof:live-status`.
- `npm run diagnose:gas-station -- --report
  tmp/gaskit/testnet-upstream-diagnostic.json`, recording only status output.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7-7.19, local `.env` testnet configuration, and Docker-connected local
Gas Station runtime.

Risk:
Low to medium. The diagnostic contacts live/configured services and reserve_gas
compatibility can fail for operational reasons. This slice must improve
redaction without claiming funding, reserve_gas readiness, or sponsored
execution.

Escalation triggers:

- Any request to print raw upstream error bodies, bearer tokens, signer
  material, rendered Gas Station config, full sponsor address, raw transaction
  bytes, or user signatures.
- Any request to treat Gas Station root reachability or IOTA RPC reachability
  as reserve_gas compatibility.
- Any request to run `execute:testnet-demo` without explicit operator approval.

## Slice 7.21: IOTA Names Live Smoke Report Gate

User-visible outcome:
IOTA Names live proof can no longer be marked ready from configuration alone.
Operators must run the opt-in live smoke and provide a sanitized ignored report
before live-status, product-status, launch-readiness, or operator gates can
mark the Names proof ready.

Likely files:

- `scripts/iota-names-live-report.ts`
- `scripts/smoke-iota-names-live.ts`
- `scripts/iota-names-live-smoke.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/write-live-proof-plan.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/product-status.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/write-live-proof-plan.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/testnet-readiness.md`
- `README.md`

Acceptance criteria:

- `npm run smoke:iota-names-live -- --report <ignored-json-path>` writes a
  sanitized report with schema version, kind, observation time, result, code,
  configured-field booleans, live-contact flag, match status, and redacted
  resolved address only.
- The report omits GraphQL endpoint values, full names, full expected/resolved
  addresses, raw GraphQL request/response bodies, credential material, local
  secret paths, and private keys.
- `npm run proof:live-status` blocks safe IOTA Names config without
  `IOTA_NAMES_LIVE_REPORT`.
- A current passing `IOTA_NAMES_LIVE_REPORT` marks only the `iota-names-live`
  check ready; it does not prove IOTA Identity, VC, Gas Station reserve_gas, or
  sponsored execution.
- Product status, launch readiness, operator gates, and live proof plans point
  operators at the report-writing command.
- The live smoke remains opt-in and stays out of default local verification.

Verification:

- Focused IOTA Names smoke, live-status, product-status, operator-gate,
  live-proof-plan, launch-readiness, and package-script tests.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 2.6-2.8 and 7.20.

Risk:
Medium. This changes readiness semantics from config-present to
report-backed proof. It may expose previously hidden blockers, but that is the
intended launch-safety behavior.

Escalation triggers:

- Any request to treat IOTA Names endpoint/name/address configuration as live
  proof without a current passing report.
- Any request to print configured GraphQL endpoint values, full names, full
  addresses, raw GraphQL bodies, or local secret paths in status gates.
- Any request to include `smoke:iota-names-live` in default local verification.

## Slice 7.22: Sponsor Faucet API Selection

User-visible outcome:
Operators can explicitly choose the public IOTA faucet API shape used by the
sponsor faucet helper instead of relying on an ad hoc script when the currently
configured faucet supports either the batch `/v1/gas` flow or the documented
legacy `/gas` flow.

Likely files:

- `scripts/request-sponsor-faucet-funds.ts`
- `scripts/request-sponsor-faucet-funds.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run sponsor:request-faucet-funds -- --execute --api-version v1-batch`
  keeps the existing default batch request and status-poll behavior.
- `npm run sponsor:request-faucet-funds -- --execute --api-version
  v0-documented` uses the documented `/gas` request shape without requiring an
  inline `tsx` helper.
- The helper still requires `--execute`, still requires an HTTPS or loopback
  faucet URL, and still writes only a sanitized ignored report.
- Success and failure reports preserve the selected `faucetApiVersion`, bounded
  HTTP status, and bounded failure kind without raw faucet bodies, faucet task
  ids, full sponsor addresses, signer material, rendered Gas Station config,
  bearer tokens, raw transaction bytes, or user signatures.
- Faucet success still does not prove sponsor funding, reserve_gas
  compatibility, or sponsored execution.

Verification:

- Focused sponsor faucet tests.
- `npm run sponsor:request-faucet-funds -- --help`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.18-7.21, local `.env` testnet signer configuration, and an
operator-provided faucet URL for live requests.

Risk:
Low to medium. The implementation is mostly CLI routing around already-tested
request functions, but the live command contacts a faucet service and reveals
the public sponsor address when `--execute` is provided.

Escalation triggers:

- Any request to make faucet requests without `--execute`.
- Any request to print raw faucet responses, faucet task ids, full sponsor
  addresses, signer material, bearer tokens, rendered Gas Station config, raw
  transaction bytes, or user signatures.
- Any request to treat a faucet request as proof of sponsor funding or
  reserve_gas compatibility.

## Slice 7.23: IOTA Identity Live Smoke Report Gate

User-visible outcome:
IOTA Identity live proof can no longer be marked ready from proof-endpoint and
profile-path configuration alone. Operators must run the opt-in live smoke and
provide a sanitized ignored report before live-status, product-status,
launch-readiness, or operator gates can mark the Identity proof ready.

Likely files:

- `scripts/iota-identity-live-report.ts`
- `scripts/smoke-iota-identity-live.ts`
- `scripts/iota-identity-live-smoke.test.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/write-live-proof-plan.ts`
- `scripts/check-operator-live-gates.ts`
- `scripts/check-launch-readiness.ts`
- `scripts/live-proof-status.test.ts`
- `scripts/product-status.test.ts`
- `scripts/operator-live-gates.test.ts`
- `scripts/write-live-proof-plan.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/testnet-readiness.md`

Acceptance criteria:

- `npm run smoke:iota-identity-live -- --report <ignored-json-path>` writes a
  sanitized report with schema version, kind, observation time, result, code,
  configured-field booleans, trust-policy configured flag, live-contact flag,
  identity verification flag, and credential-ref count only.
- The report omits proof endpoint values, profile paths, profile names, DIDs,
  credential references, raw proof request/response bodies, credential
  material, local secret paths, and private keys.
- `npm run proof:live-status` blocks safe IOTA Identity config without
  `IOTA_IDENTITY_LIVE_REPORT`.
- A current passing `IOTA_IDENTITY_LIVE_REPORT` marks only the
  `iota-identity-live` check ready; it does not prove IOTA Names, VC
  trust-policy completeness beyond configured local policy, Gas Station
  reserve_gas, or sponsored execution.
- Product status, launch readiness, operator gates, and live proof plans point
  operators at the report-writing command.
- The live smoke remains opt-in and stays out of default local verification.

Verification:

- Focused IOTA Identity smoke, live-status, product-status, operator-gate,
  live-proof-plan, launch-readiness, and package-script tests.
- `npm run smoke:iota-identity-live -- --help`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 2.8 and 7.21.

Risk:
Medium. This changes readiness semantics from config-present to
report-backed proof. It may expose previously hidden blockers, but that is the
intended launch-safety behavior.

Escalation triggers:

- Any request to treat IOTA Identity endpoint/profile configuration as live
  proof without a current passing report.
- Any request to print configured endpoint values, profile paths, DIDs,
  credential refs, raw proof bodies, credential evidence, or local secret paths
  in status gates.
- Any request to include `smoke:iota-identity-live` in default local
  verification.

## Slice 7.24: Sponsor Faucet Attempt Context

User-visible outcome:
Operators can wire the latest sanitized sponsor faucet request report into
live-status/product/operator gates as triage context for the `sponsor-funding`
next step, without letting a faucet request clear funding readiness.

Likely files:

- `scripts/request-sponsor-faucet-funds.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/request-sponsor-faucet-funds.test.ts`
- `scripts/live-proof-status.test.ts`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `GASKIT_SPONSOR_FAUCET_REPORT=<ignored-json-path> npm run proof:live-status`
  can include a bounded, sanitized summary of the latest faucet result in the
  `sponsor-funding` next step.
- Faucet reports are validated before use and reject unsupported fields,
  stale reports, full sponsor addresses, gas-spend claims, signing claims,
  unsupported API versions, unsupported failure kinds, and malformed amounts.
- A configured faucet report never clears `sponsor-funding`; only a passing
  `GASKIT_SPONSOR_FUNDING_REPORT` can do that.
- Status output does not print faucet URLs, raw faucet response bodies, faucet
  task ids, full sponsor addresses, signer material, rendered Gas Station
  config, bearer tokens, raw transaction bytes, user signatures, or local
  secret paths.

Verification:

- Focused sponsor faucet and live-proof status tests.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.17-7.23 and the existing sponsor faucet report artifact path.

Risk:
Low to medium. The report is optional operator context, but accepting
operator-provided JSON still needs strict validation so the status path cannot
become a place to smuggle full addresses, raw faucet details, or readiness
overclaims.

Escalation triggers:

- Any request to treat `GASKIT_SPONSOR_FAUCET_REPORT` as funding,
  reserve_gas, or sponsored execution proof.
- Any request to print raw faucet response bodies, faucet task ids, full
  sponsor addresses, signer material, bearer tokens, rendered Gas Station
  config, raw transaction bytes, or user signatures.

## Slice 7.25: Live Proof Status Artifact Writer

User-visible outcome:
Operators and future agents can write the current non-networked live-proof
status to an ignored redacted JSON artifact for handoff/audit evidence while
the remaining testnet proof is blocked on sponsor funding and reserve_gas
compatibility.

Likely files:

- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run proof:live-status -- --json` prints a redacted machine-readable
  status artifact without contacting live services.
- `npm run proof:live-status -- --out <ignored-json-path>` writes the same
  artifact with mode 0600.
- The artifact contains schema version, kind, timestamp, overall ok flag,
  ready check ids, blocked check ids, blocker codes, the existing sanitized
  checks, and safety boundaries.
- The artifact does not include configured endpoint values, profile paths,
  faucet URLs, raw upstream bodies, faucet task ids, full sponsor addresses,
  signer material, bearer tokens, rendered Gas Station config, raw transaction
  bytes, user signatures, or local secret paths.
- The artifact remains status evidence only. It does not clear sponsor
  funding, testnet-upstream, IOTA Names, IOTA Identity, VC, production, or
  package-readiness blockers.

Verification:

- Focused live-proof status, product-status, operator-gate, and package-script
  tests.
- `npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.18-7.24 and the existing non-networked live-proof status gate.

Risk:
Low. This is a derived local artifact writer, but it still needs strict
redaction discipline because operators may archive it next to live proof
evidence.

Escalation triggers:

- Any request to include configured endpoint values, profile paths, faucet
  URLs, raw upstream bodies, faucet task ids, full sponsor addresses, signer
  material, bearer tokens, rendered Gas Station config, raw transaction bytes,
  user signatures, or local secret paths.
- Any request to treat the live-proof status artifact as proof that sponsor
  funding, reserve_gas compatibility, live Names/Identity, package
  publication, production custody, production payment, marketplace, or public
  A2A readiness has passed.

## Slice 7.26: Reserve Failure Classification

User-visible outcome:
Operators can tell whether the current `reserve_gas` diagnostic failure should
be routed to sponsor funding, auth/config, network reachability, or generic
upstream compatibility triage, without printing raw Gas Station responses or
secret values.

Likely files:

- `scripts/diagnose-gas-station-upstream.ts`
- `scripts/diagnose-gas-station-upstream.test.ts`
- `scripts/testnet-upstream-report.ts`
- `scripts/check-live-proof-status.ts`
- `scripts/live-proof-status.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/testnet-readiness.md`
- `docs/testnet-attempts.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run diagnose:gas-station -- --report <ignored-json-path>` can write a
  sanitized `reserveGas.code` and message for skipped, ready, missing-auth,
  sponsor-funding-blocked, request-failed, and generic HTTP reserve outcomes.
- A configured `GASKIT_SPONSOR_FUNDING_REPORT` can classify reserve failure as
  `RESERVE_GAS_SPONSOR_FUNDING_BLOCKED` when the funding report is not ready.
- `npm run proof:live-status` surfaces the bounded reserve message and routes
  the next step to sponsor funding when the reserve failure is funding-blocked.
- Existing older diagnostic reports without `reserveGas.code` remain valid.
- The diagnostic still does not print or store raw upstream response bodies,
  faucet task ids, full sponsor addresses, sponsor signer material, rendered
  Gas Station config, bearer tokens, raw transaction bytes, user signatures, or
  local secret paths.

Verification:

- Focused diagnostic, live-status, sponsored-execute prerequisite,
  product-status, operator-gate, and package-script tests.
- `npm run diagnose:gas-station -- --report
  tmp/gaskit/testnet-upstream-diagnostic.json` on the current machine,
  recording only sanitized status output.
- `npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.18-7.25 and the current sanitized sponsor funding report path.

Risk:
Low to medium. The report remains status-only, but clearer reserve
classification could be mistaken for readiness. The gate must remain blocked
until reserve_gas actually passes.

Escalation triggers:

- Any request to parse, print, or store raw Gas Station response bodies, bearer
  tokens, rendered Gas Station config, full sponsor addresses, raw transaction
  bytes, user signatures, or sponsor signer material.
- Any request to treat `RESERVE_GAS_SPONSOR_FUNDING_BLOCKED` as a passing
  reserve compatibility proof.

## Slice 7.27: Gas Station Reachability Classification

User-visible outcome:
Operators can distinguish raw Gas Station upstream reachability from optional
wrapper health endpoint availability when Docker is connected, without
weakening the reserve_gas compatibility gate or printing raw upstream bodies.

Likely files:

- `scripts/diagnose-gas-station-upstream.ts`
- `scripts/diagnose-gas-station-upstream.test.ts`
- `scripts/testnet-upstream-report.ts`
- `docs/CODEBASE_MAP.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/testnet-readiness.md`
- `docs/testnet-attempts.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run diagnose:gas-station -- --report <ignored-json-path>` emits a
  bounded `gasStationReachabilityCode` in stdout and writes optional
  `gasStationReachability` metadata into the sanitized report.
- A raw upstream root HTTP 200 with wrapper `/v1/health` HTTP 404 is classified
  as `GAS_STATION_ROOT_READY`; the wrapper-health probe is logged as
  informational rather than a fatal failure.
- Existing older upstream diagnostic reports without
  `gasStationReachability` remain valid.
- A report still cannot pass unless IOTA RPC reachability and reserve_gas
  compatibility both pass; the current sponsor-funding-blocked reserve probe
  remains `TESTNET_UPSTREAM_REPORT_FAILED`.
- The diagnostic still does not print or store raw upstream response bodies,
  faucet task ids, full sponsor addresses, sponsor signer material, rendered
  Gas Station config, bearer tokens, raw transaction bytes, user signatures, or
  local secret paths.

Verification:

- Focused diagnostic, live-status, and sponsored-execute prerequisite tests.
- `npm run diagnose:gas-station -- --report
  tmp/gaskit/testnet-upstream-diagnostic.json` on the current machine,
  recording only sanitized status output.
- `npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.7, 7.18, 7.25, and 7.26.

Risk:
Low. The change improves operator triage, but must not allow root reachability
or optional wrapper health to stand in for reserve_gas compatibility.

Escalation triggers:

- Any request to treat `GAS_STATION_ROOT_READY` as reserve_gas compatibility,
  sponsored execution proof, or sponsor funding proof.
- Any request to print or store raw Gas Station response bodies, bearer tokens,
  rendered Gas Station config, full sponsor addresses, raw transaction bytes,
  user signatures, or sponsor signer material.

## Slice 7.28: Sponsor Funding Request Faucet Context

User-visible outcome:
Operators can generate the ignored sponsor funding request artifact with
bounded context from the latest sanitized sponsor faucet report, so a failed or
rate-limited faucet route is visible next to the full public sponsor address
without printing that address in stdout or treating faucet context as funding
proof.

Likely files:

- `scripts/write-sponsor-funding-request.ts`
- `scripts/write-sponsor-funding-request.test.ts`
- `docs/CODEBASE_MAP.md`
- `docs/testnet-readiness.md`
- `docs/agentic-gaskit/live-proof-status.md`
- `docs/agentic-gaskit/operator-live-gates.md`
- `docs/agentic-gaskit/execution-slices.md`

Acceptance criteria:

- `npm run sponsor:write-funding-request -- --faucet-report
  <ignored-json-path> --out <ignored-json-path>` validates the supplied
  sponsor faucet report and copies only bounded result, code, API version,
  HTTP status, failure kind, and guidance fields into the ignored funding
  request artifact.
- `GASKIT_SPONSOR_FAUCET_REPORT=<ignored-json-path> npm run
  sponsor:write-funding-request -- --out <ignored-json-path>` uses the same
  bounded context path.
- Invalid, stale, unreadable, or unsafe faucet reports are classified as
  invalid/unreadable context without copying unsafe fields.
- The funding request summary remains redacted and does not print the full
  sponsor address, faucet URL, faucet task id, raw faucet body, signer
  material, bearer token, rendered Gas Station config, raw transaction bytes,
  or user signatures.
- Faucet context remains advisory. It does not clear `sponsor-funding`,
  `testnet-upstream`, reserve_gas compatibility, or sponsored execution
  readiness.

Verification:

- Focused sponsor funding request, sponsor faucet, live-status, and
  package-script tests.
- `npm run sponsor:write-funding-request -- --faucet-report
  tmp/gaskit/sponsor-faucet-request-v0-latest.json --out
  tmp/gaskit/sponsor-funding-request.json`.
- `npm run typecheck`.
- `npm run docs:check`.
- `npm run secrets:scan`.
- `git diff --check`.
- `npm run verify:fast`.

Dependencies:
Slices 7.16, 7.18, 7.22, and 7.24.

Risk:
Low to medium. The artifact already contains the full public sponsor address
in an ignored path, but it must not become a place to copy unsafe faucet
responses or to overclaim funding readiness.

Escalation triggers:

- Any request to print the full sponsor address, signer material, faucet URL,
  faucet task id, raw faucet body, bearer token, rendered Gas Station config,
  raw transaction bytes, or user signatures.
- Any request to treat faucet context or a funding request artifact as
  sponsor funding, reserve_gas compatibility, or sponsored execution proof.
