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
- A2A Agent Card mapping from Agentic GasKit Agent Profiles using current
  discovery fields, auth declarations, supported interfaces, modes, and skills.
- A2A public-card hardening that fails closed for revoked/expired profiles,
  unsupported local protocol versions, malformed auth declarations, and private
  profile fields in public metadata.
- A2A well-known response helpers for serving local Agent Cards at the
  canonical `/.well-known/agent-card.json` path.

This package does not operate a production x402 facilitator, replace AP2, hold
payment credentials, sign payment payloads, submit live settlement
transactions, operate an A2A task/message server, sign public Agent Cards,
prove live A2A discovery, or replace the A2A protocol.
