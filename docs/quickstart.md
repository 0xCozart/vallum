# 30-Minute Quickstart

This quickstart starts with the published npm package path and deterministic
local proof paths that do not need Docker, sponsor keys, testnet funds, live
IOTA RPC, or a running IOTA Gas Station. Use those checks first, then move to
the live testnet path only after local configuration is ready.

Goal: a developer can install AgentRail from npm, verify the canonical local
agent-safe sponsored execution path, understand the secret boundary, and know
exactly what is still required for a live sponsored testnet transaction.

## Install from npm

The current prerelease packages are published under
`@sacredlabs/agentrail-*`. Install the SDK for backend integration:

```bash
mkdir agentrail-consumer
cd agentrail-consumer
npm init -y
npm install @sacredlabs/agentrail-sdk@next
```

Run a minimal package import check:

```bash
node --input-type=module -e 'import("@sacredlabs/agentrail-sdk").then(({ createAgentRailClient }) => { const client = createAgentRailClient({ baseUrl: "http://127.0.0.1:8787", apiKey: "local-demo-key" }); if (typeof client.simulatePolicy !== "function" || typeof client.reserveGas !== "function" || typeof client.executeSponsoredTransaction !== "function") throw new Error("AgentRail SDK shape mismatch"); console.log("agentrail npm install ok"); })'
```

Expected result:

```text
agentrail npm install ok
```

The SDK belongs in backend code. Do not put AgentRail app keys, Gas Station
bearer tokens, sponsor keys, raw transaction bytes, or user signatures in
browser JavaScript.

The package set was published with `tag=next`. npm also currently exposes
`latest=0.0.0-prerelease` for this first package set after rejecting a
`latest` dist-tag deletion. Use `@next` or the exact `@0.0.0-prerelease`
version in docs, scripts, and demos until the first stable release exists.

## Canonical agent-safe sponsored execution path

Start here when evaluating AgentRail as a developer integration:

```bash
npm install
npm run smoke:paid-mcp-tool
```

Expected result: the command prints a structured local proof packet for a paid
MCP-style tool call. It proves the SDK-to-mock-policy-gateway route, manifest
action intent, signer-reference redaction, approval, policy denial,
failed-payment withholding, receipt event chains, and secret redaction markers.

To prove the same adoption wedge from package APIs, use one of these consumer
proofs:

- `npm run smoke:package-paid-mcp-consumer` for local tarballs from the
  current checkout.
- `npm run smoke:npm-registry-paid-mcp-consumer` for a fresh temporary
  consumer that installs the published npm packages from the registry and
  writes `tmp/agentrail/npm-registry-consumer-proof.json`.

Run the opt-in local tarball consumer smoke from the repo root:

```bash
npm run smoke:package-paid-mcp-consumer
```

Expected result: the command builds the workspace, packs every public workspace
package into local tarballs, installs those tarballs into a fresh temporary
consumer project, imports only public package root entrypoints, and runs the
paid MCP-style flow without live IOTA RPC, IOTA Gas Station, payment providers,
custody providers, marketplace services, npm registry publication, or public
A2A hosting.

`npm run smoke:package-paid-mcp-consumer` is intentionally not part of
`verify:fast`, `verify:local`, or `grant:check`; use it when adoption
installability matters more than iteration speed.

The registry consumer proof is also opt-in because it contacts npm:

```bash
npm run smoke:npm-registry-paid-mcp-consumer
```

Expected result: the command installs all 11 published
`@sacredlabs/agentrail-*` packages into a fresh temporary project, runs the
same paid MCP-style approval, denial, failed-payment, receipt, and redaction
checks, and writes a redacted mode-600 local proof packet.

## Current scaffold checks

```bash
npm install
npm run verify:fast
npm test
npm run typecheck
npm run smoke:local
npm run smoke:demo-dapp
npm run smoke:demo-browser
npm run readiness:testnet:example
npm run proof:testnet-digest
npm run proof:a2a-public-readiness
npm run proof:verification-profiles
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:operator-gates
```

`npm run verify:fast` is the bounded iteration profile. Use
`npm run verify:local` before accepting a slice, handoff, release claim, or
reviewer-facing proof.

## Local policy gateway smoke path

This smoke path verifies the AgentRail gateway API shape, app-key auth, package/function allowlist rejection, SDK-compatible reserve responses, and execute proxy behavior. It can run against a local/mock upstream before a real IOTA Gas Station is configured.

### 1. Configure local environment

Copy the example file and keep secrets local:

```bash
cp .env.example .env
```

The policy gateway reads these variables from the process environment. Node does not automatically load `.env` in this package, so source the file before starting the service or pass variables inline:

```bash
AGENTRAIL_GATEWAY_PORT=8787
AGENTRAIL_GATEWAY_HOST=127.0.0.1
AGENTRAIL_POLICY_PATH=examples/policies/demo-dapp.yaml
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key
GAS_STATION_URL=http://127.0.0.1:9527
GAS_STATION_BEARER_TOKEN=replace-with-local-gas-station-token
```

`AGENTRAIL_DEMO_APP_KEY` is a local development app key only. Do not commit real API keys, sponsor keys, bearer tokens, or `.env` files.

### 2. Start the gateway

