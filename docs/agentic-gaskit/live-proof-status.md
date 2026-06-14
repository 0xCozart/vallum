# Live Proof Status

Last updated: 2026-06-11.

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

For a redacted command-order artifact before live work, run:

```bash
npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json
```

The proof plan is also non-networked. It records command names, blocker codes,
missing input names, required evidence artifacts, and safety boundaries without
printing configured endpoint values, names, addresses, profile paths,
credentials, tokens, transaction bytes, credential payloads, response bodies,
or local secret paths.

## Current Local Status

On the current machine, `.env` is present outside Git and `npm run
readiness:testnet` passes non-networked readiness. `npm run proof:live-status`
now reports:

- `TESTNET_READINESS_CONFIG_PRESENT`
- `GAS_STATION_DOCKER_DAEMON_UNAVAILABLE`
- `TESTNET_UPSTREAM_REPORT_FAILED`
- `IOTA_NAMES_LIVE_CONFIG_MISSING`
- `IOTA_IDENTITY_LIVE_CONFIG_MISSING`
- `VC_TRUST_POLICY_CONFIG_MISSING`

`npm run gas-station:runtime-preflight` confirms the ignored local Gas Station
config exists and Docker client command is available on this machine, but the
Docker daemon is not currently reachable from this workspace. The preflight now
requires a real non-empty Docker server version from `docker info`, so Docker
Desktop/WSL false-ready states are classified as
`GAS_STATION_DOCKER_DAEMON_UNAVAILABLE`. When the daemon is reachable, Docker
Compose is not required because the preflight can fall back to the direct
Docker dry-run path exposed by `npm run gas-station:docker-direct -- --dry-run`.
This is a local runtime prerequisite only; it does not start containers,
contact IOTA RPC, call Gas Station HTTP endpoints, or reserve gas.

Operators who intentionally use a separately managed Gas Station can set
`GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream` outside committed files.
In that mode `npm run gas-station:runtime-preflight` does not inspect Docker
and does not contact the managed endpoint; it only verifies that managed mode
and `GAS_STATION_URL` are configured without printing the URL. The
`testnet-upstream` gate still requires a current passing
`npm run diagnose:gas-station -- --report <ignored-json-path>` report before a
fresh sponsored execute is ready.

The configured IOTA testnet RPC endpoint also responded to
`npm run diagnose:gas-station -- --skip-reserve --report
tmp/gaskit/testnet-upstream-diagnostic.json` with HTTP 200 and a latest
checkpoint response. The same diagnostic could not reach the configured local
Gas Station root or `/v1/health` endpoint at loopback, wrote a sanitized
ignored report, and `npm run proof:live-status` now classifies that evidence as
`TESTNET_UPSTREAM_REPORT_FAILED`. This means the next testnet execution
boundary is local Gas Station availability, reserve compatibility, and sponsor
funding, not `.env` shape.

## What The Command Proves

- local testnet readiness configuration is present and structurally valid, or
  the exact readiness blocker ids are listed
- local Gas Station runtime prerequisites are present through local Docker or
  explicit managed-upstream mode, or the exact runtime/config blocker is listed
- sanitized testnet upstream diagnostic report status is present and proves
  IOTA RPC, Gas Station reachability, and reserve_gas compatibility, or the
  exact upstream report blocker is listed
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
npm run gas-station:render-config
npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
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
operator-owned local credentials. The command fails closed before reserve or
execute unless local testnet readiness, local Gas Station runtime preflight,
and a current passing `GASKIT_TESTNET_UPSTREAM_REPORT` are all present.
