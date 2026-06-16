# Package Integration Guide

AgentRail is IOTA-native infrastructure for agent-safe sponsored execution. It
helps an app backend or agent runtime request an IOTA action through policy,
manifests, signer references, and receipts without exposing sponsor secrets to
the browser or to an autonomous agent.

AgentRail is not only an MCP server. MCP is one adapter surface for agent
runtimes. The core library is broader: SDK calls, policy-gateway routing,
manifest validation, signer-reference safety, receipt evidence, contract
workflow helpers, and operator proof gates.

## What AgentRail Does

AgentRail gives builders a safer path for sponsored IOTA actions:

- a backend or agent runtime describes the intended action in a manifest;
- policy checks decide whether the action can be sponsored;
- signer references identify scoped signing capability without exposing raw
  key material;
- the SDK routes value-bearing requests through an AgentRail-compatible policy
  gateway;
- receipts record approval, denial, payment failure, sponsorship, submission,
  and completion evidence;
- operator proof commands separate local proof from live IOTA, production
  payment, custody, marketplace, and public A2A claims.

Use AgentRail when you need a controlled sponsored-execution boundary. Do not
use it as a seed-export wallet, custody service, token project, marketplace
first product, or replacement for the official IOTA Gas Station.

## Why It Exists

IOTA Gas Station solves the sponsorship primitive: a sponsor can pay gas for a
transaction. AgentRail adds the surrounding safety and developer layer that
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
AgentRail dependencies automatically.

| User | Install | Use this for |
| --- | --- | --- |
| App/backend developer | `@sacredlabs/agentrail-sdk@next` | Calling an AgentRail-compatible gateway from backend code. |
| Agent runtime integrator | `@sacredlabs/agentrail-sdk@next` for backend/tool-host code; `@sacredlabs/agentrail-mcp-server@next` after the next MCP package publish for stdio MCP hosts | Building an agent integration that still routes through policy and manifests. |
| Policy/gateway operator | `@sacredlabs/agentrail-policy-gateway@next` | Evaluating local sponsorship policy or building a gateway service. |
| Advanced package consumer | Lower-level packages such as `manifest`, `receipts`, `registry`, `standards`, or `accounts` | Specialized integrations that need direct primitives. |

Do not install all 11 packages manually unless you are developing AgentRail
itself or building an advanced integration. The published packages are split
so the SDK, gateway, MCP facade, marketplace read model, and lower-level
primitives can evolve independently.

## Install

The current prerelease is published under `@sacredlabs/agentrail-*`:

```bash
npm install @sacredlabs/agentrail-sdk@next
```

This installs the backend SDK and the lower-level manifest, registry, receipt,
and shared type packages it depends on.

If you are experimenting with the MCP package:

```bash
npm install @sacredlabs/agentrail-mcp-server@next
```

This source tree now builds a stdio CLI bin named `agentrail-mcp` and keeps the
programmatic facade. The already-published `0.0.0-prerelease` package predates
that bin. The reviewed source version for the runnable MCP package is
`0.0.1-mcp.0`, but registry install proof for the runnable MCP entrypoint
remains blocked until that version is published and verified from npm.

After that publication, an MCP host can start the server with environment
configuration owned by the host process:

```bash
AGENTRAIL_GATEWAY_URL=https://gateway.example.test \
AGENTRAIL_API_KEY=replace-with-server-side-secret \
npm exec -- agentrail-mcp
```

Do not pass API keys as CLI arguments, paste them into agent prompts, or commit
MCP host configuration files containing real values.

The package set was published with `tag=next`. npm also currently exposes
`latest=0.0.0-prerelease` for this first package set after rejecting a
`latest` dist-tag deletion. Use `@next` or the exact `@0.0.0-prerelease`
version until a stable release exists.

## Configure

At minimum, an SDK consumer needs:

| Setting | Purpose | Where it belongs |
| --- | --- | --- |
| `AGENTRAIL_GATEWAY_URL` | Base URL for your AgentRail-compatible policy gateway. | Backend/server environment. |
| `AGENTRAIL_API_KEY` | App credential accepted by that gateway. | Backend/server secret store. |
| Policy allowlist | Which packages, functions, contracts, gas budgets, agents, and counterparties can be sponsored. | Gateway/operator config. |
| Gas Station upstream config | URL and bearer token for the IOTA Gas Station behind the gateway. | Gateway/operator secret store. |

Browser code should call your own backend routes. It should not receive
AgentRail app API keys, Gas Station bearer tokens, sponsor keys, signer
material, raw transaction bytes, user signatures, or local secret paths.

For local repo verification, the demo gateway uses:

```bash
AGENTRAIL_GATEWAY_PORT=8787
AGENTRAIL_GATEWAY_HOST=127.0.0.1
AGENTRAIL_POLICY_PATH=examples/policies/demo-dapp.yaml
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key
GAS_STATION_URL=http://127.0.0.1:9527
GAS_STATION_BEARER_TOKEN=replace-with-local-gas-station-token
```

