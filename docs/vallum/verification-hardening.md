# Verification And Hardening Plan

Last updated: 2026-06-09.

## Completion Standard

The roadmap is executable only when future implementation can prove each phase
with direct evidence:

- source files exist for the slice
- tests cover the stated behavior
- negative policy cases pass
- manual demos are reproducible from a clean checkout
- external API assumptions are refreshed
- risks are documented with mitigation or escalation

No phase should be called complete because a happy-path demo works.

## Cross-Cutting Invariants

- Deny by default for unknown agents, contracts, counterparties, actions, schema
  versions, payment protocols, and unsupported standards versions.
- Every autonomous action has agent, owner, intent, budget, scope, expiry,
  counterparty, idempotency key, and receipt requirement.
- Every sponsored or value-bearing action passes through policy gateway.
- Agents can create wallets, but normal APIs return signer references and
  addresses, not seeds, mnemonics, private keys, or raw keypairs.
- Signer references are opaque scoped handles, not bearer credentials. Matching
  owner/agent context and policy scope are required for signing.
- Humans/operators fund agent wallets directly or through Vallum sponsorship;
  funding and value-bearing use remain auditable and policy-gated.
- MCP tools and SDK helpers cannot bypass policy.
- Simulation is required where configured and must be bound to the manifest.
- Human approval threshold blocks execution until deterministic approval state
  exists.
- Logs redact secrets, bearer tokens, private keys, payment credentials, and
  private prompt text.
- Seed export is not a default path. Recovery/export requires explicit
  human/operator intent, audit records, and separate hardening.
- External payment state is linked to manifest and IOTA receipt ids.
- Profile/credential revocation must be checkable and cache-bounded.
- Marketplace work cannot begin until primitives are proven.

## Verification Matrix

| Area | Minimum checks | Evidence |
| --- | --- | --- |
| Manifest | schema validation, expiry, version, required fields | unit tests |
| Accounts | signer-reference creation, no seed exposure, rotation/revocation | unit/integration tests |
| Policy | allow/deny matrix, spend caps, allow-list, rate limit, approval | unit tests |
| Gateway | request lifecycle, redaction, idempotency, mock Gas Station | integration tests |
| SDK | no policy bypass, typed results, error handling | integration tests |
| MCP | tool input validation, gateway routing, denial handling | smoke/integration tests |
| Contracts | create/release/refund, unauthorized release, double release | Move tests |
| Receipts | state lifecycle, external payment linkage, audit ids | unit/integration tests |
| Registry | profile schema, expired/revoked states, capability checks | unit tests |
| IOTA adapters | current API compatibility, localnet/testnet path | adapter tests/manual |
| x402 bridge | requirement mapping, verify/settle state, redaction | unit/integration tests |
| AP2 bridge | mandate mapping, dispute evidence, trusted-surface marker | unit tests |
| A2A bridge | Agent Card generation, revoked skill suppression | unit/schema tests |
| Dashboard | auth, log redaction, operator actions, no secret leakage | e2e/manual |
| Marketplace | profile verification, access control, dispute evidence | e2e/manual |

## Hardening Findings To Address Before Implementation

### Blocker: Objective Traceability Can Be Lost

Failure mode:
Implementation satisfies individual package tasks while missing the product
objective: safe sponsored agent infrastructure with policy, receipts, identity,
standards compatibility, and operator control.

Impact:
The repo ships a demo-shaped codebase that does not prove the safety and
interoperability claims.

Fix:
Use the public PRDs, module specs, execution slices, and verification gates as
the blocking traceability check. Every phase handoff must cite the relevant
thesis need, PRD, slice, gate, evidence, and remaining risk.

Validation:
Phase handoff includes objective traceability and direct evidence for the phase
gate.

### Blocker: Gitless Work Becomes Unreviewable

Failure mode:
Planning and implementation changes happen without a baseline commit or
structured slice commits.

Impact:
Reviewers cannot isolate what changed, and future agents may accidentally bury
scope drift or broken verification in large diffs.

Fix:
Phase 0 requires git initialization, `.gitignore`, baseline commit, pre-edit
status check, and structured commits per slice.

Validation:
`git log --oneline --decorate -n 5` shows baseline and slice commits; `git
status --short --branch` is clean or intentionally explained.

