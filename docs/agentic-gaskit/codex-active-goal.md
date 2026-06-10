# Codex Active Goal: Agentic GasKit Build/Test/Improve Loop

Last updated: 2026-06-10.

## Goal Pointer

This is the active `/goal` target for Codex execution in
`/home/sacred/code/agentic-gaskit`.

Current continuation handoff:

- `docs/agentic-gaskit/handoff-next-product-build.md`

Execution entry:

- `docs/agentic-gaskit/execution-entry.md`

Immediate product slice:

- Slice 5.1: Marketplace Readiness Gate completion and handoff

## Intent Read

The repo is the canonical Agentic GasKit implementation fork created from the
existing IOTA GasKit project. The handoff says the repo migration and planning
foundation are complete enough to begin product implementation.

The current goal is not another broad planning pass. Codex should build the
product in vertical slices, starting with account/wallet primitives, and use a
repeatable eval loop to test, harden, improve, and hand off each slice before
moving forward.

The failure mode is building demo-shaped features that pass happy paths while
weakening GasKit sponsorship safety, leaking wallet material, bypassing policy,
or losing evidence between sessions.

## Repo Term Normalization

| Raw term | Repo/product term | Assumption |
| --- | --- | --- |
| "another project" | Existing IOTA GasKit foundation in this fork | Extend current GasKit gateway, SDK, policy, readiness, and secret hygiene behavior. |
| "new product" | Agentic GasKit | Agent-safe sponsored execution on IOTA with wallets, signer refs, manifests, policy, receipts, contracts, MCP/A2A, and standards bridges. |
| "handoff" | `docs/agentic-gaskit/handoff-next-product-build.md` | Treat it as the latest continuation state. |
| "phases prepared" | PRDs, execution slices, module specs, gates | Execute by vertical slices, not broad package scaffolding. |
| "loop with evals" | Per-slice build/test/harden verification loop | Every slice needs baseline, focused tests, broad checks, hardening review, evidence, and a handoff. |

## Objective Contract

Goal:
Build Agentic GasKit from the migrated GasKit fork into a working,
locally/testnet-verifiable product by executing the existing phase plan in
small vertical slices, starting with signer-reference-first account creation.

Why:
Agentic GasKit only works if agents can use IOTA execution rails without
receiving raw wallet secrets, bypassing policy controls, or rebuilding proven
GasKit sponsorship behavior incorrectly.

Current problem:
The repository contains the existing GasKit sponsorship toolkit plus locally
verified Agentic slices for accounts, manifests, mock policy sponsorship,
SDK/MCP routing, receipts, escrow/receipt Move state contracts, and the local
agent-to-agent escrow demo. The current slices add local Agent Profile schema
validation, local fixture resolution, SDK resolver access, capability policy
checks, mock-tested IOTA Names/Identity adapter interfaces, a local
contract-template metadata registry, a local pay-per-call tool workflow, and a
local/mock data-license workflow. The current slices also add a local x402 v2
standards bridge for mapping payment requirements to manifests and receipts
without operating a production facilitator, plus a local AP2 closed checkout/
payment mandate bridge for mapping mandates to manifests and dispute-linked
receipts without operating live AP2 or production payment rails. The current
slices also add local A2A Agent Card mapping from Agent Profiles without
operating an A2A server or public discovery endpoint. Slice 5.1 adds a
marketplace readiness gate that permits marketplace requirements/design work
only inside local/mock proof and keeps production marketplace implementation
blocked. The next gaps are expanded contract workflows beyond pay-per-call and
data-license, access-control/dispute evidence for any marketplace-facing
surface, live IOTA Names/Identity proof, and live deployment proof when
explicitly in scope.

Desired outcome:
Codex repeatedly implements one vertical slice, proves it with focused and
broad checks, improves failures found by evals, records evidence, commits or
hands off cleanly, and then advances to the next dependency-safe slice.

Users affected:

- IOTA dApp builders using sponsored execution.
- Agent developers needing safe signer references and policy-gated execution.
- Operators who must fund, monitor, revoke, and audit agent actions.
- Future implementation agents resuming this repo.

In scope:

- Start from the latest handoff and `docs/agentic-gaskit/execution-entry.md`.
- Verify the existing foundation before editing.
- Continue from the latest completed slice unless a baseline gate is broken.
- Continue through `docs/agentic-gaskit/execution-slices.md` in dependency order.
- Use tests before implementation where feasible.
- Add negative and redaction tests for every security boundary.
- Preserve existing GasKit gateway, SDK, app credential, quota, sponsor-wallet,
  readiness, and secret hygiene behavior unless a migration reason is written.
- Keep all execution evidence local unless explicitly asked to use an external
  tracker.

Out of scope unless explicitly approved:

- Production custody or KMS integration.
- Default seed export.
- Mainnet behavior or real funds.
- Marketplace implementation before Phases 1-4 pass.
- Tokenomics.
- Replacing MCP, A2A, AP2, x402, or official IOTA Gas Station.
- External issue tracker updates.

Constraints:

