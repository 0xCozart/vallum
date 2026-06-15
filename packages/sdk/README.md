# @agentrail/sdk

TypeScript client scaffold for applications integrating with an AgentRail policy gateway.

## Install

Status: this package is a workspace package today and is not claimed as published to npm yet. Use the monorepo workspace for local review. After M3 publication, install from npm:

```sh
npm install @agentrail/sdk
```

## Usage

```ts
import { createAgentRailClient, AgentRailPolicyError } from "@agentrail/sdk";

const agentRail = createAgentRailClient({
  baseUrl: "https://gateway.example.invalid",
  apiKey: process.env.AGENTRAIL_APP_API_KEY ?? "",
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
  if (error instanceof AgentRailPolicyError) {
    console.error(error.reasonCode, error.message);
  }
  throw error;
}
```

The client calls a configured policy gateway over HTTP. It does not embed sponsor credentials and does not itself prove live/testnet transaction execution.

Local AgentRail helpers such as `requestSponsoredAction`, `openEscrow`,
`callPaidTool`, `requestDataLicense`, and `fulfillServiceBounty` route
sponsored/value-bearing flows through the policy gateway. They do not prove
live settlement, custody, marketplace provider verification, or testnet
deployment by themselves.
