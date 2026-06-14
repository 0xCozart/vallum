# Launch Readiness Evidence

`npm run proof:launch-readiness` is a non-networked launch-readiness evidence
matrix for Agentic GasKit.

It maps each major roadmap phase to:

- source and doc evidence that exists in this checkout;
- local verification commands that prove the current local/mock behavior;
- live, production, publication, custody, marketplace, payment, A2A, and
  device-safety blockers from `npm run proof:product-status`;
- the next safe gate before any broader claim can be made.

Run it from the repository root:

```bash
npm run proof:launch-readiness
```

For a redacted machine-readable artifact, use:

```bash
npm run proof:launch-readiness -- --json
npm run proof:launch-readiness -- --out tmp/gaskit/launch-readiness.json
```

The `--out` file is written with mode `600`. It is a local audit artifact, not
passing evidence by itself, and it must stay outside committed files.

Expected status in an unconfigured checkout:

```text
Agentic GasKit launch readiness not-ready
localEvidenceOk=true
launchReady=false
```

The command exits successfully when it can produce the matrix. Treat
`launchReady=false` as the important launch boundary: the local proof surface is
auditable, but live/testnet and production claims still require separate
operator-approved proof.

## Evidence Areas

| Area | Current claim | Status boundary |
| --- | --- | --- |
| Phase 1 sponsored policy MVP | Local signer-reference wallets, manifests, policy-gated sponsorship, MCP tools, escrow, receipts, documented public sponsored testnet execute digest evidence, local testnet-readiness config, local Gas Station runtime preflight wiring, sponsor funding request generation, bounded sponsor faucet context, sanitized upstream diagnostic report path, non-networked custody readiness gate, and redacted custody production proof-plan writer are proven by local checks. | Local proof plus a documented public sponsored testnet execute digest; refreshing that proof still requires `gas-station-runtime` to pass locally, sponsor funding to pass, a passing `testnet-upstream` report proving Gas Station reachability and reserve_gas compatibility, explicit operator intent before `npm run execute:testnet-demo`, and separate production custody review before custody claims. |
| Phase 2 identity and VC | Profiles, local resolvers, mock Names/Identity adapters, cache behavior, VC trust policy, and a non-networked live-proof plan writer are locally proven. | Blocked on IOTA Names, IOTA Identity, and VC live-proof configuration. |
| Phase 3 contract workflows | Escrow, receipt, pay-per-call, data-license, service-bounty, reputation-receipt, and subscription workflows are locally proven. | Physical device access remains safety-gated. |
| Phase 4 standards bridges | x402, AP2, and A2A mappings are locally proven with fail-closed behavior. Payment-provider readiness now reports local x402/AP2 source and test proof, then validates only an operator-supplied redacted structured report before manual review; the payment proof-plan writer emits the non-networked command/report checklist before any provider call. A2A public-readiness proof now reports local proof, local authenticated extended-card access, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing and validation, local static discovery loopback host smoke, local static hosting review, local loopback streaming, local push notification configuration, local injected push delivery, local opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, public hosting inputs, redacted structured public discovery report classification, redacted structured public push delivery report classification, and structured external conformance blockers. Opt-in artifact commands can prepare, validate, loopback-smoke, and write a redacted hosting-review packet for canonical local `.well-known` files from already-signed public inputs, and an opt-in public discovery smoke can probe approved public Agent Card/JWKS config and emit the discovery report. | Blocked on accepted live payment/provider report, public A2A hosting acceptance, production auth/key management, accepted public discovery evidence, accepted public push webhook delivery evidence, and external conformance. |
| Phase 5 marketplace/operator | Marketplace read-model evidence proves local labels, policy compatibility, receipt access control, and dispute bundle redaction, with a non-networked marketplace readiness gate and redacted marketplace production proof-plan writer. | Production marketplace, provider verification, moderation, custody, and live settlement remain blocked until an ignored structured marketplace report is accepted manually. |
| Phase 6 package release | Packages are locally packable, installable from tarballs, dry-run publishable, checked by a non-networked package publication readiness gate, and covered by a redacted package publication proof-plan writer. | Registry publication, account ownership, provenance, and registry install proof remain blocked until an ignored structured npm publication report is accepted manually. |
| Packet H final product status | Product status, launch-readiness, operator live-gate, and verification-profile reports are executable. | The fast profile is iteration-only; the active goal remains open while blockers remain. |

## What It Does Not Do

- It does not run live IOTA commands.
- It does not contact IOTA Names, IOTA Identity, payment, A2A, or provider
  services.
- It does not run `npm publish`.
- It does not approve production marketplace, provider verification, custody,
  recovery export, public A2A hosting, or physical device access.