- Read `CLAUDE.md` and `docs/CODEBASE_MAP.md` before broad search.
- Respect `apex.workflow.json`; do not claim Apex verification until Apex
  profile review/setup concerns are addressed or explicitly accepted.
- IOTA testnet verification is allowed when it is relevant to the current
  slice and required operator-owned local config is present; do not expose
  secrets or turn local/mock proof into a live proof claim.
- Do not expose seeds, mnemonics, private keys, raw keypairs, raw transaction
  bytes, user signatures, sponsor keys, app API keys, bearer tokens, payment
  credentials, or private prompt text.
- Treat signer references as scoped handles, not bearer credentials.
- Treat the policy gateway and wallet creation as security boundaries.

## Execution Loop

Run this loop for every slice.

1. Orient
   - Read the latest handoff.
   - Read the owning PRD, module spec, execution slice, verification gates, and
     planning-structure traceability row.
   - Run `git status --short --branch` and preserve unrelated work.

2. Define done
   - Restate the slice outcome, owned files, no-touch surfaces, acceptance
     criteria, focused checks, broad checks, manual checks, risks, and
     escalation triggers.
   - For meaningful code-facing work, create or update the local Apex slice
     manifest under `tmp/apex-workflow/` before editing if the helper/profile is
     usable. If Apex setup remains unreviewed or unavailable, record the same
     scope and evidence in the final handoff and do not claim Apex verification.

3. Baseline eval
   - Run the lightest baseline checks needed for the slice.
   - For a broad product slice, start with:

     ```bash
     npm run docs:check
     npm run secrets:scan
     npm test
     npm run typecheck
     ```

4. Test-first eval
   - Add failing tests for the behavior before implementation where feasible.
   - Tests should cover both approved behavior and denial/redaction behavior for
     any security, policy, wallet, receipt, payment, or gateway boundary.

5. Implement
   - Make the smallest vertical change that produces the slice outcome.
   - Reuse existing repo patterns, scripts, workspace conventions, and GasKit
     safety boundaries.

6. Focused eval
   - Run the narrowest tests for touched files first.
   - Prefer focused package, script, example, or docs tests before full repo
     proof.

7. Broad eval
   - Broaden to checks required by touched surfaces.
   - Before considering a meaningful product slice complete, run:

     ```bash
     npm run verify:local
     git diff --check
     ```

8. Hardening eval
   - Check policy bypass, signer-reference misuse, secret leakage, stale
     external APIs, revocation, idempotency, happy-path-only demos, log privacy,
     and incomplete evidence.
   - Use a dedicated hardening pass before accepting wallet, signer, gateway,
     MCP, payment, recovery/export, or launch-sensitive work.

9. Improve
   - Fix eval failures and hardening findings before broadening scope.
   - If a failure reveals a larger design gap, document the blocker and stop the
     slice instead of guessing.

10. Handoff
   - Record files changed, commands run, manual checks, evidence summary, known
     unproven claims, risks, commit hashes, and next safe slice.
   - Update the continuation handoff when the slice changes what the next agent
     must know.

## Current Slice Acceptance

Slice 5.1 is complete only when:

- A local marketplace readiness document reviews whether Phases 1-4 primitives
  are strong enough to justify marketplace work.
- The review cites current local verification evidence for implemented
  primitives and separates local/mock proof from live testnet or production
  proof.
- Marketplace non-goals remain explicit.
- Compliance, provider-verification, moderation, custody, live-payment, and
  security questions are listed as unresolved or gated where applicable.
- Existing GasKit tests and safety checks still pass, or any failure is
  explained as a pre-existing/blocking condition with exact evidence.

Current Slice 5.1 artifact:

- `docs/marketplace-readiness.md`

## Completion Standard

The active goal is complete only when Agentic GasKit has advanced from the
current handoff through verified vertical slices until the product works in
mock/localnet/testnet form:

- install, typecheck, tests, docs checks, local gateway smokes, and secret scan
  pass from a clean checkout;
- account creation, manifests, policy evaluation, SDK/MCP routing, receipts,
  identity/registry, contract templates, and standards mappings have tests and
  negative cases appropriate to their phase;
- SDK and MCP value-bearing flows route through the policy gateway;
- receipts/logs do not leak secrets or private prompt text;
- signer-reference-first wallet behavior is proven before live signing;
- phase handoffs cite the relevant PRD, slice, gate, commands, evidence, risks,
  and commit hashes;
- production/mainnet/custody/payment-provider claims remain out of scope unless
  explicitly approved later.

## Next Safe Command Sequence

Start the next Codex execution session with:

```bash
git status --short --branch
sed -n '1,220p' docs/agentic-gaskit/handoff-next-product-build.md
sed -n '1,220p' docs/agentic-gaskit/execution-entry.md
sed -n '1,180p' docs/agentic-gaskit/account-wallet-safety.md
sed -n '1,190p' docs/agentic-gaskit/execution-slices.md
sed -n '1,220p' docs/agentic-gaskit/verification-hardening.md
```

Then create the next slice scope record/manifest, run the baseline evals, add
focused tests or review checks, and follow the next safe target named by the
handoff. Do not start production marketplace implementation from Slice 5.1
alone.
