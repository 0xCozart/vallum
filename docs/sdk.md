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
  resolveSigner: resolveEscrowOperationSigner,
  contract: {
    packageId: process.env.VALLUM_ESCROW_PACKAGE_ID!,
    paymentType: "0x2::iota::IOTA",
  },
  gasBudget: 50_000_000,
  resolveParticipants: async (request) => ({
    ownerAddress: await resolveOwnerAddress(request.refundDestinationRef),
    providerAddress: await resolveProviderAddress(request.providerPayoutRef),
    verifierAddress: await resolveVerifierAddress(request.receipt.escrow.verifierId),
    refundAuthorityAddress: await resolveRefundAuthority(request.refundAuthorityRef),
    refundDestinationAddress: await resolveRefundDestination(request.refundDestinationRef),
    platformFeeAddress: await resolvePlatformFeeRecipient(request.platformFeeRef),
  }),
  resolvePaymentObject: (request) => selectPaymentCoin(request.receipt.idempotencyKey),
  amountsToBaseUnits: (request) => ({
    grossAmount: toBaseUnits(request.receipt.amount),
    providerNetAmount: toBaseUnits(request.providerNetAmount),
    platformFeeAmount: toBaseUnits(request.platformFeeAmount),
  }),
});

const settlement = createIotaEscrowSettlementClient({
  executor,
  store: durableEscrowSettlementStore,
});
```

This executor is Vallum-generic. In the default shared-object mode it builds
the escrow package `open_shared`, `release`, and `refund` calls, so gateway
policy allowlists must include `open_shared` for funded opens. `open_shared`
consumes the resolved payment object and locks its `Coin<T>` balance in a
shared escrow object; `release` pays only the configured provider/platform
split; `refund` returns funds only to the configured refund destination. Each
transaction still reserves sponsor gas through the Vallum gateway, signs with
the resolved operation signer, and executes through the same
`executeSponsoredTransaction()` boundary.

The caller must provide payment-object selection, Move payment type, address
resolution, refund authority, refund destination, fee recipient, absolute
`refundAfterEpochMs` deadline, payee self-release policy, and base-unit amount
conversion because those are app/operator policy decisions, not SDK defaults.
`refundAfterEpochMs` is compared against IOTA chain epoch time; use `0` only
when timeout refund is intentionally disabled. `resolveSigner()` should return
the payer signer for `open`, the configured release-authority signer for
`release`, and the configured refund-authority signer for `refund`. The
executor rejects funded open before gas reservation if the signer address does
not match the resolved payer address. For live use, back
`createIotaEscrowSettlementClient()` with a durable conditional store that
atomically rejects duplicate `opening` reservations before the funded open can
execute; the in-memory store is for tests and local demos only. Executor policy
target resolvers must match the actual Move package/function being executed.
The executor does not log or return raw transaction bytes, user signatures, app
API keys, Gas Station bearer tokens, sponsor keys, or signer secrets.

Live executors should always pass an `IotaClient` so the IOTA SDK builds the
transaction bytes from the configured Move calls. The
`unsafeBuildTransactionBytesForTesting` option is a unit-test hook only and
requires `allowUnsafeCustomTransactionBuilder: true`; do not wire it to
untrusted input or production signing paths. `amountsToBaseUnits()` must return
u64-safe integer base-unit values whose provider and platform split equals the
gross funded amount.

## More Examples

See [Code Examples](examples.md) for backend routes, browser caller shape, gateway curl commands, and policy YAML.
