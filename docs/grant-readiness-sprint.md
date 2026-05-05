# IOTA GasKit Grant Readiness Sprint

Date: 2026-05-05

## Current status

This document is the public status note for the clean `iota-gaskit` grant-readiness repository. It supersedes earlier private planning notes that used a separate non-public source/incubator prototype.

The clean public repo now exists at:

```text
https://github.com/0xCozart/iota-gaskit
```

The source/incubator prototype remains external evidence only. This repo intentionally contains the scrubbed open-source toolkit scaffold, grant plan, docs, examples, and package surfaces that are safe for public review.

## Sprint goal

Make the project credible for IOTA Foundation review without overclaiming grant deliverables that belong in later milestones.

A reviewer should be able to verify:

- open-source toolkit framing rather than a private SaaS submission;
- Apache-2.0 licensing and contribution/security hygiene;
- clear separation between grant-funded public-good code and future managed-service options;
- a realistic architecture and milestone budget;
- fail-closed policy/SDK scaffolds with passing tests;
- no obvious committed secrets in the clean scaffold;
- a concise path into the remaining production/dashboard/observability milestones;
- documented real IOTA testnet sponsored execute evidence without leaking secrets.

## Completed pre-submission items

- Public repository initialized and pushed.
- README, grant scope, managed-service roadmap, grant application, and milestone docs created.
- Apache-2.0 `LICENSE`, `NOTICE`, `CONTRIBUTING.md`, `SECURITY.md`, issue templates, and PR template added.
- TypeScript workspace scaffold created for:
  - `@iota-gaskit/shared-types`
  - `@iota-gaskit/policy-gateway`
  - `@iota-gaskit/sdk`
- Policy gateway scaffold includes fail-closed checks for auth, app status, app limits, wallet denial, package allowlist metadata, and function allowlist metadata.
- SDK scaffold includes typed reservation/execution helpers and guarded malformed-response handling.
- Demo app, backend examples, policy example, deployment template, architecture docs, threat model, and hardening docs created.
- Local verification evidence is tracked in `docs/milestone-0-proof.md`.
- Real testnet sponsored execute evidence is tracked in `docs/testnet-attempts.md`.

## Explicit non-goals for Milestone 0

Milestone 0 does not claim that:

- production dashboard UI is implemented in this clean repo yet;
- production hardening is complete;
- npm packages are released to the public registry.

Those are planned grant milestone deliverables.

## Remaining path

1. Use `docs/reviewer-walkthrough.md` for reviewer orientation.
2. Submit the grant package with `docs/grant-application.md` and `docs/grant-milestones.md`.
3. Package the reviewer-operated local deployment/testnet path so a clean clone can reproduce the sponsored transaction with their own credentials.
4. Continue extracting proven pieces from the external source prototype only after each piece is scrubbed, tested, and framed as open-source toolkit functionality.
