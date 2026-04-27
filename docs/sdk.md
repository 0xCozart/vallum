# TypeScript SDK

The SDK helps dApp backends interact with GasKit without hand-writing raw HTTP calls.

## Planned API

```ts
import { createGasKitClient } from "@iota-gaskit/sdk";

const client = createGasKitClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.GASKIT_API_KEY!,
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
  gasKitTransactionId: reservation.gasKitTransactionId,
  transactionBytes,
  userSignature,
});
```

The API key belongs on the backend, not in browser code. `simulatePolicy()` uses the same authenticated gateway boundary as `reserveGas()`, but a rejected simulation is returned as `{ allowed: false, reasonCode, message }` decision data rather than thrown as `GasKitPolicyError`; auth and malformed transport responses still throw SDK errors.
