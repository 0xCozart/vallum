# Production Hardening

## Secrets

- Never commit sponsor private keys.
- Use environment-specific secrets.
- Prefer KMS or external signer for production.
- Rotate any key that was ever committed or shared.

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

## Monitoring

The local policy gateway exposes an optional sanitized decision-event sink for reserve/execute approvals, policy/auth rejections, and upstream failures. Route these events to your chosen log/metrics/usage store without adding app API keys, bearer tokens, sponsor keys, transaction bytes, user signatures, or raw request bodies.

Alert on:

- high failed execution rate;
- high policy rejection rate;
- low sponsor balance;
- Redis errors;
- Gas Station health failures;
- unexpected request spikes.

## Backups

Back up the usage store and policy config. Redis backup needs depend on Gas Station state requirements for the deployment mode.
