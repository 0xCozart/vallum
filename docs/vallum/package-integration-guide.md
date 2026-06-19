# Package Integration Guide

Vallum is IOTA-native infrastructure for agent-safe sponsored execution. It
helps an app backend or agent runtime request an IOTA action through policy,
manifests, signer references, and receipts without exposing sponsor secrets to
the browser or to an autonomous agent.

Vallum is not only an MCP server. MCP is one adapter surface for agent
runtimes. The core library is broader: SDK calls, policy-gateway routing,
manifest validation, signer-reference safety, receipt evidence, contract
workflow helpers, and operator proof gates.

## What Vallum Does

Vallum gives builders a safer path for sponsored IOTA actions:

- a backend or agent runtime describes the intended action in a manifest;
- policy checks decide whether the action can be sponsored;
- signer references identify scoped signing capability without exposing raw
  key material;
- the SDK routes value-bearing requests through an Vallum-compatible policy
  gateway;
- receipts record approval, denial, payment failure, sponsorship, submission,
  and completion evidence;
- operator proof commands separate local proof from live IOTA, production
  payment, custody, marketplace, and public A2A claims.

Use Vallum when you need a controlled sponsored-execution boundary. Do not
use it as a seed-export wallet, custody service, token project, marketplace
first product, or replacement for the official IOTA Gas Station.

## Why It Exists

IOTA Gas Station solves the sponsorship primitive: a sponsor can pay gas for a
transaction. Vallum adds the surrounding safety and developer layer that
agentic applications need:

- app credentials and policy before sponsor spend;
- package/function allowlists and gas budgets;
- signer-reference-first agent wallet/account handling;
- transaction manifests that bind intent, spend limits, counterparty, and
  receipt requirements;
- redacted receipts and operator-visible proof;
- package and adapter surfaces that agents can use without receiving sponsor
  keys, app API keys, raw transaction bytes, or user signatures.

The practical goal is boring infrastructure: a backend or agent runtime can
ask for a sponsored IOTA action, and the operator can prove what happened.

## Which Package To Install

Most users should install one entry package. npm installs its transitive
Vallum dependencies automatically.

| User | Install | Use this for |
| --- | --- | --- |
| App/backend developer | `@vallum/sdk` | Calling an Vallum-compatible gateway from backend code. |
| Agent runtime integrator | `@vallum/sdk` for backend/tool-host code; `@vallum/mcp-server` for stdio MCP hosts | Building an agent integration that still routes through policy and manifests. |
| Policy/gateway operator | `@vallum/policy-gateway` | Evaluating local sponsorship policy or building a gateway service. |
| Advanced package consumer | Lower-level packages such as `manifest`, `receipts`, `registry`, `standards`, or `accounts` | Specialized integrations that need direct primitives. |

Do not install all 11 packages manually unless you are developing Vallum
itself or building an advanced integration. The packages are split so the SDK,
gateway, MCP facade, marketplace read model, and lower-level primitives can
evolve independently.

## Install

The current official release is published under `@vallum/*`:

```bash
npm install @vallum/sdk
```

This installs the backend SDK and the lower-level manifest, registry, receipt,
and shared type packages it depends on.

If you are experimenting with the MCP package:

```bash
npm install @vallum/mcp-server
```

The MCP package builds a stdio CLI bin named `vallum-mcp` and keeps the
programmatic facade. The runnable MCP package is published on the coordinated
`0.1.1` package line through the npm `latest` dist-tag, and registry install
plus local stdio execution is covered by
`npm run smoke:npm-registry-mcp-stdio-consumer`.

An MCP host can start the server with environment configuration owned by the
host process:

```bash
VALLUM_GATEWAY_URL=https://gateway.example.test \
VALLUM_API_KEY=replace-with-server-side-secret \
npm exec -- vallum-mcp
```

Do not pass API keys as CLI arguments, paste them into agent prompts, or commit
MCP host configuration files containing real values.

For the official package path, use the npm `latest` tag or pin the exact
`0.1.1` version when reproducibility matters.

