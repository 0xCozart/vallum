# Module Specs

Last updated: 2026-06-09.

These module specs sit below the phase PRDs. They define what each package or
app owns, what it must not own, and how it is verified.

## Existing GasKit Foundation

Phase:
0 integration baseline, then reused by all sponsored-execution phases.

Owns:

- Canonical IOTA GasKit policy gateway and SDK reserve/execute flows.
- Gas Station deployment and operational boundary.
- App credentials, quotas, wallet denylists, package/function allowlists, usage
  events, testnet readiness, sponsor-wallet safety, and secret hygiene.

Must not own:

- Agent-specific manifest semantics.
- Agent DID/profile lifecycle.
- Agent wallet creation policy beyond the sponsor-wallet and app-credential
  boundary.
- MCP/A2A/x402/AP2 agent workflow semantics unless deliberately integrated.

Acceptance:

- Agentic GasKit docs and code identify which sponsorship surfaces are reused
  from the existing GasKit foundation.
- Any duplicated gateway/SDK behavior has an explicit migration reason.

Verification:

- Read `README.md`, `docs/product-requirements.md`, `docs/security/secrets.md`,
  `docs/security/sponsor-wallet.md`, and `skills/iota-gaskit/SKILL.md`.
- Run GasKit checks from this fork unless a separate upstream comparison is
  intentionally in scope.

## `packages/accounts`

Phase:
1 core, expanded in Phase 2 and production hardening.

Owns:

- Agent-created wallet/account lifecycle.
- Signer-reference model.
- Safe signer adapter interfaces.
- Local in-memory demo signer.
- Encrypted local keystore interface after the signer-reference contract is
  proven.
- Wallet rotation, revocation, compromised status, and recovery workflow
  contracts.

Must not own:

- Default plaintext seed storage.
- Silent seed export.
- Production custody.
- Sponsor-wallet management already owned by existing IOTA GasKit/Gas Station.
- Browser exposure of private keys, mnemonics, user signatures, or transaction
  bytes.

Acceptance:

- Agent wallet creation returns address plus signer reference, not raw seed.
- Agents can create wallets, but value-bearing use is capability and
  policy-scoped.
- Humans/operators can fund agent wallets directly or through GasKit without
  giving agents unrestricted keys.
- Recovery/export APIs are explicit, denied by default for agent runtimes, and
  audit-only until separately implemented.
- Logs redact signer refs where needed and never include seed/private-key
  material.

Verification:

- Unit tests for in-memory account creation.
- Unit tests proving no seed/private key appears in returned values or logs.
- Wrong-passphrase and file-permission tests before encrypted local keystore is
  accepted.
- Integration tests proving SDK/MCP use signer references and still route
  sponsored/value-bearing actions through policy.

## `packages/manifest`

Phase:
1, then extended in Phase 4.

Owns:

- Agent Transaction Manifest schema.
- Manifest validation.
- Manifest versioning.
- Expiry, scope, budget, counterparty, action, contract, idempotency, simulation,
  human mandate, and receipt fields.
- x402/AP2 mapping helpers when standards bridges are added.

Must not own:

- Policy decisions.
- Chain execution.
- Secrets or private keys.

Acceptance:

- Invalid, expired, unknown-version, missing-required-field, and overlarge
  payload fixtures fail.
- Valid fixture passes.
- Schema has stable version field and typed error codes.

Verification:

- Unit tests.
- Typecheck.
- Standards mapping tests in Phase 4.

## `packages/policy-gateway`

Phase:
1 core, expanded in Phases 2-4.

Owns:

- Deny-by-default policy evaluation.
- Sponsored action request lifecycle.
- Gas Station adapter boundary.
- Capability checks from registry/profile data.
- Human approval threshold state.
- Rate limiting and idempotency.
- Redacted audit logs.

Must not own:

- Agent UI.
- Raw wallet private key management beyond configured Gas Station adapter.
- Marketplace business logic.
- LLM-based approval decisions.

Acceptance:

- Unknown agents, missing manifests, expired manifests, over-budget spend,
  disallowed contracts/actions, unauthorized counterparties, missing simulation,
  revoked profile, and unsupported protocol versions are denied.
- Valid requests are approved only when all required checks pass.
- Logs include reason codes and no secrets.

Verification:

- Unit deny matrix.
- Gateway integration tests.
- Redaction tests.
- Adapter contract tests.

## `packages/sdk`

Phase:
1 core, expanded through all phases.

Owns:

- Developer-facing Agentic GasKit API.
- Gateway client.
- `requestSponsoredAction`.
- `openEscrow`.
- `callPaidTool`.
- `resolveAgent`.
- Contract wrapper helpers.
- Typed result/error objects.

Must not own:

- Policy enforcement.
- Direct sponsored/value-bearing IOTA calls that bypass gateway.
- Dashboard or marketplace UI state.

Acceptance:

- SDK operations route through gateway for sponsored/value-bearing actions.
- SDK returns typed approved/denied/pending/retryable/fatal results.
- SDK examples are runnable from docs.

Verification:

- Integration tests against mock gateway.
- Type tests for public API.
- Example smoke tests.

## `packages/mcp-server`

Phase:
1 core, expanded in Phase 4.

Owns:

- MCP tool definitions.
- Tool input validation.
- MCP server transport setup.
- Tool-to-SDK routing.
- Safe errors for agent runtimes.

Must not own:

- Direct Gas Station or IOTA transaction submission.
- Private policy state.
- Raw secrets in tool results.

Initial tools:

- `iota.resolve_name`
- `iota.request_sponsored_transaction`
- `iota.open_escrow`
- `iota.release_escrow`
- `iota.issue_receipt`
- `iota.get_reputation`

Later tools:

