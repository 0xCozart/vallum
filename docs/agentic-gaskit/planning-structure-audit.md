# Planning Structure Audit

Last audited: 2026-06-09.

## Audit Objective

Red-team the planning artifacts for Agentic GasKit and verify that the planning
structure can actually drive the stated objective:

Build IOTA-native agent infrastructure for sponsored gas, policy controls,
identities, names, contract blocks, receipts, MCP tools, and
standards-compatible payment flows without drifting into marketplace-first,
tokenomics, mainnet custody, or a replacement for x402, AP2, A2A, or MCP.
The existing GasKit code in this fork is the sponsorship foundation; Agentic
GasKit should extend it rather than rebuilding it.

## Verdict

The plan is viable as a planning workspace if the gates in this audit are
treated as blocking. The strongest part of the plan is its vertical order:
foundation, manifest, policy gateway, SDK/MCP, escrow/receipts, identity,
contract library, standards bridges, then marketplace readiness.

The plan does not become implementation-ready because the docs are present. It
becomes implementation-ready only when Phase 0 proves the repository scaffold,
external API refresh, test commands, local/mock execution, and git hygiene from
a clean checkout.

## Findings

### Blocker: No Git Baseline Or Commit Discipline

Failure mode:
Future agents make broad planning or implementation changes without a baseline,
making it impossible to separate thesis, planning, audit, and code changes.

Impact:
Review quality drops and regressions become hard to isolate. A future agent may
silently replace product constraints while appearing to implement the roadmap.

Fix applied:
Initialize git, add a baseline `.gitignore`, and commit the planning workspace
before audit hardening. Phase 0 now requires git initialization, structured
commits, and clean or intentionally documented working-tree state.

Validation:
`git log --oneline --decorate -n 5` shows a baseline planning commit followed
by any audit or implementation commits.

### Major: Objective Traceability Was Implicit

Failure mode:
An implementer can satisfy local checklists while missing the objective, for
example by scaffolding packages and demos that do not prove sponsored policy,
receipts, revocation, or standards compatibility.

Impact:
The repo becomes a plausible demo instead of the controlled agent
infrastructure described by the thesis.

Fix applied:
This audit adds a traceability matrix and requires future handoffs to tie
changed slices back to the objective, PRD, acceptance criteria, and verification
evidence.

Validation:
Before a phase is called complete, its handoff names the relevant PRD, slices,
checks run, evidence files, remaining risks, and the objective row it satisfies.

### Major: Slice Evidence Could Be Too Vague

Failure mode:
A slice is marked complete with claims like "tests passed" or "demo works"
without exact commands, outputs, fixture names, or manual steps.

Impact:
Future agents cannot reproduce the proof, and launch-blocking behavior can be
hidden behind a happy-path demo.

Fix applied:
The slice queue now requires a completion record for each slice: objective,
files changed, commands run, manual steps, evidence, risks, and commit hash.

Validation:
Each implementation handoff includes a concrete evidence block and a matching
commit.

### Major: External API Freshness Could Be Hand-Waved

Failure mode:
Implementation copies outdated assumptions for IOTA Gas Station, IOTA Move,
IOTA Names, IOTA Identity, MCP, x402, AP2, or A2A.

Impact:
Adapters may be wrong, unsafe, or impossible to verify. Standards bridges are
especially risky because protocol versions and Agent Card fields can change.

Fix applied:
Phase 0 requires current-source API notes before scaffold decisions that depend
on external tooling, and requires the full API refresh before Phase 1 starts.
Any adapter or standards mapping must cite the exact official docs, version,
and date used. Unresolved schema/path ambiguity blocks the slice rather than
becoming a guess.

Validation:
`docs/agentic-gaskit/external-api-notes.md` contains dated source links and implementation
assumptions for every touched integration. Unsupported versions fail closed in
tests.

### Major: Marketplace Readiness Needed A Hard Lock

Failure mode:
Marketplace docs or UI work starts because the thesis is exciting, before
policy, registry, receipts, standards bridges, access control, and dispute
evidence are proven.

Impact:
The project inherits trust, moderation, compliance, and payment risks before
the core primitives are safe.

