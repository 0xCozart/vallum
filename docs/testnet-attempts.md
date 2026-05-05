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
