# Operator Live Gates

`npm run proof:operator-gates` is a non-networked operator runbook for the
remaining Vallum live and production gates.

It reads the product-status proof and classifies each gate as:

- `proven-local` for deterministic local evidence that is already wired;
- `ready-to-run` for non-networked commands that can run once local config is
  present;
- `ready-approval` for valid ready-live evidence or structured reports that are
  ready for manual operator review but still approval-required;
- `blocked-config` for missing or failing local testnet, upstream diagnostic,
  IOTA Names, IOTA Identity, or VC trust-policy configuration;
- `requires-approval` for live endpoint, registry, payment, public hosting,
  marketplace, custody, or physical-device safety gates that still lack
  accepted proof and need explicit operator approval or a dedicated slice;
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

The artifact is written under `tmp/vallum/`, which is ignored by Git. It uses
kind `vallum.operator-live-gate-report` and contains gate ids, blocker
codes, ready-approval gate ids, approval flags, live-service flags, command
names, messages, and next steps. It does not include configured endpoint
values, names, addresses, profile paths, credentials, tokens, response bodies,
or secret local paths.

To prepare an ignored structured report skeleton for a later approved proof
run, use:

```bash
npm run operator:write-report-template -- --kind package-publication --out tmp/vallum/package-publication-report-template.json
```

The template writer is also non-networked. It can write templates for
`testnet-upstream`, `testnet-digest`, `iota-names-live`,
`iota-identity-live`, `vc-validation-live`, `a2a-public-discovery`,
`a2a-public-push-delivery`, `a2a-external-conformance`,
`payment-provider-live`, `package-publication`, `marketplace-production`,
`custody-production`, and `device-access-safety`. Generated templates keep
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
Vallum operator live gates blocked
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
- Lets operators explicitly choose `VALLUM_GAS_STATION_RUNTIME_MODE=managed-upstream`
  when a separately managed Gas Station is configured; that skips Docker
  inspection but still leaves upstream reachability and reserve compatibility
  to the sanitized `testnet-upstream` diagnostic report.
- Separates sponsor-wallet testnet balance proof from reserve compatibility
  with the `sponsor-funding` gate. The accepted evidence is a sanitized
  ignored report written by `npm run sponsor:check-funding -- --report
  <ignored-json-path>` and referenced through `VALLUM_SPONSOR_FUNDING_REPORT`.
- Separates local testnet `.env` readiness from live Gas Station upstream
  readiness using the sanitized `testnet-upstream` diagnostic report gate.
- Routes `testnet-sponsored-execute` to `npm run proof:testnet-digest:live --
  --report tmp/vallum/testnet-digest-proof.json` when a documented digest is
  present, so operators can perform and persist a read-only IOTA testnet lookup
  before deciding whether to refresh sponsored execution. Set
  `VALLUM_TESTNET_DIGEST_REPORT` outside committed files when product-status
  should accept the current successful lookup without contacting IOTA RPC. If
  sponsored execute evidence is missing, the gate points to `npm run
  execute:testnet-demo`, which requires explicit operator intent and can spend
  sponsored testnet gas.
- Points IOTA Names, IOTA Identity, and VC live proof prep at
  `npm run live:write-proof-plan`, a redacted local command-order artifact,
  and `npm run live:write-identity-proof-bundle`, a linked template and
  readiness-artifact summary for the identity gates before any live smoke
  command runs.
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
- Points physical-device safety review at the non-networked
  `npm run proof:device-access-safety-readiness` command, which validates the
  virtual-only local safety gate plus an ignored structured owner-approved
  safety report before manual acceptance.
- Lets operators prepare that review with
  `npm run device-access:write-safety-proof-bundle`, a redacted local bundle
  that writes the safety report template, proof plan, readiness artifact, and
  summary without contacting or operating physical devices.
- Lets operators prepare public A2A hosting and conformance review with
  `npm run a2a:write-public-proof-plan`, a redacted local plan that lists
  command order, blocker codes, operator input names, and safety boundaries
  before any public endpoint discovery smoke runs. The adjacent
  `npm run a2a:write-public-proof-bundle` command writes that plan, the public
  readiness artifact, and the discovery, push-delivery, and external
  conformance templates together as ignored local artifacts.
- Lets operators wrap an operator-reviewed official A2A TCK
  `reports/compatibility.json` file with
  `npm run a2a:wrap-tck-conformance`, producing the accepted redacted
  `a2a-external-conformance` report shape without contacting public endpoints.
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
  marketplace report before manual acceptance. Accepted reports must include
  status-only provider, moderation, access-control, settlement, dispute, and
  operations review sections, plus capability, reconciliation,
  incident-response, and redaction check ids.
