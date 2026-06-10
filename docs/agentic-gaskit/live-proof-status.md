# Live Proof Status

Last updated: 2026-06-10.

## Purpose

Agentic GasKit separates local/mock proof from live or testnet proof. The live
proof status command gives operators and future agents a safe, non-networked
way to see which live proof paths are ready to run and which are still blocked.

Run:

```bash
npm run proof:live-status
```

The command does not contact IOTA Names, IOTA Identity, IOTA RPC, Gas Station,
payment facilitators, A2A endpoints, or npm. It inspects local configuration
shape and prints blocker codes, missing variable names, readiness check ids,
and next commands. It never prints configured secret values or endpoint values.

## Current Local Status

On the current machine, no `.env` file is present and the IOTA Names live smoke
environment variables are unset. The correct proof state is therefore blocked,
not failed live proof:

- `TESTNET_ENV_FILE_MISSING`
- `IOTA_NAMES_LIVE_CONFIG_MISSING`
- `IOTA_IDENTITY_LIVE_PROOF_UNIMPLEMENTED`
- `VC_TRUST_POLICY_UNDEFINED`

## What The Command Proves

- local testnet readiness configuration is present and structurally valid, or
  the exact readiness blocker ids are listed
- IOTA Names live smoke configuration is present and uses an HTTPS or loopback
  GraphQL endpoint, or the exact missing variables are listed
- live IOTA Identity proof remains blocked until a dedicated live resolver and
  credential-validation slice exists
- full VC validation remains blocked until trusted issuers, verification
  methods, revocation handling, cache TTL, and stale behavior are configured

## What It Does Not Prove

- live IOTA Names resolution
- live IOTA Identity DID resolution
- live VC signature or revocation validation
- IOTA testnet sponsorship or transaction execution
- live Gas Station availability
- live x402/AP2/A2A/provider interoperability
- package publication
- production marketplace, custody, payment, or provider-verification readiness

## Next Commands

Use these only when the required local configuration exists outside committed
files:

```bash
npm run readiness:testnet
npm run smoke:iota-names-live
```

`npm run execute:testnet-demo` contacts live IOTA services and can spend
sponsored testnet gas. Run it only with explicit operator intent and
operator-owned local credentials.
