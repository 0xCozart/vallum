# A2A Signed Agent Card Demo

This example signs an Agentic GasKit A2A Agent Card with an ephemeral local
Ed25519 key and verifies the resulting JWS-style `signatures` entry.

It is deterministic local proof only. It does not publish a public A2A server,
operate live discovery, prove external A2A conformance, manage production key
custody, or configure streaming and push-notification support.

Run it through the repository smoke command:

```bash
npm run smoke:a2a-signed-card
```
