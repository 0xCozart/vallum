# Paid MCP Tool Demo

This local demo shows a paid MCP-style tool using Vallum policy,
payment confirmation, and receipt state before returning the paid result.

It proves:

- approved requests route through the SDK and mock policy gateway;
- the manifest/action intent includes a scoped signer reference internally, but
  formatted output never prints the signer reference value;
- the paid result is returned only after payment confirmation and receipt
  submission;
- policy denial and payment failure do not return paid results;
- receipt event chains are printed for the approved, denied, and failed-payment
  paths;
- formatted output omits API keys, signer references, raw transaction bytes,
  user signatures, private keys, seeds, and mnemonics.

Run it from the repo root:

```bash
npm run smoke:paid-mcp-tool
```

This command is local-only. It does not contact IOTA RPC, IOTA Gas Station,
testnet, mainnet, paid APIs, or custody funds.

Expected output includes `boundary.localOnly=true`,
`boundary.route=SDK->mock-policy-gateway`, `approved.status=completed`,
`denied.reason=GAS_BUDGET_TOO_HIGH`, `failedPayment.reason=mock-payment-failed`,
and receipt event chains for each path. The mock payment digest and mock
sponsorship id are local fixture evidence, not live/testnet proof.
