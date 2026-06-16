# @sacredlabs/agentrail-contracts-metadata

Versioned contract template metadata registry for AgentRail policy
allow-lists.

This package is local prerelease workspace code. It provides metadata and pure
evaluation helpers for approved contract templates such as `escrow_v1`,
`receipt_v1`, `pay_per_call_v1`, `data_license_v1`, `service_bounty_v1`,
`reputation_receipt_v1`, and `subscription_v1`; it does not deploy contracts,
verify providers, settle payments, operate reputation scoring, operate
recurring billing, or prove live package addresses.

## Local checks

```bash
npm run build -w @sacredlabs/agentrail-contracts-metadata
node --import tsx --test packages/contracts-metadata/src/*.test.ts
```
