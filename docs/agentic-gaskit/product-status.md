# Product Status Proof

`npm run proof:product-status` is a non-networked proof-boundary command for
Agentic GasKit.

It does not contact IOTA services, publish packages, run payment providers, or
operate public A2A endpoints. Instead, it reports the current product evidence
surface in one machine-checkable place:

- local verification and package release gates that are configured in this
  checkout;
- documented public testnet digest evidence wiring;
- A2A public-readiness wiring for local proof, local authenticated extended
  Agent Card access, local public JWKS serving, local static discovery bundle
  generation, local static discovery artifact writing and validation, local
  static discovery loopback host smoke, local static hosting review, local loopback streaming, local push
  notification configuration, local injected push delivery, local opt-in push
  HTTP transport, callback URL admission hardening, callback host allowlisting,
  local retry/attempt observability, local durable attempt evidence, local
  delivery queueing, a local injected-transport worker, public hosting inputs,
  redacted structured public discovery report classification, redacted
  structured public push delivery report classification, and structured
  external conformance blockers;
- opt-in public A2A discovery/JWKS smoke wiring for operator-approved public
  HTTPS configuration, kept outside default local verification, with optional
  structured discovery report output;
- verification-profile wiring that keeps fast iteration separate from the full
  local evidence gate;
- payment-provider readiness wiring that checks local x402/AP2 source and test
  proof, then accepts only an operator-supplied redacted structured report path
  before moving live payment/provider evidence to manual review;
- payment-provider proof-plan wiring that writes a redacted non-networked
  command/report checklist before any operator-approved x402/AP2 provider proof
  is attempted;
- package-publication readiness wiring that checks local package release docs,
  pack dry-runs, tarball install smoke, opt-in publish dry-run, and accepts only
  an operator-supplied redacted structured npm publication report path before
  moving registry evidence to manual review;
- launch-readiness evidence matrix and operator live-gate runbook wiring;
- live/testnet readiness, local Gas Station runtime preflight status,
  sanitized testnet upstream diagnostic report status, IOTA Names, IOTA
  Identity, and VC proof status from `npm run proof:live-status`;
- production-only blockers such as npm registry publication, public A2A
  hosting, live payment/provider settlement, production marketplace operation,
  production custody, and physical device access.

Run it from the repository root:

```bash
npm run proof:product-status
```

Expected status in an unconfigured checkout:

```text
Agentic GasKit product status not-complete
localProofOk=true
complete=false
```

The command exits successfully when it can produce the audit report, even when
the product is not complete. Treat `complete=false` as the important claim
boundary: it means the current repo has deterministic local proof but still
requires configured live/testnet, registry, public hosting, payment, custody,
marketplace, or safety work before those claims can be made.

## What It Proves

- `npm run verify:local` is wired to deterministic local tests, Move tests,
  local smokes, package checks, verification-profile audit, docs, secrets, and
  product evidence gates.
- `npm run verify:fast` exists for bounded deterministic iteration and is not
  treated as launch evidence by itself.
- Package release proof remains local: pack dry-runs, local tarball
  install/import, opt-in publish dry-run, and a non-networked package
  publication readiness gate.
- Live/testnet gates are either ready to run with safe local configuration,
  local Gas Station runtime prerequisites, and sanitized upstream evidence, or
  blocked with exact missing/runtime/report check ids.
- Production and safety claims remain explicit blockers instead of implied
  roadmap completion.

## What It Does Not Prove

- Real npm publication or registry installation unless
  `npm run proof:package-publication-readiness` validates an ignored structured
  report and the operator manually accepts it.
- Fresh sponsored IOTA testnet execution unless `testnet-readiness`,
  `gas-station-runtime`, and `testnet-upstream` are ready and
  `npm run execute:testnet-demo` passes with explicit operator intent.
- Live IOTA Names, IOTA Identity, VC, payment, or A2A proof unless the
  corresponding opt-in live command is configured and passes.
- Live x402/AP2 facilitator, processor, or settlement proof unless
  `npm run proof:payment-provider-readiness` validates an ignored structured
  report and the operator manually accepts it.
- Public A2A hosting, production key management, external conformance, public
  push delivery, or production auth decisions.
- Production marketplace, provider verification, moderation, public scoring, or
  live settlement.
- Production custody, KMS, recovery export, staking, bonding, slashing, or
  physical device access.

## Next Commands

Use the audit output to choose the next gate:

```bash
npm run verify:local
npm run verify:fast
npm run proof:testnet-digest
npm run proof:testnet-digest:live
npm run gas-station:render-config
npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>
npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run smoke:a2a-static-discovery-local -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run proof:a2a-public-readiness
npm run proof:package-publication-readiness
npm run proof:payment-provider-readiness
npm run payment:write-provider-proof-plan -- --out tmp/gaskit/payment-provider-proof-plan.json
npm run proof:verification-profiles
npm run proof:live-status
npm run proof:launch-readiness
npm run proof:operator-gates
npm run readiness:testnet
```

Only run live commands that contact IOTA services or spend sponsored testnet gas
after operator-owned local credentials are configured outside the repo and the
operator explicitly intends to run that proof.
