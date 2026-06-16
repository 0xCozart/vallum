# @sacredlabs/agentrail-standards

Standards bridge adapters for AgentRail.

Current surface:

- x402 v2 payment requirement to Agent Transaction Manifest mapping.
- Local mock x402 facilitator flow wired through the AgentRail policy
  gateway evaluator.
- x402 external payment receipt linkage and log-safe payment metadata redaction.
- AP2 checkout/payment mandate to Agent Transaction Manifest mapping.
- Local mock AP2 mandate flow wired through the AgentRail policy gateway
  evaluator.
- AP2 receipt evidence linkage, dispute evidence pointers, and log-safe
  mandate metadata redaction.
- A2A Agent Card mapping from AgentRail Agent Profiles using current
  discovery fields, auth declarations, supported interfaces, modes, and skills.
- A2A public-card hardening that fails closed for revoked/expired profiles,
  unsupported local protocol versions, malformed auth declarations, and private
  profile fields in public metadata.
- A2A Agent Card JWS signing and trusted-key verification helpers for local
  signed-card proof.
- A2A well-known response helpers for serving local Agent Cards at the
  canonical `/.well-known/agent-card.json` path.
- A2A JWKS response helpers for serving explicitly configured public signing
  keys at the canonical `/.well-known/jwks.json` path without private key
  material.
- Local/mock A2A task and message operation helpers for send-message,
  get-task, list-tasks, and cancel-task semantics, gated by AgentRail
  manifest/policy metadata and log-safe redaction.
- Local HTTP-shaped A2A handler for public Agent Card discovery and
  bearer-authenticated task send/get/list/cancel routes.
- Authenticated local A2A extended Agent Card access through the HTTP-shaped
  handler when an extended card is explicitly configured.
- Local A2A push notification configuration CRUD that accepts public HTTPS
  callback URLs while rejecting webhook credential storage and unsafe local
  destinations.
- Local injected A2A push delivery envelopes that POST sanitized task payloads
  through an explicit transport without default outbound webhook calls.
- Opt-in A2A push HTTP transport helper that posts sanitized task payloads only
  when explicitly injected, rejects unsafe callback URLs before network
  contact, does not emit authorization headers, uses manual redirect handling,
  applies a timeout, and returns status-only results.
- Local A2A push retry and in-memory attempt observability for explicitly
  injected transports, recording status-only attempt metadata without request
  bodies or credential material.
- Loopback-only Node HTTP server helper for deterministic local A2A discovery
  and task route smoke proof, including optional local JWKS serving, with
  explicit unsafe opt-in required for non-loopback binds.

This package does not operate a production x402 facilitator, replace AP2, hold
payment credentials, sign payment payloads, submit live settlement
transactions, operate a live public A2A task/message server, publish public A2A
discovery, prove public A2A push/webhook infrastructure, operate production
push queues/workers, prove external A2A conformance or live A2A discovery,
provide production Agent Card key management, or replace the A2A protocol.
