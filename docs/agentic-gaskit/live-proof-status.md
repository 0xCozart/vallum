# Live Proof Status

Last updated: 2026-06-14.

## Purpose

Agentic GasKit separates local/mock proof from live or testnet proof. The live
proof status command gives operators and future agents a safe, non-networked
way to see which live proof paths are ready to run and which are still blocked.

Run:

```bash
npm run proof:live-status
npm run proof:live-status -- --json
npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json
```

The command does not contact IOTA Names, IOTA Identity, IOTA RPC, Gas Station,
payment facilitators, A2A endpoints, or npm. It inspects local configuration
shape and prints blocker codes, missing variable names, readiness check ids,
redacted evidence labels, and next commands. It never prints configured secret
values, endpoint values, local report paths, full addresses, profile paths, or
raw upstream bodies.
The `--json` and `--out` forms produce the same redacted machine-readable
status artifact with check ids, blocker codes, messages, redacted evidence
labels, next steps, and proof boundaries. The output artifact is local evidence
only, is written with mode 0600, and must stay ignored.

For a redacted command-order artifact before live work, run:

```bash
npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json
```

The proof plan is also non-networked. It records command names, blocker codes,
missing input names, optional triage input names, required evidence artifacts,
redacted evidence labels, and safety boundaries without printing configured
endpoint values, names, addresses, profile paths, credentials, tokens,
transaction bytes, credential payloads, response bodies, or local secret paths.
It includes the sponsor funding request, faucet request, and read-only funding
diagnostic in the command order, but still treats faucet reports as optional
triage context only; a passing sponsor funding report is required before the
funding gate can clear.

## Current Local Status

On the current machine, `.env` is present outside Git and `npm run
readiness:testnet` passes non-networked readiness. Docker Desktop is reachable
from WSL, `gaskit-gas-station` and `gaskit-redis` are running, and `npm run
proof:live-status` with the current ignored funding/upstream reports now
reports:

- `TESTNET_READINESS_CONFIG_PRESENT`
- `GAS_STATION_RUNTIME_READY`
- `SPONSOR_FUNDING_TOTAL_INSUFFICIENT`
- `TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED`
- `IOTA_NAMES_LIVE_CONFIG_MISSING`
- `IOTA_IDENTITY_LIVE_CONFIG_MISSING`
- `VC_TRUST_POLICY_CONFIG_MISSING`

`npm run gas-station:runtime-preflight` confirms the ignored local Gas Station
config exists, the Docker daemon is reachable, Docker Compose is available,
and the direct Docker fallback is also available. `npm run
gas-station:docker-direct -- --status` reports `DOCKER_DIRECT_STACK_READY` for
the expected local network, Redis container, and Gas Station container. This is
a local runtime prerequisite only; it does not prove reserve_gas compatibility
or sponsored execution.

Operators who intentionally use a separately managed Gas Station can set
`GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream` outside committed files.
In that mode `npm run gas-station:runtime-preflight` does not inspect Docker
and does not contact the managed endpoint; it only verifies that managed mode
and `GAS_STATION_URL` are configured without printing the URL. The
`sponsor-funding` gate still requires a current passing
`npm run sponsor:check-funding -- --report <ignored-json-path>` report before
reserve compatibility can be considered ready. The `testnet-upstream` gate
still requires a current passing
`npm run diagnose:gas-station -- --report <ignored-json-path>` report before a
fresh sponsored execute is ready.
`GASKIT_SPONSOR_FAUCET_REPORT` is optional operator-triage context only. When
it points at a sanitized report from `npm run sponsor:request-faucet-funds`, or
when the default ignored `tmp/gaskit/sponsor-faucet-request.json` report exists
and validates, the funding gate can explain the latest faucet failure, rate
limit, blocked request, or completed request in its next step. It never clears
`sponsor-funding`; only a passing sponsor funding report can do that.
Faucet HTTP failures are bounded before they reach live-proof output. For
example, an HTTP 405 from the documented `/gas` route is classified as
`REQUEST_UNSUPPORTED`, telling the operator to switch funding routes instead
of repeating that API version.

The current sanitized upstream diagnostic reaches the local Gas Station root
and IOTA testnet RPC. It classifies raw upstream reachability as
`GAS_STATION_ROOT_READY`; `/v1/health` is treated as an informational wrapper
health probe because the raw upstream container may not expose it. The latest
report was generated with `--skip-reserve`, so `npm run proof:live-status`
classifies that evidence as `TESTNET_UPSTREAM_REPORT_RESERVE_SKIPPED` and
keeps the upstream gate blocked. This means the next testnet execution
boundary is sponsor funding, then a fresh diagnostic without `--skip-reserve`
to prove reserve_gas compatibility, not Docker connectivity, optional wrapper
health, or `.env` shape.

