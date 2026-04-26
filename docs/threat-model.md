# Threat Model

## Assets

- sponsor wallet private key;
- Gas Station bearer token;
- app API keys;
- JWT/session secrets;
- Redis state;
- usage and policy logs;
- dashboard operator access.

## Threats

### Sponsor wallet drain

Attackers may attempt to use valid or leaked credentials to sponsor unlimited transactions.

Mitigations:

- app quotas;
- wallet limits;
- package/function allowlists;
- hard gas budgets;
- low-balance alerts;
- manual suspension;
- KMS/external signer guidance.

### API key leakage

A leaked app key could sponsor transactions until revoked.

Mitigations:

- hashed keys at rest;
- one-time plaintext reveal;
- rotation support;
- per-app quotas;
- dashboard/audit visibility.

### Policy bypass

Requests could omit or forge package/function metadata.

Mitigations:

- validate metadata against transaction contents where feasible;
- require backend integration for trusted app metadata;
- log all decisions with sanitized structured events;
- fail closed when policy state is unavailable.

### Redis exposure

Redis state could be corrupted or read if exposed publicly.

Mitigations:

- private Docker/network binding;
- firewall rules;
- strong deployment docs;
- backup/restore guidance.

### Misconfigured Gas Station

Gas Station could be exposed directly without the policy gateway.

Mitigations:

- private networking;
- bearer-token protection;
- reverse-proxy examples;
- production checklist.

### Replay or double execution

An attacker could retry execution calls with known reservation identifiers.

Mitigations:

- transaction state tracking;
- idempotency checks;
- reservation expiry checks;
- structured logs.