For an external app, use your own names such as `AGENTRAIL_API_KEY`; the
`AGENTRAIL_DEMO_APP_KEY` name is only for this repository's demo app.

## Use The SDK

Create the client in backend code:

```ts
import { createAgentRailClient } from "@sacredlabs/agentrail-sdk";

const agentrail = createAgentRailClient({
  baseUrl: process.env.AGENTRAIL_GATEWAY_URL!,
  apiKey: process.env.AGENTRAIL_API_KEY!,
});
```

Preflight policy before reserving gas:

```ts
const decision = await agentrail.simulatePolicy({
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
const reservation = await agentrail.reserveGas({
  gasBudget: 50_000_000,
  reserveDurationSecs: 30,
  walletAddress: userAddress,
  packageId: "0x...",
  functionName: "mint_badge",
});
```

After the user signs, execute through the gateway:

```ts
const result = await agentrail.executeSponsoredTransaction({
  reservationId: reservation.reservationId,
  agentRailTransactionId: reservation.agentRailTransactionId,
  transactionBytes,
  userSignature,
});
```

Do not log raw `transactionBytes` or `userSignature` in normal request paths.

## Use The MCP Package

The package can be used as a stdio MCP server by a local MCP host after a
version containing `agentrail-mcp` is installed:

```json
{
  "mcpServers": {
    "agentrail": {
      "command": "agentrail-mcp",
      "env": {
        "AGENTRAIL_GATEWAY_URL": "https://gateway.example.test",
        "AGENTRAIL_API_KEY": "replace-with-server-side-secret"
      }
    }
  }
}
```

Those values belong to the MCP host process or local secret store. The LLM or
agent prompt should never receive the API key.

The programmatic facade remains useful for custom tool hosts:

```ts
import { createIotaMcpServer } from "@sacredlabs/agentrail-mcp-server";

const server = createIotaMcpServer({
  gatewayBaseUrl: process.env.AGENTRAIL_GATEWAY_URL!,
  apiKey: process.env.AGENTRAIL_API_KEY!,
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
`tmp/agentrail/npm-registry-consumer-proof.json`.

This proves npm registry install/import plus local mock execution. It does not
prove live IOTA execution, production payment settlement, production custody,
marketplace operation, or public A2A hosting.

The local tarball proof for the runnable MCP stdio bin is:

```bash
npm run smoke:package-mcp-stdio-consumer
```

That command installs local tarballs into a fresh temporary consumer, starts
`node_modules/.bin/agentrail-mcp`, lists tools, and calls approval, denial, and
invalid-input paths against a loopback mock gateway. It does not prove registry
availability until a new package version is published and separately checked.

After publishing a version that contains the `agentrail-mcp` bin, prove the npm
registry path with:

```bash
npm run smoke:npm-registry-mcp-stdio-consumer
```

That command installs the published MCP server package into a fresh temporary
consumer, starts `node_modules/.bin/agentrail-mcp`, lists tools, and calls
approval, denial, and invalid-input paths against a loopback mock gateway.
It proves registry install plus local MCP stdio execution only.

## Package Map

| Package | Role |
| --- | --- |
| `@sacredlabs/agentrail-sdk` | Main backend SDK entrypoint. |
| `@sacredlabs/agentrail-mcp-server` | MCP stdio server bin and programmatic facade for agent tool integrations. |
| `@sacredlabs/agentrail-policy-gateway` | Local policy evaluation and mock gateway helpers. |
| `@sacredlabs/agentrail-manifest` | Agent Transaction Manifest validation and fixtures. |
| `@sacredlabs/agentrail-receipts` | Receipt state and event-chain helpers. |
| `@sacredlabs/agentrail-accounts` | Agent account and signer-reference primitives. |
| `@sacredlabs/agentrail-registry` | Agent profile, Names, Identity, and VC-facing registry helpers. |
| `@sacredlabs/agentrail-contracts-metadata` | Contract template metadata and allowlist evidence. |
| `@sacredlabs/agentrail-standards` | Standards bridges for A2A, AP2, and x402-shaped local proof. |
| `@sacredlabs/agentrail-marketplace` | Local marketplace read model and readiness helpers. |
| `@sacredlabs/agentrail-shared-types` | Shared request/response types. |

## Boundaries

This prerelease proves package installation, local SDK/gateway behavior,
manifest validation, receipt evidence, policy denial, failed-payment
withholding, local tarball MCP stdio bin execution, and redaction markers.

It does not claim:

- stable package release status;
- registry availability for the new MCP server binary before the next publish;
- live IOTA sponsorship from the npm package alone;
- production payment-provider settlement;
- production signer custody or KMS integration;
- production marketplace operation;
- public A2A hosting or external conformance.

Those are separate operator-gated slices.
