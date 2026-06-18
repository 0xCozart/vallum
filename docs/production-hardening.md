# Production Hardening

## Secrets

- Never commit sponsor private keys.
- Use environment-specific secrets.
- Prefer KMS or external signer for production.
- Rotate any key that was ever committed or shared.
- Run `npm run secrets:scan` for tracked repo hygiene and
  `npm run secrets:scan:local` before sharing a workstation snapshot or using
  ignored local config as operator evidence.

## Network

- Keep Gas Station and Redis private.
- Expose only the policy gateway/API and public dashboard routes intended for users.
- Use TLS.
- Restrict Grafana/dashboard admin routes.

## Budget controls

- Set small initial daily budgets.
- Use per-app and per-wallet limits.
- Configure max gas budget per transaction.
- Monitor low sponsor balance.
- Fail closed if policy state is unavailable.
- Use a production-safe quota store for daily limits. The repo-local
  `VALLUM_QUOTA_STORE_PATH` JSON store is local proof only; it does not provide
  cross-process or multi-host atomicity.
- Set conservative reservation TTLs and per-app active reservation caps so
  valid app keys cannot grow unbounded active reservation state.

## Monitoring

The local policy gateway exposes an optional sanitized decision-event sink for reserve/execute approvals, policy/auth rejections, and upstream failures. Route these events to your chosen log/metrics/usage store without adding app API keys, bearer tokens, sponsor keys, transaction bytes, user signatures, or raw request bodies.

Alert on:

- high failed execution rate;
- high policy rejection rate;
- low sponsor balance;
- Redis errors;
- Gas Station health failures;
- unexpected request spikes.

The local JSONL usage event store and `GET /operator/usage` API are suitable for deterministic development and reviewer proof only. The operator usage API requires a separate bearer token and `Cache-Control: no-store`, but before production replace or wrap this local foundation with storage and access control that has explicit concurrency behavior, retention/compaction, backup/restore, encryption posture, schema migration strategy, dashboard/API authentication, audit logging, and rate limiting.

## Backups

Back up the usage store and policy config. Redis backup needs depend on Gas Station state requirements for the deployment mode.
