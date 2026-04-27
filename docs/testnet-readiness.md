# Testnet Readiness Preflight

This preflight is the safe boundary between the deterministic local smoke paths and the first real sponsored testnet transaction attempt.

It does not contact IOTA RPC, a Gas Station upstream, Redis, Docker, wallets, or any hosted service. It only validates local configuration shape and fails closed on values that are still placeholders or local-demo defaults.

## Commands

Validate that the public example still documents placeholders and all required keys:

```bash
npm run readiness:testnet:example
```

Validate your local `.env` before trying a real testnet-sponsored transaction:

```bash
cp .env.example .env
# edit .env locally; never commit it
npm run readiness:testnet
```

`readiness:testnet` reads `.env` by default. You can validate another file with:

```bash
npm run build
npm exec tsx -- scripts/check-testnet-readiness.ts --env-file path/to/local.env
```

When `GASKIT_POLICY_PATH` is relative, this CLI resolves it relative to the selected env file directory before falling back to the repo working directory.

## What it checks

The preflight requires these keys to be present:

- `IOTA_RPC_URL`
- `GAS_STATION_KEYPAIR`
- `GAS_STATION_AUTH`
- `JWT_SECRET`
- `DATABASE_URL`
- `GASKIT_GATEWAY_HOST`
- `GASKIT_GATEWAY_PORT`
- `GASKIT_POLICY_PATH`
- `GASKIT_DEMO_APP_KEY`
- `GAS_STATION_URL`
- `GAS_STATION_BEARER_TOKEN`

It also checks:

- `IOTA_RPC_URL` is HTTPS and points at a testnet endpoint.
- `GAS_STATION_URL` is a valid URL.
- `GASKIT_GATEWAY_HOST` remains loopback-only for the first testnet demo boundary.
- `GASKIT_GATEWAY_PORT` is a valid TCP port.
- secret-like values are not placeholders in real readiness mode.
- `JWT_SECRET` is at least 32 characters in real readiness mode.
- `GASKIT_POLICY_PATH` loads through the gateway config parser.
- the policy has a non-empty package allowlist.
- the policy package allowlist does not still contain placeholder package IDs in real readiness mode.

## Output safety

The report prints variable names and pass/fail messages only. It does not print secret values for:

- sponsor key material
- Gas Station auth values
- JWT secret
- app key
- upstream bearer token

If this command fails, fix the local file. Do not paste real secrets into issues, PRs, commits, chats, screenshots, or logs.

## What this does not prove

This preflight is intentionally local-only. Passing it does not prove:

- the sponsor wallet has testnet funds;
- the private key is valid for the selected IOTA network;
- the Gas Station upstream is running;
- Docker, Redis, or dashboard services are healthy;
- a package/function can execute on-chain;
- production deployment hardening is complete.

Those checks belong to later live/testnet slices with explicit operator approval and secret handling. After the offline env preflight passes, use `POST /v1/policy/simulate` against the local gateway as a no-upstream policy preflight before attempting a real reserve/execute path.