## Configure

At minimum, an SDK consumer needs:

| Setting | Purpose | Where it belongs |
| --- | --- | --- |
| `VALLUM_GATEWAY_URL` | Base URL for your Vallum-compatible policy gateway. | Backend/server environment. |
| `VALLUM_API_KEY` | App credential accepted by that gateway. | Backend/server secret store. |
| Policy allowlist | Which packages, functions, contracts, gas budgets, agents, and counterparties can be sponsored. | Gateway/operator config. |
| Gas Station upstream config | URL and bearer token for the IOTA Gas Station behind the gateway. | Gateway/operator secret store. |

Browser code should call your own backend routes. It should not receive
Vallum app API keys, Gas Station bearer tokens, sponsor keys, signer
material, raw transaction bytes, user signatures, or local secret paths.

For local repo verification, the demo gateway uses:

```bash
VALLUM_GATEWAY_PORT=8787
VALLUM_GATEWAY_HOST=127.0.0.1
VALLUM_POLICY_PATH=examples/policies/demo-dapp.yaml
VALLUM_DEMO_APP_KEY=local-dev-demo-key
GAS_STATION_URL=http://127.0.0.1:9527
GAS_STATION_BEARER_TOKEN=replace-with-local-gas-station-token
```

For an external app, use your own names such as `VALLUM_API_KEY`; the
`VALLUM_DEMO_APP_KEY` name is only for this repository's demo app.

## Use The SDK

Create the client in backend code:

```ts
import { createVallumClient } from "@vallum/sdk";

const vallum = createVallumClient({
  baseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_API_KEY!,
});
```

Preflight policy before reserving gas:

```ts
const decision = await vallum.simulatePolicy({
  gasBudget: 50_000_000,
  walletAddress: userAddress,
  packageId: "0x...",
  functionName: "mint_badge",
});

if (!decision.allowed) {
  return {
    sponsored: false,
    reasonCode: decision.reasonCode,
    message: decision.message,
  };
}
```

Reserve sponsored gas and return only the safe fields your frontend needs:

```ts
const reservation = await vallum.reserveGas({
  gasBudget: 50_000_000,
  reserveDurationSecs: 30,
  walletAddress: userAddress,
  packageId: "0x...",
  functionName: "mint_badge",
});
```

After the user signs, execute through the gateway:

```ts
const result = await vallum.executeSponsoredTransaction({
  reservationId: reservation.reservationId,
  agentRailTransactionId: reservation.agentRailTransactionId,
  transactionBytes,
  userSignature,
});
```

Do not log raw `transactionBytes` or `userSignature` in normal request paths.

### Use The Generic IOTA Escrow Executor

For escrow-shaped workflows, `@vallum/sdk` exposes a concrete
`IotaEscrowSettlementExecutor` implementation:

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
  signer: settlementSigner,
  contract: { packageId: process.env.VALLUM_ESCROW_PACKAGE_ID! },
  gasBudget: 50_000_000,
  resolveParticipants: resolveEscrowParticipants,
  amountToBaseUnits: resolveEscrowAmountUnits,
});

