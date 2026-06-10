# PRD: Phase 2 Identity And Registry

## Problem

Safe sponsored actions require more than an address. Agents need a verifiable
profile that connects name, wallet, signer reference, owner, DID, capabilities,
endpoints, contracts, payment methods, revocation status, and reputation
pointers.

## Goals

- Define the Agent Profile / Agent Passport schema.
- Resolve an agent name to a validated profile.
- Bind agent-created wallets to signer references, ownership, rotation state,
  and revocation state.
- Bind profile data to IOTA Names where supported and to local/testnet metadata
  where needed.
- Integrate IOTA Identity DIDs and verifiable credentials for owners and agent
  capabilities.
- Support revocation and key rotation semantics.
- Make profile resolution usable by SDK, MCP, policy gateway, and dashboard.

## Non-Goals

- No public marketplace.
- No universal DNS replacement.
- No custom A2A replacement.
- No production identity authority.
- No legal identity verification product.

## User Stories

- As an agent developer, I want `resolveAgent("researcher.demo.iota")` to return
  all safe interaction metadata.
- As an agent runtime, I want to create and reference my wallet without exposing
  seed material to tools, logs, or prompts.
- As an operator, I want policies to reference capabilities from a verified
  profile instead of raw names.
- As a provider, I want counterparties to know my endpoint, payment methods, and
  supported contracts.
- As an auditor, I want revocation and owner changes to be visible.

## Functional Requirements

- Define Agent Profile fields:
  - agent name
  - target wallet/address
  - signer reference
  - wallet creation source
  - wallet rotation/revocation state
  - agent DID
  - owner DID or organization identifier
  - capabilities
  - credential references
  - MCP endpoint
  - A2A endpoint or Agent Card URL
  - supported contract templates
  - payment methods
  - spend policy pointer
  - reputation object pointer
  - expiry
  - revocation status
  - schema version
- Implement resolver API in SDK and registry package.
- Implement profile validation and schema versioning.
- Make wallet references compatible with `packages/accounts` and existing
  IOTA GasKit funding/sponsorship boundaries.
- Implement local/mock resolver for tests.
- Implement IOTA Names adapter after verifying current API.
- Implement IOTA Identity adapter after verifying current DID/VC APIs.
- Make policy gateway optionally require capability match for selected actions.
- Add dashboard/profile inspection view.

## Technical Requirements

- Resolver must return typed errors for not found, expired, revoked, malformed,
  unverifiable, unsupported schema, and stale cache.
- Profile cache must honor expiry and revocation.
- Credentials must be validated by deterministic code, not an LLM.
- Profile metadata must not require private identity data.
- Profile metadata must not include seeds, mnemonics, private keys, raw
  keypairs, or plaintext signer secrets.
- Profile schema must be compatible with A2A Agent Card mapping in Phase 4.
- Local profile fixtures must enable tests without live IOTA.

## Likely Files

- `packages/registry/src/profileSchema.ts`
- `packages/registry/src/resolveAgent.ts`
- `packages/registry/src/iotaNamesAdapter.ts`
- `packages/registry/src/iotaIdentityAdapter.ts`
- `packages/sdk/src/resolveAgent.ts`
- `packages/policy-gateway/src/capabilityCheck.ts`
- `apps/dashboard/src/profile/`
- `examples/identity-profile/`

## Acceptance Criteria

- Local fixture profile resolves and validates.
- Revoked profile is denied for sponsored actions.
- Expired profile is denied or flagged according to policy.
- Capability mismatch denies protected actions.
- Owner DID and agent DID are exposed to policy evaluation.
- Wallet address and signer reference are exposed as references only, with no
  secret material.
- Revoked wallet/signing state denies protected actions.
- Profile schema maps cleanly to future A2A Agent Card fields.
- Dashboard can inspect resolved profile and validation status.

## Verification

- Unit tests for profile schema.
- Unit tests for resolver errors.
- Unit tests for capability policy checks.
- Integration tests with mock IOTA Names and Identity adapters.
- Manual testnet resolution once official APIs are confirmed.
- Documentation showing current official API assumptions.

## Edge Cases

- Name resolves to wallet but profile metadata is missing.
- Profile points to dead MCP/A2A endpoint.
- Capability credential is revoked after profile cache.
- Agent wallet signer reference is rotated after profile cache.
- Owner changes name target address.
- Multiple profiles claim the same endpoint.
- Payment methods differ from policy-allowed methods.

## Risks

- IOTA Names may not support all profile metadata directly.
- Identity APIs may change or require off-chain storage.
- Revocation can be missed if cache TTL is too long.
- Signer-reference drift can leave profiles pointing at revoked or compromised
  wallet material.
- Impersonation risk if name/profile/DID binding is weak.

## Escalation Triggers

- Need for legally verified organizational identity.
- Inability to bind profile metadata safely to IOTA Names.
- DID/VC behavior requires a specialized identity provider.
