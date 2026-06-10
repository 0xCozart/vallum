# @iota-gaskit/registry

Versioned Agent Profile schema and validation helpers for Agentic GasKit.

Current surface:

- Agent Profile schema validation with revoked/expired states.
- Local fixture profile resolution.
- Dependency-injected IOTA Names and IOTA Identity adapter interfaces.
- A2A Agent Card generation from active Agent Profiles.

This package is local-first today. It does not resolve live IOTA Names,
validate live IOTA Identity credentials, serve A2A endpoints, or contact
testnet/mainnet services.
