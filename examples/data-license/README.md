# Data License Demo

This local demo shows an Vallum data-license workflow using policy
approval, template metadata, access proof evidence, and receipt state before a
license is considered granted.

It proves:

- approved requests route through the SDK and mock policy gateway;
- access is granted only after sponsorship approval and access proof evidence;
- policy denial and access-proof failure do not grant access;
- formatted output omits API keys, signer references, raw transaction bytes,
  signatures, private access tokens, and secret material.

Run it from the repo root:

```bash
npm run smoke:data-license
```

This command is local-only. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, production data providers, or custody funds.
