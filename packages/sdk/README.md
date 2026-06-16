# @vallum/sdk

TypeScript client scaffold for applications integrating with an Vallum policy gateway.

## Install

For the npm prerelease, install:

```sh
npm install @vallum/sdk@next
```

See the full package selection and configuration guide in the repository:
https://github.com/0xCozart/agentic-gaskit/blob/main/docs/vallum/package-integration-guide.md

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
