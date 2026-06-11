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
| Phase 1 sponsored policy MVP | Local signer-reference wallets, manifests, policy-gated sponsorship, MCP tools, escrow, receipts, and documented public testnet digest evidence are proven by local checks. | Local proof plus documented prior testnet digest only; new sponsored execution still requires configured operator credentials. |
| Phase 2 identity and VC | Profiles, local resolvers, mock Names/Identity adapters, cache behavior, and VC trust policy are locally proven. | Blocked on configured testnet readiness, IOTA Names, IOTA Identity, and VC proof. |
| Phase 3 contract workflows | Escrow, receipt, pay-per-call, data-license, service-bounty, reputation-receipt, and subscription workflows are locally proven. | Physical device access remains safety-gated. |
| Phase 4 standards bridges | x402, AP2, and A2A mappings are locally proven with fail-closed behavior. A2A public-readiness proof now reports local proof, local authenticated extended-card access, local loopback streaming, local push notification configuration, local injected push delivery, local opt-in push HTTP transport, callback URL admission hardening, local retry/attempt observability, public hosting inputs, redacted structured public discovery report classification, redacted structured public push delivery report classification, and structured external conformance blockers. An opt-in public discovery smoke can probe approved public Agent Card/JWKS config and emit the discovery report. | Blocked on live payment/provider proof, public A2A hosting acceptance, production auth/key management, accepted public discovery evidence, accepted public push webhook delivery evidence, and external conformance. |
| Phase 5 marketplace/operator | Marketplace read-model evidence proves local labels, policy compatibility, receipt access control, and dispute bundle redaction. | Production marketplace, provider verification, moderation, custody, and live settlement remain blocked. |
| Phase 6 package release | Packages are locally packable, installable from tarballs, and dry-run publishable. | Registry publication, account ownership, provenance, and registry install proof remain blocked. |
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
npm run proof:a2a-public-readiness
npm run verify:fast
npm run proof:verification-profiles
npm run proof:operator-gates
npm run readiness:testnet
npm run verify:local
```

Run live commands only after operator-owned local credentials are configured
outside the repo and the operator explicitly intends to run that proof.
