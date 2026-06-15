# Operator Live Gates

`npm run proof:operator-gates` is a non-networked operator runbook for the
remaining Agentic GasKit live and production gates.

It reads the product-status proof and classifies each gate as:

- `proven-local` for deterministic local evidence that is already wired;
- `ready-to-run` for non-networked commands that can run once local config is
  present;
- `ready-approval` for valid ready-live evidence or structured reports that are
  ready for manual operator review but still approval-required;
- `blocked-config` for missing or failing local testnet, upstream diagnostic,
  IOTA Names, IOTA Identity, or VC trust-policy configuration;
- `requires-approval` for live endpoint, registry, payment, public hosting,
  marketplace, custody, or device gates that still lack accepted proof and need
  explicit operator approval or a dedicated slice;
- `blocked-production` for production claims without enough design or proof;
- `deferred-safety` for physical-device access until a separate safety design
  is approved.

Run it from the repository root:

```bash
npm run proof:operator-gates
```

To write the same redacted classification as a local JSON artifact for an
operator handoff or live-proof prep session, run:

```bash
npm run operator:write-live-gate-report
```

The artifact is written under `tmp/gaskit/`, which is ignored by Git. It uses
kind `agentic-gaskit.operator-live-gate-report` and contains gate ids, blocker
codes, ready-approval gate ids, approval flags, live-service flags, command
names, messages, and next steps. It does not include configured endpoint
values, names, addresses, profile paths, credentials, tokens, response bodies,
or secret local paths.

To prepare an ignored structured report skeleton for a later approved proof
run, use:

```bash
npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json
```

The template writer is also non-networked. It can write templates for
`testnet-upstream`, `testnet-digest`, `iota-names-live`,
`iota-identity-live`, `vc-validation-live`, `a2a-public-discovery`,
`a2a-public-push-delivery`, `a2a-external-conformance`,
`payment-provider-live`, `package-publication`, `marketplace-production`, and
`custody-production`. Generated templates keep
`result=pending-operator-proof`; a readiness gate will not accept the report
until a real operator-approved proof run replaces that status with passing
evidence.

Production approval report gates validate both unsafe field names and
secret-like string values before a report can become `ready-approval`. Keep
notes, evidence summaries, and operator comments status-only; do not paste
tokens, authorization headers, payment instruments, npm auth material, private
prompts, signer material, raw payloads, or local secret paths into any report.

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
- Lets operators explicitly choose `GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream`
  when a separately managed Gas Station is configured; that skips Docker
  inspection but still leaves upstream reachability and reserve compatibility
  to the sanitized `testnet-upstream` diagnostic report.
- Separates sponsor-wallet testnet balance proof from reserve compatibility
  with the `sponsor-funding` gate. The accepted evidence is a sanitized
  ignored report written by `npm run sponsor:check-funding -- --report
  <ignored-json-path>` and referenced through `GASKIT_SPONSOR_FUNDING_REPORT`.
- Separates local testnet `.env` readiness from live Gas Station upstream
  readiness using the sanitized `testnet-upstream` diagnostic report gate.
- Routes `testnet-sponsored-execute` to `npm run proof:testnet-digest:live --
  --report tmp/gaskit/testnet-digest-proof.json` when a documented digest is
  present, so operators can perform and persist a read-only IOTA testnet lookup
  before deciding whether to refresh sponsored execution. Set
  `GASKIT_TESTNET_DIGEST_REPORT` outside committed files when product-status
  should accept the current successful lookup without contacting IOTA RPC. If
  sponsored execute evidence is missing, the gate points to `npm run
  execute:testnet-demo`, which requires explicit operator intent and can spend
  sponsored testnet gas.
- Points IOTA Names, IOTA Identity, and VC live proof prep at
  `npm run live:write-proof-plan`, a redacted local command-order artifact,
  and `npm run live:write-identity-proof-bundle`, a linked template and
  readiness summary for the identity gates before any live smoke command runs.
- Treats `vc-validation-live` as an approval-required live-service gate because
  it depends on `npm run smoke:iota-identity-live -- --report
  <ignored-json-path>` to produce current credential evidence.
- Includes sponsor funding prep in that proof plan: write the ignored funding
  request first, optionally attempt an approved faucet route, then run the
  read-only sponsor funding diagnostic before upstream reserve compatibility.
  Faucet reports remain optional triage context and cannot clear funding.
- Shows which live smokes would contact external services and require explicit
  operator intent.
- Keeps valid ready-live reports visible as `ready-approval` instead of
  completion blockers. These gates still carry `approvalRequired=true`, but
  their success codes are not treated as missing-proof blocker codes.
- Keeps package publication, public A2A hosting, live payment/provider proof,
  production marketplace, custody, and physical-device access out of automatic
  local verification claims.
