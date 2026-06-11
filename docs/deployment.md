# Deployment

GasKit deployment has three different proof levels. Do not skip levels when moving from a local smoke path to a live sponsor-wallet path.

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
- `GASKIT_OPERATOR_USAGE_TOKEN` is separate from app API keys and the upstream Gas Station bearer token.
- The current local reservation store is in memory; restarting the gateway clears local reservation state.

## Live testnet path

Use this path only with operator-owned testnet credentials and a reachable IOTA Gas Station setup.

| Checkpoint | Command or action | Failure means |
| --- | --- | --- |
| Example placeholders are documented | `npm run readiness:testnet:example` | Public config documentation drifted. |
| Local secret file is shaped correctly | `npm run readiness:testnet` | Fix `.env`; do not attempt live reserve/execute. |
| Local Gas Station config is rendered | `npm run gas-station:render-config` | Fix `.env` signer/RPC config; do not start Gas Station. |
| Local Docker runtime is ready | `npm run gas-station:runtime-preflight` | Install/enable Docker daemon, then use Docker Compose or the direct Docker fallback before starting Gas Station. |
| Local Gas Station containers are started | `docker compose --env-file .env -f deploy/docker-compose/docker-compose.local.yml up` or `npm run gas-station:docker-direct -- --execute` | Docker daemon, Compose plugin, image pull, Redis, or Gas Station startup is not ready. |
| Upstream is reachable | `npm run diagnose:gas-station` | Gas Station URL/auth/network is not ready. |
| Live sponsored execute is intentional | `npm run execute:testnet-demo` | Stop and inspect bounded error output before retrying. |

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
by default.

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
