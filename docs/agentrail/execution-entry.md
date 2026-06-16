# AgentRail Execution Entry

Last updated: 2026-06-10.

## Purpose

This is the entry document for starting actual AgentRail product
implementation.

The repo migration is complete enough to build here. The product is not
complete. The current codebase still implements the AgentRail sponsorship
foundation: policy gateway, SDK, local service, examples, docs, readiness, and
safe smoke paths. Agentic accounts, manifests, MCP/A2A tools, registry,
receipts, and contract workflows are next.

## Objective Contract

Goal:
Turn the migrated AgentRail fork into a working AgentRail MVP by adding the
first agent-specific primitives without weakening existing AgentRail sponsorship
safety.

Why:
Agents need IOTA execution rails, but the product fails if agents receive raw
seeds, bypass the policy gateway, or rebuild proven AgentRail sponsorship behavior
from scratch.

Desired first outcome:
Agents can create local/mock wallet accounts and receive wallet addresses plus
scoped signer references. No API returns seeds, mnemonics, private keys, raw
keypairs, raw transaction bytes, user signatures, sponsor keys, app API keys,
or bearer tokens.

Non-goals for the first implementation pass:

- production custody
- KMS/external signer integration
- default seed export
- live mainnet behavior
- marketplace
- package namespace migration
- MCP tools that bypass the gateway
- direct Gas Station execution helpers in normal product paths

## Start Sequence

1. Confirm clean state:

   ```bash
   git status --short --branch
   git log --oneline -n 5
   git remote -v
   ```

2. Read these files in order:

   - `CLAUDE.md`
   - `docs/CODEBASE_MAP.md`
   - `docs/agentrail/migration-plan.md`
   - `docs/agentrail/account-wallet-safety.md`
   - `docs/agentrail/execution-slices.md`
   - `docs/agentrail/verification-hardening.md`

3. Run baseline local proof before editing:

   ```bash
   npm run docs:check
   npm run secrets:scan
   npm test
   npm run typecheck
   ```

4. Start with Slice 1.0 from
   `docs/agentrail/execution-slices.md`.

## First Product Slice

Implement the account/wallet manager contract.

Recommended package:

- `packages/accounts`

Recommended package name for now:

- `@sacredlabs/agentrail-accounts`

The public package namespace is now `@sacredlabs/agentrail-*`. Keep any future
move to `@agentrail/*` as a dedicated compatibility and release-planning
decision after npm support approves the org scope.

Minimum public types:

- `SignerRef`
- `WalletAccount`
- `WalletAccountStatus`
- `WalletAccountStore`
- `WalletCreationContext`
- `SignerAdapter`
- `RecoveryPolicy`

Minimum behavior:

- create an in-memory agent wallet for tests and demos
- return address, wallet id, signer reference, status, and allowed scopes
- require owner/agent context for wallet creation
- treat signer references as scoped opaque handles, not bearer credentials
- fail closed for recovery/export
- redact signer refs and secret-looking fixture values from logs/errors

Minimum tests:

- wallet creation returns references, not secret material
- no seed, mnemonic, private key, or raw keypair appears in returned values
- signer-ref-only requests do not authorize signing
- revoked/disabled wallet status cannot sign
- recovery/export returns an explicit unsupported/denied result
- redaction tests cover signer refs and secret-looking fixture values

## Second Product Slice

After Slice 1.0 passes, implement Slice 1.1 Manifest Schema.

Recommended package:

- `packages/manifest`

The manifest should be versioned and fail closed for missing required fields,
expired intents, unsupported schema versions, malformed spend/scope, and
missing idempotency keys.

## Third Product Slice

After Slice 1.1 passes, extend policy evaluation for agent-aware sponsored
actions.

Do not bypass existing AgentRail policy behavior. Add agent checks around the
current foundation:

- known agent/owner
- wallet/signer reference status
- allowed contract/action
- budget and expiry
- counterparty
- simulation requirement where configured
- human approval threshold where configured

## Safety Gates

- Do not run `npm run execute:testnet-demo` without explicit operator intent.
- Do not commit `.env` files or live credentials.
- Do not add direct Gas Station execution as an SDK/MCP happy path.
- Do not add raw seed export except through a separate explicit recovery design.
- Do not claim production custody or mainnet readiness.
- Do not start marketplace/discovery until account, manifest, policy, receipt,
  and identity primitives are proven.

## Verification For Each Slice

Use the smallest focused proof first, then broaden:

```bash
npm test -- packages/accounts/src/*.test.ts
npm run typecheck
npm run docs:check
npm run secrets:scan
git diff --check
```

Before merging a meaningful product slice:

```bash
npm run verify:local
```

## Handoff Requirements

Every implementation slice should end with:

- changed files
- commands run
- test results
- known unproven claims
- security/custody risks
- next slice recommendation
- commit hash

Record local continuation notes under ignored handoff or execution-manifest
paths, such as `docs/agentrail/local-handoffs/` or
`tmp/apex-workflow/`, rather than adding private Codex planning state to the
public documentation site.
