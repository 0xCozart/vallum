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

The local gateway exposes `POST /v1/policy/simulate` as a deterministic preflight for app teams and operators. It uses the same Bearer app API key authentication and the same policy engine as the reserve path, but it does not proxy to IOTA Gas Station, create reservations, mutate quota counters, or emit reserve/execute decision events.

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

Missing or invalid app credentials still fail closed with the usual auth statuses and reason codes. Malformed JSON and non-object bodies return `BadRequest` before policy evaluation. Keep simulation output secret-free; it should contain only policy decision data, not app keys, bearer tokens, raw request bodies, transaction bytes, signatures, or upstream responses.

## Standard reason codes

See `packages/shared-types/src/policy.ts` for the canonical reason-code list.

## Example

See `examples/policies/demo-dapp.yaml`.
