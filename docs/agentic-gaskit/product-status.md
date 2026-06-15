# Product Status Proof

`npm run proof:product-status` is a non-networked proof-boundary command for
Agentic GasKit.

It does not contact IOTA services, publish packages, run payment providers, or
operate public A2A endpoints. Instead, it reports the current product evidence
surface in one machine-checkable place:

- local verification and package release gates that are configured in this
  checkout;
- documented sponsored IOTA testnet execute digest evidence wiring;
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
- public A2A readiness aggregation that moves `public-a2a-hosting` to
  `ready-live` only when public URL, JWKS, task-auth, public discovery, public
  push delivery, and external conformance checks are all either local proof or
  `ready-approval` structured evidence;
- verification-profile wiring that keeps fast iteration separate from the full
  local evidence gate;
- payment-provider readiness wiring that checks local x402/AP2 source and test
  proof, then accepts only an operator-supplied redacted structured report path
  before moving live payment/provider evidence to manual review, with an
  optional redacted mode-600 local readiness artifact for audit snapshots;
- payment-provider proof-plan wiring that writes a redacted non-networked
  command/report checklist with kind
  `agentic-gaskit.payment-provider-proof-plan` before any operator-approved
  x402/AP2 provider proof is attempted;
- package-publication readiness wiring that checks local package release docs,
  pack dry-runs, tarball install smoke, opt-in publish dry-run, and accepts only
  an operator-supplied redacted structured npm publication report path before
  moving registry evidence to manual review;
- package-publication proof-plan wiring that writes a redacted non-networked
  command/report checklist before any operator-approved npm publication proof
  is attempted;
- marketplace readiness wiring that checks local read-model source, docs,
  tests, smoke wiring, and accepts only an operator-supplied redacted structured
  production marketplace report path before moving marketplace evidence to
  manual review, with an optional redacted mode-600 local readiness artifact
  for audit snapshots;
- marketplace-production proof-plan wiring that writes a redacted non-networked
  command/report checklist before any operator-approved production marketplace
  review is attempted;
- custody readiness wiring that checks local signer-reference account source,
  docs, tests, build coverage, and accepts only an operator-supplied redacted
  structured production custody report path before moving custody evidence to
  manual review, with an optional redacted mode-600 local readiness artifact
  for audit snapshots;
- custody-production proof-plan wiring that writes a redacted non-networked
  command/report checklist before any operator-approved custody, KMS, recovery,
  legal, or incident-response review is attempted;
- operator report-template wiring that writes ignored local structured JSON
  templates for package publication, payment-provider, marketplace, custody,
  and public A2A reports while keeping `result=pending-operator-proof` until a
  real approved proof run fills in passing evidence;
- launch-readiness evidence matrix and operator live-gate runbook wiring;
- live/testnet readiness, local Gas Station runtime preflight status,
  sanitized testnet upstream diagnostic report status, IOTA Names, IOTA
  Identity, and VC proof status from `npm run proof:live-status`;
- production-only blockers such as npm registry publication, public A2A
  hosting, live payment/provider settlement, production marketplace operation,
  production custody, and physical device access when their accepted structured
  reports or safety approvals are still missing.

Run it from the repository root:

```bash
npm run proof:product-status
```

For a redacted machine-readable artifact, use:

```bash
npm run proof:product-status -- --json
npm run proof:product-status -- --out tmp/gaskit/product-status.json
```

The `--out` file is written with mode `600`. It is a local audit artifact, not
passing evidence by itself, and it must stay outside committed files.

To aggregate product-status, launch-readiness, and operator live-gate state
into a single redacted completion audit, use:

```bash
npm run proof:roadmap-completion
npm run proof:roadmap-completion -- --out tmp/gaskit/roadmap-completion-audit.json
```

The roadmap completion audit is also non-networked. It keeps
`roadmapComplete=false` until product status, launch readiness, and operator
live gates are all clear; it does not replace any live/testnet, publication,
public A2A, payment, marketplace, custody, or safety proof.

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

For production blockers with existing report-template and proof-plan writers,
the `next` guidance starts with the matching ignored
`operator:write-report-template` command, then points at the redacted local
plan command before any approval-required publication, public A2A,
payment-provider, marketplace, or custody proof run. Templates and proof plans
are operator preparation artifacts; they are not passing production evidence by
themselves.

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
  local Docker or explicit managed-upstream Gas Station runtime prerequisites,
  and sanitized upstream evidence, or blocked with exact missing/runtime/report
  check ids plus redacted evidence labels.
