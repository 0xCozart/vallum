# @iota-gaskit/standards

Standards bridge adapters for Agentic GasKit.

Current surface:

- x402 v2 payment requirement to Agent Transaction Manifest mapping.
- Local mock x402 facilitator flow wired through the Agentic GasKit policy
  gateway evaluator.
- x402 external payment receipt linkage and log-safe payment metadata redaction.
- AP2 checkout/payment mandate to Agent Transaction Manifest mapping.
- Local mock AP2 mandate flow wired through the Agentic GasKit policy gateway
  evaluator.
- AP2 receipt evidence linkage, dispute evidence pointers, and log-safe
  mandate metadata redaction.

This package does not operate a production x402 facilitator, replace AP2, hold
payment credentials, sign payment payloads, or submit live settlement
transactions.
