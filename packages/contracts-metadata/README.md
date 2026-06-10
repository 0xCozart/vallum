# @iota-gaskit/contracts-metadata

Versioned contract template metadata registry for Agentic GasKit policy
allow-lists.

This package is local prerelease workspace code. It provides metadata and pure
evaluation helpers for approved contract templates such as `escrow_v1` and
`receipt_v1`; it does not deploy contracts or prove live package addresses.

## Local checks

```bash
npm run build -w @iota-gaskit/contracts-metadata
node --import tsx --test packages/contracts-metadata/src/*.test.ts
```
