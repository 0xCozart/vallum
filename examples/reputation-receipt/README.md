# Reputation Receipt Demo

This local/mock demo records a reputation receipt only after policy-gateway
approval and evidence collection. It proves approved, policy-denied, and
evidence-failed paths without contacting live IOTA services.

The demo does not operate public reputation scoring, provider verification,
marketplace ranking, staking, bonding, moderation, live settlement, or legal
trust enforcement.

Run it with:

```bash
npm run smoke:reputation-receipt
```

Local safety checks:

- policy denial does not collect reputation evidence;
- failed, thrown, malformed, or raw-payload evidence withholds completion;
- receipt output records hashes and status, not private review payloads;
- formatted output omits API keys, signer references, bearer tokens, payment
  credentials, raw transaction bytes, and private key material.
