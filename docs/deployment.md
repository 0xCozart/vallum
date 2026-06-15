# Deployment

AgentRail deployment has three different proof levels. Do not skip levels when moving from a local smoke path to a live sponsor-wallet path.

## Local proof path

Start here before adding live credentials. The deterministic local proof paths run without Docker, Redis, sponsor keys, live IOTA RPC, or a running IOTA Gas Station.

```bash
npm install
npm run verify:local
```

This proves the repository can build, test, run local gateway/demo smokes, validate example readiness, dry-run package artifacts, and scan tracked/staged/untracked text files for obvious secret patterns.

## Local service path

Use this path when you want to run the policy gateway process locally against a local or testnet Gas Station upstream.

Minimum operator steps:

1. Copy `.env.example` to `.env`.
2. Replace placeholders locally; never commit `.env`.
3. Run `npm run readiness:testnet`.
4. Start the policy gateway on a loopback host.
5. Check `GET /health`.
6. Call `POST /v1/policy/simulate` before trying reserve/execute.
7. Call `POST /v1/reserve_gas` only after simulation and policy metadata are correct.

Important boundaries:

- The browser should call a same-origin backend route, not Gas Station directly.
- `GAS_STATION_BEARER_TOKEN` belongs only on the server/operator side.
- `AGENTRAIL_OPERATOR_USAGE_TOKEN` is separate from app API keys and the upstream Gas Station bearer token.
- The current local reservation store is in memory; restarting the gateway clears local reservation state.

## Live testnet path

Use this path only with operator-owned testnet credentials and a reachable IOTA Gas Station setup.

| Checkpoint | Command or action | Failure means |
| --- | --- | --- |
| Example placeholders are documented | `npm run readiness:testnet:example` | Public config documentation drifted. |
| Local secret file is shaped correctly | `npm run readiness:testnet` | Fix `.env`; do not attempt live reserve/execute. |
| Local Gas Station config is rendered | `npm run gas-station:render-config` | Fix `.env` signer/RPC config; do not start Gas Station. |
| Gas Station runtime mode is ready | `npm run gas-station:runtime-preflight` | Install/enable Docker daemon for `local-docker`, or explicitly configure `managed-upstream` with an operator-managed Gas Station URL. |
| Local Gas Station containers are started | `docker compose --env-file .env -f deploy/docker-compose/docker-compose.local.yml up` or `npm run gas-station:docker-direct -- --execute` | Docker daemon, Compose plugin, image pull, Redis, or Gas Station startup is not ready. |
| Direct Docker stack is running | `npm run gas-station:docker-direct -- --status` | Expected direct Docker network or containers are missing or stopped; this does not prove HTTP health or reserve compatibility. |
| Sponsor funding request is prepared | `npm run sponsor:write-funding-request -- --out tmp/agentrail/sponsor-funding-request.json` | The configured signer cannot be converted into a public sponsor address for funding. |
| Sponsor faucet request is intentional | `npm run sponsor:request-faucet-funds -- --execute --out tmp/agentrail/sponsor-faucet-request.json` | Missing `IOTA_FAUCET_URL`, unsafe faucet URL, faucet rate limit, or faucet failure; this does not prove reserve compatibility. |
| Sponsor wallet funding report is current | `npm run sponsor:check-funding -- --report tmp/agentrail/sponsor-funding-report.json` | Sponsor wallet balance or sampled coin shape is not enough for the reserve budget; fund or consolidate testnet gas before retrying reserve. |
| Testnet upstream checklist is prepared | `npm run operator:write-report-template -- --kind testnet-upstream --out tmp/agentrail/testnet-upstream-report-template.json` | Template only; it lists `--skip-reserve` triage before the full diagnostic but cannot clear `AGENTRAIL_TESTNET_UPSTREAM_REPORT`. |
| Upstream is reachable | `npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json` | Gas Station URL/auth/network/reserve compatibility is not ready. |
| Live sponsored execute is intentional | `npm run execute:testnet-demo` | Command self-checks readiness/runtime/upstream report first; stop and inspect bounded error output before retrying. |

