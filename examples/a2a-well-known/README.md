# A2A Well-Known Demo

This local demo shows how AgentRail can serve a current A2A Agent Card
from an Agent Profile at `/.well-known/agent-card.json`.

It proves:

- the canonical discovery path returns `application/a2a+json`;
- the legacy `/.well-known/agent.json` path is not advertised by default;
- revoked profiles do not return an active Agent Card;
- formatted output omits signer references, wallet internals, credential refs,
  payment addresses, raw transaction bytes, signatures, and secret material.

Run it from the repo root:

```bash
npm run smoke:a2a-well-known
```

This command is local-only. It does not contact A2A peers, IOTA RPC, IOTA Gas
Station, IOTA Names, IOTA Identity, testnet, mainnet, paid APIs, or custody
funds.