const settlement = createIotaEscrowSettlementClient({
  executor,
  store: durableEscrowSettlementStore,
});
```

The executor is not tied to any one app. It requires the installing backend or
operator to resolve owner, provider, and verifier IOTA addresses; convert
receipt amounts into non-negative u64-safe contract base units; configure the
Move package/function names; and provide a settlement signer from a server-side
signer or signer service. Live executors should pass an `IotaClient` so the IOTA
SDK builds transaction bytes from the configured Move calls. The
`unsafeBuildTransactionBytesForTesting` option is a unit-test hook only, requires
`allowUnsafeCustomTransactionBuilder: true`, and should not be connected to
untrusted input or production signing paths. Open, release, and refund
transactions still route through Vallum reserve/execute calls, so app
credentials, policy allowlists, gas budgets, and Gas Station sponsorship remain
gateway-owned.

Live or testnet use still requires operator-owned IOTA RPC, signer, gateway,
Gas Station, and policy configuration outside the repo. Local package tests
prove the executor shape and redaction boundary; they do not prove a live
escrow open, release, refund, provider payout, or platform fee settlement.

## Use The MCP Package

The package can be used as a stdio MCP server by a local MCP host after a
version containing `vallum-mcp` is installed:

```json
{
  "mcpServers": {
    "vallum": {
      "command": "vallum-mcp",
      "env": {
        "VALLUM_GATEWAY_URL": "https://gateway.example.test",
        "VALLUM_API_KEY": "replace-with-server-side-secret"
      }
    }
  }
}
```

Those values belong to the MCP host process or local secret store. The LLM or
agent prompt should never receive the API key.

The programmatic facade remains useful for custom tool hosts:

```ts
import { createIotaMcpServer } from "@vallum/mcp-server";

const server = createIotaMcpServer({
  gatewayBaseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_API_KEY!,
});

const tools = server.listTools();
const result = await server.callTool("iota.request_sponsored_transaction", {
  manifest,
});
```

That facade exposes tool descriptors and `callTool()` behavior that routes
through the SDK and policy gateway. It is intentionally not direct IOTA access
and not a bypass around sponsorship policy.

## Prove A Fresh Install

From this repository, the public npm adoption proof is:

```bash
npm run smoke:npm-registry-paid-mcp-consumer
```

That command installs all 11 published packages from npm into a fresh
temporary consumer project, imports package root entrypoints only, and runs the
paid MCP-style approval, policy-denial, failed-payment, receipt, and redaction
checks. It writes a redacted local report to
`tmp/vallum/npm-registry-consumer-proof.json`.

This proves npm registry install/import plus local mock execution. It does not
prove live IOTA execution, production payment settlement, production custody,
marketplace operation, or public A2A hosting.

The local tarball proof for the runnable MCP stdio bin is:

```bash
npm run smoke:package-mcp-stdio-consumer
```

That command installs local tarballs into a fresh temporary consumer, starts
`node_modules/.bin/mcp`, lists tools, and calls approval, denial, and
invalid-input paths against a loopback mock gateway. It proves local package
bin behavior only.

Prove the npm registry MCP path with:

```bash
npm run smoke:npm-registry-mcp-stdio-consumer
```

That command installs the published MCP server package into a fresh temporary
consumer, starts `node_modules/.bin/mcp`, lists tools, and calls
approval, denial, and invalid-input paths against a loopback mock gateway.
It proves registry install plus local MCP stdio execution only.

## Package Map

| Package | Role |
| --- | --- |
| `@vallum/sdk` | Main backend SDK entrypoint. |
| `@vallum/mcp-server` | MCP stdio server bin and programmatic facade for agent tool integrations. |
| `@vallum/policy-gateway` | Local policy evaluation and mock gateway helpers. |
| `@vallum/manifest` | Agent Transaction Manifest validation and fixtures. |
| `@vallum/receipts` | Receipt state and event-chain helpers. |
| `@vallum/accounts` | Agent account and signer-reference primitives. |
| `@vallum/registry` | Agent profile, Names, Identity, and VC-facing registry helpers. |
| `@vallum/contracts-metadata` | Contract template metadata and allowlist evidence. |
| `@vallum/standards` | Standards bridges for A2A, AP2, and x402-shaped local proof. |
| `@vallum/marketplace` | Local marketplace read model and readiness helpers. |
| `@vallum/shared-types` | Shared request/response types. |

## Boundaries

This prerelease proves package installation, local SDK/gateway behavior,
manifest validation, receipt evidence, policy denial, failed-payment
withholding, local tarball MCP stdio bin execution, and redaction markers.

It does not claim:

- stable package release status;
- live IOTA sponsorship from the npm package alone;
- production payment-provider settlement;
- production signer custody or KMS integration;
- production marketplace operation;
- public A2A hosting or external conformance.

Those are separate operator-gated slices.
