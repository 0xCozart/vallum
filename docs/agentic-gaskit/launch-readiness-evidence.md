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
| Phase 1 sponsored policy MVP | Local signer-reference wallets, manifests, policy-gated sponsorship, MCP tools, escrow, receipts, documented public testnet digest evidence, local testnet-readiness config, local Gas Station runtime preflight wiring, and a sanitized upstream diagnostic report path are proven by local checks. | Local proof plus documented prior testnet digest only; new sponsored execution still requires `gas-station-runtime` to pass locally, then a passing `testnet-upstream` report proving Gas Station reachability and reserve_gas compatibility, sponsor funding, and explicit operator intent. |
| Phase 2 identity and VC | Profiles, local resolvers, mock Names/Identity adapters, cache behavior, and VC trust policy are locally proven. | Blocked on IOTA Names, IOTA Identity, and VC live-proof configuration. |
| Phase 3 contract workflows | Escrow, receipt, pay-per-call, data-license, service-bounty, reputation-receipt, and subscription workflows are locally proven. | Physical device access remains safety-gated. |
| Phase 4 standards bridges | x402, AP2, and A2A mappings are locally proven with fail-closed behavior. Payment-provider readiness now reports local x402/AP2 source and test proof, then validates only an operator-supplied redacted structured report before manual review; the payment proof-plan writer emits the non-networked command/report checklist before any provider call. A2A public-readiness proof now reports local proof, local authenticated extended-card access, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing and validation, local static discovery loopback host smoke, local static hosting review, local loopback streaming, local push notification configuration, local injected push delivery, local opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, public hosting inputs, redacted structured public discovery report classification, redacted structured public push delivery report classification, and structured external conformance blockers. Opt-in artifact commands can prepare, validate, loopback-smoke, and write a redacted hosting-review packet for canonical local `.well-known` files from already-signed public inputs, and an opt-in public discovery smoke can probe approved public Agent Card/JWKS config and emit the discovery report. | Blocked on accepted live payment/provider report, public A2A hosting acceptance, production auth/key management, accepted public discovery evidence, accepted public push webhook delivery evidence, and external conformance. |
| Phase 5 marketplace/operator | Marketplace read-model evidence proves local labels, policy compatibility, receipt access control, and dispute bundle redaction, with a non-networked marketplace readiness gate. | Production marketplace, provider verification, moderation, custody, and live settlement remain blocked until an ignored structured marketplace report is accepted manually. |
| Phase 6 package release | Packages are locally packable, installable from tarballs, dry-run publishable, and checked by a non-networked package publication readiness gate. | Registry publication, account ownership, provenance, and registry install proof remain blocked until an ignored structured npm publication report is accepted manually. |
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
npm run proof:live-status
npm run proof:testnet-digest
npm run proof:testnet-digest:live
npm run gas-station:render-config
npm run gas-station:runtime-preflight
npm run gas-station:docker-direct -- --dry-run
npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json
npm run a2a:write-static-discovery-bundle -- --agent-card <signed-card.json> --jwks <jwks.json> --public-base-url <url> --public-jwks-url <url> --out-dir <dir>
npm run a2a:check-static-discovery-bundle -- --out-dir <dir> --expected-public-base-url <url> --expected-public-jwks-url <url>
npm run proof:a2a-public-readiness
npm run proof:package-publication-readiness
npm run proof:payment-provider-readiness
npm run proof:marketplace-readiness
npm run payment:write-provider-proof-plan -- --out tmp/gaskit/payment-provider-proof-plan.json
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run operator:write-live-gate-report
npm run readiness:testnet
npm run verify:local
```

Run live commands only after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