- Lets operators prepare that review with
  `npm run marketplace:write-production-proof-plan`, a redacted local plan that
  lists marketplace review command order, required report fields, required
  check ids, approval boundaries, and blocker codes without contacting
  production marketplace systems.
- The adjacent `npm run marketplace:write-production-proof-bundle` command
  writes that plan, the marketplace readiness artifact, and the production
  marketplace report template together as ignored local artifacts.
- Points production custody review at the non-networked
  `npm run proof:custody-readiness` command, which validates local
  signer-reference proof plus an ignored structured custody report before
  manual acceptance. Accepted reports must include status-only
  signer-reference, custody-control, lifecycle, recovery, audit, incident, and
  compliance review sections, plus module validation, operator access,
  backup/restore, key lifecycle, and redaction check ids.
- Lets operators prepare that review with
  `npm run custody:write-production-proof-plan`, a redacted local plan that
  lists custody review command order, required report fields, required check
  ids, approval boundaries, and blocker codes without contacting KMS, external
  signers, custody providers, or live wallet infrastructure.
- The adjacent `npm run custody:write-production-proof-bundle` command writes
  that plan, the custody readiness artifact, and the custody-production report
  template together as ignored local artifacts.
- Points live payment/provider review at the non-networked
  `npm run proof:payment-provider-readiness` command, which validates local
  x402/AP2 proof plus an ignored structured report before manual acceptance.
  Accepted reports must be status-only: x402 facilitator verify, settle, and
  payment-response confirmation, plus AP2 mandate-chain validation, checkout
  receipt, payment receipt, and accountability review.
- Lets operators prepare that review with
  `npm run payment:write-provider-proof-plan`, a redacted local plan that lists
  command order, required report fields, approval boundaries, and blocker
  codes without running provider calls.
- The adjacent `npm run payment:write-provider-proof-bundle` command writes
  that plan, the payment-provider readiness artifact, and the live payment
  provider report template together as ignored local artifacts.
- Adds `npm run smoke:payment-provider-live -- --report <ignored-json-path>`
  as the opt-in operator-approved x402 facilitator verify/settle smoke. It
  reads ignored local x402 request and AP2 status proof inputs, contacts only
  the configured x402 verify/settle endpoints, and writes the accepted
  redacted report shape only after x402 and AP2 status checks pass.
- The payment smoke is not part of default local verification. It must not be
  run without payment-provider approval because settlement may submit a real
  payment through the selected facilitator.
- Lets operators generate ignored structured report templates with
  `npm run operator:write-report-template -- --kind <kind> --out <path>` so the
  report fields and required check ids match the existing readiness validators
  before any approved live, publication, marketplace, custody, or public A2A
  proof run fills them in.
- Includes those report-template commands either directly in the relevant
  `proof:operator-gates` command field or inside a higher-level proof-bundle
  command, so the operator path starts with ignored preparation artifacts before
  any readiness, live-smoke, diagnostic, publication, or provider command that
  can produce or validate accepted evidence.
- Includes a `testnet-upstream` template for self-hosted or managed Gas
  Station proof planning. It lists the optional `--skip-reserve` reachability
  diagnostic before the full reserve diagnostic, but that template is not
  accepted by `VALLUM_TESTNET_UPSTREAM_REPORT`; only the sanitized diagnostic
  report emitted by `npm run diagnose:gas-station -- --report
  <ignored-json-path>` can clear the upstream gate.
- Includes a `testnet-digest` template for the accepted
  `VALLUM_TESTNET_DIGEST_REPORT` artifact. The template points at the
  non-networked digest-docs check before the read-only live lookup command, but
  it is not accepted as sponsored execute evidence.
- Includes `iota-names-live`, `iota-identity-live`, and `vc-validation-live`
  templates for the remaining live identity gates. They point at the accepted
  IOTA Names and IOTA Identity report kinds, while keeping VC validation tied
  to the accepted IOTA Identity live smoke report plus trust-policy
  configuration. `npm run live:write-identity-proof-bundle` writes the linked
  Names, Identity, and VC templates plus the live proof plan and live proof
  status artifact as ignored local artifacts; it remains non-networked and
  does not prove live identity behavior without the operator-owned smoke
  reports.