The live execute command is intentionally excluded from `verify:local` because it contacts live services and consumes sponsored testnet gas.

The local Compose template runs Redis and the official `iotaledger/gas-station`
container with loopback-only host ports. Render
`deploy/gas-station/config.local.yaml` first; that file contains sponsor signer
material, is ignored by Git, and must not be printed or committed. Run
`npm run gas-station:runtime-preflight` before starting containers; it checks
only local config and Docker runtime availability and does not prove HTTP health
or reserve_gas compatibility. If your Docker installation uses the legacy
standalone binary, replace `docker compose` with `docker-compose` in the
command above. If Compose is unavailable but the Docker client and daemon are
reachable, review the sanitized direct plan with
`npm run gas-station:docker-direct -- --dry-run`, then run
`npm run gas-station:docker-direct -- --execute` only when you intentionally
want to pull/start the local Redis and Gas Station containers. The direct path
adds the `redis` network alias that the rendered local Gas Station config uses
by default. After an intentional direct start, use
`npm run gas-station:docker-direct -- --status` to inspect only the expected
local Docker network and container states. The status check does not start
containers, fetch HTTP health endpoints, contact IOTA RPC, or prove
reserve_gas compatibility.

If `reserve_gas` fails after Gas Station root and IOTA RPC checks are healthy,
run `npm run sponsor:write-funding-request -- --out
tmp/agentrail/sponsor-funding-request.json` if the operator needs the public
sponsor address for testnet funding. That ignored artifact contains the public
address, command order, and redaction notes; stdout remains redacted. If the
operator has an approved IOTA testnet faucet URL, set `IOTA_FAUCET_URL` outside
tracked files and run `npm run sponsor:request-faucet-funds -- --execute --out
tmp/agentrail/sponsor-faucet-request.json`. That command sends the public sponsor
address to the configured faucet only with `--execute`, writes a sanitized
ignored report, and does not sign, reserve gas, or execute transactions. Then
run `npm run sponsor:check-funding -- --report
tmp/agentrail/sponsor-funding-report.json` before retrying. The funding
diagnostic derives the public sponsor address locally from the ignored Gas
Station signer key and queries IOTA RPC for balance/coin shape. It prints only
a redacted address and numeric funding fields, and its report keeps the same
redacted/aggregate shape for `AGENTRAIL_SPONSOR_FUNDING_REPORT`; it does not
sign, reserve gas, execute transactions, or print the sponsor key.

If an operator intentionally uses a separately managed Gas Station instead of
the local Docker path, set `AGENTRAIL_GAS_STATION_RUNTIME_MODE=managed-upstream`
outside committed files. In that mode `npm run gas-station:runtime-preflight`
does not inspect Docker and does not contact the upstream service; it only
confirms that managed mode and a Gas Station URL are configured without
printing the URL. A current passing
`npm run diagnose:gas-station -- --report <ignored-json-path>` report is still
required before `npm run execute:testnet-demo` can reserve gas or build/sign a
transaction.

## Production path

Before production, replace local proof foundations with production-grade services and access controls:

- durable usage storage with migrations, retention, backup/restore, and concurrency behavior;
- dashboard/API authentication and authorization;
- private Redis and Gas Station network placement;
- TLS at the reverse proxy;
- KMS or external signer where possible;
- hard app and wallet budgets;
- low sponsor-balance alerts;
- rejection and upstream-failure monitoring;
- secret rotation and incident-response process.

The current repo already exposes sanitized decision events, a local JSONL usage-event foundation, and an authenticated local `/operator/usage` API for proof. Treat those as foundations, not a complete production dashboard or production database.

## Production considerations

Production operators should:

- protect Gas Station behind the policy gateway;
- keep Redis private;
- use TLS at the reverse proxy;
- keep sponsor keys outside the repo;
- use KMS or external signer where possible;
- configure hard budgets and rate limits;
- monitor sponsor balance and policy rejection rates.

See `docs/production-hardening.md`.
