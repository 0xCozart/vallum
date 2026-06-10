# Phase PRDs

Read these PRDs in order. Each phase depends on the earlier gates unless the PRD
explicitly says otherwise.

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | `phase-0-foundation.md` | Repo scaffold, harnesses, scripts, env templates, and external API refresh. |
| 1 | `phase-1-sponsored-policy-mvp.md` | Sponsored action MVP with manifest, policy gateway, SDK, MCP, escrow, receipts, and logs. |
| 2 | `phase-2-identity-registry.md` | Agent profile, IOTA Names, IOTA Identity, capabilities, revocation, and resolver. |
| 3 | `phase-3-contract-block-library.md` | Reusable Move templates, metadata, deployment tooling, and SDK wrappers. |
| 4 | `phase-4-standards-bridges.md` | x402, AP2, and A2A compatibility without bypassing policy controls. |
| 5 | `phase-5-marketplace.md` | Marketplace only after primitives, receipts, reputation, and standards bridges work. |

## Phase Activation Rule

Before starting a phase:

1. Confirm the previous phase gate in `docs/agentic-gaskit/verification-hardening.md`.
2. Refresh external API notes for touched integrations.
3. Pick one vertical packet from `docs/agentic-gaskit/execution-slices.md`.
4. Define the verification evidence before editing code.
5. Escalate if the packet needs mainnet funds, custody, real payment
   credentials, external issue trackers, legal/KYC decisions, or physical-device
   safety decisions.