- Lets operators write an ignored sponsor funding request artifact with
  `npm run sponsor:write-funding-request -- --out
  tmp/vallum/sponsor-funding-request.json` when they need the public sponsor
  address for testnet funding. The full address stays in the ignored artifact;
  stdout remains redacted, and the command does not contact live services. If
  `--faucet-report <ignored-json-path>` or `VALLUM_SPONSOR_FAUCET_REPORT` is
  supplied, only bounded sanitized faucet result/code/status context is copied
  into that ignored artifact for operator triage; it does not prove funding.
  Unsupported faucet routes such as an HTTP 405 from a documented route are
  represented as `REQUEST_UNSUPPORTED` so operators can switch to a wallet
  faucet flow, CLI faucet flow, alternate approved faucet, or manual testnet
  transfer.
- Lets operators request IOTA testnet faucet funds with
  `npm run sponsor:request-faucet-funds -- --execute --out
  tmp/vallum/sponsor-faucet-request.json` only after they configure
  `IOTA_FAUCET_URL` or pass `--faucet-url`. The command writes a sanitized
  ignored report, requires explicit `--execute`, and does not prove reserve_gas
  compatibility.
- Lets operators point `VALLUM_SPONSOR_FAUCET_REPORT` at that sanitized faucet
  report so live-status/product/operator gates can include the latest faucet
  failure, rate-limit, blocked request, or completed request in the
  `sponsor-funding` next step without accepting it as proof.
- Lets operators write the funding evidence report with
  `npm run sponsor:check-funding -- --report
  tmp/vallum/sponsor-funding-report.json`. The command contacts IOTA RPC, but
  writes only redacted address and aggregate funding fields, and does not sign,
  reserve gas, execute transactions, or print sponsor signer material.
- Points public A2A hosting/conformance review at the non-networked
  `npm run proof:a2a-public-readiness` command before any public endpoint is
  probed, then at `npm run smoke:a2a-public-discovery` and
  `npm run smoke:a2a-public-push-delivery` only after operator-approved public
  HTTPS configuration exists. An operator-reviewed official TCK
  `reports/compatibility.json` can be converted with
  `npm run a2a:wrap-tck-conformance` instead of using the Vallum task-route
  smoke for external conformance evidence.
- Can write a redacted local JSON report for handoff/audit evidence before
  any live command is approved.
- Reports command names and next gates without printing configured endpoints,
  profile paths, names, addresses, credentials, tokens, or secret-like values.

## What It Does Not Do

