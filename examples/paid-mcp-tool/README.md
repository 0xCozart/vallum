# Paid MCP Tool Demo

This local demo shows a paid MCP-style tool using Agentic GasKit policy,
payment confirmation, and receipt state before returning the paid result.

It proves:

- approved requests route through the SDK and mock policy gateway;
- the paid result is returned only after payment confirmation and receipt
  submission;
- policy denial and payment failure do not return paid results;
- formatted output omits API keys, signer references, raw transaction bytes, and
  signatures.

Run it from the repo root:

```bash
npm run smoke:paid-mcp-tool
```

This command is local-only. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, or custody funds.
