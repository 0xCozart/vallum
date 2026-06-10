# Agent Escrow Demo

This local demo shows one agent hiring another agent through the Agentic GasKit
mock sponsorship gateway. It proves:

- approved escrow opens through the SDK and gateway;
- provider completion advances receipt state;
- verifier approval releases escrow;
- an over-budget manifest is denied and returns structured receipt state;
- formatted output omits API keys, signer references, raw transaction bytes, and
  signatures.

Run it from the repo root:

```bash
npm run smoke:agent-escrow
```

This command is local-only. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, or custody funds.
