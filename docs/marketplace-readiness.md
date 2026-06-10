# Marketplace Readiness Gate

Last reviewed: 2026-06-10.

## Verdict

Agentic GasKit is ready for marketplace requirements/design work that stays
inside local and mock proof. It is not ready for production marketplace
implementation, live provider onboarding, real-money settlement, custody,
staking, public moderation, or provider verification.

The current Phases 1-4 primitives are strong enough to justify a narrow next
step: define how a marketplace would consume registry profiles, policy
compatibility, contract templates, receipts, and standards bridge evidence
without duplicating those sources of truth. They are not strong enough to
justify operating a marketplace or accepting production provider claims.

## Evidence Reviewed

The latest full local verification evidence is from Slice 3.6 after the
subscription local/mock workflow landed. The recorded command was:

```bash
npm run verify:local
```

The run passed TypeScript tests, Move tests, local smokes, readiness examples,
package dry-run, docs check, and secret scan. That evidence proves the local
workspace can exercise the currently implemented primitives together. It does
not prove live IOTA testnet deployment, mainnet behavior, production payments,
provider verification, or public marketplace operations.

This readiness slice also ran the repo baseline checks appropriate for a
docs-only gate:

```bash
npm run docs:check
npm run secrets:scan
npm test
npm run typecheck
git diff --check
```

## Phase Gate Review

| Area | Local status | Marketplace implication |
| --- | --- | --- |
| Accounts and signer references | Locally tested wallet creation returns addresses and scoped signer references without seed/private-key material. | Marketplace flows can reference agent wallets, but cannot imply production custody or recovery readiness. |
| Manifest and policy gateway | Local tests cover valid actions plus unknown, expired, over-budget, unsupported, missing-simulation, and capability-mismatch denials. | Marketplace purchase initiation must route through SDK and policy gateway; search results cannot become an execution bypass. |
| SDK and MCP routing | Local tests prove sponsored actions and MCP tools route through gateway paths and return structured approvals or denials. | Marketplace actions should call SDK workflows, not direct IOTA clients or payment rails. |
| Receipts and escrow | Local receipt state, escrow lifecycle, denial cases, Move contract tests, and marketplace receipt access-control tests pass. | Marketplace can display receipt/dispute concepts in local demos, but production dispute resolution remains gated. |
| Registry and identity adapters | Agent Profile schema, fixture resolver, capability checks, mock IOTA Names/Identity adapters, bounded local identity verification cache behavior, and an opt-in IOTA Names live smoke path are tested. | Marketplace can consume profile records and label status, but configured live name proof plus live DID/VC verification remain unproven. |
| Contract metadata, pay-per-call, data-license, service-bounty, reputation receipts, and subscriptions | Local template metadata allow-listing, paid tool, data-license, service-bounty, reputation-receipt, and subscription flows pass with denial and failure cases. | Marketplace can model supported templates and local paid/data-license/service-bounty/reputation/subscription evidence calls, but broader contract workflows, recurring billing, dispute operation, public scoring, and production provider access are not complete. |
| x402, AP2, and A2A bridges | Local mapping, well-known response, signed Agent Card verification, task/message operation, local HTTP-shaped A2A boundary, and loopback A2A server tests pass for supported versions; unsupported versions fail closed; sensitive metadata redaction is tested. | Marketplace can show standards compatibility as local bridge evidence only, not live facilitator, AP2 network, live public A2A server, production Agent Card key management, external conformance, or public A2A discovery proof. |
| Marketplace read model | Local read-only provider labels, policy compatibility, contract template summaries, receipt access control, and redacted dispute evidence bundle tests pass. | This proves marketplace evidence consumption only; it does not approve production UI/API, provider onboarding, public scoring, moderation, custody, or live settlement. |

## Marketplace Non-Goals

- No production marketplace build from this gate alone.
- No speculative tokenomics.
- No provider staking, bonding, slashing, or custody.
- No production settlement, payment processing, or real-money facilitator
  operation.
- No public provider verification, KYC, KYB, moderation, or trust-and-safety
  process.
- No unverified provider claims presented as verified capabilities.
- No IoT-heavy marketplace until device safety constraints and provider
  accountability are proven.
- No duplicate marketplace identity database that becomes more authoritative
  than registry/profile, IOTA Names, or IOTA Identity sources.

## Required Marketplace Design Constraints

