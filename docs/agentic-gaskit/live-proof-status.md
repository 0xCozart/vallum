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

On the current machine, no `.env` file is present and the IOTA Names live smoke,
IOTA Identity live smoke, and live VC trust-policy variables are unset. The
correct proof state is therefore blocked, not failed live proof:

- `TESTNET_ENV_FILE_MISSING`
- `IOTA_NAMES_LIVE_CONFIG_MISSING`
- `IOTA_IDENTITY_LIVE_CONFIG_MISSING`
- `VC_TRUST_POLICY_CONFIG_MISSING`

## What The Command Proves

- local testnet readiness configuration is present and structurally valid, or
  the exact readiness blocker ids are listed
- IOTA Names live smoke configuration is present and uses an HTTPS or loopback
  GraphQL endpoint, or the exact missing variables are listed
- IOTA Identity live smoke configuration is present and uses an HTTPS or
  loopback proof endpoint, or the exact missing variables are listed
- local VC trust-policy evaluation exists for trusted issuers, verification
  methods, credential types, supported revocation status mechanisms, credential
  expiry, max credential age, and cache-policy binding
- live VC validation remains blocked until the trust-policy variables are
  configured and a dedicated live credential-validation command exists

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
npm run smoke:iota-identity-live
```

Live IOTA Identity proof readiness uses these non-secret variable names:

```bash
IOTA_IDENTITY_PROOF_ENDPOINT=https://...
IOTA_IDENTITY_PROFILE_PATH=profiles/agent-profile.json
```

Live VC trust-policy readiness uses these non-secret variable names:

```bash
IOTA_IDENTITY_TRUSTED_ISSUER_DIDS=did:iota:...
IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS=#key-1
IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES=VerifiableCredential,AgentCapabilityCredential
IOTA_IDENTITY_ACCEPTED_STATUS_TYPES=RevocationBitmap2022,StatusList2021Entry
IOTA_IDENTITY_CACHE_TTL_MS=60000
```

Those values are configuration readiness only. `npm run smoke:iota-identity-live`
contacts the configured proof endpoint and proves that the endpoint can resolve
the profile DIDs and return credential evidence accepted by the local trust
policy. It still does not prove that the endpoint is backed by production key
management, public provider verification, production policy acceptance, or
mainnet operation.

`npm run execute:testnet-demo` contacts live IOTA services and can spend
sponsored testnet gas. Run it only with explicit operator intent and
operator-owned local credentials.
