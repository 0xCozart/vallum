# Service Bounty Demo

This local demo shows an Vallum service-bounty workflow using policy
approval, template metadata, provider completion proof, and receipt state before
a bounty is released.

It proves:

- approved requests route through the SDK and mock policy gateway;
- bounty release happens only after sponsorship approval and completion proof
  evidence;
- policy denial and failed completion proof do not release a bounty;
- formatted output omits API keys, signer references, raw transaction bytes,
  signatures, private provider payloads, and secret material.

Run it from the repo root:

```bash
npm run smoke:service-bounty
```

This command is local-only. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, production providers, marketplace services, or
custody funds.