- It does not run `npm run smoke:iota-names-live -- --report <ignored-json-path>`.
- It does not run `npm run smoke:iota-identity-live -- --report <ignored-json-path>`.
- It does not run the Identity live smoke on behalf of VC validation.
- It does not run `npm run proof:testnet-digest:live -- --report
  tmp/vallum/testnet-digest-proof.json`.
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
npm run roadmap:write-execution-proof-bundle -- --out tmp/vallum/roadmap-execution-proof-bundle.json
npm run operator:write-blocker-resolution-plan -- --out tmp/vallum/blocker-resolution-plan.json
npm run proof:product-status
npm run proof:launch-readiness
npm run proof:testnet-digest
npm run proof:testnet-digest:live -- --report tmp/vallum/testnet-digest-proof.json
npm run package:write-publication-proof-bundle -- --out tmp/vallum/package-publication-proof-bundle.json
npm run payment:write-provider-proof-bundle -- --out tmp/vallum/payment-provider-proof-bundle.json
npm run smoke:payment-provider-live -- --report tmp/vallum/payment-provider-live-report.json
npm run a2a:write-public-proof-plan -- --out tmp/vallum/a2a-public-proof-plan.json
npm run a2a:write-public-proof-bundle -- --out tmp/vallum/a2a-public-proof-bundle.json
npm run a2a:wrap-tck-conformance -- --compatibility <reports/compatibility.json> --out tmp/vallum/a2a-external-conformance-report.json --public-agent-card-url <url> --public-base-url <url>
npm run proof:a2a-public-readiness
npm run proof:package-publication-readiness
npm run proof:payment-provider-readiness
npm run proof:marketplace-readiness
npm run marketplace:write-production-proof-bundle -- --out tmp/vallum/marketplace-production-proof-bundle.json
npm run marketplace:write-production-proof-plan -- --out tmp/vallum/marketplace-production-proof-plan.json
npm run custody:write-production-proof-bundle -- --out tmp/vallum/custody-production-proof-bundle.json
npm run proof:custody-readiness
npm run custody:write-production-proof-plan -- --out tmp/vallum/custody-production-proof-plan.json
npm run device-access:write-safety-proof-bundle -- --out tmp/vallum/device-access-safety-proof-bundle.json
npm run proof:device-access-safety-readiness
npm run device-access:write-safety-proof-plan -- --out tmp/vallum/device-access-safety-proof-plan.json
npm run live:write-proof-plan -- --out tmp/vallum/live-proof-plan.json
npm run live:write-identity-proof-bundle -- --out tmp/vallum/identity-proof-bundle.json
npm run proof:live-status -- --out tmp/vallum/live-proof-status.json
npm run package:write-publication-proof-plan -- --out tmp/vallum/package-publication-proof-plan.json
npm run payment:write-provider-proof-plan -- --out tmp/vallum/payment-provider-proof-plan.json
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/vallum/testnet-upstream-report-template.json
npm run operator:write-report-template -- --kind testnet-digest --out tmp/vallum/testnet-digest-report-template.json
npm run operator:write-report-template -- --kind iota-names-live --out tmp/vallum/iota-names-live-report-template.json
npm run operator:write-report-template -- --kind iota-identity-live --out tmp/vallum/iota-identity-live-report-template.json
npm run operator:write-report-template -- --kind vc-validation-live --out tmp/vallum/vc-validation-live-report-template.json
npm run gas-station:docker-direct -- --status
npm run sponsor:write-funding-request -- --out tmp/vallum/sponsor-funding-request.json
npm run sponsor:write-funding-request -- --faucet-report tmp/vallum/sponsor-faucet-request.json --out tmp/vallum/sponsor-funding-request.json
npm run sponsor:request-faucet-funds -- --execute --out tmp/vallum/sponsor-faucet-request.json
VALLUM_SPONSOR_FAUCET_REPORT=tmp/vallum/sponsor-faucet-request.json npm run proof:live-status
npm run sponsor:check-funding -- --report tmp/vallum/sponsor-funding-report.json
npm run operator:write-report-template -- --kind package-publication --out tmp/vallum/package-publication-report-template.json
npm run operator:write-report-template -- --kind payment-provider-live --out tmp/vallum/payment-provider-live-report-template.json
npm run smoke:payment-provider-live -- --report tmp/vallum/payment-provider-live-report.json
npm run operator:write-report-template -- --kind marketplace-production --out tmp/vallum/marketplace-production-report-template.json
npm run operator:write-report-template -- --kind custody-production --out tmp/vallum/custody-production-report-template.json
npm run operator:write-report-template -- --kind device-access-safety --out tmp/vallum/device-access-safety-report-template.json
npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/vallum/a2a-public-discovery-report-template.json
npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/vallum/a2a-public-push-delivery-report-template.json
npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/vallum/a2a-external-conformance-report-template.json
npm run a2a:wrap-tck-conformance -- --compatibility <reports/compatibility.json> --out tmp/vallum/a2a-external-conformance-report.json --public-agent-card-url <url> --public-base-url <url>
npm run smoke:a2a-public-discovery
npm run smoke:a2a-public-push-delivery
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run operator:write-live-gate-report
npm run readiness:testnet
npm run gas-station:render-config
npm run gas-station:runtime-preflight
VALLUM_GAS_STATION_RUNTIME_MODE=managed-upstream npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run diagnose:gas-station -- --skip-reserve --report tmp/vallum/testnet-upstream-diagnostic.json
npm run diagnose:gas-station -- --report tmp/vallum/testnet-upstream-diagnostic.json
npm run smoke:iota-names-live -- --report tmp/vallum/iota-names-live-report.json
npm run smoke:iota-identity-live -- --report tmp/vallum/iota-identity-live-report.json
```

The aggregate roadmap execution proof bundle is a non-networked handoff packet:
it writes the current product, launch, operator-gate, and roadmap-completion
artifacts plus the existing identity, package publication, public A2A,
payment-provider, marketplace, custody, and device-access safety
proof-preparation bundles. It does
not run the approval-required live or production commands and does not make a
live IOTA Names, IOTA Identity, VC, npm, public A2A, payment, marketplace,
custody, or physical-device claim.

The blocker-resolution plan is the operator-facing consolidation over that
roadmap bundle. It writes the same ignored proof-preparation artifacts, then
groups remaining blocker codes by proof area with required environment variable
names, accepted report env names, required structured report fields, evidence
artifact names, non-networked preparation commands, and approval-required
commands. It does not contact live services or print configured endpoint
values, tokens, report contents, response bodies, payment instruments, signer
material, or secret local paths.

The `--skip-reserve` diagnostic is reachability triage only. It cannot clear
`testnet-upstream`; the full diagnostic without `--skip-reserve` must pass
before fresh sponsored execution is ready.

Only run live commands after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
