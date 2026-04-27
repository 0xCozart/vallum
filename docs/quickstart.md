# 30-Minute Quickstart

Status: Milestone 1 in progress. The current repo now includes runnable local policy gateway and demo dApp smoke paths. The full sponsored testnet transaction demo still requires a local or testnet IOTA Gas Station upstream.

Goal: a developer can clone the repo, start a local GasKit stack, open the demo dApp, and execute one sponsored testnet transaction within 30 minutes.

## Current scaffold checks

```bash
npm install
npm test
npm run typecheck
npm run smoke:local
npm run smoke:demo-dapp
npm run smoke:demo-browser
npm run readiness:testnet:example
```

## Local policy gateway smoke path

This smoke path verifies the GasKit gateway API shape, app-key auth, package/function allowlist rejection, SDK-compatible reserve responses, and execute proxy behavior. It can run against a local/mock upstream before a real IOTA Gas Station is configured.

### 1. Configure local environment

Copy the example file and keep secrets local:

```bash
cp .env.example .env
```

The policy gateway reads these variables from the process environment. Node does not automatically load `.env` in this package, so source the file before starting the service or pass variables inline:

```bash
GASKIT_GATEWAY_PORT=8787
GASKIT_GATEWAY_HOST=127.0.0.1
GASKIT_POLICY_PATH=examples/policies/demo-dapp.yaml
GASKIT_DEMO_APP_KEY=local-dev-demo-key
GAS_STATION_URL=http://127.0.0.1:9527
GAS_STATION_BEARER_TOKEN=replace-with-local-gas-station-token
```

`GASKIT_DEMO_APP_KEY` is a local development app key only. Do not commit real API keys, sponsor keys, bearer tokens, or `.env` files.

### 2. Start the gateway

```bash
npm run build -w @iota-gaskit/policy-gateway-service
set -a
. ./.env
set +a
npm run start -w @iota-gaskit/policy-gateway-service
```

Equivalent inline start command:

```bash
GASKIT_DEMO_APP_KEY=local-dev-demo-key \
GASKIT_GATEWAY_HOST=127.0.0.1 \
GASKIT_POLICY_PATH=examples/policies/demo-dapp.yaml \
GAS_STATION_URL=http://127.0.0.1:9527 \
GAS_STATION_BEARER_TOKEN=replace-with-local-token \
npm run start -w @iota-gaskit/policy-gateway-service
```

### 3. Check local health

```bash
curl http://127.0.0.1:8787/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "iota-gaskit-policy-gateway",
  "upstream": {
    "configured": true
  }
}
```

### 4. Verify fail-closed auth

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"package_id":"0xYOUR_DEMO_PACKAGE_ID","function_name":"mint_badge"}'
```

Expected result: HTTP 401 with reason code `AUTH_MISSING`.

### 5. Verify package/function policy

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H 'authorization: Bearer local-dev-demo-key' \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"package_id":"0xNOT_ALLOWED","function_name":"mint_badge"}'
```

Expected result: HTTP 400 with reason code `PACKAGE_NOT_ALLOWED`.

### 6. Simulate policy locally before reserve

Use the simulation endpoint to preflight policy decisions without touching IOTA Gas Station, creating reservations, mutating quota counters, or emitting reserve/execute events:

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/policy/simulate \
  -H 'authorization: Bearer local-...key' \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"wallet_address":"0xWALLET","package_id":"0xYOUR_DEMO_PACKAGE_ID","function_name":"mint_badge"}'
```

Expected allowed result: HTTP 200 with `{ "allowed": true }`. Policy rejections also return HTTP 200 as decision data, for example `{"allowed":false,"reasonCode":"PACKAGE_NOT_ALLOWED",...}`. Missing or invalid app credentials still return auth failures.

### 7. Run the one-command local smoke

The smoke command starts an in-process mock Gas Station upstream plus the policy gateway on loopback-only dynamic ports. It exercises the public SDK path without Docker, testnet funds, sponsor keys, or real network calls:

```bash
npm run smoke:local
```

Expected output ends with:

```text
IOTA GasKit local gateway smoke passed
```

The smoke covers health, missing auth, invalid auth, local policy simulation, package/function allowlist rejection, allowed reserve proxying, and execute proxying.

### 8. Run the demo dApp against the local gateway path

The demo dApp has a local-only CLI flow and a minimal browser-wrapper flow that use the public SDK against the policy gateway. The root smoke commands start a mock upstream plus gateway, then run the demo flow end to end:

```bash
npm run smoke:demo-dapp
npm run smoke:demo-browser
```

Expected output ends with one of:

```text
IOTA GasKit demo dApp local flow passed
IOTA GasKit demo dApp browser smoke passed
```

If you already have a local gateway running, you can point the CLI demo dApp at it:

```bash
GASKIT_GATEWAY_URL=http://127.0.0.1:8787 \
GASKIT_DEMO_APP_KEY=local-dev-demo-key \
npm run dev -w @iota-gaskit/demo-dapp
```

Or start the browser wrapper locally:

```bash
GASKIT_GATEWAY_URL=http://127.0.0.1:8787 \
GASKIT_DEMO_APP_KEY=local-dev-demo-key \
npm run browser -w @iota-gaskit/demo-dapp
```

Then open `http://127.0.0.1:8788`. The browser wrapper binds to loopback hosts only and calls a same-origin local backend endpoint so the app key stays server-side; it is not embedded into browser HTML or JavaScript.

The demo dApp smoke paths use placeholder transaction bytes/signatures and do not require Docker, sponsor keys, testnet funds, or real network calls.

### 9. Run the local testnet-readiness preflight

Before replacing the local/mock upstream with real testnet sponsor credentials, run the local-only readiness checks:

```bash
npm run readiness:testnet:example
```

That command verifies `.env.example` still documents placeholders and required keys without using any real secrets.

After copying `.env.example` to `.env` and replacing values locally, run:

```bash
npm run readiness:testnet
```

The preflight does not contact IOTA RPC, a Gas Station upstream, Docker, Redis, or any hosted service. It only validates local config shape, fails closed on placeholders/local demo defaults, loads the policy config, checks a non-empty package allowlist, and keeps secret values out of output. See `docs/testnet-readiness.md`.

### 10. Proxy an allowed reserve request manually

If you are running a local IOTA Gas Station upstream at `GAS_STATION_URL`, call:

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H 'authorization: Bearer local-dev-demo-key' \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"wallet_address":"0xWALLET","package_id":"0xYOUR_DEMO_PACKAGE_ID","function_name":"mint_badge"}'
```

Expected result: the request is proxied to `GAS_STATION_URL/v1/reserve_gas`; the response includes the upstream `result.reservation_id` plus a gateway-local `_saas_tx_id` / `gasKitTransactionId` used later by `/v1/execute_tx`.

If no upstream Gas Station is running, the gateway returns `GAS_STATION_UNAVAILABLE`. The current gateway keeps reservations in memory for local smoke use only; restart the service to clear local reservation state.

## Milestone 1 target flow

1. Copy `.env.example` to `.env`.
2. Add testnet sponsor wallet values locally.
3. Start Redis, Gas Station, policy gateway, and dashboard.
4. Open dashboard health page.
5. Open demo dApp.
6. Execute sponsored testnet transaction.
7. See usage event in dashboard.

Secrets must remain local and must never be committed.
