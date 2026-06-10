# PRD: Phase 3 Contract Block Library

## Problem

The MVP escrow proves the concept, but agents need reusable contract blocks for
common payment, task, data, and device workflows. Without standardized templates,
each developer must write Move from scratch and policy enforcement cannot rely
on known contract semantics.

## Goals

- Build a reusable library of audited/tested Move contract templates.
- Provide deployment tooling and SDK wrappers for each template.
- Make templates policy-addressable by stable identifiers.
- Emit receipts/events that dashboard and reputation systems can consume.
- Prioritize API/data/agent-service contracts before IoT.

## Non-Goals

- No custom tokenomics.
- No unrestricted arbitrary contract deployment by agents.
- No production marketplace listing.
- No legal contract automation beyond technical templates.

## Contract Blocks

Initial set:

- `escrow_v1`
- `receipt_v1`
- `pay_per_call_v1`
- `data_license_v1`
- `service_bounty_v1`
- `subscription_v1`
- `reputation_receipt_v1`
- `device_access_lease_v1`

Deferred candidates:

- milestone escrow
- refundable deposit
- payment splitter
- usage-metered contract
- dispute bond
- SLA contract
- result-delivery contract
- compute purchase
- inference purchase
- model-output provenance receipt
- machine-to-machine payment
- maintenance bounty
- device identity credential

## User Stories

- As a developer, I want `gaskit deploy escrow_v1` so I can use a known
  template without writing Move.
- As an agent, I want to open a pay-per-call purchase through policy controls.
- As a data provider, I want a data license contract that records access terms.
- As an operator, I want every template to have tests and policy metadata.

## Functional Requirements

- Define template metadata schema:
  - template id
  - version
  - package address
  - entry functions
  - allowed actions
  - policy risk category
  - receipt events
  - required manifest fields
  - refund/dispute behavior
- Implement CLI deployment for approved templates.
- Implement SDK wrappers for common flows.
- Add Move unit tests for each template.
- Add policy gateway allow-list integration by template id/version.
- Add receipt/event parsers.
- Add example for pay-per-call MCP tool.
- Add example for data license.

## Technical Requirements

- Each template must have explicit state machine documentation.
- Entry functions must accept only required objects and parameters.
- Template events must include stable identifiers for manifests and receipts.
- Policy must reject unregistered package addresses.
- Upgrades must preserve versioned template identity.
- Tests must cover double release, unauthorized release, expiry/refund, invalid
  counterparty, and event emission where applicable.

## Likely Files

- `contracts/escrow_v1/`
- `contracts/receipt_v1/`
- `contracts/pay_per_call_v1/`
- `contracts/data_license_v1/`
- `contracts/service_bounty_v1/`
- `contracts/subscription_v1/`
- `contracts/reputation_receipt_v1/`
- `contracts/device_access_lease_v1/`
- `packages/contracts-metadata/`
- `packages/sdk/src/contracts/`
- `packages/cli/src/deploy.ts`
- `examples/paid-mcp-tool/`
- `examples/data-license/`

## Acceptance Criteria

- Each initial template has Move tests.
- Each template has metadata consumed by policy gateway.
- CLI can deploy templates to localnet/testnet.
- SDK exposes typed wrappers for initial templates.
- Policy gateway rejects calls to package addresses not matching approved
  metadata.
- Examples run in mock/localnet mode.

## Verification

- Move unit tests per contract.
- Type tests or compile checks for SDK wrappers.
- CLI integration test in mock/localnet.
- Policy tests for allowed and disallowed template versions.
- Manual demo for pay-per-call MCP tool.

## Edge Cases

- Package address changes after deployment.
- Template upgrade changes entry function semantics.
- Receipt event emitted but transaction fails.
- User retries after provider already delivered.
- Data license terms are too large for on-chain storage.
- Subscription renewal overlaps with cancellation.

## Risks

- Contract library becomes too broad before the first few templates are proven.
- Developers treat templates as legally audited contracts.
- Package upgrade behavior introduces compatibility risk.
- Device lease contracts need physical-world safety constraints not covered by
  generic policy.

## Escalation Triggers

- Any template touches custody or settlement beyond testnet assumptions.
- Need for formal smart-contract audit before broader distribution.
- Device access creates physical safety or regulatory risk.