- Lets operators prepare public A2A hosting and conformance review with
  `npm run a2a:write-public-proof-plan`, a redacted local plan that lists
  command order, blocker codes, operator input names, and safety boundaries
  before any public endpoint discovery smoke runs. The adjacent
  `npm run a2a:write-public-proof-bundle` command writes that plan, the public
  readiness artifact, and the discovery, push-delivery, and external
  conformance templates together as ignored local artifacts.
- Points package publication review at the non-networked
  `npm run proof:package-publication-readiness` command, which validates local
  package release proof plus an ignored structured npm publication report
  before manual acceptance.
- Lets operators prepare that review with
  `npm run package:write-publication-proof-plan`, a redacted local plan that
  lists package names, command order, required report fields, required check
  ids, approval boundaries, and blocker codes without running real publication.
  The adjacent `npm run package:write-publication-proof-bundle` command writes
  that plan, the publication readiness artifact, and the package-publication
  report template together as ignored local artifacts.
- Points production marketplace review at the non-networked
  `npm run proof:marketplace-readiness` command, which validates local
  marketplace read-model proof plus an ignored structured production
  marketplace report before manual acceptance.
- Lets operators prepare that review with
  `npm run marketplace:write-production-proof-plan`, a redacted local plan that
  lists marketplace review command order, required report fields, required
  check ids, approval boundaries, and blocker codes without contacting
  production marketplace systems.
- Points production custody review at the non-networked
  `npm run proof:custody-readiness` command, which validates local
  signer-reference proof plus an ignored structured custody report before
  manual acceptance.
- Lets operators prepare that review with
  `npm run custody:write-production-proof-plan`, a redacted local plan that
  lists custody review command order, required report fields, required check
  ids, approval boundaries, and blocker codes without contacting KMS, external
  signers, custody providers, or live wallet infrastructure.
- Points live payment/provider review at the non-networked
  `npm run proof:payment-provider-readiness` command, which validates local
  x402/AP2 proof plus an ignored structured report before manual acceptance.
- Lets operators prepare that review with
  `npm run payment:write-provider-proof-plan`, a redacted local plan that lists
  command order, required report fields, approval boundaries, and blocker
  codes without running provider calls.
- Lets operators generate ignored structured report templates with
  `npm run operator:write-report-template -- --kind <kind> --out <path>` so the
  report fields and required check ids match the existing readiness validators
  before any approved live, publication, marketplace, custody, or public A2A
  proof run fills them in.
- Includes those report-template commands directly in the relevant
  `proof:operator-gates` command field, so the operator path starts with an
  ignored template before the proof-plan, readiness, live-smoke, diagnostic, or
  publication command that can produce or validate accepted evidence.
- Includes a `testnet-upstream` template for self-hosted or managed Gas
  Station proof planning. It lists the optional `--skip-reserve` reachability
  diagnostic before the full reserve diagnostic, but that template is not
  accepted by `GASKIT_TESTNET_UPSTREAM_REPORT`; only the sanitized diagnostic
  report emitted by `npm run diagnose:gas-station -- --report
  <ignored-json-path>` can clear the upstream gate.
- Includes a `testnet-digest` template for the accepted
  `GASKIT_TESTNET_DIGEST_REPORT` artifact. The template points at the
  non-networked digest-docs check before the read-only live lookup command, but
  it is not accepted as sponsored execute evidence.
- Includes `iota-names-live`, `iota-identity-live`, and `vc-validation-live`
  templates for the remaining live identity gates. They point at the accepted
  IOTA Names and IOTA Identity report kinds, while keeping VC validation tied
  to the accepted IOTA Identity live smoke report plus trust-policy
  configuration. `npm run live:write-identity-proof-bundle` writes the linked
  Names, Identity, and VC templates plus the live proof plan as ignored local
  artifacts; it remains non-networked and does not prove live identity behavior
  without the operator-owned smoke reports.
- Lets operators write an ignored sponsor funding request artifact with
  `npm run sponsor:write-funding-request -- --out
  tmp/gaskit/sponsor-funding-request.json` when they need the public sponsor
  address for testnet funding. The full address stays in the ignored artifact;
  stdout remains redacted, and the command does not contact live services. If
  `--faucet-report <ignored-json-path>` or `GASKIT_SPONSOR_FAUCET_REPORT` is
  supplied, only bounded sanitized faucet result/code/status context is copied
  into that ignored artifact for operator triage; it does not prove funding.
  Unsupported faucet routes such as an HTTP 405 from a documented route are
  represented as `REQUEST_UNSUPPORTED` so operators can switch to a wallet
  faucet flow, CLI faucet flow, alternate approved faucet, or manual testnet
  transfer.
- Lets operators request IOTA testnet faucet funds with
  `npm run sponsor:request-faucet-funds -- --execute --out
  tmp/gaskit/sponsor-faucet-request.json` only after they configure
  `IOTA_FAUCET_URL` or pass `--faucet-url`. The command writes a sanitized
  ignored report, requires explicit `--execute`, and does not prove reserve_gas
  compatibility.
