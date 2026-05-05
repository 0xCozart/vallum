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
