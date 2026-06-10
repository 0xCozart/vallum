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

- Slice 1.0: Agent Account And Wallet Manager Contract
- Conservative package path: `packages/accounts`
- Conservative package name: `@iota-gaskit/accounts`

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
The repository contains the existing GasKit sponsorship toolkit and complete
planning docs, but the Agentic packages for accounts, manifests, MCP/A2A,
registry, receipts, and contract workflows are not implemented yet.

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
- Implement Slice 1.0 first unless a baseline gate is broken.
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
- Do not run live testnet commands without explicit operator intent.
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
   - For the current account slice, start with:

     ```bash
     npm run docs:check
     npm run secrets:scan
     npm test
     npm run typecheck
     ```

4. Test-first eval
   - Add failing tests for the behavior before implementation where feasible.
   - For Slice 1.0, tests must cover signer-reference creation, no secret
     material in returned values, signer refs not authorizing by themselves,
     revoked/disabled status behavior, recovery/export denial, and redaction.

5. Implement
   - Make the smallest vertical change that produces the slice outcome.
   - Reuse existing repo patterns, scripts, workspace conventions, and GasKit
     safety boundaries.

6. Focused eval
   - Run the narrowest tests for touched files first.
   - For Slice 1.0, prefer focused account/package tests before full repo proof.

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

## First Slice Acceptance

Slice 1.0 is complete only when:

- `packages/accounts` exists and exposes the account/wallet manager contract.
- Agent wallet creation returns address, wallet id, signer reference, status,
  and allowed scopes.
- Returned values do not include seed, mnemonic, private key, raw keypair, raw
  transaction bytes, user signatures, sponsor keys, app API keys, or bearer
  tokens.
- Wallet creation requires owner/agent context.
- Signer references are opaque scoped handles and cannot authorize signing or
  sponsorship by possession alone.
- Revoked or disabled wallet state cannot sign.
- Recovery/export is explicit and denied or unsupported for autonomous agent
  runtime flows.
- Logs/errors redact signer refs and secret-looking fixture values where they
  could leak.
- Existing GasKit tests and safety checks still pass, or any failure is
  explained as a pre-existing/blocking condition with exact evidence.

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

Then create the Slice 1.0 scope record/manifest, run the baseline evals, add
focused account tests, and implement `packages/accounts`.
