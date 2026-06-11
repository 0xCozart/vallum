# Testnet Digest Proof

`npm run proof:testnet-digest` is a non-networked check for the public IOTA
testnet transaction digest evidence already documented in this repo.

It verifies that the known public digest appears in:

- `docs/testnet-attempts.md`
- `docs/milestone-0-proof.md`
- `docs/reviewer-walkthrough.md`

Run it from the repository root:

```bash
npm run proof:testnet-digest
```

Expected local status:

```text
Agentic GasKit testnet digest proof documented-local
documented=true
liveChecked=false
verified=false
```

The local command does not contact IOTA RPC, sign transactions, reserve gas,
execute transactions, use sponsor credentials, start Gas Station, or read
`.env`.

## Opt-In Read-Only Lookup

Operators can perform a read-only lookup of the documented digest on IOTA
testnet:

```bash
npm run proof:testnet-digest:live
```

This command uses the public IOTA SDK client and the configured/default testnet
RPC URL to call `getTransactionBlock` for the documented digest. It does not
spend gas, sign transactions, reserve sponsored gas, or use sponsor secrets.

The expected successful live status is:

```text
Agentic GasKit testnet digest proof verified-testnet
liveChecked=true
verified=true
effectsStatus=success
```

If the lookup fails, treat it as read-only live proof blocked. Do not turn a
failed lookup into a claim that the original sponsored transaction did not
happen; inspect the endpoint, network, digest, and current IOTA testnet
availability first.

## What It Does Not Prove

- Current sponsor wallet funding.
- Current Gas Station availability.
- Current local `.env` readiness.
- A new sponsored transaction execution.
- Production or mainnet readiness.

Use `npm run execute:testnet-demo` only when operator-owned local credentials,
Gas Station, and explicit operator intent are available.
