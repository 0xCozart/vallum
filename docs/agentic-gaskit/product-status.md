# Product Status Proof

`npm run proof:product-status` is a non-networked proof-boundary command for
Agentic GasKit.

It does not contact IOTA services, publish packages, run payment providers, or
operate public A2A endpoints. Instead, it reports the current product evidence
surface in one machine-checkable place:

- local verification and package release gates that are configured in this
  checkout;
- documented public testnet digest evidence wiring;
- A2A public-readiness wiring for local proof, public hosting inputs,
  unsupported streaming/push capabilities, and external conformance blockers;
- verification-profile wiring that keeps fast iteration separate from the full
  local evidence gate;
- launch-readiness evidence matrix and operator live-gate runbook wiring;
- live/testnet readiness, IOTA Names, IOTA Identity, and VC proof status from
  `npm run proof:live-status`;
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
  install/import, and opt-in publish dry-run.
- Live/testnet gates are either ready to run with safe local configuration or
  blocked with exact missing check ids.
- Production and safety claims remain explicit blockers instead of implied
  roadmap completion.

## What It Does Not Prove

- Real npm publication or registry installation.
- Live IOTA Names, IOTA Identity, VC, payment, or A2A proof unless the
  corresponding opt-in live command is configured and passes.
- Public A2A hosting, production key management, external conformance, or
  production auth decisions.
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
npm run proof:a2a-public-readiness
npm run proof:verification-profiles
npm run proof:live-status
npm run proof:launch-readiness
npm run proof:operator-gates
npm run readiness:testnet
```

Only run live commands that contact IOTA services or spend sponsored testnet gas
after operator-owned local credentials are configured outside the repo and the
operator explicitly intends to run that proof.
