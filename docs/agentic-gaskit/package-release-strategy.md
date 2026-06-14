# Package Release Strategy

Last updated: 2026-06-10.

## Decision

Agentic GasKit keeps the conservative `@iota-gaskit/*` workspace package
namespace for the current prerelease line.

The repository root remains `agentic-gaskit` and `private: true` so the
monorepo root cannot be accidentally published. Publishable workspace packages
remain public prerelease packages with `publishConfig.access=public` and
`publishConfig.tag=next`.

## Why

The current product extends the existing IOTA GasKit sponsorship toolkit. A
full package namespace rename to `@agentic-gaskit/*` would touch every import,
example, README, lockfile, package dry-run, and downstream integration at the
same time. That is a compatibility migration, not a feature slice.

Keeping `@iota-gaskit/*` now avoids mixing package rename risk with wallet,
policy gateway, SDK, MCP, payment, identity, A2A, or marketplace safety work.

## Current Publishable Packages

- `@iota-gaskit/accounts`
- `@iota-gaskit/contracts-metadata`
- `@iota-gaskit/manifest`
- `@iota-gaskit/marketplace`
- `@iota-gaskit/mcp-server`
- `@iota-gaskit/policy-gateway`
- `@iota-gaskit/receipts`
- `@iota-gaskit/registry`
- `@iota-gaskit/sdk`
- `@iota-gaskit/shared-types`
- `@iota-gaskit/standards`

Private workspaces such as the demo app, docs site, and policy gateway service
are not publishable package surfaces.

## Mechanical Gates

The release metadata tests enforce:

- root package is private;
- public package names stay in `@iota-gaskit/*`;
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

`npm run proof:package-publication-readiness` adds a non-networked registry
publication readiness gate:

- checks the local package release docs, dry-run helper, install smoke helper,
  package metadata tests, and script wiring;
- verifies every current public workspace is included in `pack:check`;
- keeps `publish:dry-run` and package publication readiness out of
  `verify:fast`, `verify:local`, and `grant:check`;
- blocks npm registry publication claims unless `PACKAGE_PUBLICATION_REPORT`
  points to an ignored redacted structured report from an operator-approved
  publication proof.

When the structured report is missing, the readiness gate points operators at
the ignored report-template command first:

```bash
npm run operator:write-report-template -- --kind package-publication --out tmp/gaskit/package-publication-report-template.json
```

The template is preparation only. It remains `pending-operator-proof` until a
real operator-approved publication proof fills in status-only passing evidence.

The structured report must be status-only JSON with `schemaVersion=1`,
`kind=agentic-gaskit.package-publication-proof`, `result=passed`,
`registry=npm`, a recent `observedAt`, every current public package name, and
check ids for pack dry-run, local tarball install, npm publish dry-run,
registry install, provenance review, and rollback review. It must not include
npm tokens, OTPs, npmrc contents, credentials, authorization headers, raw
registry responses, signatures, or local secret paths.

The readiness gate can also emit a redacted local audit artifact:

```bash
npm run proof:package-publication-readiness -- --json
npm run proof:package-publication-readiness -- --out tmp/gaskit/package-publication-readiness.json
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
  `tmp/gaskit/package-publication-proof-plan.json`;
- keeps npm publication credentials, OTPs, npmrc contents, authorization
  headers, raw registry responses, signatures, package-owner account details,
  and local secret paths out of output and Git.

## Explicit Non-Claims

No package is claimed as published to npm today.

No real `npm publish` may run without explicit operator approval, npm registry
credentials outside the repo, and a fresh release checklist. `npm pack
--dry-run` and `npm publish --dry-run` are safe local release checks; real
publication is a separate operator-gated release slice.

## Future Rename Path

A future `@agentic-gaskit/*` migration remains possible, but it must be a
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
