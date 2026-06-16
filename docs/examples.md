# Code Examples

These examples show the intended integration shape. The app backend owns the Vallum API key. Browser code talks to your backend, not directly to IOTA Gas Station and not directly to a sponsor wallet.

## Backend SDK Setup

```ts
import { createVallumClient } from "@vallum/sdk";

const vallum = createVallumClient({
  baseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_DEMO_APP_KEY!,
});
```

Use a real secret name in your app, such as `VALLUM_API_KEY`. The demo key name is used in this repo because the local example app is named `demo-dapp`.

## Preflight Policy Before Reserving Gas

Use policy simulation when you want to tell the user whether sponsorship is available before creating a reservation.

```ts
const decision = await vallum.simulatePolicy({
  gasBudget: 50_000_000,
  walletAddress: userAddress,
  packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
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

Simulation uses app authentication and policy checks. It does not reserve sponsor gas, mutate quota counters, submit to IOTA, or emit reserve/execute events.

## Reserve Sponsor Gas

After policy passes and the user is ready to sign, reserve sponsor gas from your backend.

```ts
const reservation = await vallum.reserveGas({
  gasBudget: 50_000_000,
  reserveDurationSecs: 30,
  walletAddress: userAddress,
  packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
  functionName: "mint_badge",
});

return {
  reservationId: reservation.reservationId,
  agentRailTransactionId: reservation.agentRailTransactionId,
  sponsorAddress: reservation.sponsorAddress,
};
```

Return only the fields your frontend needs. Do not return Gas Station bearer tokens, app API keys, raw upstream bodies, or local secret paths.

## Execute With the User Signature

The user still signs the transaction. Your backend receives the signed transaction bytes/signature and calls Vallum.

```ts
const result = await vallum.executeSponsoredTransaction({
  reservationId,
  agentRailTransactionId,
  transactionBytes,
  userSignature,
});

return {
  digest: result.digest,
};
```

Do not log raw `transactionBytes` or `userSignature` in the default path. If an operator needs debug logging, keep it behind an explicit secure debug mode outside normal docs and examples.

## Next.js Route Shape

This is the basic server route pattern. The browser calls `/api/vallum/reserve`; the route calls Vallum with a server-owned key.

```ts
// app/api/vallum/reserve/route.ts
import { createVallumClient } from "@vallum/sdk";

const vallum = createVallumClient({
  baseUrl: process.env.VALLUM_GATEWAY_URL!,
  apiKey: process.env.VALLUM_API_KEY!,
});

export async function POST(request: Request) {
  const body = await request.json();

  const reservation = await vallum.reserveGas({
    gasBudget: body.gasBudget,
    reserveDurationSecs: 30,
    walletAddress: body.walletAddress,
    packageId: body.packageId,
    functionName: body.functionName,
  });

  return Response.json({
    reservationId: reservation.reservationId,
    agentRailTransactionId: reservation.agentRailTransactionId,
    sponsorAddress: reservation.sponsorAddress,
  });
}
```

The maintained example in `examples/nextjs-api-route` adds validation, method checks, safe error mapping, and deterministic tests. Use that example before copying this minimal shape into a real app.

## Browser Caller

The browser sends user-visible metadata to your backend. It does not receive the Vallum app key.

```ts
const reserveResponse = await fetch("/api/vallum/reserve", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    gasBudget: 50_000_000,
    walletAddress: connectedWalletAddress,
    packageId: "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
    functionName: "mint_badge",
  }),
});

const reservation = await reserveResponse.json();
```

After the user signs, call your execute route:

```ts
await fetch("/api/vallum/execute", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    reservationId: reservation.reservationId,
    agentRailTransactionId: reservation.agentRailTransactionId,
    transactionBytes,
    userSignature,
  }),
});
```

## Gateway Curl Examples

These commands are useful when manually checking a local gateway.

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/policy/simulate \
  -H "authorization: Bearer ${VALLUM_DEMO_APP_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "gas_budget": 50000000,
    "wallet_address": "0xUSER",
    "package_id": "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
    "function_name": "mint_badge"
  }'
```

```bash
curl -i \
  -X POST http://127.0.0.1:8787/v1/reserve_gas \
  -H "authorization: Bearer ${VALLUM_DEMO_APP_KEY}" \
  -H "content-type: application/json" \
  -d '{
    "gas_budget": 50000000,
    "reserve_duration_secs": 30,
    "wallet_address": "0xUSER",
    "package_id": "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0",
    "function_name": "mint_badge"
  }'
```

Missing or invalid app credentials should fail before the request reaches IOTA Gas Station.

## Agent-Safe Paid MCP Tool Demo

The narrow agent-safe sponsored execution path is the local paid MCP-style tool
demo:

```bash
npm run smoke:paid-mcp-tool
```

This command runs from the repo root, builds the workspace, starts an in-process
mock policy gateway, and calls it through the SDK. It contacts no IOTA RPC,
IOTA Gas Station, testnet, mainnet, paid API, custody provider, payment
provider, or public A2A endpoint.

The formatted output is intentionally structured for review. It shows:

- `boundary.localOnly=true` and `boundary.route=SDK->mock-policy-gateway`;
- the action intent `pay_per_call.request_call` for `premium_analysis`;
- `manifest.signerReference.internal=true` and
  `manifest.signerReference.exposed=false`;
- `approved.status=completed` plus the approved receipt event chain;
- `denied.reason=GAS_BUDGET_TOO_HIGH` for the policy denial path;
- `failedPayment.reason=mock-payment-failed` for the non-policy failure path;
- redaction markers for API keys, raw transaction bytes, and user signatures.

The demo proves local SDK, manifest, mock policy-gateway, payment-gating,
receipt, denial, and redaction behavior. It is not live/testnet sponsorship
proof and does not imply production payment-provider, custody, marketplace, or
public A2A readiness.

## Policy YAML Example

The demo policy keeps sponsorship narrow: one app, one package ID, two functions, a max gas budget, per-wallet limits, and an empty denylist.

```yaml
apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    status: active
    daily_budget_iota: 10
    daily_request_limit: 1000
    max_requests_per_wallet_per_day: 25
    max_gas_budget_per_tx: 50000000
    allowed_packages:
      - "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0"
    allowed_functions:
      - "mint_badge"
      - "free_trial"
    denied_wallets: []
```

## Full Maintained Examples

- `examples/node-backend`: framework-neutral backend handlers with safe response projection.
- `examples/nextjs-api-route`: Next.js-compatible route helpers with validation and tests.
- `apps/demo-dapp`: local CLI and browser-wrapper demo flows using the public SDK.
- `examples/paid-mcp-tool`: local agent-safe paid MCP-style tool demo with
  approval, policy denial, failed-payment, receipt, and redaction proof.

Run the maintained example tests with:

```bash
node --import tsx --test examples/node-backend/backend.test.ts
node --import tsx --test examples/nextjs-api-route/route.test.ts
npm run smoke:demo-dapp
npm run smoke:demo-browser
npm run smoke:paid-mcp-tool
```
