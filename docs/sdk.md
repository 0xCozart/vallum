# TypeScript SDK

The SDK helps dApp backends interact with Vallum without hand-writing raw HTTP calls.

## Backend API Example

```ts
import { createVallumClient } from "@vallum/sdk";

const client = createVallumClient({
  baseUrl: "https://api.example.com",
  apiKey: process.env.VALLUM_API_KEY!,
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

The API key belongs on the backend, not in browser code. `simulatePolicy()` uses the same authenticated gateway boundary as `reserveGas()`, but a rejected simulation is returned as `{ allowed: false, reasonCode, message }` decision data rather than thrown as `VallumPolicyError`; auth and malformed transport responses still throw SDK errors.

## IOTA Escrow Settlement Executor

The SDK exports a generic live/testnet executor for the escrow settlement
client:

```ts
import { IotaClient } from "@iota/iota-sdk/client";
import {
  createIotaEscrowSettlementClient,
  createSponsoredIotaEscrowSettlementExecutor,
  createVallumClient,
} from "@vallum/sdk";

const gateway = createVallumClient({
  baseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_API_KEY!,
});

const executor = createSponsoredIotaEscrowSettlementExecutor({
  gateway,
  iotaClient: new IotaClient({ url: process.env.IOTA_RPC_URL! }),
  signer: settlementSigner, // { address, signTransaction(bytes) }
  contract: {
    packageId: process.env.VALLUM_ESCROW_PACKAGE_ID!,
  },
  gasBudget: 50_000_000,
  resolveParticipants: async (request) => ({
    ownerAddress: await resolveOwnerAddress(request.refundDestinationRef),
    providerAddress: await resolveProviderAddress(request.providerPayoutRef),
    verifierAddress: await resolveVerifierAddress(request.receipt.escrow.verifierId),
  }),
  amountToBaseUnits: (request) => toBaseUnits([
    request.providerNetAmount,
    request.platformFeeAmount,
  ]),
});

const settlement = createIotaEscrowSettlementClient({
  executor,
  store: durableEscrowSettlementStore,
});
```

This executor is Vallum-generic. It builds the configured Move escrow
`create`, `release`, and `refund` calls, reserves sponsor gas through the
Vallum gateway, signs the transaction with the provided settlement signer, and
executes through the same `executeSponsoredTransaction()` boundary.

The caller must provide address resolution and amount conversion because those
are app/operator policy decisions, not SDK defaults. For live use, back
`createIotaEscrowSettlementClient()` with a durable conditional store; the
in-memory store is for tests and local demos only. The executor does not log or
return raw transaction bytes, user signatures, app API keys, Gas Station bearer
tokens, sponsor keys, or signer secrets.

Live executors should always pass an `IotaClient` so the IOTA SDK builds the
transaction bytes from the configured Move calls. The
`unsafeBuildTransactionBytesForTesting` option is a unit-test hook only and
requires `allowUnsafeCustomTransactionBuilder: true`; do not wire it to
untrusted input or production signing paths. `amountToBaseUnits()` must return a
non-negative u64-safe integer base-unit value.

## More Examples

See [Code Examples](examples.md) for backend routes, browser caller shape, gateway curl commands, and policy YAML.