- Lets operators point `GASKIT_SPONSOR_FAUCET_REPORT` at that sanitized faucet
  report so live-status/product/operator gates can include the latest faucet
  failure, rate-limit, blocked request, or completed request in the
  `sponsor-funding` next step without accepting it as proof.
- Lets operators write the funding evidence report with
  `npm run sponsor:check-funding -- --report
  tmp/gaskit/sponsor-funding-report.json`. The command contacts IOTA RPC, but
  writes only redacted address and aggregate funding fields, and does not sign,
  reserve gas, execute transactions, or print sponsor signer material.
- Points public A2A hosting/conformance review at the non-networked
  `npm run proof:a2a-public-readiness` command before any public endpoint is
  probed, then at `npm run smoke:a2a-public-discovery` only after
  operator-approved public HTTPS configuration exists.
- Can write a redacted local JSON report for handoff/audit evidence before
  any live command is approved.
- Reports command names and next gates without printing configured endpoints,
  profile paths, names, addresses, credentials, tokens, or secret-like values.

## What It Does Not Do

- It does not run `npm run smoke:iota-names-live -- --report <ignored-json-path>`.
- It does not run `npm run smoke:iota-identity-live -- --report <ignored-json-path>`.
- It does not run the Identity live smoke on behalf of VC validation.
- It does not run `npm run proof:testnet-digest:live -- --report
  tmp/gaskit/testnet-digest-proof.json`.
- It does not run `npm run execute:testnet-demo`.
- It does not start Docker, Redis, or Gas Station containers.
- It does not run `npm run diagnose:gas-station`.
- It does not run `npm publish`.
- It does not run payment-provider live calls; it only points to the redacted
  readiness/report gate.
- It does not operate public A2A hosting, live payment providers, production
  marketplace flows, production custody, or physical devices.
- It does not turn report templates into accepted evidence; templates remain
  `pending-operator-proof` until an approved proof run replaces them.
- It does not change `launchReady=false` while product-status or launch
  blockers remain.
- The JSON artifact does not prove any live endpoint, package publication,
  payment provider, marketplace, custody, or physical-device claim.

## Next Commands

Use this report with the other proof gates:

```bash
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:testnet-digest
npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json
npm run package:write-publication-proof-bundle -- --out tmp/gaskit/package-publication-proof-bundle.json
npm run a2a:write-public-proof-plan -- --out tmp/gaskit/a2a-public-proof-plan.json
npm run a2a:write-public-proof-bundle -- --out tmp/gaskit/a2a-public-proof-bundle.json
npm run proof:a2a-public-readiness
npm run proof:package-publication-readiness
npm run proof:payment-provider-readiness
npm run proof:marketplace-readiness
npm run marketplace:write-production-proof-plan -- --out tmp/gaskit/marketplace-production-proof-plan.json
npm run proof:custody-readiness
npm run custody:write-production-proof-plan -- --out tmp/gaskit/custody-production-proof-plan.json
npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json
npm run live:write-identity-proof-bundle -- --out tmp/gaskit/identity-proof-bundle.json
npm run proof:live-status -- --out tmp/gaskit/live-proof-status.json
npm run package:write-publication-proof-plan -- --out tmp/gaskit/package-publication-proof-plan.json
npm run payment:write-provider-proof-plan -- --out tmp/gaskit/payment-provider-proof-plan.json
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
npm run operator:write-report-template -- --kind testnet-digest --out tmp/gaskit/testnet-digest-report-template.json
npm run operator:write-report-template -- --kind iota-names-live --out tmp/gaskit/iota-names-live-report-template.json
npm run operator:write-report-template -- --kind iota-identity-live --out tmp/gaskit/iota-identity-live-report-template.json
npm run operator:write-report-template -- --kind vc-validation-live --out tmp/gaskit/vc-validation-live-report-template.json
npm run gas-station:docker-direct -- --status
npm run sponsor:write-funding-request -- --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:write-funding-request -- --faucet-report tmp/gaskit/sponsor-faucet-request.json --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:request-faucet-funds -- --execute --out tmp/gaskit/sponsor-faucet-request.json
GASKIT_SPONSOR_FAUCET_REPORT=tmp/gaskit/sponsor-faucet-request.json npm run proof:live-status
npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json
npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json
npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json
npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json
npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json
npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json
npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json
npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json
npm run smoke:a2a-public-discovery
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run operator:write-live-gate-report
npm run readiness:testnet
npm run gas-station:render-config
npm run gas-station:runtime-preflight
GASKIT_GAS_STATION_RUNTIME_MODE=managed-upstream npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run smoke:iota-names-live -- --report tmp/gaskit/iota-names-live-report.json
npm run smoke:iota-identity-live -- --report tmp/gaskit/iota-identity-live-report.json
```

The `--skip-reserve` diagnostic is reachability triage only. It cannot clear
`testnet-upstream`; the full diagnostic without `--skip-reserve` must pass
before fresh sponsored execution is ready.

Only run live commands after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
