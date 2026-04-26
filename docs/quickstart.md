# 30-Minute Quickstart

Status: Milestone 1 in progress. The current repo now includes a runnable local policy gateway smoke path. The full sponsored testnet transaction demo still requires a local or testnet IOTA Gas Station upstream.

Goal: a developer can clone the repo, start a local GasKit stack, open the demo dApp, and execute one sponsored testnet transaction within 30 minutes.

## Current scaffold checks

```bash
npm install
npm test
npm run typecheck
```

## Local policy gateway smoke path

This smoke path verifies the GasKit gateway API shape, app-key auth, policy allowlist rejection, SDK-compatible reserve responses, and execute proxy behavior. It can run against a local/mock upstream before a real IOTA Gas Station is configured.

### 1. Configure local environment

Copy the example file and keep secrets local:

```bash
cp .env.example .env
```

The policy gateway reads these variables:

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
GASKIT_DEMO_APP_KEY=local-dev-demo-key \
GASKIT_GATEWAY_HOST=127.0.0.1 \
GASKIT_POLICY_PATH=examples/policies/demo-dapp.yaml \
GAS_STATION_URL=http://127.0.0.1:9527 \
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

### 6. Proxy an allowed reserve request

Start a local IOTA Gas Station upstream at `GAS_STATION_URL`, then call:

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H 'authorization: Bearer local-dev-demo-key' \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"wallet_address":"0xWALLET","package_id":"0xYOUR_DEMO_PACKAGE_ID","function_name":"mint_badge"}'
```

Expected result: the request is proxied to `GAS_STATION_URL/v1/reserve_gas`; the response includes the upstream `result.reservation_id` plus a gateway-local `_saas_tx_id` / `gasKitTransactionId` used later by `/v1/execute_tx`.

If no upstream Gas Station is running, the gateway returns `GAS_STATION_UNAVAILABLE`.

## Milestone 1 target flow

1. Copy `.env.example` to `.env`.
2. Add testnet sponsor wallet values locally.
3. Start Redis, Gas Station, policy gateway, and dashboard.
4. Open dashboard health page.
5. Open demo dApp.
6. Execute sponsored testnet transaction.
7. See usage event in dashboard.

Secrets must remain local and must never be committed.
