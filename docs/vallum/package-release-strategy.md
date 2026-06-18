# Package Release Strategy

Last updated: 2026-06-18.

## Decision

Vallum publishes the first official package line under `@vallum/*` workspace
package names.

Consumer package selection, SDK configuration, and agent-runtime guidance live
in [Package Integration Guide](package-integration-guide.md).

The repository root remains `vallum` and `private: true` so the monorepo root
cannot be accidentally published. Publishable workspace packages are public
packages with `publishConfig.access=public` and `publishConfig.tag=latest`.

The current official release line is `0.1.0` for every public `@vallum/*`
workspace package, including the runnable MCP stdio CLI. It publishes on the
npm `latest` dist-tag. The previous coordinated public line was
`0.0.1-prerelease.1`; before that, `0.0.1-prerelease.0` and
`0.0.0-prerelease` were prerelease package lines, with
`@vallum/mcp-server@0.0.1-mcp.0` as an interim MCP-package-only CLI bump.

## Why

The old package namespace no longer matches the chosen product name. Moving the
workspace to `@vallum/*` keeps the package surface aligned with the brand and
forces any real registry publication to pass through fresh operator proof for
scope ownership, registry authorization, dist-tags, provenance decisions, and
rollback readiness.

This namespace decision is package-distribution only. It must not change
wallet, policy gateway, SDK, MCP, payment, identity, A2A, marketplace, or live
IOTA behavior.

## Current Publishable Packages

- `@vallum/accounts`
- `@vallum/contracts-metadata`
- `@vallum/manifest`
- `@vallum/marketplace`
- `@vallum/mcp-server`
- `@vallum/policy-gateway`
- `@vallum/receipts`
- `@vallum/registry`
- `@vallum/sdk`
- `@vallum/shared-types`
- `@vallum/standards`

Private workspaces such as the demo app, docs site, and policy gateway service
are not publishable package surfaces.

## Mechanical Gates

The release metadata tests enforce:

- root package is private;
- public package names stay in `@vallum/*`;
- package versions stay aligned on `0.1.0`;
- packages publish ESM `dist/index.js` plus `dist/index.d.ts`;
- package exports expose only reviewed built entrypoints;
- the MCP server package is the only public package with a CLI bin, and that
  bin is `vallum-mcp` pointing at `dist/cli.js`;
- package files include built JavaScript, built types, `LICENSE`, and
  `README.md`;
- `publishConfig` uses public access and the `latest` tag;
- internal package dependencies pin to the repo release version;
- root `build` and `pack:check` cover every public package workspace;
- private app workspaces do not carry public publish metadata.

`npm run publish:dry-run` adds an opt-in release-operator gate:

- builds every workspace first;
- enumerates every non-private package under `packages/*`;
- excludes private app workspaces;
- runs `npm publish --dry-run --tag latest --access public` with explicit `-w`
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
  from `@vallum/sdk`, `@vallum/manifest`, and
  `@vallum/policy-gateway`;
- starts an in-process mock policy gateway and exercises the canonical paid
  MCP-style flow through SDK-to-gateway calls;
- proves approval, policy denial, failed-payment withholding, receipt event
  evidence, and redaction markers without live network calls.

This proves a fresh local consumer project can run the first Vallum
adoption wedge from packed package APIs. It does not prove npm registry
installability, package-name availability, live payments, custody,
marketplace, public A2A hosting, or live IOTA/testnet execution. The command is
opt-in and intentionally stays out of `verify:fast`, `verify:local`, and
`grant:check` until its runtime cost and stability are deliberately accepted.

`npm run smoke:npm-registry-paid-mcp-consumer` adds an opt-in published-package
adoption proof:

- contacts the public npm registry;
- installs the published `@vallum/*` packages into a fresh
  temporary consumer project;
- uses `NPM_CONFIG_MIN_RELEASE_AGE=0` because this machine can hide newly
  published packages behind a local release-age gate;
- runs the same package-root paid MCP-style approval, policy-denial,
  failed-payment, receipt, and redaction checks;
- writes a redacted local report to
  `tmp/vallum/npm-registry-consumer-proof.json`.

This proves the current published package set can be installed from npm and
used by a fresh consumer for the first Vallum adoption wedge. It is still local
mock execution proof, not live IOTA, live payment-provider, custody,
marketplace, or public A2A proof. The command is intentionally excluded from
`verify:fast`, `verify:local`, and `grant:check` because it is networked and
registry-state dependent.

`npm run smoke:npm-registry-mcp-stdio-consumer` adds the matching
published-package proof for the runnable MCP stdio bin:

- contacts the public npm registry;
- installs the published MCP server package plus required mock-gateway support
  packages into a fresh temporary consumer project;
- starts `node_modules/.bin/mcp`;
- proves initialize, tool listing, approval, policy denial, invalid input,
  stdin-close shutdown, and redaction markers against a loopback mock gateway;
- writes a redacted local report to
  `tmp/vallum/npm-registry-mcp-stdio-consumer-proof.json`.

This proves registry install plus local MCP stdio execution only, not live
IOTA, production gateway, payment, custody, marketplace, or public A2A
behavior. The command is intentionally excluded from `verify:fast`,
`verify:local`, and `grant:check` because it is networked and registry-state
dependent.

`npm run proof:package-publication-readiness` adds a non-networked registry
publication readiness gate:

- checks the local package release docs, dry-run helper, install smoke helper,
  paid MCP consumer tarball smoke helper, MCP stdio tarball smoke helper,
  npm-registry proof helpers, package metadata tests, and script wiring;
- verifies every current public workspace is included in `pack:check`;
- keeps `publish:dry-run` and package publication readiness out of
  `verify:fast`, `verify:local`, and `grant:check`;
