# @vallum/policy-gateway

Fail-closed sponsorship policy evaluation helpers for Vallum gateways.

## Install

For the npm prerelease, install:

```sh
npm install @vallum/policy-gateway@next
```

See
https://github.com/0xCozart/vallum/blob/main/docs/vallum/package-integration-guide.md
for package selection, configuration, and when to use the gateway package
instead of the SDK.

## Usage

```ts
import { evaluateSponsorshipPolicy } from "@vallum/policy-gateway";

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
