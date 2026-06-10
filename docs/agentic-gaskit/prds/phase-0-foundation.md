# PRD: Phase 0 Foundation

## Problem

The repo has product direction but no implementation structure, dependency
strategy, build/test harness, localnet workflow, or module boundaries. Starting
with feature code would force future agents to invent architecture while also
implementing security-sensitive payment and sponsorship behavior.

## Goals

- Create a TypeScript-first monorepo with Move contract support.
- Establish package boundaries for SDK, MCP server, policy gateway, manifest,
  registry, receipts, CLI, dashboard, contracts, examples, and scripts.
- Add deterministic tests for pure logic before blockchain integration.
- Add a localnet/testnet development path for IOTA and Gas Station.
- Document external API refresh requirements.
- Establish git baseline, ignore rules, and structured commit practice.
- Make a clean checkout runnable by a future Codex agent.

## Non-Goals

- No production Gas Station deployment.
- No mainnet transaction execution.
- No marketplace.
- No full IOTA Identity/Names integration beyond dependency investigation.
- No hosted dashboard beyond a stub if needed for logs.

## Users

- Future implementers.
- Agentic GasKit maintainers.
- Operators who will eventually sponsor gas.

## Functional Requirements

- Provide package manager configuration and workspace layout.
- Provide scripts for lint, typecheck, unit tests, contract tests, and docs
  checks.
- Provide environment templates for localnet, testnet, and mocked execution.
- Provide a contracts harness that can run Move tests locally.
- Provide a minimal local service harness for the policy gateway.
- Provide source-controlled example policies and manifests.
- Provide README instructions for first-run setup.
- Initialize or verify git metadata, default branch, `.gitignore`, and baseline
  commit before implementation work.

## Technical Requirements

- Prefer TypeScript packages for developer-facing SDK, MCP server, gateway,
  registry, manifest, receipts, and CLI.
- Prefer Move packages under `contracts/` for contract blocks.
- Keep IOTA client integration behind adapters so pure policy tests do not need
  a live chain.
- Use schema validation for manifests, policies, receipts, and profiles.
- Keep secrets in env files excluded from version control.
- Add typed fixtures for valid and invalid manifests/policies.

## Likely Files

- `package.json`
- `pnpm-workspace.yaml` or equivalent
- `tsconfig.base.json`
- `vitest.config.ts` or equivalent
- `README.md`
- `.env.example`
- `packages/manifest/`
- `packages/policy-gateway/`
- `packages/sdk/`
- `packages/mcp-server/`
- `packages/registry/`
- `packages/receipts/`
- `packages/cli/`
- `apps/dashboard/`
- `contracts/`
- `examples/`
- `scripts/`

## Acceptance Criteria

- Fresh checkout has documented install and test commands.
- Unit tests pass for at least one starter package.
- Contract test command exists, even if only a starter contract is present.
- Local gateway can start in mock mode.
- Env templates do not contain secrets.
- Module boundaries match `docs/CODEBASE_MAP.md`.
- CI or local check script runs lint, typecheck, unit tests, and docs checks.
- Git history contains a planning baseline and later implementation slices are
  committed separately or explicitly documented.

## Verification

- Run install.
- Run lint.
- Run typecheck.
- Run unit tests.
- Run contract tests or documented local equivalent.
- Start the mock policy gateway.
- Confirm no secret-looking values are committed.
- Run `git status --short --branch`.
- Run `git log --oneline --decorate -n 5`.

## Edge Cases

- IOTA localnet tooling is unavailable locally.
- Gas Station requires Redis/Docker setup.
- Move toolchain version changes.
- External SDK package names or APIs differ from the thesis.

## Risks

- Wrong package manager or framework choice creates churn later.
- Contract harness cannot run without significant IOTA setup.
- Future agents start coding around mocks and never prove localnet behavior.

## Escalation Triggers

- Official IOTA tooling requires a different language stack than planned.
- Gas Station cannot be run locally without material ops work.
- Move contract testing requires a repo structure incompatible with the monorepo.