Blocked or ready live-proof checks include fixed evidence labels such as
`sponsor-funding-report-loaded-redacted`,
`testnet-upstream-report-loaded-redacted`, and
`iota-identity-live-report-valid-redacted`. These labels are intentionally not
paths or endpoint values; they only tell the operator which ignored structured
report class was loaded, missing, invalid, or accepted.

## What The Command Proves

- local testnet readiness configuration is present and structurally valid, or
  the exact readiness blocker ids are listed
- local Gas Station runtime prerequisites are present through local Docker or
  explicit managed-upstream mode, or the exact runtime/config blocker is listed
- sanitized sponsor funding report status is present and proves enough sampled
  IOTA balance for the requested reserve budget, or the exact funding report
  blocker is listed
- sanitized testnet upstream diagnostic report status is present and proves
  IOTA RPC, Gas Station reachability, and reserve_gas compatibility, or the
  exact upstream report blocker plus bounded Gas Station reachability and
  reserve failure codes are listed
- IOTA Names live smoke configuration and a current sanitized report are
  present, or the exact missing variables/report blocker is listed
- IOTA Identity live smoke configuration and a current sanitized report are
  present, or the exact missing variables/report blocker is listed
- local VC trust-policy evaluation exists for trusted issuers, verification
  methods, credential types, supported revocation status mechanisms, credential
  expiry, max credential age, and cache-policy binding
- live VC validation remains blocked until the trust-policy variables are
  configured and the current IOTA Identity live smoke report proves credential
  evidence against that policy

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
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
npm run gas-station:docker-direct -- --status
npm run sponsor:write-funding-request -- --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:write-funding-request -- --faucet-report tmp/gaskit/sponsor-faucet-request.json --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:request-faucet-funds -- --execute --out tmp/gaskit/sponsor-faucet-request.json
npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json
npm run proof:live-status
GASKIT_SPONSOR_FAUCET_REPORT=tmp/gaskit/sponsor-faucet-request.json npm run proof:live-status
GASKIT_SPONSOR_FUNDING_REPORT=tmp/gaskit/sponsor-funding-report.json npm run proof:live-status
npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
GASKIT_SPONSOR_FUNDING_REPORT=tmp/gaskit/sponsor-funding-report.json GASKIT_TESTNET_UPSTREAM_REPORT=tmp/gaskit/testnet-upstream-diagnostic.json npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json
npm run smoke:iota-names-live -- --report tmp/gaskit/iota-names-live-report.json
npm run smoke:iota-identity-live -- --report tmp/gaskit/iota-identity-live-report.json
```

The `--skip-reserve` diagnostic is reachability triage only. It cannot clear
`testnet-upstream`; a fresh diagnostic without `--skip-reserve` is still
required after sponsor funding is ready.

Live IOTA Identity proof readiness uses these non-secret variable names:

```bash
IOTA_IDENTITY_PROOF_ENDPOINT=https://...
IOTA_IDENTITY_PROFILE_PATH=profiles/agent-profile.json
IOTA_IDENTITY_LIVE_REPORT=tmp/gaskit/iota-identity-live-report.json
```

Live VC trust-policy readiness uses these non-secret variable names:

```bash
IOTA_IDENTITY_TRUSTED_ISSUER_DIDS=did:iota:...
IOTA_IDENTITY_ALLOWED_VERIFICATION_METHODS=#key-1
IOTA_IDENTITY_REQUIRED_CREDENTIAL_TYPES=VerifiableCredential,AgentCapabilityCredential
IOTA_IDENTITY_ACCEPTED_STATUS_TYPES=RevocationBitmap2022,StatusList2021Entry
IOTA_IDENTITY_CACHE_TTL_MS=60000
```

Those values are configuration readiness only. `npm run smoke:iota-identity-live
-- --report <ignored-json-path>` contacts the configured proof endpoint and
writes a sanitized ignored report proving that the endpoint can resolve the
profile DIDs and return credential evidence accepted by the local trust policy.
The `vc-validation-live` gate now requires that current report, the report's
trust-policy flag, and at least one checked credential reference before it can
move to ready. The report omits endpoint values, profile paths, DIDs,
credential references, raw proof responses, and private local paths. It still
does not prove that the endpoint is backed by production key management, public
provider verification, production policy acceptance, or mainnet operation.

`npm run execute:testnet-demo` contacts live IOTA services and can spend
sponsored testnet gas. Run it only with explicit operator intent and
operator-owned local credentials. The command fails closed before reserve or
execute unless local testnet readiness, local Gas Station runtime preflight,
and current passing `GASKIT_TESTNET_UPSTREAM_REPORT` plus
`IOTA_NAMES_LIVE_REPORT` and `IOTA_IDENTITY_LIVE_REPORT` artifacts are present.