- blocks npm registry publication claims unless `PACKAGE_PUBLICATION_REPORT`
  points to an ignored redacted structured report from an operator-approved
  publication proof.

When the structured report is missing, the readiness gate points operators at
the ignored report-template command first:

```bash
npm run operator:write-report-template -- --kind package-publication --out tmp/vallum/package-publication-report-template.json
```

The template is preparation only. It remains `pending-operator-proof` until a
real operator-approved publication proof fills in status-only passing evidence.

The structured report must be status-only JSON with `schemaVersion=1`,
`kind=vallum.package-publication-proof`, `result=passed`,
`registry=npm`, a recent `observedAt`, every current public package name, and
check ids for pack dry-run, local tarball install, npm publish dry-run,
npm registry paid MCP consumer proof, registry install, provenance review, and
rollback review. It must not include npm tokens, OTPs, npmrc contents,
credentials, authorization headers, raw registry responses, signatures, or
local secret paths.

The readiness gate can also emit a redacted local audit artifact:

```bash
npm run proof:package-publication-readiness -- --json
npm run proof:package-publication-readiness -- --out tmp/vallum/package-publication-readiness.json
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
  `tmp/vallum/package-publication-proof-plan.json`;
- keeps npm publication credentials, OTPs, npmrc contents, authorization
  headers, raw registry responses, signatures, package-owner account details,
  and local secret paths out of output and Git.

`npm run package:write-publication-proof-bundle -- --out
tmp/vallum/package-publication-proof-bundle.json` writes the proof plan, the
publication readiness artifact, and the package-publication report template
together as ignored local artifacts. It also writes a summary with package
names, blocker codes, required report fields, required check ids, command
order, and boundaries. The bundle is preparation only: it contacts no npm
registry, runs no real publish, does not prove npm account ownership, and does
not clear registry publication readiness without an operator-approved
structured publication report.

## Publication Evidence

The `0.1.0` package set is the first official npm release under `@vallum/*`.
The previous coordinated public line was `0.0.1-prerelease.1`; before that,
the prerelease lines were `0.0.1-prerelease.0` and `0.0.0-prerelease`. The
MCP package also had the interim runnable-stdio prerelease
`@vallum/mcp-server@0.0.1-mcp.0`.

Publication evidence for the current official release includes:

- `npm run pack:check`
- `npm run smoke:package-install`
- `npm run smoke:package-paid-mcp-consumer`
- `npm run smoke:npm-registry-paid-mcp-consumer`
- `npm run smoke:npm-registry-mcp-stdio-consumer`
- `npm run publish:dry-run`
- real `npm publish --tag latest --access public`
- registry visibility proof for all 11 public `@vallum/*` packages;
- old package deletion proof showing the `@sacredlabs/agentrail-*` package
  line returns npm E404;
- registry install/import proof for all public packages;
- redacted npm registry consumer proof at
  `tmp/vallum/npm-registry-consumer-proof.json`
- redacted npm registry MCP stdio proof at
  `tmp/vallum/npm-registry-mcp-stdio-consumer-proof.json`
- an ignored local structured report accepted by
  `PACKAGE_PUBLICATION_REPORT=tmp/vallum/package-publication-report.json npm run proof:package-publication-readiness`

This machine may have npm's local `min-release-age` safety gate enabled. If an
operator needs immediate post-publish registry install proof, use
`NPM_CONFIG_MIN_RELEASE_AGE=0` deliberately and record that choice in the
ignored publication report.

Do not claim provenance signing, production launch readiness, live IOTA
execution, payment-provider settlement, marketplace production operation, or
production custody from this package publication.

## Runnable MCP Package Publication

The source tree now publishes `@vallum/mcp-server@0.1.0` as part of the
coordinated workspace release. The previous
`@vallum/mcp-server@0.0.1-mcp.0` publication was an MCP-package-only CLI bump
over the older `0.0.0-prerelease` API line.

Before claiming npm availability for `vallum-mcp`, operators proved the
selected package metadata without publishing:

```bash
npm run pack:check
npm run publish:dry-run
```

The pack proof must include `@vallum/mcp-server` and its
`vallum-mcp` bin. The publish dry-run is still a metadata rehearsal only; it
must not be treated as proof of npm account ownership, package-name
availability, 2FA readiness, provenance signing, registry authorization, or
successful real publication.

Real publication of `@vallum/mcp-server@0.0.1-mcp.0` was operator-approved on
2026-06-16 and published to npm with `--access public` and `--tag next`.
Post-publish registry proof installed that MCP version and started
`vallum-mcp` from the npm package with:

```bash
npm run smoke:npm-registry-mcp-stdio-consumer
```

That proof covers registry install plus local MCP stdio execution against a
mock policy gateway. It does not prove live IOTA, production gateway,
payment-provider settlement, production custody, marketplace operation, or
public A2A hosting.

Future real `npm publish` runs require explicit operator approval, npm registry
credentials outside the repo, and a fresh release checklist. `npm pack
--dry-run` and `npm publish --dry-run` are safe local release checks; real
publication remains an operator-gated release action.

## Dist-Tag Decision

For the current official package set, documentation and examples should use the
default npm `latest` path or pin exact `0.1.0` versions where reproducibility
matters. Do not move `latest` again without a reviewed release slice.

Each package publication should explicitly verify dist-tags after publish.

## Scope Rename Checklist

The migration to `@vallum/*` is a dedicated compatibility slice that updates:

- package names;
- package imports and exports;
- lockfile references;
- examples and docs;
- install instructions;
- package dry-runs and publish dry-runs;
- migration notes for downstream consumers.

Do not combine this rename with wallet, signing, policy, payment, identity,
A2A, marketplace, or live IOTA behavior changes.
