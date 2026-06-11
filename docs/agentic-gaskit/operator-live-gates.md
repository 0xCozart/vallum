# Operator Live Gates

`npm run proof:operator-gates` is a non-networked operator runbook for the
remaining Agentic GasKit live and production gates.

It reads the product-status proof and classifies each gate as:

- `proven-local` for deterministic local evidence that is already wired;
- `ready-to-run` for non-networked commands that can run once local config is
  present;
- `blocked-config` for missing or failing local testnet, upstream diagnostic,
  IOTA Names, IOTA Identity, or VC trust-policy configuration;
- `requires-approval` for live endpoint, registry, payment, public hosting,
  marketplace, custody, or device gates that need explicit operator approval or
  a dedicated slice;
- `blocked-production` for production claims without enough design or proof;
- `deferred-safety` for physical-device access until a separate safety design
  is approved.

Run it from the repository root:

```bash
npm run proof:operator-gates
```

Expected status in an unconfigured checkout:

```text
Agentic GasKit operator live gates blocked
allGatesClear=false
```

The command exits successfully when it can produce the report. It does not
contact IOTA, IOTA Names, IOTA Identity, npm, payment providers, public A2A
hosts, marketplace systems, or physical devices.

## What It Helps With

- Shows which local proof gates are already configured.
- Shows that fast iteration remains separate from the full local proof gate.
- Shows whether testnet readiness is blocked by missing local config.
- Separates rendered local Gas Station config from local Docker runtime
  readiness using the `gas-station-runtime` preflight gate, including the
  direct Docker fallback when Compose is unavailable.
- Separates local testnet `.env` readiness from live Gas Station upstream
  readiness using the sanitized `testnet-upstream` diagnostic report gate.
- Shows which live smokes would contact external services and require explicit
  operator intent.
- Keeps package publication, public A2A hosting, live payment/provider proof,
  production marketplace, custody, and physical-device access out of automatic
  local verification claims.
- Points public A2A hosting/conformance review at the non-networked
  `npm run proof:a2a-public-readiness` command before any public endpoint is
  probed, then at `npm run smoke:a2a-public-discovery` only after
  operator-approved public HTTPS configuration exists.
- Reports command names and next gates without printing configured endpoints,
  profile paths, names, addresses, credentials, tokens, or secret-like values.

## What It Does Not Do

- It does not run `npm run smoke:iota-names-live`.
- It does not run `npm run smoke:iota-identity-live`.
- It does not start Docker, Redis, or Gas Station containers.
- It does not run `npm run diagnose:gas-station`.
- It does not run `npm publish`.
- It does not operate public A2A hosting, live payment providers, production
  marketplace flows, production custody, or physical devices.
- It does not change `launchReady=false` while product-status blockers remain.

## Next Commands

Use this report with the other proof gates:

```bash
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:testnet-digest
npm run proof:testnet-digest:live
npm run proof:a2a-public-readiness
npm run smoke:a2a-public-discovery
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run readiness:testnet
npm run gas-station:render-config
npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
```

Only run live commands after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
