# PRD: Phase 5 Marketplace

## Problem

The thesis includes discovery and reputation, but a marketplace will fail if
built before the primitives work. After SDK, policy, registry, contracts, and
standards bridges are proven, a marketplace can expose useful providers and
templates.

## Goals

- Provide searchable agents and services.
- Show verified capabilities, pricing, payment methods, supported contracts, and
  reputation.
- Let users initiate escrow/pay-per-call/data-license workflows from listed
  providers.
- Surface usage logs, receipts, and dispute evidence.
- Support provider staking/bonding only after risk review.

## Non-Goals

- No marketplace before Phases 1-4 are working.
- No speculative tokenomics.
- No unverified provider claims.
- No production custody without legal/security review.
- No IoT-heavy marketplace until device safety constraints are proven.

## User Stories

- As a buyer agent, I want to discover a provider with a verified capability.
- As a provider, I want to publish pricing and supported contracts.
- As an operator, I want to see usage, spend, disputes, and policy denials.
- As a human reviewer, I want to inspect receipts and evidence before disputes
  are resolved.

## Functional Requirements

- Search agents by capability, contract template, price, endpoint, payment
  method, and reputation.
- Display verified profile data and validation status.
- Display policy compatibility before purchase.
- Initiate escrow/pay-per-call/data-license workflows.
- Display receipts and audit logs.
- Add dispute evidence collection.
- Add provider onboarding and verification.
- Add provider bond/stake only if Phase 5 hardening approves it.

## Technical Requirements

- Marketplace must consume registry/profile data, not duplicate identity truth.
- Marketplace actions must route through SDK and policy gateway.
- Search results must label verification status clearly.
- Pricing must be stablecoin/USD-denominated where possible.
- Logs and receipts must be scoped by user/operator permissions.
- Dispute evidence must be tamper-evident and linked to manifest/receipt ids.

## Likely Files

- `apps/marketplace/`
- `packages/marketplace-api/`
- `packages/registry/`
- `packages/receipts/`
- `packages/sdk/`
- `apps/dashboard/`

## Acceptance Criteria

- Provider can publish a verified test profile.
- Buyer can search and inspect provider capability/pricing.
- Buyer can initiate a policy-checked paid workflow.
- Marketplace displays receipts and policy decisions.
- Dispute evidence links to mandate, manifest, payment, and IOTA receipt state.
- Unverified or revoked providers are labeled and blocked where policy requires.

## Verification

- E2E test for provider onboarding to paid workflow.
- Policy integration tests for marketplace-initiated actions.
- Access-control tests for logs/receipts.
- Search/filter tests.
- Manual dispute evidence walkthrough.

## Edge Cases

- Provider profile revoked after listing.
- Price changes between discovery and purchase.
- Provider endpoint is unavailable.
- Reputation score is gamed by repeated low-value jobs.
- Dispute evidence contains sensitive data.
- Buyer and provider collude.

## Risks

- Marketplace adds trust, compliance, and moderation obligations.
- Reputation can be gamed.
- Provider bonding may create financial/regulatory exposure.
- Marketplace can distract from developer tooling.

## Escalation Triggers

- Any real-money production settlement.
- Any legal KYC/KYB/provider verification requirement.
- Any custody, staking, or slashing mechanism.
- Any content moderation or marketplace abuse surface requiring policy.
