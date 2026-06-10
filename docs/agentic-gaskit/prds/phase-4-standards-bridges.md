# PRD: Phase 4 Standards Bridges

## Problem

Agentic GasKit should not be a walled garden. The useful wedge is IOTA-native
identity, gas sponsorship, contracts, receipts, and policy controls that plug
into broader agent payment and communication standards.

## Goals

- Add x402-compatible payment support for paid APIs/tools.
- Add AP2-style mandate and receipt compatibility.
- Add A2A-compatible agent profile metadata.
- Anchor external payment/mandate receipts to IOTA contract or receipt state.
- Preserve policy gateway enforcement for all bridged flows.

## Non-Goals

- No replacement x402 facilitator.
- No replacement AP2 protocol.
- No custom agent communication protocol.
- No assumption that IOTA has all stablecoin liquidity required.
- No marketplace.

## User Stories

- As an API provider, I want an agent to pay for my HTTP endpoint through x402
  while Agentic GasKit records policy and receipt state.
- As an operator, I want AP2-style mandates to map to transaction manifests.
- As another agent, I want to discover an Agentic GasKit agent through an
  A2A-compatible card.
- As an auditor, I want external payment evidence linked to IOTA receipts.

## Functional Requirements

- Implement x402 client/server helper or adapter after verifying current x402
  version and facilitator APIs.
- Map x402 payment requirements to manifest fields:
  - resource
  - amount
  - currency/network
  - payee
  - expiry
  - receipt/idempotency
- Implement AP2 mandate compatibility layer:
  - checkout mandate pointer
  - payment mandate pointer
  - trusted-surface/non-agentic boundary indicator
  - dispute evidence reference
- Implement receipt anchoring:
  - external payment id
  - facilitator verification/settlement status
  - IOTA receipt object or event id
  - manifest id
- Implement A2A Agent Card mapping:
  - name
  - description
  - endpoint
  - auth requirements
  - skills/capabilities
  - supported contracts
  - payment methods
- Add bridge examples:
  - paid MCP tool with x402
  - AP2-style autonomous mandate mock
  - A2A profile endpoint

## Technical Requirements

- Bridged flows must pass through the policy gateway.
- External payment metadata must be redacted where it may contain PII or private
  business context.
- Idempotency must bind external payment, manifest, and IOTA receipt.
- AP2 trusted-surface behavior must remain deterministic and non-agentic.
- A2A metadata must not expose private credentials or secrets.
- Standards adapters must be versioned because protocols are evolving.

## Likely Files

- `packages/standards/x402/`
- `packages/standards/ap2/`
- `packages/standards/a2a/`
- `packages/manifest/src/ap2Mapping.ts`
- `packages/receipts/src/externalPaymentReceipt.ts`
- `packages/registry/src/a2aCard.ts`
- `examples/paid-mcp-tool-x402/`
- `examples/ap2-mandate-mock/`

## Acceptance Criteria

- x402 mock/facilitator flow can pay for an API/tool call and receive a result.
- Policy gateway can deny x402-backed requests using the same budget and
  counterparty rules as native flows.
- AP2-style mandate fixture maps to a manifest and receipt without losing
  dispute evidence fields.
- A2A-compatible card can be generated from an Agent Profile.
- External payment receipt is linked to IOTA receipt/contract state.
- Versioned adapters fail closed on unsupported protocol versions.

## Verification

- Unit tests for x402 requirement to manifest mapping.
- Unit tests for AP2 mandate to manifest mapping.
- Unit tests for A2A card generation.
- Integration test for paid API/tool mock.
- Redaction tests for logs.
- Manual verification against current official x402/AP2/A2A docs.

## Edge Cases

- x402 payment verifies but IOTA receipt submission fails.
- IOTA receipt succeeds but external settlement later fails.
- AP2 mandate expires during agent execution.
- A2A card advertises a skill that policy no longer allows.
- External protocol version changes field names.
- Facilitator returns inconsistent verify/settle states.

## Risks

- x402/AP2/A2A are active standards; docs and schemas may change.
- External payment metadata can leak user or business intent.
- Agents may confuse "paid" with "authorized to execute."
- Standards bridge may become broader than core IOTA value.

## Escalation Triggers

- Need to process real card/bank/payment credentials.
- Need to operate a production facilitator.
- Protocol version incompatibility cannot be resolved through adapter versioning.
