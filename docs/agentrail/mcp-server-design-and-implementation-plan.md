# MCP Server Design And Implementation Plan

Date: 2026-06-16

Status: Apex planning artifact for a future implementation slice. This document
is tracked product planning, not proof that the runnable MCP server already
exists.

## Executive Decision

Build a real runnable MCP stdio entrypoint for
`@sacredlabs/agentrail-mcp-server`, but keep AgentRail's center of gravity
unchanged:

> AgentRail is IOTA-native infrastructure for agent-safe sponsored execution.
> MCP is one adapter surface that lets agent runtimes call that infrastructure.

The first runnable MCP version should be deliberately narrow. It should expose
the existing sponsored-action tools over stdio, route every value-bearing action
through the existing SDK and policy gateway, and prove the path with local mock
gateway smokes before any new npm publication.

## Apex Planning Context

- Mode: `planning`.
- Surface: runnable MCP design and implementation planning.
- Downshift proof: planning-only durable docs slice; no runtime MCP
  implementation in this tranche.
- Product authority read: `CLAUDE.md`, `docs/CODEBASE_MAP.md`,
  `docs/architecture.md`, `docs/agentrail/verification-hardening.md`,
  `docs/security/secrets.md`, `docs/security/sponsor-wallet.md`, and
  `docs/agentrail/package-integration-guide.md`.
- Current package reality: `packages/mcp-server` exports a programmatic facade
  through `createIotaMcpServer()`, but has no `bin`, stdio transport, hosted
  transport, or agent-client configuration snippets yet.

## Goal

Make the MCP package installable and runnable by an agent host:

```bash
npm install @sacredlabs/agentrail-mcp-server@next
npm exec -- agentrail-mcp
```

The server must read gateway configuration from the MCP server process
environment, list the AgentRail sponsored-action tools, call the existing SDK
gateway route, return structured MCP tool results, and avoid leaking secrets in
stdout, stderr, logs, reports, package fixtures, or docs. The LLM/agent prompt
must never receive those env values; at most, an MCP host process receives them
from a local secret store or uncommitted client configuration.

## Non-Goals

Do not include these in the first runnable MCP slice:

- direct IOTA RPC calls from the MCP process;
- direct IOTA Gas Station calls from the MCP process;
- sponsor private keys, raw signer material, seed export, custody, or KMS;
- hosted HTTP or Streamable HTTP MCP transport;
- OAuth or multi-tenant hosted MCP auth;
- public A2A hosting or conformance;
- live payment-provider settlement;
- marketplace launch;
- stable package release claims;
- publishing over the already-published `0.0.0-prerelease` version.

## Current Implementation Baseline

The existing MCP package already has the right core boundary:

- `packages/mcp-server/src/tools.ts` defines:
  - `iota.request_sponsored_transaction`;
  - `iota.open_escrow`;
  - JSON-schema-shaped tool descriptors;
  - manifest input validation through `@sacredlabs/agentrail-manifest`;
  - structured approval, denial, and invalid-input results.
- `packages/mcp-server/src/server.ts` constructs an `IotaAgent` from
  `@sacredlabs/agentrail-sdk` and calls the gateway sponsorship route.
- `packages/mcp-server/src/tools.test.ts` already proves:
  - happy-path gateway routing;
  - escrow tool routing;
  - invalid input fail-closed behavior;
  - gateway denial as structured error;
  - SDK route stays `.../v1/agent/sponsorships`.

The missing pieces are transport, CLI config, package bin metadata, stdio
smoke coverage, consumer `npx` proof, and updated docs.

## Design Principles

1. Keep the existing facade as the testable core.
2. Use the official MCP TypeScript SDK for protocol and stdio transport rather
   than hand-rolling JSON-RPC.
3. Make stdio the first transport because it is the lowest-friction local agent
   integration path.
4. Write only MCP protocol messages to stdout after stdio transport starts;
   diagnostics go to stderr.
5. Read secrets from environment variables only. Do not accept API keys as CLI
   args because process lists and shell histories are easy to leak.
6. Fail closed when required environment variables are missing or malformed.
7. Preserve structured denial and invalid-input semantics. Do not collapse
   policy denial into generic transport failure.
