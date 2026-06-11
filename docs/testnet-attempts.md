# Testnet Attempt Log

Purpose: record live/testnet boundary attempts without exposing local `.env` values, sponsor keys, bearer tokens, app keys, raw transaction bytes, or private deployment details.

## 2026-05-05 local gateway to configured Gas Station upstream

Commit under test: `8717a9d5a1a33a1ebafb45e8c1eac34e4aab2646`

Preflight checks completed before the attempt:

- `npm run grant:check` passed.
- `npm run readiness:testnet` passed with secret values hidden.
- Package publish dry-run passed for `@iota-gaskit/shared-types`, `@iota-gaskit/policy-gateway`, and `@iota-gaskit/sdk`.
- Apex manifest detection passed for `tmp/apex-workflow/testnet-demo-package-readiness.json`.
- Independent staged-diff review passed with no blocking issues.

Live boundary attempted:

1. Started the policy gateway from local `.env` on loopback.
2. `GET /health` returned HTTP 200 with upstream configured.
3. `POST /v1/policy/simulate` for the concrete demo package/function returned HTTP 200 with `{ "allowed": true }`.
4. `POST /v1/reserve_gas` reached the configured upstream path through the gateway but returned HTTP 502 mapped to `GAS_STATION_UNAVAILABLE`.

Sanitized observed reserve result:

```json
{
  "error": "PolicyRejected",
  "reasonCode": "GAS_STATION_UNAVAILABLE",
  "message": "Gas Station reserve gas request failed with HTTP 502."
}
```

Outcome: no sponsored testnet transaction digest was produced in this attempt.

Current blocker for real testnet completion: the configured Gas Station upstream returned HTTP 502 for reserve. Next live slice should verify upstream Gas Station health/logs, sponsor wallet funding/key validity, IOTA RPC connectivity, and reserve request compatibility before retrying execute.

## 2026-05-05 upstream diagnosis follow-up

Local environment discovery found `GAS_STATION_URL` configured to loopback `http://127.0.0.1:9527`, but no process was listening on that port and Docker was unavailable in this WSL session (`Cannot connect to the Docker daemon at unix:///var/run/docker.sock`). Direct health probes to `/`, `/health`, `/v1/health`, `/api/health`, and `/metrics` all failed to connect.

A reusable sanitized diagnostic command now exists:

```bash
npm run diagnose:gas-station -- --skip-reserve
npm run diagnose:gas-station
```

Use `--skip-reserve` first to check Gas Station HTTP reachability and IOTA RPC connectivity without creating a reservation. Then run the full probe only after the upstream is intentionally online, funded, and pointed at the correct testnet RPC.

Before retrying the real execute path, bring the upstream Gas Station back online and verify:

1. `GAS_STATION_URL` points at the actual reachable upstream from the policy gateway process.
2. The upstream Gas Station logs do not show signer/key, Redis, RPC, or coin-inventory errors.
3. The sponsor address derived from the configured keypair is funded on the same network as `IOTA_RPC_URL`.
4. `POST /v1/reserve_gas` accepts the gateway body shape `{ "gas_budget": 50000000, "reserve_duration_secs": 120 }` with the configured bearer token.

## 2026-05-05 live infra retry

Followed the remaining finish-line checklist in this WSL session.

Observed state:

- Docker client is installed, but the Docker daemon is not running and cannot be started non-interactively from this user session because `sudo` requires a password.
- `GAS_STATION_URL` is still configured to loopback `http://127.0.0.1:9527`.
- No process is listening on port `9527`.
- `npm run diagnose:gas-station` rebuilt the repo, then failed Gas Station root, `/v1/health`, and `reserve_gas` compatibility probes with fetch/connect failures.
- `IOTA_RPC_URL=https://api.testnet.iota.cafe` remains reachable; the JSON-RPC checkpoint probe returned HTTP 200.

Sanitized diagnostic result:

```text
gasStationUrl=http://127.0.0.1:9527
iotaRpcUrl=https://api.testnet.iota.cafe
bearerTokenConfigured=true
fail: Gas Station root fetch failed
fail: Gas Station /v1/health fetch failed
ok: IOTA RPC iota_getLatestCheckpointSequenceNumber HTTP 200
fail: Gas Station reserve_gas compatibility probe fetch failed
```

Outcome: the real testnet transaction was not retried because the configured upstream Gas Station is offline/unreachable. The next required operator action is to start Docker/Gas Station or point `GAS_STATION_URL` at a reachable upstream, then rerun `npm run diagnose:gas-station` before attempting execute.

## 2026-05-05 Docker/Gas Station recovery retry

Docker access was recovered in this WSL session by using the existing Docker group path (`sg docker ...`). Docker daemon was already available to that group once invoked through the group context.

Started local live upstream containers:

- `gaskit-redis`
- `gaskit-gas-station`, bound to `127.0.0.1:9527`

Sanitized Gas Station observations:

- `GET /` returned HTTP 200 with `OK`.
- `/v1/health` returned HTTP 404; the official image still serves root health successfully.
- Gas Station initialized against `https://api.testnet.iota.cafe` and reported sponsor coin inventory.
- Full diagnostic passed its fatal checks:

```text
gasStationUrl=http://127.0.0.1:9527
iotaRpcUrl=https://api.testnet.iota.cafe
bearerTokenConfigured=true
ok: Gas Station root HTTP 200 "OK"
fail: Gas Station /v1/health HTTP 404 {}
ok: IOTA RPC iota_getLatestCheckpointSequenceNumber HTTP 200
ok: Gas Station reserve_gas compatibility probe HTTP 200
```

