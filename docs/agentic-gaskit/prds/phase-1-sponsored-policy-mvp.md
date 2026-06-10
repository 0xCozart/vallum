# PRD: Phase 1 Sponsored Policy MVP

## Problem

Agents should not receive unrestricted wallets or direct sponsorship. The first
working product must prove controlled sponsored IOTA execution: every action has
a signed manifest, a policy decision, a simulation requirement, a spend cap, a
contract allow-list, signer-reference-scoped wallet access, and an audit
receipt.

## Goals

- Let an agent request a sponsored IOTA action through SDK and MCP.
- Let an agent create a wallet/account in local/mock mode without receiving raw
  seed material.
- Reuse the existing IOTA GasKit gateway/SDK/Gas Station operational foundation
  where possible.
- Validate an Agent Transaction Manifest before any value-bearing action.
- Enforce policy rules for known agents, contracts, counterparties, spend,
  simulation, rate limits, and human approval thresholds.
- Integrate with Gas Station in mock/localnet/testnet mode.
- Ship one verifier-release escrow contract and one receipt model.
- Provide dashboard/operator logs for all decisions.

## Non-Goals

- No full registry or DID issuance.
- No x402/AP2 bridge.
- No production mainnet sponsorship.
- No default plaintext seed storage or silent seed export.
- No production custody or KMS integration.
- No marketplace.
- No arbitrary Move package deployment by agents.

## User Stories

- As an agent developer, I want to call one SDK method to request a sponsored
  action so I do not manage gas coins directly.
- As an agent developer, I want an agent to create its own wallet and receive a
  safe signer reference rather than a raw seed.
- As an operator, I want to fund agent wallets directly or through GasKit while
  keeping signing and spending policy-scoped.
- As an operator, I want unknown or risky actions denied by default so sponsored
  gas cannot be abused.
- As a verifier, I want escrow release to require explicit proof so agent tasks
  do not rely on trust.
- As an auditor, I want every attempted action logged with a policy decision and
  receipt state.

## Functional Requirements

- Define an Agent Transaction Manifest schema with:
  - agent name/address
  - agent wallet id or signer reference where applicable
  - owner identifier
  - intent
  - max spend
  - allowed contract/action
  - counterparty
  - expiry
  - receipt requirement
  - refund policy
  - human mandate pointer
  - simulation hash or simulation status
  - nonce/idempotency key
- Define a policy schema with:
  - known agent identifiers
  - daily and per-transaction spend limits
  - allowed packages/contracts/actions
  - blocked actions
  - destination allow-list
  - simulation requirement
  - human approval threshold
  - rate limit
  - log level
- Implement pure policy evaluation with deny-by-default behavior.
- Define account/wallet interfaces for:
  - agent-created wallet account
  - authenticated wallet creation context
  - signer reference
  - account status
  - rotation/revocation state
  - recovery/export policy
- Add in-memory wallet creation for tests and demos.
- Add gateway endpoint for sponsorship requests.
- Add SDK method `requestSponsoredAction` and initial `openEscrow`.
- Add MCP tool `iota.request_sponsored_transaction` and `iota.open_escrow`.
- Add local/mock Gas Station adapter and current-official adapter interface.
- Add Move escrow contract with create, verify/release, refund/expire paths.
- Add receipt model for attempted, denied, sponsored, submitted, released, and
  refunded states.
- Add dashboard/operator log view or structured log output.

## Technical Requirements

- MCP tools must call SDK/gateway paths, not raw IOTA clients.
- Gateway must not trust client-supplied policy decisions.
- Simulation hash/status must be bound to the transaction intent and inputs.
- Idempotency keys must prevent duplicate sponsorship/release from retries.
- Gateway logs must redact secrets, auth tokens, private keys, payment
  credentials, and private prompt text.
- Policy evaluator must be unit-testable without IOTA.
- Gas Station integration must be adapter-based so mock/localnet/testnet can be
  swapped without changing policy code.
- Account creation must return address plus signer reference, not seed,
  mnemonic, private key, or raw keypair.
- Account creation must require authenticated owner/agent context and rate
  limits.
- Signer references must be opaque scoped handles, not bearer credentials.
  Possession of a signer reference alone must not authorize signing or
  sponsorship.
- Recovery/export must be explicit, denied by default for autonomous agent
  runtimes, and audited when later implemented.
- Existing IOTA GasKit SDK/gateway behavior should be reused through adapters
  instead of duplicated unless a migration reason is documented.

## Likely Files

- `packages/manifest/src/schema.ts`
- `packages/accounts/src/`
- `packages/policy-gateway/src/evaluatePolicy.ts`
- `packages/policy-gateway/src/server.ts`
- `packages/policy-gateway/src/gasStationAdapter.ts`
- `packages/sdk/src/IotaAgent.ts`
- `packages/mcp-server/src/tools.ts`
- `packages/receipts/src/schema.ts`
- `contracts/escrow_v1/`
- `contracts/receipt_v1/`
- `apps/dashboard/`
- `examples/agent-escrow/`
- `policies/research-agent.json`

## Acceptance Criteria

- Valid known-agent escrow request is accepted in mock/localnet mode.
- Agent wallet creation returns a signer reference and address without raw
  seed/private-key material.
- Signer references cannot be used as standalone authorization without matching
  owner/agent context and policy scope.
- Humans/operators can fund or sponsor agent wallets without granting agents
  unrestricted signing authority.
- Unknown agent is denied.
- Missing manifest is denied.
- Expired manifest is denied.
- Over-budget action is denied.
- Disallowed contract/action is denied.
- Unauthorized counterparty is denied.
- Missing simulation is denied when policy requires simulation.
- Human approval is required above configured threshold.
- Retry with same idempotency key does not double-sponsor or double-release.
- Every decision emits a redacted audit log.
- Demo shows an agent opening escrow, provider completing task, verifier
  releasing escrow, and receipt status updating.

## Verification

- Unit tests for manifest schema.
- Unit tests for account/wallet creation and redaction.
- Negative tests proving signer-ref-only requests fail authorization.
- Unit tests for policy allow/deny matrix.
- Unit tests for idempotency behavior.
- Integration test for gateway request lifecycle in mock mode.
- MCP tool smoke test against gateway.
- SDK integration test against gateway.
- Move tests for escrow create/release/refund.
- Manual local demo script.

## Edge Cases

- Agent retries after network timeout.
- Simulation result is stale or for different inputs.
- Gas Station reserves gas but transaction submission fails.
- Agent wallet is created but never funded.
- Signer reference is revoked between manifest creation and execution.
- Verifier tries to release twice.
- Counterparty changes between manifest and transaction.
- Rate limit resets while pending escrow exists.
- Clock skew affects manifest expiry.

## Risks

- Gas sponsorship can be griefed by intentionally invalid requests.
- Object locks or gas coin reservation behavior can cause operational failure.
- Prompt-injected agents may generate technically valid but unsafe requests.
- Logs can leak sensitive content if not redacted early.
- Wallet creation can accidentally become a custody or seed-exposure product.

## Escalation Triggers

- Any design that lets MCP bypass policy.
- Any mainnet transaction requirement.
- Any need to custody user funds beyond escrow test fixtures.
- Any need to export raw seeds outside an explicit recovery workflow.
- Official Gas Station API differs materially from planned adapter shape.
