# TypeScript SDK

The SDK helps dApp backends interact with AgentRail without hand-writing raw HTTP calls.

## Backend API Example

```ts
import { createAgentRailClient } from "@sacredlabs/agentrail-sdk";

const client = createAgentRailClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.AGENTRAIL_API_KEY!,
});

const simulation = await client.simulatePolicy({
  gasBudget: 50_000_000,
  walletAddress: userAddress,
  packageId: "0x...",
  functionName: "mint_badge",
});

if (!simulation.allowed) {
  // Show or log simulation.reasonCode/message without creating a reservation.
  return;
}

const reservation = await client.reserveGas({
  gasBudget: 50_000_000,
  walletAddress: userAddress,
  packageId: "0x...",
  functionName: "mint_badge",
});

const result = await client.executeSponsoredTransaction({
  reservationId: reservation.reservationId,
  agentRailTransactionId: reservation.agentRailTransactionId,
  transactionBytes,
  userSignature,
});
```

The API key belongs on the backend, not in browser code. `simulatePolicy()` uses the same authenticated gateway boundary as `reserveGas()`, but a rejected simulation is returned as `{ allowed: false, reasonCode, message }` decision data rather than thrown as `AgentRailPolicyError`; auth and malformed transport responses still throw SDK errors.

## More Examples

See [Code Examples](examples.md) for backend routes, browser caller shape, gateway curl commands, and policy YAML.