Compatibility fix discovered during this retry: the official Gas Station returns numeric `reservation_id` values. The gateway and SDK now coerce finite numeric response identifiers to strings before storing/returning them, preserving SDK compatibility while accepting the official upstream shape.

Gateway reserve through the local policy gateway now succeeds against the real Gas Station upstream and returns sponsor address, reservation id, gas coins, and a GasKit transaction id.

A follow-up execute attempt using placeholder transaction bytes/signature reached the official Gas Station but failed at upstream validation with HTTP 422, mapped by the gateway to `GAS_STATION_UNAVAILABLE`. This is expected for placeholder transaction data and confirms the flow is now past the previous reserve/connectivity blocker.

Remaining live-completion requirement: generate a real IOTA testnet transaction for the allowlisted package/function, sign it with a real user key, then submit those real transaction bytes/signature through `executeSponsoredTransaction`. The infrastructure and reserve boundary are now passing.

## 2026-05-05 real sponsored testnet execute

Added and ran a reusable real execute command:

```bash
npm run execute:testnet-demo
```

The command builds one real sponsored testnet transaction for the allowlisted demo Move call:

```text
0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0::demo_badge::mint_badge
```

It generates an ephemeral user key locally, reserves Gas Station gas through the policy gateway, builds a transaction with the ephemeral user as sender and the reserved sponsor/gas coin as gas owner/payment, signs with the ephemeral user key, then submits via `executeSponsoredTransaction`. The script prints only public addresses/ids/digests, never private keys or bearer tokens.

Additional compatibility issue discovered and fixed: the official Gas Station requires numeric `reservation_id` values on `execute_tx`, even though the SDK exposes reservation ids as strings for public API stability. The gateway now stores both the public string id and the original upstream id shape, validates public execute requests by string, and forwards the original numeric id back to the official upstream.

Sanitized successful run:

```text
gatewayBaseUrl=http://127.0.0.1:8787
iotaRpcUrl=https://api.testnet.iota.cafe
demoTarget=0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0::demo_badge::mint_badge
ephemeralUserAddress=0x80b3fadd46ab8aac6563a1e733deda1c63ca5e54c667662ab63cc8f4e3253b5b
reservedGas=true
reservationId=13
gasKitTransactionId=gaskit_5dc3c921-8b51-4f2c-ad54-795e0503b726
sponsorAddress=0xd046a4fb78f6ad84a08232db7f4f23164f6e406063ac021f8c86d0cf29b9b868
executed=true
transactionDigest=2Db6NiwZdR26JenPkWMFno7QgMePwhQ6rQQTA6jDJa7H
```

Outcome: the real IOTA testnet sponsored transaction path is complete end-to-end through local policy gateway, local Gas Station, and testnet RPC.

## 2026-06-11 upstream diagnostic report gate

Local `.env` is present and `npm run readiness:testnet` passes non-networked
configuration validation. A sanitized upstream diagnostic report path was added
so future proof gates can distinguish `.env` shape from current Gas Station
availability.

Command run:

```bash
npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json
```

Sanitized diagnostic result:

```text
gasStationUrl=http://127.0.0.1:9527
iotaRpcUrl=https://api.testnet.iota.cafe
bearerTokenConfigured=true
fail: Gas Station root fetch failed
fail: Gas Station /v1/health fetch failed
ok: IOTA RPC iota_getLatestCheckpointSequenceNumber HTTP 200 {"jsonrpc":"2.0","id":1,"result":"226298093"}
skip: reserve_gas compatibility probe
report=tmp/gaskit/testnet-upstream-diagnostic.json
```

`npm run proof:live-status`, `npm run proof:product-status`, `npm run
proof:operator-gates`, and `npm run proof:launch-readiness` now include
`testnet-upstream` as a separate gate. Current state is
`TESTNET_UPSTREAM_REPORT_FAILED`: IOTA testnet RPC is reachable, but the
configured loopback Gas Station is not reachable and reserve_gas compatibility
has not been proven in the current session.

Outcome: no sponsored transaction was attempted. The next required operator
action is to start or point `GAS_STATION_URL` at a reachable funded Gas Station,
rerun the diagnostic without `--skip-reserve` to produce a passing sanitized
report, then run `npm run execute:testnet-demo` only with explicit operator
intent.

Follow-up hardening: `npm run execute:testnet-demo` now checks local testnet
readiness, local Gas Station runtime preflight, and the configured sanitized
upstream diagnostic report before any reserve/execute attempt. Missing, stale,
failed, or reserve-skipped reports block execution before transaction building,
signing, or live Gas Station calls.

## 2026-06-11 local Gas Station config render

Added a local config render step for the official Gas Station container path:

```bash
npm run gas-station:render-config
```

Sanitized render result:

```text
gasStationConfig=deploy/gas-station/config.local.yaml
containsSponsorKey=true
next=docker compose --env-file .env -f deploy/docker-compose/docker-compose.local.yml up
```

Shape-only local verification confirmed:

```text
configExists=true
keyBytes=33
hasTestnetRpc=true
hasRedisServiceUrl=true
```

The rendered file is ignored by Git and contains sponsor signer material. It
must not be printed or committed.

Docker runtime status in this WSL session:

```text
docker version -> Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
docker compose --env-file ... -> compose plugin unavailable in this distro
docker-compose version -> WSL Docker Desktop integration is not active
```

Outcome: local Gas Station config generation is now reproducible, but the
container was not started in this session. The next operator action is to enable
Docker daemon plus Compose integration for this WSL distro, start the local
compose stack, then rerun `npm run diagnose:gas-station -- --report
tmp/gaskit/testnet-upstream-diagnostic.json` without `--skip-reserve`.
