# Agent Guide

Vallum now ships a repo-local Codex skill at
`skills/vallum/SKILL.md`.

Use it when an agent needs to navigate the repo, make SDK or gateway changes,
improve docs, run verification, review secret boundaries, integrate Vallum into
another app, or add the new agent-facing surfaces.

Before broad work, read
[`docs/vallum/migration-plan.md`](vallum/migration-plan.md).
That file is the current authority for repo ownership, branding, migrated docs,
package namespace decisions, and the wallet/custody boundary.

## What the Skill Teaches

- where product, architecture, examples, SDK, policy, gateway, observability, readiness, and docs-site files live;
- how to preserve existing Vallum sponsorship behavior while extending the
  fork toward Vallum;
- which commands are local-only and which commands may touch live testnet services;
- how to keep sponsor-wallet, app-key, and upstream bearer-token boundaries intact;
- how to avoid exposing agent wallet seeds, mnemonics, private keys, raw
  transaction bytes, or signer refs as bearer credentials;
- which verification commands prove docs, SDK, gateway, local smoke, readiness, typecheck, and secret hygiene.

## When to Invoke It

Use `$vallum` for prompts like:

- "review the Vallum docs";
- "add a new SDK example";
- "change policy gateway behavior";
- "debug testnet readiness";
- "integrate Vallum into a Next.js backend";
- "add an agent account or signer-reference API";
- "add an MCP tool for sponsored execution";
- "migrate package names or docs into the Vallum direction";
- "check whether sponsor secrets are safe";
- "run the local proof path";
- "prepare a new agent to work in this repo."

## What It Does Not Do

The skill is not an MCP server and does not expose live tools. It gives agents the repo-specific workflow, safety boundaries, source map, and command ladder. A future MCP should only be added if agents need structured live tooling such as policy inspection, env validation, generated integration scaffolds, or guided smoke execution.

## Safety Rule

Local checks do not prove live sponsored execution. Live commands such as
`npm run execute:testnet-demo` must only be run when the operator explicitly
asks, local testnet credentials are configured, runtime preflight passes, and
the configured sanitized upstream diagnostic report proves IOTA RPC, Gas
Station reachability, and reserve_gas compatibility.

Agent wallet convenience is a security boundary. Agents may create wallets
through approved SDK/CLI/API paths, but normal APIs must return addresses and
scoped signer references, not raw seed or private-key material.
