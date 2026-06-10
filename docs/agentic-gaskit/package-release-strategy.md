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
