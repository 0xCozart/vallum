# Account And Wallet Safety Model

Last updated: 2026-06-09.

## Decision

Agentic GasKit should support easy account and wallet creation, including
agent-created wallets, but it must be signer-reference-first.

Agents may create wallets. Humans and operators may fund those wallets directly
or through GasKit-controlled sponsorship. Agents must not receive raw seeds,
mnemonics, private keys, or unrestricted signing authority as their default
interface.

## Relationship To GasKit

The upstream GasKit codebase is the canonical foundation for Gas Station
sponsorship, policy gateway behavior, app credentials, quotas, observability,
testnet readiness, sponsor-wallet safety, and secret hygiene.

This fork extends that foundation. It should not duplicate GasKit's gateway or
deployment layer. Agentic GasKit adds agent wallet lifecycle, signer-reference
routing, agent identity binding, and policy-scoped execution.

## Wallet Roles

| Role | Created by | Holds funds | Default signing surface | Notes |
| --- | --- | --- | --- | --- |
| Sponsor wallet | Human/operator | Yes, operational gas funds | Gas Station or external signer | Existing GasKit owns the operational safety boundary. |
| Agent wallet | Agent through approved SDK/CLI/API | Maybe | Signer reference with scoped capabilities | Agents can create these, but should not see seeds by default. |
| User wallet | Human/user | Maybe | User wallet or external signer | User signs their own intent where required. |
| Provider wallet | Human/provider or organization | Yes | External signer or verified profile signer | Used for escrow/provider payouts. |
| Ephemeral demo wallet | SDK/CLI/demo harness | Testnet only | In-memory signer | Allowed for local/test demos; never marketed as custody. |
| Recovery wallet material | Human/operator only | Maybe | Explicit recovery workflow | Export is exceptional, warned, audited, and never silent. |

## Required Product Semantics

- Agents can request wallet creation.
- Wallet creation returns an address and a signer reference, not a seed.
- Wallet creation requires authenticated owner/agent context and rate limits.
- A signer reference is an opaque handle, not a bearer credential. Possession
  of the reference alone must not authorize signing.
- Agent profiles bind to wallet address, signer reference, owner DID, agent DID,
  capability scope, creation time, rotation state, and revocation state.
- Humans/operators can fund agent wallets directly or through GasKit-sponsored
  workflows.
- Sponsored/value-bearing actions still pass through the policy gateway.
- Signing authority is scoped by policy: contract templates, methods, budgets,
  counterparties, expiry, and human approval thresholds.
- Wallets can be revoked, rotated, and marked compromised.
- Every recovery/export action is explicit and auditable.

## Storage Modes

| Mode | Purpose | Allowed secret persistence | Verification |
| --- | --- | --- | --- |
| In-memory ephemeral signer | Tests and demos | None after process exit | Unit tests prove no file writes. |
| Encrypted local keystore | Local development | Encrypted key material only | Tests cover wrong passphrase, file permissions, and redacted logs. |
| Environment signer | Compatibility with existing local scripts | Environment-owned, not app-owned | Readiness checks only; never printed or committed. |
| External signer/KMS | Production direction | Outside Agentic GasKit process | Adapter contract tests and docs; real provider requires explicit scope. |
| Gas Station sponsor signer | Sponsor gas operations | Existing GasKit/Gas Station boundary | Keep separate from agent wallet material. |

## Recovery Rules

Seed or private-key export is not a normal SDK method.

Recovery workflows must:

- require explicit human/operator intent
- print warnings before export
- avoid writing plaintext by default
- produce an audit event with wallet id, actor, timestamp, reason, and
  destination type, but not the secret
- require follow-up rotation guidance
- be unavailable to autonomous agent runtimes unless explicitly delegated by a
  human/operator policy

## Non-Goals

- No default plaintext seed storage.
- No hidden seed export.
- No agent-visible raw private keys.
- No production custody service without a separate security/legal review.
- No replacement for existing IOTA GasKit sponsor-wallet operations.
- No browser exposure of app credentials, sponsor keys, mnemonics, transaction
  bytes, user signatures, or Gas Station bearer tokens.

## Minimum First Slice

The first implementation slice should define interfaces and tests before live
wallet operations:

- `SignerRef`
- `WalletAccount`
- `WalletAccountStatus`
- `WalletAccountStore`
- `SignerAdapter`
- `WalletCreationContext`
- in-memory agent wallet creation
- explicit recovery-not-supported error
- redaction tests for signer refs and secret-looking fixture values
- tests proving signer refs are scoped handles and cannot be used as standalone
  authorization

Only after that should the project add encrypted local keystore behavior.