```bash
npm run build -w @sacredlabs/agentrail-policy-gateway-service
set -a
. ./.env
set +a
npm run start -w @sacredlabs/agentrail-policy-gateway-service
```

Equivalent inline start command:

```bash
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key \
AGENTRAIL_GATEWAY_HOST=127.0.0.1 \
AGENTRAIL_POLICY_PATH=examples/policies/demo-dapp.yaml \
GAS_STATION_URL=http://127.0.0.1:9527 \
GAS_STATION_BEARER_TOKEN=replace-with-local-token \
npm run start -w @sacredlabs/agentrail-policy-gateway-service
```

### 3. Check local health

```bash
curl http://127.0.0.1:8787/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "agentrail-policy-gateway",
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
  -d '{"gas_budget":1,"package_id":"0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0","function_name":"mint_badge"}'
```

Expected result: HTTP 401 with reason code `AUTH_MISSING`.

### 5. Verify package/function policy

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H "authorization: Bearer ${AGENTRAIL_DEMO_APP_KEY}" \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"package_id":"0xNOT_ALLOWED","function_name":"mint_badge"}'
```

Expected result: HTTP 400 with reason code `PACKAGE_NOT_ALLOWED`.

### 6. Simulate policy locally before reserve

Use the simulation endpoint to preflight policy decisions without touching IOTA Gas Station, creating reservations, mutating quota counters, or emitting reserve/execute events:

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/policy/simulate \
  -H "authorization: Bearer ${AGENTRAIL_DEMO_APP_KEY}" \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"wallet_address":"0xWALLET","package_id":"0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0","function_name":"mint_badge"}'
```

Expected allowed result: HTTP 200 with `{ "allowed": true }`. Policy rejections also return HTTP 200 as decision data, for example `{"allowed":false,"reasonCode":"PACKAGE_NOT_ALLOWED",...}`. Missing or invalid app credentials still return auth failures. Malformed JSON, non-object bodies, and malformed policy field shapes such as non-numeric or non-positive `gas_budget` values return `BadRequest` before policy evaluation.

### 7. Run the one-command local smoke

The smoke command starts an in-process mock Gas Station upstream plus the policy gateway on loopback-only dynamic ports. It exercises the public SDK path without Docker, testnet funds, sponsor keys, or real network calls:

```bash
npm run smoke:local
```

Expected output ends with:

```text
AgentRail local gateway smoke passed
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
AgentRail demo dApp local flow passed
AgentRail demo dApp browser smoke passed
```

If you already have a local gateway running, you can point the CLI demo dApp at it:

```bash
AGENTRAIL_GATEWAY_URL=http://127.0.0.1:8787 \
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key \
npm run dev -w @sacredlabs/agentrail-demo-dapp
```

Or start the browser wrapper locally:

```bash
AGENTRAIL_GATEWAY_URL=http://127.0.0.1:8787 \
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key \
npm run browser -w @sacredlabs/agentrail-demo-dapp
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

### 10. Render and start local Gas Station config

When you are ready to start a local Gas Station for testnet proof, render the
ignored local Gas Station config from `.env`:

```bash
npm run gas-station:render-config
```

This writes `deploy/gas-station/config.local.yaml`, which contains sponsor
signer material and must stay ignored. Then start the local Redis and Gas
Station services on loopback:

```bash
docker compose --env-file .env -f deploy/docker-compose/docker-compose.local.yml up
```

Use `docker-compose` instead of `docker compose` if your Docker installation
uses the standalone Compose binary.

### 11. Proxy an allowed reserve request manually

If you are running a local IOTA Gas Station upstream at `GAS_STATION_URL`, call:

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H "authorization: Bearer ${AGENTRAIL_DEMO_APP_KEY}" \
  -H 'content-type: application/json' \
  -d '{"gas_budget":1,"wallet_address":"0xWALLET","package_id":"0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0","function_name":"mint_badge"}'
```

Expected result: the request is proxied to `GAS_STATION_URL/v1/reserve_gas`; the response includes the upstream `result.reservation_id` plus a gateway-local `agentRailTransactionId` used later by `/v1/execute_tx`.

If no upstream Gas Station is running, the gateway returns `GAS_STATION_UNAVAILABLE`. The current gateway keeps reservations in memory for local smoke use only; restart the service to clear local reservation state.

## Target live testnet flow

The live flow requires operator-owned local credentials and a reachable IOTA Gas Station upstream. It is intentionally separate from the deterministic smoke commands because it contacts live services and consumes sponsored testnet gas.

1. Copy `.env.example` to `.env`.
2. Add testnet sponsor wallet values locally.
3. Run `npm run gas-station:render-config` for the default local Docker
   Gas Station path, or set `AGENTRAIL_GAS_STATION_RUNTIME_MODE=managed-upstream`
   when `GAS_STATION_URL` points at an operator-managed Gas Station.
4. Run `npm run gas-station:runtime-preflight`.
5. Start Redis, Gas Station, policy gateway, and dashboard for the local Docker
   path, or start only the policy gateway/dashboard when using managed
   upstream.
6. Run `npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json`.
7. Open dashboard health page.
8. Open demo dApp.
9. Execute sponsored testnet transaction.
10. See usage event in dashboard.

Secrets must remain local and must never be committed.