- `iota.create_agent_identity`
- `iota.deploy_contract_template`
- `iota.verify_credential`
- `iota.pay_x402`

Acceptance:

- Tool inputs are schema validated.
- Tool calls route through SDK/gateway.
- Denials are returned as structured, non-secret errors.

Verification:

- MCP smoke tests.
- Tool input tests.
- Gateway routing tests.

## `packages/registry`

Phase:
2.

Owns:

- Agent Profile schema.
- Agent resolution.
- IOTA Names adapter.
- IOTA Identity adapter.
- Profile validation.
- Revocation and expiry status.
- A2A Agent Card mapping input.

Must not own:

- Marketplace search ranking.
- Legal/KYB identity verification.
- Policy decisions beyond exposing validated facts.

Acceptance:

- Local fixture resolution works.
- Expired, revoked, malformed, and unverifiable profiles produce typed errors.
- Capability data can be consumed by policy gateway.

Verification:

- Schema tests.
- Resolver tests.
- Mock adapter tests.
- Manual testnet adapter verification after API refresh.

## `packages/contracts-metadata`

Phase:
3.

Owns:

- Versioned contract template metadata.
- Template id/version to package/module/function mapping.
- Pure contract metadata allow-list decisions.
- Local metadata for approved template fixtures.

Must not own:

- Move deployment or package publication.
- Live package-address proof.
- Custody, settlement, or legal audit claims.

Acceptance:

- Approved template/version metadata is accepted.
- Unknown package addresses fail closed when template allow-lists are used.
- Mismatched template versions fail closed.
- Policy gateway can consume metadata without breaking raw package allow-lists.

Verification:

- Metadata registry unit tests.
- Policy gateway integration tests.
- Full local verification before advancing contract slices.

## `packages/receipts`

Phase:
1 core, expanded in Phase 4.

Owns:

- Receipt schema.
- Receipt state machine.
- Receipt/event parsing.
- External payment receipt linkage.
- Audit identifiers.

Must not own:

- Payment settlement.
- Policy approval.
- Private task content.

States:

- attempted
- denied
- approved
- sponsored
- submitted
- completed
- released
- refunded
- disputed
- failed

Acceptance:

- State transitions are explicit.
- Invalid transitions fail.
- External payment and IOTA receipt states can diverge without data loss.

Verification:

- Unit state-machine tests.
- Partial failure tests.
- Redaction tests.

## `contracts`

Phase:
1 starts with escrow and receipt; Phase 3 expands library.

Owns:

- Move contract templates.
- Contract tests.
- Events consumed by receipts/dashboard.
- Template metadata for policy allow-lists.

Must not own:

- Off-chain policy decisions.
- Legal contract guarantees.
- Arbitrary unreviewed package execution.

Initial templates:

- `escrow_v1`
- `receipt_v1`
- `pay_per_call_v1`

Phase 3 templates:

- `data_license_v1`
- `service_bounty_v1`
- `subscription_v1`
- `reputation_receipt_v1`
- `device_access_lease_v1`

Acceptance:

- Each template has state-machine docs, Move tests, and metadata.
- Unauthorized release, double release, refund/expiry, and invalid counterparty
  cases are tested where relevant.

Verification:

- Move tests.
- Localnet/testnet deployment smoke tests.

## `packages/cli`

Phase:
0 scaffold, Phase 3 deploy tooling.

Owns:

- Developer commands.
- Template deployment commands.
- Local demo commands.
- Environment sanity checks.

Must not own:

- Hidden production defaults.
- Secret generation without explicit user action.

Acceptance:

- `gaskit deploy escrow_v1`-style commands are deterministic in localnet/testnet.
- CLI refuses unknown templates and unsafe networks by default.

Verification:

- CLI unit tests.
- Localnet smoke test.

## `apps/dashboard`

Phase:
1 minimal logs, expanded through Phases 2-5.

Owns:

- Operator view for policy decisions.
- Policy management UI when implementation reaches that slice.
- Spend/usage logs.
- Human approvals.
- Profile inspection.
- Receipt/dispute inspection.

Must not own:

- Policy truth separate from gateway.
- Secret display.
- Marketplace listing logic until Phase 5.

Acceptance:

- Operators can inspect redacted decisions and receipt status.
- Approval actions are auditable.
- Revoked/expired profile state is visible.

Verification:

- UI tests when dashboard exists.
- Access-control tests.
- Redaction tests.
- Manual responsive checks if web UI is implemented.

## `packages/standards`

Phase:
4.

Owns:

- x402 adapter.
- AP2 mandate/receipt adapter.
- A2A Agent Card adapter.
- Protocol version guards.

Must not own:

- Production facilitator operation.
- Payment credentials.
- Standards replacement.

Acceptance:

- Unsupported versions fail closed.
- Mappings preserve dispute evidence, idempotency, amount, resource,
  counterparty, and receipt linkage.
- Bridged flows pass through policy gateway.

Verification:

- Mapping unit tests.
- Mock facilitator tests.
- Schema compatibility checks against refreshed official docs.

## `apps/marketplace`

Phase:
5 only.

Owns:

- Search and listing UI.
- Provider onboarding UI.
- Capability/pricing/reputation display.
- Initiation of policy-checked workflows.
- Dispute evidence display.

Must not own:

- Identity truth.
- Policy bypass.
- Real-money production settlement until separately approved.
- Provider KYC/KYB unless explicitly scoped.

Acceptance:

- Marketplace consumes registry, policy, SDK, and receipts rather than duplicating
  them.
- Revoked/unverified providers are blocked or clearly labeled.
- Paid workflow initiation uses SDK/gateway.

Verification:

- E2E workflow tests.
- Access-control tests.
- Dispute evidence walkthrough.
