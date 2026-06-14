# Agentic GasKit Project Rules

This fork is the Agentic GasKit implementation path created from IOTA GasKit.
It keeps the existing GasKit sponsorship toolkit as the foundation and extends
it with agent-specific accounts, signer references, manifests, identity,
contracts, receipts, MCP/A2A surfaces, and standards bridges.

## Source Of Truth

Start here:

- `docs/agentic-gaskit/migration-plan.md` - repo migration, branding, package,
  remote, and safety gates.
- `docs/overview.md` - product overview and current implemented status.
- `docs/architecture.md` - system boundaries and planned agent flow.
- `docs/agentic-gaskit/account-wallet-safety.md` - wallet/signer-reference
  safety model.
- `docs/agentic-gaskit/execution-slices.md` - implementation queue.
- `docs/agentic-gaskit/verification-hardening.md` - verification and risk
  gates.

The original GasKit sponsorship behavior remains product-critical. Do not
replace gateway, SDK, app credential, quota, sponsor-wallet, testnet readiness,
or secret hygiene behavior without a written migration reason and focused
verification.

## Product Framing

Agentic GasKit is IOTA-native infrastructure for agent-safe sponsored execution:
Gas Station sponsorship, policy controls, agent-created wallets, signer
references, transaction manifests, receipts, contract workflows, and
standards-compatible integrations.

Do not frame the product as:

- a replacement for the official IOTA Gas Station
- a wallet or custody service
- a default seed-export product
- a tokenomics project
- a marketplace-first product
- a replacement for MCP, A2A, AP2, or x402

## Execution Rules

- Build in vertical slices.
- Check `git status --short --branch` before editing.
- Preserve unrelated dirty work.
- Keep existing GasKit checks passing unless the slice intentionally changes
  their contract.
- Run focused docs/build/test checks for every slice.
- Treat the policy gateway as a security boundary.
- Treat agent wallet creation as a security boundary.
- Do not expose raw seeds, mnemonics, private keys, raw keypairs, raw
  transaction bytes, user signatures, sponsor keys, app API keys, bearer tokens,
  payment credentials, or private prompt text.
- Signer references are opaque scoped handles, not bearer credentials.
- Live testnet commands must only run after explicit operator intent and local
  credentials are configured outside the repo.

## Apex Note

`AGENTS.md` references Apex. The source repo did not include
`apex.workflow.json` when this fork was created, but this fork now has a
reviewed Agentic GasKit profile with no external tracker, focused-search code
review, no browser adapter, ignored local manifests, and repo-local verification
presets. Do not claim Apex verification unless the profile validates and the
current slice has manifest/detect evidence.
