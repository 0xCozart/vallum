# Package Release Strategy

Last updated: 2026-06-15.

## Decision

AgentRail publishes the current prerelease line under the Sacred Labs npm org
using `@sacredlabs/agentrail-*` workspace package names.

The repository root remains `agentrail` and `private: true` so the
monorepo root cannot be accidentally published. Publishable workspace packages
remain public prerelease packages with `publishConfig.access=public` and
`publishConfig.tag=next`.

## Why

The shorter `@agentrail/*` npm package scope is blocked until npm support
approves creation of the `agentrail` organization scope. Publishing under
`@sacredlabs/agentrail-*` keeps the product name visible, uses the organization
the operator already controls, and avoids publishing bare `@sacredlabs/*`
packages that could collide with future Sacred Labs projects.

This namespace decision is package-distribution only. It must not change
wallet, policy gateway, SDK, MCP, payment, identity, A2A, marketplace, or live
IOTA behavior.

## Current Publishable Packages

- `@sacredlabs/agentrail-accounts`
- `@sacredlabs/agentrail-contracts-metadata`
- `@sacredlabs/agentrail-manifest`
- `@sacredlabs/agentrail-marketplace`
- `@sacredlabs/agentrail-mcp-server`
- `@sacredlabs/agentrail-policy-gateway`
- `@sacredlabs/agentrail-receipts`
- `@sacredlabs/agentrail-registry`
- `@sacredlabs/agentrail-sdk`
- `@sacredlabs/agentrail-shared-types`
- `@sacredlabs/agentrail-standards`

Private workspaces such as the demo app, docs site, and policy gateway service
are not publishable package surfaces.

## Mechanical Gates

The release metadata tests enforce:

- root package is private;
- public package names stay in `@sacredlabs/agentrail-*`;
- package versions stay aligned on `0.0.0-prerelease`;
- packages publish ESM `dist/index.js` plus `dist/index.d.ts`;
- package exports expose only the built root entrypoint;
- package files include built JavaScript, built types, `LICENSE`, and
  `README.md`;
- `publishConfig` uses public access and the `next` tag;
- internal package dependencies pin to the repo prerelease version;
- root `build` and `pack:check` cover every public package workspace;
- private app workspaces do not carry public publish metadata.

`npm run publish:dry-run` adds an opt-in release-operator gate:

- builds every workspace first;
- enumerates every non-private package under `packages/*`;
- excludes private app workspaces;
- runs `npm publish --dry-run --tag next --access public` with explicit `-w`
  workspace arguments for the public packages;
- prints package names plus `mode=dry-run` and `realPublish=false`.

This command may print npm's normal dry-run warning about not being logged in.
That warning is acceptable for local release rehearsal; it is also why this
gate must not be treated as proof of npm account ownership, package-name
availability, 2FA readiness, provenance signing, registry authorization, or
successful real publication.

`npm run smoke:package-install` adds a deterministic local installability gate:

- builds every workspace first;
- packs every non-private package under `packages/*` into a temporary
  directory;
- installs those local tarballs together into a fresh temporary consumer
  project with lifecycle scripts, audit, funding prompts, and package-lock
  writes disabled;
- imports each public package root entrypoint from the temporary consumer.

This proves the current local tarball bundle can be installed and imported
together. It does not prove npm registry installability, package-name
availability, account ownership, provenance, install behavior for partial
package sets, or downstream application compatibility.

`npm run smoke:package-paid-mcp-consumer` adds an opt-in local adoption proof:

- builds every workspace first;
- packs every non-private package under `packages/*` into a temporary
  directory;
- installs those local tarballs together into a fresh temporary consumer
  project with lifecycle scripts, audit, funding prompts, and package-lock
  writes disabled;
- runs a generated consumer program that imports only package root entrypoints
  from `@sacredlabs/agentrail-sdk`, `@sacredlabs/agentrail-manifest`, and
  `@sacredlabs/agentrail-policy-gateway`;
- starts an in-process mock policy gateway and exercises the canonical paid
  MCP-style flow through SDK-to-gateway calls;
- proves approval, policy denial, failed-payment withholding, receipt event
  evidence, and redaction markers without live network calls.

This proves a fresh local consumer project can run the first AgentRail
adoption wedge from packed package APIs. It does not prove npm registry
installability, package-name availability, live payments, custody,
marketplace, public A2A hosting, or live IOTA/testnet execution. The command is
opt-in and intentionally stays out of `verify:fast`, `verify:local`, and
`grant:check` until its runtime cost and stability are deliberately accepted.

`npm run smoke:npm-registry-paid-mcp-consumer` adds an opt-in published-package
adoption proof:

- contacts the public npm registry;
- installs the published `@sacredlabs/agentrail-*` packages into a fresh
  temporary consumer project;
- uses `NPM_CONFIG_MIN_RELEASE_AGE=0` because this machine can hide newly
  published packages behind a local release-age gate;
- runs the same package-root paid MCP-style approval, policy-denial,
  failed-payment, receipt, and redaction checks;
- writes a redacted local report to
  `tmp/agentrail/npm-registry-consumer-proof.json`.

This proves the current published package set can be installed from npm and
used by a fresh consumer for the first AgentRail adoption wedge. It is still
local mock execution proof, not live IOTA, live payment-provider, custody,
marketplace, or public A2A proof. The command is intentionally excluded from
`verify:fast`, `verify:local`, and `grant:check` because it is networked and
registry-state dependent.

`npm run proof:package-publication-readiness` adds a non-networked registry
publication readiness gate:

