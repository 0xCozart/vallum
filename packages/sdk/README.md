# @vallum/sdk

TypeScript client scaffold for applications integrating with an Vallum policy gateway.

## Install

For the npm release, install:

```sh
npm install @vallum/sdk
```

See the full package selection and configuration guide in the repository:
https://github.com/0xCozart/vallum/blob/main/docs/vallum/package-integration-guide.md

## Usage

```ts
import { createVallumClient, VallumPolicyError } from "@vallum/sdk";

const agentRail = createVallumClient({
  baseUrl: "https://gateway.example.invalid",
  apiKey: process.env.VALLUM_APP_API_KEY ?? "",
});

try {
  const decision = await agentRail.simulatePolicy({
    gasBudget: 1_000_000,
    packageId: "0xpackage",
    functionName: "mint",
  });

  if (!decision.allowed) {
    console.log(decision.reasonCode, decision.message);
  }
} catch (error) {
  if (error instanceof VallumPolicyError) {
    console.error(error.reasonCode, error.message);
  }
  throw error;
}
```

The client calls a configured policy gateway over HTTP. It does not embed sponsor credentials and does not itself prove live/testnet transaction execution.

Local Vallum helpers such as `requestSponsoredAction`, `openEscrow`,
`callPaidTool`, `requestDataLicense`, and `fulfillServiceBounty` route
sponsored/value-bearing flows through the policy gateway. They do not prove
live settlement, custody, marketplace provider verification, or testnet
deployment by themselves.

## Generic IOTA custody escrow

`createSponsoredIotaEscrowSettlementExecutor` builds funded escrow open,
release, and refund transactions for Vallum-compatible gateways. In the default
shared-object mode, funded open calls the escrow package `open_shared` entry, so
gateway policy allowlists must include `open_shared` plus `release` and
`refund`. The open transaction consumes a configured IOTA `Coin<T>` payment
object and calls the generic custody escrow Move package with policy-bound
payer, payee, release authority, refund authority, refund destination, payment
type, base-unit split, receipt/reference IDs, idempotency key, timeout, and
payee self-release flag. The executor can resolve a different signer per
operation, so funded open signs as the payer, release signs as the configured
release authority, and refund signs as the configured refund authority.

Release and refund calls do not accept arbitrary payout destinations. They use
the recipients and authority terms stored by the funded open transaction, so a
gateway operator or verifier cannot silently reroute funds through the SDK
surface.
