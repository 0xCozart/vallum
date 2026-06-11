# @iota-gaskit/registry

Versioned Agent Profile schema and validation helpers for Agentic GasKit.

Current surface:

- Agent Profile schema validation with revoked/expired states.
- Local fixture profile resolution.
- Dependency-injected IOTA Names and IOTA Identity adapter interfaces.
- Bounded in-memory IOTA Identity verification cache helpers that fail closed
  after TTL expiry if DID or credential evidence cannot refresh.
- Optional force-refresh behavior for protected actions that must bypass
  current cache entries.
- A2A Agent Card generation from active Agent Profiles.
- Local A2A Agent Card JWS signing and trusted-key verification helpers.
- Local A2A Agent Card well-known response helpers for the canonical
  `/.well-known/agent-card.json` path.
- Local public JWKS response helpers for Agent Card signing public keys at the
  canonical `/.well-known/jwks.json` path.
- Local static A2A discovery bundle generation for signed Agent Card and public
  JWKS JSON artifacts at canonical well-known paths.
- Local static A2A discovery artifact writing for canonical `.well-known`
  files plus a sanitized header manifest.

This package is local-first today. It does not resolve live IOTA Names,
validate live IOTA Identity credentials, run A2A task/message operations, host
public A2A discovery, prove external A2A conformance, provide production key
management or key rotation, deploy static discovery artifacts to a public host,
prove endpoint ownership, or contact testnet/mainnet services. The identity cache records
only successful local/mock verification evidence and does not turn mock
credentials into live credential validation.