- Sponsored testnet execution is represented by a dedicated
  `testnet-sponsored-execute` check that accepts only documented public digest
  evidence, with optional read-only live digest lookup kept in the separate
  `npm run proof:testnet-digest:live` command. When that lookup is written to
  an ignored report and referenced with `GASKIT_TESTNET_DIGEST_REPORT`,
  product status can accept the current successful lookup without contacting
  IOTA RPC itself.
- Production and safety claims remain explicit blockers instead of implied
  roadmap completion.
- Structured report templates can be generated locally without contacting live
  services, and they are intentionally not passing evidence until an approved
  proof run updates them.

For live/testnet report-backed gates, product status preserves the fixed
redacted evidence labels emitted by `npm run proof:live-status`, such as
`sponsor-funding-report-loaded-redacted` or
`testnet-upstream-report-valid-redacted`. These labels are deliberately not
local paths, endpoint values, addresses, profile paths, tokens, or raw response
content.

## What It Does Not Prove

- Real npm publication or registry installation unless
  `npm run proof:package-publication-readiness` validates an ignored structured
  report and the operator manually accepts it.
- A new sponsored IOTA testnet execution unless `testnet-readiness`,
  `gas-station-runtime`, `sponsor-funding`, `testnet-upstream`, and
  `testnet-sponsored-execute` are ready. `testnet-sponsored-execute` means the
  public digest is documented locally or verified by the opt-in read-only lookup;
  rerunning `npm run execute:testnet-demo` still requires explicit operator
  intent. Managed-upstream runtime mode only satisfies the runtime prerequisite;
  it does not replace the required passing upstream diagnostic report.
- Live IOTA Names, IOTA Identity, VC, payment, or A2A proof unless the
  corresponding opt-in live command is configured and passes.
- Live x402/AP2 facilitator, processor, or settlement proof unless
  `npm run proof:payment-provider-readiness` validates an ignored structured
  report and the operator manually accepts it.
- Public A2A hosting, production key management, external conformance, public
  push delivery, or production auth decisions unless
  `npm run proof:a2a-public-readiness` validates the required public
  configuration and ignored structured reports and the operator manually
  accepts them.
- Any operator report template by itself. Templates remain
  `pending-operator-proof` and do not clear readiness blockers.
- Production marketplace, provider verification, moderation, public scoring, or
  live settlement unless `npm run proof:marketplace-readiness` validates an
  ignored structured report and the operator manually accepts it.
- Production custody, KMS, recovery export, staking, bonding, or slashing
  unless `npm run proof:custody-readiness` validates an ignored structured
  report and the operator manually accepts it.
- Physical device access.

## Next Commands

Use the audit output to choose the next gate:

```bash
npm run verify:local
npm run verify:fast
npm run proof:product-status -- --out tmp/gaskit/product-status.json
npm run proof:roadmap-completion -- --out tmp/gaskit/roadmap-completion-audit.json
npm run proof:testnet-digest
npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json
npm run gas-station:render-config
npm run gas-station:runtime-preflight
GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>
npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run smoke:a2a-static-discovery-local -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json
npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json
npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json
npm run a2a:write-public-proof-plan -- --out tmp/gaskit/a2a-public-proof-plan.json
npm run a2a:write-public-proof-bundle -- --out tmp/gaskit/a2a-public-proof-bundle.json
npm run proof:a2a-public-readiness
npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json
npm run proof:package-publication-readiness
npm run package:write-publication-proof-plan -- --out tmp/gaskit/package-publication-proof-plan.json
npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json
npm run proof:payment-provider-readiness
npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json
npm run proof:marketplace-readiness
npm run marketplace:write-production-proof-plan -- --out tmp/gaskit/marketplace-production-proof-plan.json
npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json
npm run proof:custody-readiness
npm run custody:write-production-proof-plan -- --out tmp/gaskit/custody-production-proof-plan.json
npm run payment:write-provider-proof-plan -- --out tmp/gaskit/payment-provider-proof-plan.json
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
npm run gas-station:docker-direct -- --status
npm run sponsor:write-funding-request -- --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:request-faucet-funds -- --execute --out tmp/gaskit/sponsor-faucet-request.json
npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json
npm run proof:verification-profiles
npm run proof:live-status
npm run proof:launch-readiness
npm run proof:operator-gates
npm run readiness:testnet
```

Only run live commands that contact IOTA services or spend sponsored testnet gas
after operator-owned local credentials are configured outside the repo and the
operator explicitly intends to run that proof.
