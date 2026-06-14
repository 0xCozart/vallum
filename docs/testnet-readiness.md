# Testnet Readiness Preflight

This preflight is the safe boundary between the deterministic local smoke paths and the first real sponsored testnet transaction attempt.

It does not contact IOTA RPC, a Gas Station upstream, Redis, Docker, wallets, or any hosted service. It only validates local configuration shape and fails closed on values that are still placeholders or local-demo defaults.

## Commands

Validate that the public example still documents placeholders and all required keys:

```bash
npm run readiness:testnet:example
```

Check that the previously documented public IOTA testnet digest evidence is
still present in repo docs without contacting IOTA RPC:

```bash
npm run proof:testnet-digest
```

Optionally perform a read-only testnet lookup of that public digest:

```bash
npm run proof:testnet-digest:live
```

The live digest lookup does not reserve gas, execute transactions, sign
transactions, or use sponsor credentials.

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

## Opt-In IOTA Names Resolution Smoke

After an operator has an IOTA Names GraphQL endpoint and an expected
name/address pair, the registry adapter can be checked without spending gas:

```bash
IOTA_NAMES_GRAPHQL_URL=https://...
IOTA_NAMES_NAME=example.iota
IOTA_NAMES_EXPECTED_ADDRESS=0x...
npm run smoke:iota-names-live
```

The command contacts the configured GraphQL endpoint and verifies that
`resolveIotaNamesAddress(name) { address }` matches the expected address. It
does not call Gas Station, sign transactions, use sponsor credentials, or
execute a Move transaction.

If the three required variables are absent, the command exits with blocker
status `2` and reports:

```text
code=IOTA_NAMES_LIVE_CONFIG_MISSING
missing=IOTA_NAMES_GRAPHQL_URL,IOTA_NAMES_NAME,IOTA_NAMES_EXPECTED_ADDRESS
```

`smoke:iota-names-live` is opt-in and is not part of `npm run verify:local`.
Passing local verification therefore does not prove live IOTA Names resolution.

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

`npm run execute:testnet-demo` now fails closed before reserving gas or
building/signing a transaction unless all of these are true:

- `npm run readiness:testnet` passes.
- `npm run gas-station:runtime-preflight` passes.
- For direct Docker starts, `npm run gas-station:docker-direct -- --status`
  reports the expected local network, Redis container, and Gas Station
  container running. This is local Docker state only.
- If reserve compatibility fails after Gas Station root and IOTA RPC checks
  pass, `npm run sponsor:check-funding` reports whether the configured sponsor
  wallet has enough readable testnet IOTA balance and sampled coin shape for
  the reserve budget. It is read-only and prints no private key or full sponsor
  address.
- `GASKIT_TESTNET_UPSTREAM_REPORT` points at a current sanitized report created
  by `npm run diagnose:gas-station -- --report <ignored-json-path>` without
  `--skip-reserve`.

`gas-station:runtime-preflight` defaults to `local-docker`, which requires the
ignored rendered config plus a reachable Docker daemon and either Docker
Compose or the direct Docker fallback. Operators who intentionally use a
separately managed Gas Station can set:

```bash
GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream
```

Managed mode is still non-networked. It only verifies that a Gas Station URL is
configured without printing it. It does not prove that the endpoint is healthy
or compatible; `GASKIT_TESTNET_UPSTREAM_REPORT` must still point at a current
passing diagnostic report before `npm run execute:testnet-demo` can reserve gas
or build/sign a transaction.

Operators can generate a non-networked checklist for this proof path with:

```bash
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
```

That template is not accepted by `GASKIT_TESTNET_UPSTREAM_REPORT`. It remains
`pending-operator-proof`; the accepted report must be the sanitized diagnostic
JSON emitted by `npm run diagnose:gas-station -- --report <ignored-json-path>`.

For the direct Docker path, `npm run gas-station:docker-direct -- --status`
can be used after an intentional startup to inspect whether the expected local
network and containers are running. It does not prove Gas Station HTTP health,
IOTA RPC reachability, reserve_gas compatibility, or sponsored execution.

`npm run sponsor:check-funding` can be used as a read-only funding diagnostic
when reserve_gas fails after auth succeeds. It contacts IOTA RPC, but it does
not reserve gas, sign transactions, execute transactions, or print sponsor
signer material.

Only after those preconditions pass should an operator use explicit intent to
run the live sponsored testnet execute.
