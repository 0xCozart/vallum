# Codex Execution Prompt

Use this prompt when handing the project to an implementation agent after the
planning goal is complete.

```text
You are working in /home/sacred/code/agentic-gaskit on Agentic GasKit.

Read these files first, in order:

1. AGENTS.md
2. docs/agentic-gaskit/migration-plan.md
3. skills/iota-gaskit/SKILL.md
4. docs/overview.md
5. docs/architecture.md
6. docs/agentic-gaskit/source-thesis.md
7. docs/agentic-gaskit/roadmap.md
8. docs/agentic-gaskit/prds/README.md
9. docs/agentic-gaskit/prds/phase-0-foundation.md
10. docs/agentic-gaskit/execution-slices.md
11. docs/agentic-gaskit/module-specs.md
12. docs/agentic-gaskit/verification-hardening.md
13. docs/agentic-gaskit/planning-structure-audit.md
14. docs/agentic-gaskit/external-api-notes.md
15. docs/agentic-gaskit/account-wallet-safety.md

Objective:
Begin implementation of Agentic GasKit by executing Phase 0 and then the
smallest safe Phase 1 vertical slice. Preserve the roadmap's product framing:
Agentic GasKit is IOTA-native agent infrastructure for sponsored gas, policy
controls, identities, names, Move contract blocks, receipts, MCP tools, and
standards-compatible payments.

This fork was created from `https://github.com/0xCozart/iota-gaskit`. Treat the
existing GasKit gateway, SDK, Gas Station boundary, app credentials, quotas,
testnet readiness, sponsor-wallet hardening, and secret hygiene as the
foundation. Do not rebuild those surfaces unless a migration reason is
documented.

Do not build a marketplace, tokenomics, mainnet custody, standards replacement,
or default seed-export product.

Execution rules:

- Work vertically from docs/agentic-gaskit/execution-slices.md.
- Run `git status --short --branch` before editing and preserve unrelated work.
- Keep history structured: baseline, audit, and each implementation slice should
  be separate commits.
- Start by refreshing scaffold-critical parts of Slice 0.2, then execute Slice
  0.1 Repo Scaffold.
- Complete or explicitly block Slice 0.2 External API Refresh Notes before any
  Phase 1 slice begins.
- Complete Slice 0.3 Existing IOTA GasKit Integration Map before rebuilding any
  sponsorship gateway or SDK behavior.
- Complete Slice 1.0 Agent Account And Wallet Manager Contract before live
  wallet signing behavior.
- Refresh official external APIs before coding any live IOTA, MCP, x402, AP2, or
  A2A integration.
- Keep pure policy and manifest logic testable without a live chain.
- Treat the policy gateway as a security boundary.
- Treat wallet creation as a security boundary: agents can create wallets, but
  normal APIs return signer references and addresses, not seeds, mnemonics,
  private keys, or raw keypairs.
- Do not let SDK or MCP value-bearing tools bypass the gateway.
- Use mock/localnet/testnet paths before any real transaction behavior.
- Add tests and verification evidence for each slice.
- Update docs only when implementation changes the execution contract.

Definition of done for the first implementation pass:

- Fresh checkout has install, typecheck, test, and docs commands.
- Workspace structure matches `docs/agentic-gaskit/migration-plan.md` and
  `docs/agentic-gaskit/module-specs.md`, or the deviation is documented with a
  reason.
- Phase 0 acceptance criteria pass.
- Slice 1.1 Manifest Schema and Slice 1.2 Pure Policy Evaluator are implemented
  with tests if Phase 0 completes cleanly.
- Slice 1.0 account/wallet tests prove no seed/private-key material is returned
  or logged before any live signing behavior is added.
- Negative policy cases include unknown agent, missing manifest, expired
  manifest, over-budget action, disallowed contract/action, unauthorized
  counterparty, missing simulation, and human-approval threshold.
- No secrets are committed.
- Final handoff lists commands run, evidence, risks, commit hashes, and next
  slice.
```
