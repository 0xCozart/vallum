# GasKit Best Practices

GasKit protects sponsor-wallet funds by keeping sponsorship decisions server-side, bounded, observable, and easy to review. Treat these practices as the default path for dApp integrations and operator deployments.

## Keep Secrets Server-side

- Keep GasKit app API keys on trusted backend routes.
- Never embed IOTA Gas Station bearer tokens in browser HTML, JavaScript, mobile bundles, or public config.
- Never commit sponsor private keys, wallet mnemonics, exported keypairs, bearer tokens, app API keys, or local `.env` files.
- Use separate secrets for local development, testnet proof, and production operation.
- Run `npm run secrets:scan` before publishing or tagging a release.

## Use Policy Simulation First

Call `simulatePolicy()` before creating a reservation when the user experience benefits from a preflight result. Simulation uses the same app authentication and policy engine as `reserveGas()`, but it does not contact IOTA Gas Station, create reservations, mutate quota counters, or emit reserve/execute decision events.

Treat simulation rejections as normal decision data. Treat auth failures, malformed request bodies, and malformed transport responses as errors.

## Fail Closed

Configured allowlists must fail closed:

- If a package allowlist exists and the request has no package metadata, reject it.
- If a function allowlist exists and the request has no function metadata, reject it.
- If app credentials are missing or invalid, reject before proxying upstream.
- If the transaction ID aliases conflict, reject before proxying upstream.
- If the upstream Gas Station is unavailable, return a bounded gateway error rather than exposing raw upstream details.

## Bound Sponsor Spend

Use multiple controls together:

- per-app request limits;
- per-app gas budgets;
- per-wallet request limits;
- per-transaction gas budget maximums;
- package allowlists;
- function allowlists;
- wallet denylists;
- short reservation durations where upstream configuration supports them.

No single control is enough. The sponsor wallet is a funded operational asset, so every sponsored path should be explainable and budgeted.

## Preserve User Signing Boundaries

GasKit sponsorship does not give the sponsor custody of user funds. The user still signs the transaction payload. Keep the app flow clear:

1. Build the intended transaction.
2. Preflight policy when useful.
3. Reserve sponsor gas through the backend.
4. Return only the safe fields needed for user signing.
5. Execute with the reservation ID, GasKit transaction ID, transaction bytes, and user signature.

Do not log raw transaction bytes or signatures unless an operator has explicitly chosen a secure debug path outside the default toolkit.

## Keep Browser Flows Thin

Browser-facing code should call your own same-origin backend route, not IOTA Gas Station directly. The backend route should own:

- GasKit API key access;
- package/function metadata selection;
- policy simulation;
- reserve and execute calls;
- safe response projection for the browser.

See `examples/nextjs-api-route` and `apps/demo-dapp` for the current local pattern.

## Sanitize Observability

Use decision events and usage snapshots for operational visibility, but keep them secret-free.

Events may include app ID, wallet address, package/function metadata, operation, outcome, reason code, HTTP status, latency, and GasKit transaction ID. Events must not include app API keys, upstream bearer tokens, raw request bodies, transaction bytes, signatures, raw upstream error bodies, or local secret file paths.

## Separate Local Proof From Production Readiness

`npm run verify:local` proves the deterministic local surface: tests, typecheck, local smokes, example readiness, package dry-runs, and tracked-file secret scanning. It does not prove production KMS signing, mainnet execution, production persistence, production monitoring, or complete dashboard coverage.

Use `npm run execute:testnet-demo` only when operator-owned testnet credentials,
a reachable IOTA Gas Station setup, local runtime preflight, a passing
sanitized upstream diagnostic report, and explicit operator intent are present.

## Before Shipping

Run the local verification path:

```bash
npm install
npm run verify:local
```

For reviewer compatibility, `npm run grant:check` remains an alias for `npm run verify:local`.

For live testnet proof, run:

```bash
npm run readiness:testnet
npm run gas-station:runtime-preflight
# Optional when GAS_STATION_URL points at an operator-managed Gas Station:
GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream npm run gas-station:runtime-preflight
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run execute:testnet-demo
```

Only run live commands with local operator-owned credentials. Do not add those credentials to docs, examples, screenshots, logs, or generated site output.