8. Keep local smoke proof deterministic and non-networked by using the existing
   mock policy gateway.

## Proposed Package Surface

### Package Metadata

Update `packages/mcp-server/package.json`:

```json
{
  "bin": {
    "agentrail-mcp": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./stdio": {
      "types": "./dist/stdio.d.ts",
      "import": "./dist/stdio.js"
    }
  },
  "files": [
    "dist/**/*.js",
    "dist/**/*.d.ts",
    "LICENSE",
    "README.md"
  ]
}
```

Add `@modelcontextprotocol/sdk` as a runtime dependency after checking the
current official TypeScript SDK import paths during implementation.

### Source Files

Add or update:

| File | Purpose |
| --- | --- |
| `packages/mcp-server/src/config.ts` | Parse env/config, validate URLs, require API key, redact config for diagnostics. |
| `packages/mcp-server/src/stdio.ts` | Adapt `IOTA_MCP_TOOLS` and `callIotaMcpTool()` to the official MCP server API and stdio transport. |
| `packages/mcp-server/src/cli.ts` | Executable entrypoint with shebang, help/version/check-config handling, and stdio startup. |
| `packages/mcp-server/src/index.ts` | Keep existing exports stable; optionally export config helpers only if useful. |
| `packages/mcp-server/src/*.test.ts` | Focused tests for config parsing, no secret echo, and tool registration. |

Do not remove `createIotaMcpServer()`; it remains the library-level facade used
by current consumers and tests.

## Configuration Contract

Required environment:

| Name | Required | Purpose | Secret |
| --- | --- | --- | --- |
| `AGENTRAIL_GATEWAY_URL` | Yes | AgentRail-compatible policy gateway base URL. | No, but do not print full private deployment URLs in errors when avoidable. |
| `AGENTRAIL_API_KEY` | Yes | Gateway app credential. | Yes. Never print or return. |

Optional environment:

| Name | Default | Purpose |
| --- | --- | --- |
| `AGENTRAIL_MCP_SERVER_NAME` | `agentrail` | MCP server name reported to clients. |
| `AGENTRAIL_MCP_SERVER_VERSION` | package version | MCP server version when available. |
| `AGENTRAIL_MCP_LOG_LEVEL` | `error` | Stderr-only diagnostics level. |

CLI flags:

| Flag | Behavior |
| --- | --- |
| `--help` | Print usage to stdout and exit without reading secrets. |
| `--version` | Print package version to stdout and exit. |
| `--check-config` | Validate required configuration, print redacted status to stderr/stdout, and exit. |

Do not add `--api-key`. If a non-secret `--gateway-url` is added later, it must
not override the rule that API keys come only from server-side env or secret
stores.

Client configuration snippets must use placeholders for `AGENTRAIL_API_KEY` and
must not encourage committing host config files that contain real secrets.

## MCP Tool Behavior

The first runnable server exposes the existing tools:

| Tool | Input | Output |
| --- | --- | --- |
| `iota.request_sponsored_transaction` | `{ manifest }` | Structured sponsored-action approval or structured denial. |
| `iota.open_escrow` | `{ manifest }` | Same gateway-routed sponsored-action behavior, for escrow-shaped manifests. |

Tool requirements:

- validate input before any gateway call;
- reject unknown tools without gateway calls;
- call only the SDK-backed gateway route for sponsored/value-bearing actions;
- preserve policy denial reason codes in structured content;
- return transport-level errors only for true protocol/server failures;
- never include `AGENTRAIL_API_KEY`, raw transaction bytes, user signatures,
  signer refs, sponsor keys, bearer tokens, private keys, mnemonics, local
  secret paths, raw upstream responses, or payment credentials in output.

## Stdio Transport Design

The stdio adapter should:

1. parse and validate env before opening the transport;
2. construct the existing `createIotaMcpServer()` facade;
3. register each descriptor from `IOTA_MCP_TOOLS`;
4. bridge MCP tool calls to `server.callTool(name, input)`;
5. map `IotaMcpToolCallResult` into the official MCP tool-result shape;
6. write protocol messages only to stdout;
7. write diagnostics only to stderr;
8. shut down cleanly on stdin close, `SIGINT`, and `SIGTERM`.