### Blocker: Missing External API Refresh Step

Failure mode:
Implementation uses stale local notes for IOTA Names, Gas Station, Identity,
MCP, x402, AP2, or A2A.

Impact:
Agents may build invalid adapters or unsafe assumptions into core modules.

Fix:
Integration slices must refresh current official docs before scaffold decisions
that depend on external tooling and before any provider-facing integration
slice.

Validation:
Each adapter PR must cite the exact docs/API version it implements.

### Blocker: Policy Boundary Could Be Bypassed

Failure mode:
SDK or MCP server calls IOTA clients or Gas Station directly for sponsored or
value-bearing actions.

Impact:
Spend caps, allow-lists, simulation, revocation, and receipts become optional.

Fix:
Architect SDK/MCP so value-bearing operations call the gateway. Keep raw IOTA
helpers read-only or explicitly unsafe with no sponsorship.

Validation:
Tests assert MCP tools use gateway adapter; code review searches for direct
Gas Station calls outside gateway adapters.

### Blocker: Existing Vallum Can Be Accidentally Rebuilt

Failure mode:
Vallum duplicates the existing Vallum gateway, SDK, deployment,
sponsor-wallet, and testnet-readiness surfaces instead of extending them.

Impact:
The project forks its own safety boundary, loses proven Vallum behavior, and
creates inconsistent policy, credentials, quota, and sponsor-wallet semantics.

Fix:
Start with Slice 0.3. Treat existing Vallum as the canonical sponsorship
foundation inside this fork unless a migration or adapter reason is explicitly
documented.

Validation:
Docs and code identify reused existing Vallum surfaces, and duplicated gateway
or SDK behavior has a written rationale.

### Blocker: Agent Wallet Seeds Can Leak Or Become Custody

Failure mode:
Wallet convenience APIs return or persist seeds, mnemonics, private keys, or raw
keypairs to agent runtimes, logs, browser flows, or default local files.

Impact:
An agent prompt, tool result, log, or compromised local file can drain agent,
provider, user, or sponsor funds. The product silently becomes a custody system.

Fix:
Use signer-reference-first design. Agents can create wallets, but receive only
address, wallet id, signer reference, status, and policy scopes. Recovery/export
is explicit, human/operator gated, audited, and out of normal autonomous flows.

Validation:
Account tests assert no seed/private-key material appears in API results, logs,
fixtures, snapshots, or MCP tool outputs. Recovery/export tests fail closed
until an explicit recovery workflow exists.

### Major: Happy-Path Escrow Can Hide Abuse Cases

Failure mode:
Demo opens and releases escrow but does not prove denied cases.

Impact:
The project looks functional while unknown agents, over-budget actions, double
release, or missing simulation can still pass.

Fix:
Treat negative tests as Phase 1 acceptance criteria.

Validation:
Run deny-matrix tests and Move unauthorized/double-release tests.

### Major: External Payment State Can Split From IOTA Receipt State

Failure mode:
x402 payment settles but IOTA receipt write fails, or IOTA receipt succeeds but
external settlement fails.

Impact:
Audit trails and dispute evidence conflict.

Fix:
Represent external payment and IOTA receipt as separate state machines linked by
manifest/idempotency ids. Do not collapse them into one boolean.

Validation:
Tests for partial failure states.

### Major: Identity Cache Can Miss Revocation

Failure mode:
Gateway uses stale profile/capability data after DID credential or profile
revocation.

Impact:
Revoked agents continue spending sponsored gas or calling protected contracts.

Fix:
Bound profile cache TTL, support forced revocation refresh for protected
actions, and log revocation source/timestamp.

Validation:
Tests for cached active profile changing to revoked.

### Major: Logs Can Leak Sensitive Agent Context

Failure mode:
Gateway/dashboard logs store bearer tokens, private keys, payment credentials,
full prompt text, or private task payloads.

Impact:
Security and privacy breach.

Fix:
Define log schema early; log stable identifiers, hashes, reason codes, and
redacted summaries.

Validation:
Redaction tests with secret-like fixtures.

### Major: Slice Evidence Can Be Non-Reproducible

