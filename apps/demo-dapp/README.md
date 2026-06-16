# AgentRail Demo dApp

This app is the deterministic local demo surface for the public AgentRail SDK and policy gateway. It intentionally uses placeholder transaction bytes/signatures and a mock/local gateway path so reviewers can run the browser and CLI proof without real IOTA network access, sponsor keys, Docker, deployment, or private prototype dependencies.

## Local flow

The deterministic local flow is:

1. A local mock Gas Station upstream is started by the smoke command.
2. The policy gateway starts on a loopback dynamic port using `examples/policies/demo-dapp.yaml`.
3. The demo dApp creates a `@sacredlabs/agentrail-sdk` client with the local app key.
4. The demo reserves gas for `0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0::mint_badge`.
5. The demo submits placeholder transaction bytes and a placeholder user signature through the gateway.
6. The mock upstream returns a transaction digest.
7. The smoke command asserts that no credentials are printed and that upstream reserve/execute requests have the expected method, path, auth, and body shape.

Run the end-to-end local smoke from the repo root:

```bash
npm run smoke:demo-dapp
```

Expected output ends with:

```text
AgentRail demo dApp local flow passed
```

## Minimal browser wrapper

The browser wrapper is a small loopback-only HTTP server that serves a page plus a same-origin `/api/run-demo` endpoint. The browser never receives the app key; the local server keeps `AGENTRAIL_DEMO_APP_KEY` server-side and returns sanitized success/error JSON. Cross-origin POST attempts and non-empty request bodies are rejected before any gateway call.

Run the browser-wrapper smoke from the repo root:

```bash
npm run smoke:demo-browser
```

Expected output ends with:

```text
AgentRail demo dApp browser smoke passed
```

## Running against an already-started local gateway

If you have started the policy gateway yourself, run the CLI flow:

```bash
AGENTRAIL_GATEWAY_URL=http://127.0.0.1:8787 \
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key \
npm run dev -w @sacredlabs/agentrail-demo-dapp
```

Or start the browser wrapper:

```bash
AGENTRAIL_GATEWAY_URL=http://127.0.0.1:8787 \
AGENTRAIL_DEMO_APP_KEY=local-dev-demo-key \
npm run browser -w @sacredlabs/agentrail-demo-dapp
```

Then open `http://127.0.0.1:8788`.

The default values are for local development only. Do not commit real API keys, bearer tokens, sponsor keys, transaction signatures, or `.env` files.

## Scope boundary

This is not a production browser dApp and its smoke tests do not submit a real testnet transaction. It remains the safe local integration bridge between the SDK, policy gateway, browser wrapper, and demo dApp. The separate opt-in live proof is `npm run execute:testnet-demo`, documented in `docs/testnet-attempts.md`, and must only be run with operator-controlled testnet credentials, passing local runtime preflight, a current passing upstream diagnostic report, and explicit operator intent.
