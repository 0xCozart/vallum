# Policy Gateway

The policy gateway decides whether a sponsorship request is allowed before it reaches IOTA Gas Station.

## MVP policy dimensions

- app credential validity;
- app enabled/disabled status;
- app daily request limits;
- app daily gas budget;
- wallet daily request limits;
- denied wallets;
- package allowlists;
- function allowlists;
- per-transaction gas budget maximum.

## Policy simulation

The local gateway exposes `POST /v1/policy/simulate` as a deterministic preflight for app teams and operators. It uses the same Bearer app API key authentication and the same policy engine as the reserve path, but it does not proxy to IOTA Gas Station, create reservations, mutate quota counters, or emit reserve/execute decision events. Backend SDK users can call this endpoint with `client.simulatePolicy(...)`; keep that call server-side because it uses the app API key.

Request body fields mirror the local reserve metadata used by the policy engine:

```json
{
  "wallet_address": "0xWALLET",
  "package_id": "0xPACKAGE",
  "function_name": "mint_badge",
  "gas_budget": 1000000
}
```

A valid simulation returns HTTP 200 with the policy decision as data:

```json
{ "allowed": true }
```

Rejected simulations also return HTTP 200 with a machine-readable reason, so clients can display preflight results without treating policy rejection as transport failure:

```json
{
  "allowed": false,
  "reasonCode": "PACKAGE_NOT_ALLOWED",
  "message": "Package is not allowlisted for this app."
}
```

Missing or invalid app credentials still fail closed with the usual auth statuses and reason codes. Malformed JSON, non-object bodies, malformed policy field types, and non-positive `gas_budget` values return `BadRequest` before policy evaluation. Keep simulation output secret-free; it should contain only policy decision data, not app keys, bearer tokens, raw request bodies, transaction bytes, signatures, or upstream responses.

## Quota storage

Reserve-time quota accounting uses a gateway quota store keyed by UTC day,
app policy fingerprint, app id, and wallet address. The default store is
process-local memory for deterministic local demos. `VALLUM_QUOTA_STORE_PATH`
enables a mode-0600 file-backed store for local restart tests and reviewer
proof, but that JSON file is not production-safe across multiple gateway
processes or hosts.

Production deployments with daily request, daily gas, or per-wallet daily
limits must use a production-safe quota adapter with documented atomic
reserve, rollback, clock, corruption, and cross-process behavior. The gateway
refuses production startup for daily-limit policies unless such an adapter is
configured.

## Reservation lifecycle

Gateway reservations have local `createdAt` and `expiresAt` metadata. Execute
requests for expired reservations fail before the upstream Gas Station execute
proxy. Per-app active reservation caps bound heap growth from valid app keys,
and terminal reservations are retained briefly for replay evidence before
cleanup. Tune these local defaults for the deployment, but keep upstream Gas
Station reservation duration as the source of live sponsorship validity.

## Standard reason codes

See `packages/shared-types/src/policy.ts` for the canonical reason-code list.

## Example

See `examples/policies/demo-dapp.yaml`.
