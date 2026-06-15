# @agentrail/policy-gateway

Fail-closed sponsorship policy evaluation helpers for AgentRail gateways.

## Install

Status: this package is a workspace package today and is not claimed as published to npm yet. Use the monorepo workspace for local review. After M3 publication, install from npm:

```sh
npm install @agentrail/policy-gateway @agentrail/shared-types
```

## Usage

```ts
import { evaluateSponsorshipPolicy } from "@agentrail/policy-gateway";

const decision = evaluateSponsorshipPolicy(
  {
    appId: "demo-app",
    appStatus: "active",
    allowedPackages: ["0xpackage"],
    maxGasBudgetPerTx: 10_000_000,
  },
  {
    authenticated: true,
    appId: "demo-app",
    packageId: "0xpackage",
    gasBudget: 1_000_000,
  },
);

if (!decision.allowed) {
  console.error(decision.reasonCode, decision.message);
}
```

The evaluator is deterministic and local. It does not reserve gas, execute transactions, call IOTA RPC, or enforce quotas beyond the request context values supplied by the caller.