## Next Gates

Use the matrix with:

```bash
npm run proof:product-status
npm run proof:product-status -- --out tmp/gaskit/product-status.json
npm run proof:launch-readiness -- --out tmp/gaskit/launch-readiness.json
npm run proof:live-status
npm run live:write-proof-plan -- --out tmp/gaskit/live-proof-plan.json
npm run proof:testnet-digest
npm run operator:write-report-template -- --kind testnet-digest --out tmp/gaskit/testnet-digest-report-template.json
npm run proof:testnet-digest:live -- --report tmp/gaskit/testnet-digest-proof.json
npm run gas-station:render-config
npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run sponsor:write-funding-request -- --out tmp/gaskit/sponsor-funding-request.json
npm run sponsor:request-faucet-funds -- --execute --out tmp/gaskit/sponsor-faucet-request.json
npm run sponsor:write-funding-request -- --faucet-report tmp/gaskit/sponsor-faucet-request.json --out tmp/gaskit/sponsor-funding-request.json
npm run proof:live-status
npm run sponsor:check-funding -- --report tmp/gaskit/sponsor-funding-report.json
npm run operator:write-report-template -- --kind testnet-upstream --out tmp/gaskit/testnet-upstream-report-template.json
npm run diagnose:gas-station -- --skip-reserve --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run operator:write-report-template -- --kind iota-names-live --out tmp/gaskit/iota-names-live-report-template.json
npm run smoke:iota-names-live -- --report tmp/gaskit/iota-names-live-report.json
npm run operator:write-report-template -- --kind iota-identity-live --out tmp/gaskit/iota-identity-live-report-template.json
npm run smoke:iota-identity-live -- --report tmp/gaskit/iota-identity-live-report.json
npm run operator:write-report-template -- --kind vc-validation-live --out tmp/gaskit/vc-validation-live-report-template.json
npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>
npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run operator:write-report-template -- --kind a2a-public-discovery --out tmp/gaskit/a2a-public-discovery-report-template.json
npm run operator:write-report-template -- --kind a2a-public-push-delivery --out tmp/gaskit/a2a-public-push-delivery-report-template.json
npm run operator:write-report-template -- --kind a2a-external-conformance --out tmp/gaskit/a2a-external-conformance-report-template.json
npm run a2a:write-public-proof-plan -- --out tmp/gaskit/a2a-public-proof-plan.json
npm run proof:a2a-public-readiness
npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json
npm run package:write-publication-proof-plan -- --out tmp/gaskit/package-publication-proof-plan.json
npm run proof:package-publication-readiness
npm run operator:write-report-template -- --kind payment-provider-live --out tmp/gaskit/payment-provider-live-report-template.json
npm run payment:write-provider-proof-plan -- --out tmp/gaskit/payment-provider-proof-plan.json
npm run proof:payment-provider-readiness
npm run operator:write-report-template -- --kind marketplace-production --out tmp/gaskit/marketplace-production-report-template.json
npm run marketplace:write-production-proof-plan -- --out tmp/gaskit/marketplace-production-proof-plan.json
npm run proof:marketplace-readiness
npm run operator:write-report-template -- --kind custody-production --out tmp/gaskit/custody-production-report-template.json
npm run custody:write-production-proof-plan -- --out tmp/gaskit/custody-production-proof-plan.json
npm run proof:custody-readiness
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run operator:write-live-gate-report
npm run readiness:testnet
npm run verify:local
```

The `--skip-reserve` diagnostic is reachability triage only. It does not clear
launch readiness; the full diagnostic without `--skip-reserve` must pass before
`testnet-upstream` can support fresh sponsored execution claims.

The `testnet-sponsored-execute` product-status check is non-networked by
default. Without `GASKIT_TESTNET_DIGEST_REPORT`, it only verifies that the
current public digest is documented in the required evidence docs. Use
`npm run proof:testnet-digest:live -- --report
tmp/gaskit/testnet-digest-proof.json` for the read-only testnet lookup, set
`GASKIT_TESTNET_DIGEST_REPORT` outside committed files so product-status can
consume that sanitized report without contacting IOTA RPC, and rerun
`npm run execute:testnet-demo` only with explicit operator intent when the
public digest needs to be refreshed.

Sponsor funding must clear before the full upstream diagnostic can prove
`reserve_gas` compatibility. If the bounded faucet context reports
`REQUEST_UNSUPPORTED` with HTTP `405`, use another approved faucet or the
ignored funding-request artifact to fund the sponsor, then rerun the sponsor
funding gate and full diagnostic.

Run live commands only after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
