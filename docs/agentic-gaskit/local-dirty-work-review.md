# Local Dirty Work Review

Last reviewed: 2026-06-10.

## Source Worktree

Reviewed dirty files from `/home/sacred/code/iota-gaskit` after the Agentic
GasKit fork was created.

The source worktree was not modified or cleaned.

## Files Reviewed

Tracked package changes:

- `package.json`
- `package-lock.json`
- `apps/policy-gateway-service/package.json`

Untracked local experiment scripts:

- `tmp/direct-gas-execute.mjs`
- `tmp/inspect-iota.mjs`
- `tmp/try-real-sponsored.mjs`

## Migration Decision

### Migrated

Dependency pins were migrated into `/home/sacred/code/agentic-gaskit`:

- `@iota/iota-sdk` pinned to `1.13.0`
- `@types/node` pinned to `20.17.0`
- `tsx` pinned to `4.20.0`
- `typescript` updated and pinned to `5.9.3`

Why:
The source diff intentionally replaced loose dev dependency ranges with exact
versions and moved TypeScript forward. That belongs in the fork because the
Agentic buildout should have reproducible local tooling before adding security
sensitive wallet and gateway extensions.

### Not Migrated As Code

The `tmp/*.mjs` scripts were not copied as runnable product scripts.

Why:

- `tmp/direct-gas-execute.mjs` calls IOTA Gas Station directly and bypasses the
  GasKit policy gateway.
- `tmp/try-real-sponsored.mjs` reads `GAS_STATION_KEYPAIR` and performs a live
  sponsored execution path.
- `tmp/inspect-iota.mjs` is a useful inspection helper, but it is hardcoded to
  one package and belongs in a reviewed diagnostic script, not an untracked tmp
  file.

No literal secret values were migrated. The scripts reference environment
variable names, not committed credentials, but committing them as-is would make
the live/direct execution path too easy for future agents to run by accident.

## Follow-Up Slice

If these experiments are still useful, convert them into a reviewed diagnostic
slice:

- add an operator-only script under `scripts/diagnostics/`
- require `--yes-live` or equivalent explicit intent for any live network call
- route sponsored execution through the GasKit gateway by default
- keep direct Gas Station calls behind a clearly named upstream-diagnosis mode
- redact key material, transaction bytes, signatures, raw upstream bodies, and
  local file paths
- add tests proving missing env fails closed and output remains sanitized
- document the command in `docs/testnet-readiness.md` or a dedicated
  diagnostic doc

Do not add live/direct execution helpers to MCP tools, SDK examples, dashboard
actions, or normal quickstarts.
