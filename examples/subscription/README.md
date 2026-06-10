# Subscription Demo

This local/mock demo records subscription entitlement evidence only after
policy-gateway approval and proof collection. It proves approved start,
policy-denied start, failed proof, renewal, and cancellation paths without
contacting live IOTA services.

The demo does not operate recurring billing, production entitlement delivery,
legal subscription enforcement, marketplace subscription listings, live
settlement, or provider verification.

Run it with:

```bash
npm run smoke:subscription
```

Local safety checks:

- policy denial does not collect subscription activation proof;
- failed, thrown, malformed, or raw-payload proof withholds activation or
  renewal;
- receipt output records hashes and status, not private access tokens, payment
  credentials, or legal terms payloads;
- formatted output omits API keys, signer references, bearer tokens, payment
  credentials, raw transaction bytes, and private key material.