Fix applied:
The roadmap and hardening gates treat Phase 5 as a readiness decision, not a
default build queue. Marketplace implementation remains blocked until Phases
1-4 pass and a readiness review exists.

Validation:
No marketplace implementation slice is active until `docs/marketplace-readiness.md`
proves the Phase 5 gate.

## Objective Traceability Matrix

| Thesis need | Planning owner | First proof | Failure signal |
| --- | --- | --- | --- |
| Sponsored gas without unrestricted agent wallets | Phase 1 PRD, policy gateway module, slices 1.2-1.4 | Deny matrix and mock gateway integration tests | SDK or MCP can call Gas Station directly |
| Existing GasKit reuse | Slice 0.3, module specs, CODEBASE_MAP | Integration map names reused SDK/gateway/security surfaces | Agentic repo rebuilds GasKit gateway/SDK without rationale |
| Agent-created wallets without seed exposure | Account/wallet safety doc, Phase 1 PRD, Slice 1.0 | Wallet creation returns signer reference and address only | Agent receives seed, mnemonic, private key, or raw keypair |
| Safe autonomous actions | Manifest, policy, receipts, verification gates | Unknown, expired, over-budget, disallowed, missing-simulation, and approval-threshold denials | Any fallback allows unknown actions |
| Verifiable agent identity and revocation | Phase 2 PRD, registry module, slices 2.1-2.3 | Revoked and expired profile tests | Cached revoked profile can still spend |
| Contract blocks for repeatable workflows | Phase 3 PRD, contracts module, slices 3.1-3.2 | Move tests and template metadata allow-list tests | Raw package address can bypass template policy |
| Receipts and dispute evidence | Receipts module, Phase 1 and Phase 4 PRDs | Receipt state-machine and partial-failure tests | Payment success and IOTA receipt success collapse into one boolean |
| Standards compatibility without replacement | Phase 4 PRD, standards module, slices 4.1-4.3 | Versioned x402/AP2/A2A mapping tests | Unsupported protocol version is accepted |
| Operator control and auditability | Dashboard module, hardening gates | Redacted logs, approval records, audit export path | Secrets or private prompt text appear in logs |
| Marketplace only after primitives | Phase 5 PRD and readiness gate | Phases 1-4 gates pass and readiness review exists | Marketplace code starts before readiness evidence |

## Phase Activation Gates

Before any phase starts:

- Read the phase PRD, `docs/agentic-gaskit/execution-slices.md`, module specs, and this audit.
- Run `git status --short --branch` and preserve unrelated work.
- Refresh `docs/agentic-gaskit/external-api-notes.md` for every touched integration.
- Choose one vertical slice with one user/operator-visible outcome.
- Define exact verification commands and manual checks before editing.

Before any phase is marked complete:

- The phase PRD acceptance criteria are satisfied.
- The phase gate in `docs/agentic-gaskit/verification-hardening.md` has direct evidence.
- Negative tests for the relevant abuse cases pass.
- The implementation handoff names commands, manual checks, files changed,
  risks, and commit hashes.
- The working tree is clean or all remaining changes are explicitly explained.

## External Reality Check Notes

Current public docs support the plan's broad assumptions, but they also justify
the refresh gate:

- IOTA Gas Station is self-hosted and production sponsorship is provider-owned.
- Existing IOTA GasKit already provides a self-hostable toolkit around IOTA Gas
  Station. Agentic work should integrate with it before duplicating its gateway,
  SDK, readiness, or sponsor-wallet surfaces.
- The Gas Station repository exposes Docker, Redis, authentication, and gas pool
  operational details that must be reflected in adapters.
- IOTA Move is object-centric and uses programmable object inputs; contract
  tests must follow current IOTA tooling.
- IOTA Names has a mainnet v1 release, but metadata and resolver behavior still
  need implementation-time verification.
- MCP, x402, AP2, and A2A all have active docs/spec repositories. Bridges must
  version their adapters and fail closed on unsupported versions.

## Audit Handoff Requirement

Every future handoff should include:

- Mode: planning, implementation, review, or launch-readiness.
- Objective row from the traceability matrix.
- Slice and PRD coverage.
- Files changed.
- Commands and manual checks run.
- Known unproven claims.
- Commit hash or reason no commit was made.
