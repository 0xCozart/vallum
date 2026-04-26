# Architecture

```mermaid
flowchart LR
  Demo[Demo dApp] --> SDK[TypeScript SDK]
  SDK --> Gateway[Policy Gateway]
  Gateway --> Store[(Usage Store)]
  Gateway --> GasStation[IOTA Gas Station]
  GasStation --> RPC[IOTA RPC]
  Gateway --> Metrics[Metrics / Logs]
  Store --> Dashboard[Operator Dashboard]
```

## Components

- IOTA Gas Station: official sponsored-transaction component.
- GasKit Policy Gateway: validates app credentials, policy, quotas, and metadata before proxying to Gas Station.
- GasKit Usage Store: stores sanitized app config, policy decisions, and usage events.
- TypeScript SDK: typed wrapper for dApp backends.
- Operator Dashboard: health, usage, policy, and rejection visibility.
- Demo dApp: reviewer-verifiable sponsored transaction flow.

## Local decision events

The runnable local policy gateway can emit sanitized structured decision events through an optional `eventSink` callback. Events cover reserve/execute approvals, policy/auth rejections, and upstream failures. They include operational fields such as app ID, wallet address, package/function metadata, HTTP status, reason code, and GasKit transaction ID, but never include app API keys, upstream bearer tokens, raw request bodies, transaction bytes, user signatures, or raw upstream error bodies.

See `docs/observability.md` for the current event contract and future production usage-store direction.