If the official SDK requires a different result shape than the current
`IotaMcpToolCallResult`, add a small mapping function and test it directly.
After the transport starts, `console.log()` and other stdout diagnostics are
disallowed. Help/version output may use stdout only before stdio transport is
opened.

## Verification Plan

### Unit Tests

Add focused tests for:

- config parser accepts valid env;
- config parser rejects missing `AGENTRAIL_GATEWAY_URL`;
- config parser rejects missing `AGENTRAIL_API_KEY`;
- config parser does not include API key values in errors;
- MCP mapping preserves approval structured content;
- MCP mapping preserves denial structured content and `isError`;
- unknown tool fails before any gateway call;
- invalid manifest fails before any gateway call.

### Stdio Smoke

Add `scripts/smoke-mcp-stdio.ts` and a root script:

```json
{
  "smoke:mcp-stdio": "npm run build && tsx scripts/smoke-mcp-stdio.ts"
}
```

The smoke should:

1. start `createAgentMockGatewayServer()` on loopback;
2. build env with `AGENTRAIL_GATEWAY_URL` and a fake local API key;
3. spawn `node packages/mcp-server/dist/cli.js`;
4. perform MCP initialize/list-tools/call-tool exchanges over stdio using the
   official client transport when practical;
5. call an approved manifest;
6. call a denied manifest;
7. call invalid input;
8. assert stdout contains valid MCP protocol responses only;
9. assert stderr does not contain the fake API key, signer ref, raw transaction
   bytes, user signatures, local secret paths, or raw upstream body;
10. assert `dist/cli.js` starts with a shebang so npm can expose the bin
    reliably;
11. close the process and mock gateway cleanly.

### Package Consumer Smoke

After the local stdio smoke passes, extend package consumer proof:

- local tarball consumer installs `@sacredlabs/agentrail-mcp-server`;
- consumer confirms package root exports still work;
- consumer confirms `node_modules/.bin/agentrail-mcp` exists;
- the smoke starts a loopback mock gateway from the repo test harness, then
  starts the consumer bin with `AGENTRAIL_GATEWAY_URL` pointed at that mock
  gateway;
- consumer repeats list/call proof without importing monorepo internals.

Keep the registry smoke separate until a new package version is published.

### Verification Commands

Minimum implementation-slice checks:

```bash
node --import tsx --test packages/mcp-server/src/*.test.ts
npm run smoke:mcp-stdio
node --import tsx --test scripts/package-scripts.test.ts
npm run typecheck
npm run docs:check
npm run secrets:scan
git diff --check
```

Before claiming release readiness:

```bash
npm run pack:check
npm run smoke:package-install
npm run smoke:package-paid-mcp-consumer
npm run proof:package-publication-readiness
```

Before publishing a runnable MCP package:

- choose a new version because `0.0.0-prerelease` has already been published;
- run `npm run publish:dry-run`;
- get explicit operator approval for real publish;
- after publish, run `npm run smoke:npm-registry-paid-mcp-consumer` or a new
  registry MCP-stdio smoke against the new version.

## Implementation Slices

### Slice 1: CLI And Config Scaffold

Mode: `shared-surface`, because this touches package metadata, build output,
security-sensitive config, and package install behavior.

Owned files:

- `packages/mcp-server/package.json`
- `packages/mcp-server/src/config.ts`
- `packages/mcp-server/src/cli.ts`
- `packages/mcp-server/src/index.ts`
- `packages/mcp-server/src/config.test.ts`
- `package-lock.json`

Acceptance:

- package builds;
- `agentrail-mcp --help` works from built output;
- missing env fails closed with variable names only;
- API key value is never printed.

### Slice 2: Official MCP Stdio Bridge

Mode: `shared-surface`.

Owned files:

- `packages/mcp-server/src/stdio.ts`
- `packages/mcp-server/src/stdio.test.ts`
- `packages/mcp-server/src/cli.ts`
- `packages/mcp-server/src/tools.ts` only if mapping needs a narrow adjustment.

Acceptance:

- MCP server initializes over stdio;
- `tools/list` exposes existing tool names and schemas;
- `tools/call` routes to SDK/gateway;
- approval and denial behavior match current facade tests.

### Slice 3: Local Stdio Smoke And Script Wiring

