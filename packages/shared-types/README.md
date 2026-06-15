# @agentrail/shared-types

Shared TypeScript policy and request/decision types for AgentRail packages.

## Install

Status: this package is a workspace package today and is not claimed as published to npm yet. Use the monorepo workspace for local review. After M3 publication, install from npm:

```sh
npm install @agentrail/shared-types
```

## Usage

```ts
import type { SponsorshipPolicy, SponsorshipRequestContext } from "@agentrail/shared-types";
import { POLICY_REASON_CODES } from "@agentrail/shared-types";

const policy: SponsorshipPolicy = {
  appId: "demo-app",
  appStatus: "active",
  allowedPackages: [],
  maxGasBudgetPerTx: 10_000_000,
};

const request: SponsorshipRequestContext = {
  authenticated: true,
  appId: "demo-app",
  gasBudget: 1_000_000,
};

console.log(POLICY_REASON_CODES, policy, request);
```

This package contains types and constants only; it does not contact IOTA RPC, an official Gas Station service, or any external network.
