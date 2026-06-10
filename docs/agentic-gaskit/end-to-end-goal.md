# End-To-End Goal Prompt

Use this prompt when handing Agentic GasKit to an implementation agent that
should execute the roadmap until the product is working in verified
mock/localnet/testnet form.

## Entry Doc

Start with:

1. `docs/agentic-gaskit/codex-execution-prompt.md`

Then read every file it names in order. Do not skip:

- `AGENTS.md`
- `docs/agentic-gaskit/migration-plan.md`
- `skills/iota-gaskit/SKILL.md`
- `docs/agentic-gaskit/planning-structure-audit.md`
- `docs/agentic-gaskit/execution-slices.md`
- `docs/agentic-gaskit/verification-hardening.md`

## Copy/Paste Prompt

```text
You are working in /home/sacred/code/agentic-gaskit on Agentic GasKit.

Your goal is to execute the local plan end to end until Agentic GasKit is a
working, verified product in mock/localnet/testnet form.

Entry doc:
Start with docs/agentic-gaskit/codex-execution-prompt.md, then read every file it names in
order. Do not skip AGENTS.md, docs/agentic-gaskit/migration-plan.md,
skills/iota-gaskit/SKILL.md, docs/agentic-gaskit/planning-structure-audit.md,
docs/agentic-gaskit/execution-slices.md, or docs/agentic-gaskit/verification-hardening.md.
Also read docs/agentic-gaskit/account-wallet-safety.md before implementing account, wallet, or
signing behavior.

Product objective:
Build Agentic GasKit as IOTA-native agent infrastructure for sponsored gas,
policy controls, identities, names, Move contract blocks, receipts, MCP tools,
and standards-compatible payment flows. Preserve the hybrid model: IOTA for
gas, identity, object state, contracts, credentials, reputation, receipts, and
coordination; USD/stablecoin/x402/AP2-compatible rails for pricing, budgets,
and business settlement.

This fork was created from https://github.com/0xCozart/iota-gaskit. Use the
existing GasKit code as the foundation for Gas Station sponsorship, app
credentials, policy gateway behavior, SDK reserve/execute flows, quotas,
observability, testnet readiness, sponsor-wallet hardening, and secret hygiene.
Agentic GasKit should extend that foundation for agent wallets/accounts,
manifests, identities, MCP/A2A, contracts, receipts, and standards bridges.

Non-negotiable constraints:
- Do not build tokenomics.
- Do not build a marketplace first.
- Do not do production mainnet custody.
- Do not replace x402, AP2, A2A, or MCP.
- Do not replace proven GasKit sponsorship behavior without an explicit
  migration reason and compatibility proof.
- Do not let SDK or MCP value-bearing tools bypass the policy gateway.
- Do not expose raw seeds, mnemonics, private keys, or raw keypairs to agents.
- Do not treat a happy-path demo as completion.
- Do not use stale protocol snippets; refresh official docs before integration.
- Do not commit secrets, private keys, bearer tokens, payment credentials, or
  private prompt text.
- Escalate before any real funds, production facilitator/payment credentials,
  custody, KYC/KYB, physical-device safety, or mainnet behavior.

Execution strategy:
Work strictly by vertical slices from docs/agentic-gaskit/execution-slices.md. Complete,
verify, commit, and hand off one slice before moving to the next unless a
dependency requires a small supporting change.

Start sequence:
1. Run git status --short --branch.
2. Read docs/agentic-gaskit/planning-structure-audit.md and docs/agentic-gaskit/verification-hardening.md.
3. Refresh scaffold-critical external API notes for package names, Move tests,
   localnet, Gas Station, MCP, and adapter interfaces.
4. Execute Slice 0.1 Repo Scaffold.
5. Complete Slice 0.2 External API Refresh Notes before any Phase 1 slice.
6. Complete Slice 0.3 Existing IOTA GasKit Integration Map before rebuilding
   sponsorship gateway or SDK behavior.
7. Complete Slice 1.0 Agent Account And Wallet Manager Contract before live
   wallet signing behavior.
8. Continue through slices 1.1 to 5.1 in dependency order.

Iteration loop for every slice:
1. Orient: reread the owning PRD, module spec, execution slice, hardening
   gates, and audit traceability row.
2. Define done: restate the slice outcome, files likely touched, acceptance
   criteria, verification commands, manual checks, and escalation triggers.
3. Refresh external APIs if the slice touches IOTA, Gas Station, Move, Names,
   Identity, MCP, x402, AP2, A2A, package names, adapter interfaces, or
   protocol fields.
4. Test first where feasible: add failing tests for schemas, policy rules,
   adapters, state machines, contracts, or UI behavior before implementation.
5. Implement the smallest vertical change that creates one user/operator-visible
   outcome.
6. Verify: run targeted tests first, then broaden to lint/typecheck/full
   tests/build/manual demo as the touched surface requires.
7. Harden: check policy bypass, stale APIs, secret leakage, idempotency,
   revocation, payment split-brain, unsupported protocol versions, and
   happy-path-only demos. For wallet/account work, also check seed exposure,
   signer-reference bypass, recovery/export misuse, and custody drift.
8. Record evidence: commands run, manual steps, files changed, test output
   summary, known unproven claims, risks, and next slice.
9. Commit: make one structured commit per completed slice.
10. Continue only if the phase gate is satisfied or a blocker is explicitly
    documented.

Phase gates:
- Phase 0 is complete only when install, lint, typecheck, tests, contract test
  path, mock gateway start, env templates, external notes, git hygiene, and
  slice evidence are present.
- Phase 1 is complete only when manifest, policy, gateway, SDK, MCP, escrow,
  receipts, signer-reference account creation, logs, happy path, and deny cases
  are verified.
- Phase 2 is complete only when profile schema, resolver, revocation/expiry,
  capability checks, and Names/Identity assumptions are verified or explicitly
  blocked.
- Phase 3 is complete only when contract templates have Move tests, metadata
  gates policy allow-lists, CLI/localnet deployment works, and SDK
  wrappers/examples pass.
- Phase 4 is complete only when x402, AP2, and A2A mappings are versioned,
  tested, redacted, policy-gated, and fail closed on unsupported versions.
- Phase 5 is a marketplace readiness gate first. Do not implement marketplace
  code until Phases 1-4 pass and readiness risks are documented. Ask before
  building real marketplace, provider verification, moderation, staking,
  custody, or production settlement.

Definition of completed working product:
A clean checkout can install, test, typecheck, run the mock/localnet gateway,
run the agent-to-agent escrow demo, show policy denies and approvals, issue
receipts/logs without leaking secrets, create or reference agent wallets without
returning raw seed/private-key material, resolve local/test profiles, run
contract template tests/demos, and prove standards mappings in mock/test form.
Any production/mainnet/custody or default seed-export claim remains out of
scope unless explicitly approved later.

Final handoff format:
- Current phase and slice completed
- Objective traceability row
- Files changed
- Commands run
- Manual checks run
- Evidence summary
- Commit hashes
- Known unproven claims
- Blockers or escalation needs
- Next recommended slice
```
