# Agent Escrow Demo

The Slice 1.7 demo is a deterministic local proof of an agent-to-agent escrow
workflow.

Run:

```bash
npm run smoke:agent-escrow
```

Expected output includes:

```text
Agentic GasKit agent escrow demo passed
approved.status=released
denied.reason=GAS_BUDGET_TOO_HIGH
gateway.events=approved,denied
```

The approved path uses `openEscrow` against the local mock agent gateway,
advances the receipt through submitted, completed, and released states, and
prints redacted receipt/log output. The denied path submits an over-budget
manifest and returns a structured policy denial.

This demo is local-only. It does not deploy contracts, custody funds, contact
IOTA RPC, contact IOTA Gas Station, or spend gas.