Any future marketplace slice must preserve these boundaries:

- Consume registry/profile data instead of duplicating identity truth.
- Label active, revoked, expired, unverified, and externally unproven provider
  states clearly.
- Route paid or sponsored actions through the SDK and policy gateway.
- Treat policy compatibility as a pre-purchase check, not a UI-only hint.
- Scope logs, receipts, dispute evidence, and usage records by user/operator
  permissions before exposing them in a UI.
- Keep external payment state, mandate state, manifest state, IOTA receipt
  state, and dispute evidence separate but linked by stable ids.
- Redact private prompts, bearer tokens, raw keys, payment credentials, and
  secret-like provider metadata from logs, cards, receipts, and search indexes.
- Fail closed when profile verification, pricing, endpoint health, payment
  proof, contract template metadata, or standards bridge versions are stale or
  unsupported.

## Unresolved Questions And Gates

These questions block production marketplace work:

| Gate | Status | Required before production marketplace |
| --- | --- | --- |
| Live IOTA Names and Identity proof | IOTA Names now has an opt-in GraphQL smoke and missing-config blocker path. No configured live pass is recorded here. IOTA Identity remains unproven live. | Run and record live testnet or official-environment name and identity proof, including revoked/expired handling. |
| Full verifiable credential validation | Not implemented. | Define trusted issuers, verification method handling, revocation checks, cache TTL, and failure modes. |
| Provider verification | Unresolved. | Decide legal/KYC/KYB and operational verification responsibilities before public listings. |
| Moderation and abuse response | Unresolved. | Define listing review, takedown, fraud, spam, endpoint abuse, and dispute escalation processes. |
| Custody and recovery | Out of scope. | Complete legal/security review before any custody, export, staking, bonding, or slashing behavior. |
| Live payment settlement | Unproven live. | Prove x402/AP2/payment processor paths with safe credentials and partial-failure receipt handling. |
| Live A2A discovery | Unproven live. Local signed-card and loopback server proof exists only for deterministic local JWS signing, trusted-key verification, and local authenticated task routes. | Prove public well-known hosting, production key distribution/rotation, external client discovery, and task/message protocol boundaries before claiming A2A interoperability. |
| Access control for logs and receipts | Local marketplace receipt access-control tests exist for buyer/provider/operator/reviewer views. | Broaden to production API/session authorization before exposing buyer/provider/operator records outside local proof. |
| Dispute evidence walkthrough | Local redacted dispute bundle links manifest, receipt, template, transaction digest, and standards evidence with a stable hash. | Build reviewer workflow, retention, appeal, and moderation process before production dispute operation. |
| Data-license workflows | Implemented locally/mock only. | Prove production provider access, access control, legal terms, live payment, and dispute handling before marketplace use. |
| Reputation scoring | Local reputation receipt evidence exists; public scoring is not implemented. | Design anti-gaming, low-value spam resistance, and source-of-truth rules before any public marketplace ranking claim. |
| Subscription operations | Local subscription entitlement evidence exists; recurring billing and production access enforcement are not implemented. | Prove provider access control, renewal billing, cancellation/refund policy, legal terms handling, and partial-failure receipts before marketplace subscription use. |
| Provider endpoint reliability | Not implemented. | Define health checks, stale listing behavior, pricing drift handling, and unavailable-provider UX. |
| Production operations | Not implemented. | Define incident response, audit exports, retention, privacy, backup, and operator permissions. |

## Decision

Marketplace implementation remains blocked for production and public launch.
The first safe marketplace-adjacent read-only package now proves how
marketplace pages would consume existing registry, policy, contract metadata,
receipt, and standards bridge outputs.

Before any marketplace action can initiate a paid or sponsored workflow beyond
local/mock demos, the repo still needs production API/session authorization,
reviewer workflow, and provider-operation decisions. Before any live
marketplace claim, the repo needs configured live proof for the relevant IOTA
Names/Identity, payment, provider-access, and standards-discovery paths.

## Manual Review Checklist

- Phases 1-4 local primitives are implemented and covered by local tests.
- Local proof is not described as live testnet or production proof.
- Marketplace non-goals remain explicit.
- Production custody, payment, provider verification, moderation, staking, and
  tokenomics remain blocked.
- Future marketplace work consumes existing Agentic GasKit primitives instead
  of rebuilding gateway, identity, policy, or receipt truth.