Mode: `shared-surface`.

Owned files:

- `scripts/smoke-mcp-stdio.ts`
- `scripts/package-scripts.test.ts`
- `package.json`

Acceptance:

- `npm run smoke:mcp-stdio` passes locally without live network calls;
- package-script tests prove the smoke is opt-in or placed in the intended
  verification profile;
- built CLI output has a shebang and no stdio logs after transport startup;
- stderr/stdout redaction checks are explicit.

Initial recommendation: keep `smoke:mcp-stdio` opt-in during the first slice.
Promote it into `verify:local` only after runtime cost and flake risk are
measured.

### Slice 4: Package Consumer And Docs

Mode: `shared-surface`.

Owned files:

- `scripts/smoke-package-paid-mcp-consumer.ts` or a new
  `scripts/smoke-package-mcp-stdio-consumer.ts`
- `scripts/package-install-smoke.test.ts`
- `packages/mcp-server/README.md`
- `docs/agentrail/package-integration-guide.md`
- `docs/quickstart.md`
- `README.md`

Acceptance:

- fresh local tarball consumer can find and start `agentrail-mcp`;
- docs no longer say the MCP package lacks a standalone bin after the bin
  exists;
- docs still say AgentRail is broader than MCP.

### Slice 5: Version And Publication Prep

Mode: `shared-surface`.

Owned files:

- `packages/mcp-server/package.json`
- `package-lock.json`
- `docs/agentrail/package-release-strategy.md`
- package publication proof scripts only if they need to understand a
  package-specific version.

Acceptance:

- a new version is selected for the MCP package;
- the release strategy says whether this is an MCP-package-only version bump or
  a coordinated workspace version bump;
- `npm run pack:check` includes the bin;
- `npm run publish:dry-run` proves package metadata without publishing;
- real publish remains blocked until explicit owner approval.

### Slice 6: Optional Registry Release And Registry Smoke

Mode: `reconciliation` or `shared-surface`, depending on whether any code or
docs change after publish.

Acceptance:

- owner explicitly approves real npm publish;
- publish uses the selected tag and version;
- registry smoke installs the newly published version;
- docs and release strategy record what was published and what remains
  non-production proof.

## Failure Modes To Guard

| Risk | Guard |
| --- | --- |
| LLM/agent prompt receives gateway API key. | Config comes from MCP server process env or host secret store only; never echo values or include real values in docs. |
| MCP stdout polluted by logs. | Protocol-only stdout after transport start; diagnostics stderr only; smoke checks both streams. |
| MCP tool bypasses policy gateway. | Route tests assert SDK gateway endpoint; no direct Gas Station/IOTA calls. |
| Local smoke accidentally contacts live network. | Use loopback mock gateway and assert boundary metadata. |
| Published package cannot be run through the package bin. | Consumer smoke checks `node_modules/.bin/agentrail-mcp` and `npm exec -- agentrail-mcp`. |
| Re-publish fails with duplicate version. | Version decision before real publish; no `0.0.0-prerelease` republish. |
| Docs imply AgentRail is just MCP. | Keep package guide language: MCP is an adapter surface. |

## Rollback And Mitigation

- If the MCP SDK integration is unstable, keep the package facade and stop at
  the CLI/config scaffold until SDK API usage is verified.
- If stdio smoke is flaky, keep it opt-in and do not add it to
  `verify:local` until the process lifecycle is deterministic.
- If package consumer proof fails because bin files are missing from tarballs,
  fix `files`, build output, and shebang handling before changing docs.
- If any output leaks secret-like values, block the slice, patch redaction, and
  rerun `npm run secrets:scan` plus focused stdio smoke.
- If npm publication is blocked, keep local tarball proof and update release
  strategy; do not claim registry availability for the new MCP bin.

## Definition Of Done

The runnable MCP implementation is done when a clean consumer can install the
package, start `agentrail-mcp` over stdio with server-side env config, list the
AgentRail tools, call the sponsored-action tool through a mock policy gateway,
observe approval and denial results, and verify that no secrets or raw signing
material appear in protocol output, logs, docs, or reports.

It is release-ready only after a new version is selected, package dry-run
passes, owner approval is explicit, and registry install proof passes against
the newly published version.