- checks the local package release docs, dry-run helper, install smoke helper,
  paid MCP consumer tarball smoke helper, package metadata tests, and script
  wiring;
- verifies every current public workspace is included in `pack:check`;
- keeps `publish:dry-run` and package publication readiness out of
  `verify:fast`, `verify:local`, and `grant:check`;
- blocks npm registry publication claims unless `PACKAGE_PUBLICATION_REPORT`
  points to an ignored redacted structured report from an operator-approved
  publication proof.

When the structured report is missing, the readiness gate points operators at
the ignored report-template command first:

```bash
npm run operator:write-report-template -- --kind package-publication --out tmp/agentrail/package-publication-report-template.json
```

The template is preparation only. It remains `pending-operator-proof` until a
real operator-approved publication proof fills in status-only passing evidence.

The structured report must be status-only JSON with `schemaVersion=1`,
`kind=agentrail.package-publication-proof`, `result=passed`,
`registry=npm`, a recent `observedAt`, every current public package name, and
check ids for pack dry-run, local tarball install, npm publish dry-run,
npm registry paid MCP consumer proof, registry install, provenance review, and
rollback review. It must not include npm tokens, OTPs, npmrc contents,
credentials, authorization headers, raw registry responses, signatures, or
local secret paths.

The readiness gate can also emit a redacted local audit artifact:

```bash
npm run proof:package-publication-readiness -- --json
npm run proof:package-publication-readiness -- --out tmp/agentrail/package-publication-readiness.json
```

The artifact records schema version, kind, timestamp, local proof status,
publication readiness status, public package names, check ids grouped by
status, blocker codes, checks, and safety boundaries. The `--out` file is
written with mode `600` and must stay outside committed files. It does not
publish packages, contact npm, prove package ownership, prove 2FA/provenance,
or clear registry publication readiness by itself.

`npm run package:write-publication-proof-plan` adds a non-networked
publication proof-plan writer for operators:

- builds first;
- contacts no npm registry and runs no real `npm publish`;
- emits command order, current blocker codes, package names, required
  structured report fields, required check ids, and proof boundaries;
- can write an ignored local JSON artifact such as
  `tmp/agentrail/package-publication-proof-plan.json`;
- keeps npm publication credentials, OTPs, npmrc contents, authorization
  headers, raw registry responses, signatures, package-owner account details,
  and local secret paths out of output and Git.

`npm run package:write-publication-proof-bundle -- --out
tmp/agentrail/package-publication-proof-bundle.json` writes the proof plan, the
publication readiness artifact, and the package-publication report template
together as ignored local artifacts. It also writes a summary with package
names, blocker codes, required report fields, required check ids, command
order, and boundaries. The bundle is preparation only: it contacts no npm
registry, runs no real publish, does not prove npm account ownership, and does
not clear registry publication readiness without an operator-approved
structured publication report.

## Publication Evidence

The `0.0.0-prerelease` package set is published to npm under
`@sacredlabs/agentrail-*` with the requested `next` tag. npm also currently
exposes `latest=0.0.0-prerelease`; an attempted `latest` deletion returned
npm `E400`, so the registry state remains `next` plus `latest` on the
prerelease version.

Publication evidence for the current prerelease includes:

- `npm run pack:check`
- `npm run smoke:package-install`
- `npm run smoke:package-paid-mcp-consumer`
- `npm run smoke:npm-registry-paid-mcp-consumer`
- `npm run publish:dry-run`
- real `npm publish --tag next --access public`
- registry dist-tag proof showing `next=0.0.0-prerelease` and
  `latest=0.0.0-prerelease` for all 11 public packages
- registry install/import proof for all 11 public packages
- redacted npm registry consumer proof at
  `tmp/agentrail/npm-registry-consumer-proof.json`
- an ignored local structured report accepted by
  `PACKAGE_PUBLICATION_REPORT=tmp/agentrail/package-publication-report-sacredlabs.json npm run proof:package-publication-readiness`

This machine has npm's local `min-release-age` safety gate enabled. Immediate
post-publish registry install proof used `NPM_CONFIG_MIN_RELEASE_AGE=0` so the
fresh prerelease could be verified before the local age window elapsed.

Do not claim the future `@agentrail/*` namespace, provenance signing,
stable package release, production launch readiness, live IOTA execution,
payment-provider settlement, marketplace production operation, or production
custody from this package publication. The registry-retained `latest` tag is a
dist-tag state for the first prerelease package set, not a stable release claim.

Future real `npm publish` runs require explicit operator approval, npm registry
credentials outside the repo, and a fresh release checklist. `npm pack
--dry-run` and `npm publish --dry-run` are safe local release checks; real
publication remains an operator-gated release action.

## Dist-Tag Decision

For this first prerelease package set, keep documentation and examples pinned
to `@next` or `@0.0.0-prerelease` even though npm currently exposes the same
version through `latest`. Do not treat `latest` as a stable-release signal.

The next package publication should use a new prerelease version and explicitly
verify dist-tags after publish. If npm support approves the `@agentrail/*`
scope, handle that migration as a separate compatibility release rather than
rewriting package names inside a behavior slice.

## Future Scope Migration Path

A future migration from `@sacredlabs/agentrail-*` to `@agentrail/*` remains
possible if npm support approves the `agentrail` org scope, but it must be a
dedicated compatibility slice that updates:

- package names;
- package imports and exports;
- lockfile references;
- examples and docs;
- install instructions;
- package dry-runs and publish dry-runs;
- migration notes for downstream consumers.

Do not combine that rename with wallet, signing, policy, payment, identity,
A2A, marketplace, or live IOTA behavior changes.
