# Testnet Digest Proof

`npm run proof:testnet-digest` is a non-networked check for the public IOTA
testnet transaction digest evidence already documented in this repo.

Documented digest:

```text
6gA8pyrYStnHWbYrE7Edr9iKd4PFG4mf2J2u9x14JoR3
```

Previous sponsored execute report digests from 2026-06-14:

```text
5qSeMePKyUWVf6e5AiQCZD4MNLe6dwTrcXzo7cXtN5Zg
Fc32GFCU95wUGs5iGjewJuMxxXwtRrjzLh3LUGrf85uf
FLdnYRUACAKQn8CwugEv1u6gYTh9jBr8rGMk2JZ2adsd
6Fz2r2ARRo6fiQMUL4FkWuwU16ekEmKHvHbhLpF5DU6n
```

It verifies that the known public digest appears in:

- `docs/testnet-attempts.md`
- `docs/agentic-gaskit/testnet-digest-proof.md`
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
- A newer sponsored transaction execution after the documented digest changes.
- Production or mainnet readiness.

Use `npm run execute:testnet-demo` only when operator-owned local credentials,
Gas Station, explicit operator intent, local runtime preflight, and a passing
sanitized upstream diagnostic report are available.

For fresh sponsored execute runs, capture an ignored sanitized execution report
with:

```bash
npm run execute:testnet-demo -- --report tmp/gaskit/sponsored-execute-report.json
```

That report is operational evidence only. It redacts addresses and opaque
execution ids, and it is not accepted by readiness gates as digest proof until
the public digest is added to tracked evidence and verified with
`npm run proof:testnet-digest:live -- --digest <digest> --report
tmp/gaskit/testnet-digest-proof.json`.