Failure mode:
A slice handoff says tests or demos passed without exact commands, fixtures,
manual steps, or commit hash.

Impact:
The next agent cannot reproduce the proof and may build on unverified behavior.

Fix:
Each slice handoff must include commands run, manual checks, evidence files,
known unproven claims, risks, and commit hash.

Validation:
Reviewer can rerun the named commands from a clean checkout.

### Major: Marketplace Prematurely Creates Compliance Surface

Failure mode:
Marketplace begins before policy, receipts, reputation, and dispute evidence
are reliable.

Impact:
Provider verification, disputes, payments, moderation, and potential regulatory
requirements arrive before infrastructure is safe.

Fix:
Use Phase 5 readiness gate. Do not implement marketplace until Phases 1-4 pass.

Validation:
Marketplace PRD cannot be activated until readiness checklist is complete.

## Phase Gates

### Phase 0 Gate

Required evidence:

- install works
- git repo exists with baseline planning commit
- lint/typecheck/test scripts exist
- contract test path exists
- local gateway mock can start
- env templates committed without secrets
- external API notes refreshed or blocked with exact sources
- slice evidence and commit discipline documented

### Phase 1 Gate

Required evidence:

- existing Vallum integration map exists or duplicated sponsorship
  behavior has a written reason
- account/wallet creation returns signer references without raw secret material
- manifest schema tests pass
- policy allow/deny matrix tests pass
- gateway mock integration tests pass
- SDK and MCP route through gateway
- escrow/receipt contract tests pass
- demo includes happy path and deny cases
- logs are redacted
- seed/private-key redaction tests pass

### Phase 2 Gate

Required evidence:

- profile schema tests pass
- profile wallet/signer reference tests pass
- resolver fixture tests pass
- revoked/expired profile tests pass
- revoked/rotated signer reference tests pass
- capability policy tests pass
- current IOTA Names/Identity APIs documented
- testnet/manual resolution path verified or explicitly blocked

### Phase 3 Gate

Required evidence:

- each initial contract template has Move tests
- template metadata gates policy allow-list
- CLI deploys approved template locally/testnet
- SDK wrappers compile and test
- pay-per-call and data-license demos run

### Phase 4 Gate

Required evidence:

- x402 mapping tests pass
- AP2 mapping tests pass
- A2A card generation tests pass
- external payment partial failure tests pass
- unsupported protocol version fails closed
- redaction tests cover external payment metadata

### Phase 5 Gate

Required evidence:

- Phases 1-4 gates pass
- marketplace readiness review exists
- compliance/security questions are documented
- access control tests cover logs and receipts
- dispute evidence walkthrough passes

## Escalation Rules

Escalate to the user before proceeding if any slice requires:

- production mainnet funds
- custody of user funds
- real payment credentials
- operating a production x402 facilitator or payment processor
- legal/KYC/KYB provider verification
- device access with physical safety implications
- an external issue tracker
- a product rename away from Vallum
- a broad marketplace build before primitives pass

## Roadmap Audit Checklist

Use this checklist before marking the active goal complete:

- `CLAUDE.md` exists and explains project rules.
- `docs/CODEBASE_MAP.md` exists and orients future agents.
- `docs/vallum/roadmap.md` defines objective, architecture, module
  ownership, phase roadmap, and design loop.
- `docs/vallum/product-status.md` separates local proof from live,
  production, publication, and safety blockers.
- `docs/vallum/launch-readiness-evidence.md` maps roadmap areas to
  evidence, commands, blockers, and next gates.
- `docs/vallum/execution-slices.md` contains vertical work packets with dependencies,
  acceptance criteria, verification, risk, and escalation triggers.
- `docs/vallum/verification-hardening.md` contains invariants, gates, risk findings,
  and completion audit criteria.
- Public PRDs, module specs, execution slices, and verification gates map
  thesis needs to PRDs, slices, gates, and failure signals.
- Private Codex execution prompts and scratch audits stay in ignored local
  planning paths rather than hosted public docs.
- The plan explicitly avoids marketplace-first, tokenomics, mainnet custody, and
  standards replacement.
- The plan explicitly handles sponsored-gas abuse, policy bypass, external API
  staleness, prompt-injection risk, revocation, payment split-brain, and log
  privacy.
