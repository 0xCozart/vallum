# Account And Wallet Safety Model

Last updated: 2026-06-09.

## Decision

Vallum should support easy account and wallet creation, including
agent-created wallets, but it must be signer-reference-first.

Agents may create wallets. Humans and operators may fund those wallets directly
or through Vallum-controlled sponsorship. Agents must not receive raw seeds,
mnemonics, private keys, or unrestricted signing authority as their default
interface.

## Relationship To Vallum

The upstream Vallum codebase is the canonical foundation for Gas Station
sponsorship, policy gateway behavior, app credentials, quotas, observability,
testnet readiness, sponsor-wallet safety, and secret hygiene.

This fork extends that foundation. It should not duplicate Vallum's gateway or
deployment layer. Vallum adds agent wallet lifecycle, signer-reference
routing, agent identity binding, and policy-scoped execution.

## Wallet Roles

| Role | Created by | Holds funds | Default signing surface | Notes |
| --- | --- | --- | --- | --- |
| Sponsor wallet | Human/operator | Yes, operational gas funds | Gas Station or external signer | Existing Vallum owns the operational safety boundary. |
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
- Humans/operators can fund agent wallets directly or through Vallum-sponsored
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
| External signer/KMS | Production direction | Outside Vallum process | Adapter contract tests and docs; real provider requires explicit scope. |
| Gas Station sponsor signer | Sponsor gas operations | Existing Vallum/Gas Station boundary | Keep separate from agent wallet material. |

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
- No replacement for existing Vallum sponsor-wallet operations.
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

## Production Custody Readiness Gate

`npm run proof:custody-readiness` is the non-networked production custody
readiness gate.

It checks the local signer-reference account source, tests, package README,
this safety model, verification hardening guidance, package build coverage, and
local verification coverage. It does not create a production custody service,
connect to a KMS, export keys, operate signer infrastructure, stake, bond,
slash, or custody funds.

The accounts package can also build a local status-only custody production
review snapshot for the required signer-reference, no-secret-exposure,
KMS/external-signer, lifecycle, recovery, backup, rotation, audit, legal,
incident-response, and redaction checks. Missing checks remain pending and
notes are redacted. The snapshot is operator preparation material only; it does
not replace the ignored `CUSTODY_PRODUCTION_REPORT` structured report required
by this readiness gate.

Production custody claims remain blocked unless `CUSTODY_PRODUCTION_REPORT`
points to an ignored redacted structured report from an operator-approved
custody review. The report must be status-only JSON with `schemaVersion=1`,
`kind=vallum.custody-production-proof`, `result=passed`, a recent
`observedAt`, `custodyMode=external-signer` or `custodyMode=kms`, and check ids
for signer-reference contract review, no agent secret exposure, KMS/external
signer review, cryptographic module validation, operator access, key
lifecycle, recovery/export review, backup/restore, rotation/revocation review,
audit logging, legal/security review, incident response, and redaction review.
It also must include passing status-only sections named
`signerReferenceReview`, `custodyControlReview`, `lifecycleReview`,
`recoveryReview`, `auditReview`, `incidentReview`, and `complianceReview`.
Those sections must summarize only review status, not raw key-management
records, module certificates, operator account data, recovery artifacts, audit
logs, incident details, or legal documents.

The report must not include seeds, mnemonics, private keys, raw keypairs,
signer material, credentials, payloads, headers, signatures, or local secret
paths.

When `CUSTODY_PRODUCTION_REPORT` is missing, generate the status-only template
first:

```bash
npm run operator:write-report-template -- --kind custody-production --out tmp/vallum/custody-production-report-template.json
```

The generated template is preparation material only. It does not contact KMS
providers, external signers, custody providers, IOTA services, Gas Station
endpoints, or live wallet infrastructure, and it is not accepted as production
custody proof until an operator completes the required review and sets
`CUSTODY_PRODUCTION_REPORT` to a valid ignored structured report.

`npm run proof:custody-readiness -- --out tmp/vallum/custody-readiness.json`
writes the same readiness state as a redacted mode-0600 local JSON artifact for
audit snapshots. The artifact does not contact KMS providers, external
signers, custody providers, IOTA services, Gas Station endpoints, or live
wallet infrastructure, and it does not clear production custody blockers.

`npm run custody:write-production-proof-plan` adds a non-networked custody
production proof-plan writer for operators:

- builds first;
- contacts no KMS, external signer, custody provider, IOTA service, Gas
  Station endpoint, or live wallet infrastructure;
- emits command order, current blocker codes, required structured report
  fields, required check ids, and proof boundaries;
- can write an ignored local JSON artifact such as
  `tmp/vallum/custody-production-proof-plan.json`;
- keeps seeds, mnemonics, private keys, raw keypairs, signer material,
  credentials, authorization headers, payloads, signatures, exported keys, and
  local secret paths out of output and Git.

`npm run custody:write-production-proof-bundle -- --out
tmp/vallum/custody-production-proof-bundle.json` writes the custody production
report template, proof plan, readiness artifact, and redacted summary together
as ignored local artifacts. The bundle is still a preparation artifact: it does
not contact KMS providers, external signers, custody providers, IOTA services,
Gas Station endpoints, or live wallet infrastructure, and it does not clear
production custody blockers without a valid operator-supplied structured
report.
