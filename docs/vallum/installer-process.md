# Vallum Installer Process

The Vallum installer is an agent-assisted setup process for another
repository. It must make the setup mode explicit before touching files, because
Vallum configuration can involve app API keys, sponsor wallets, Gas Station
bearer tokens, signer references, manifests, receipts, and live proof reports.

The installer script in this repo is:

```bash
npm run vallum:installer
```

Dry run is the default. To write the scaffold into a target repo, pass
`-- --target <repo> --write` after reviewing the plan.

## First Question

The installing agent must start with this mode choice:

```text
How do you want Vallum installed?

1. Safe local auto-scaffold - install package instructions, placeholders,
   gitignore, and local/mock checks. No real keys.
2. Guided operator config - the agent guides local secret configuration and
   shape validation. Live/testnet remains approval-gated.
3. Existing gateway/client only - wire SDK or MCP host to an already managed
   Vallum gateway.

Default: Safe local auto-scaffold.
```

If the user does not choose, use Safe local auto-scaffold.

## Modes

### Safe local auto-scaffold

Use this for a first install into an application repo.

The installer may:

- detect package manager and target repo shape;
- propose `@vallum/sdk@next`, `@vallum/mcp-server@next`, or
  `@vallum/policy-gateway@next`;
- add Vallum local/operator paths to `.gitignore`;
- write `.env.vallum.example` with placeholders only;
- write `vallum.config.example.json` with non-secret policy shape;
- write `docs/vallum-setup.md` in the target repo;
- write `.vallum/reports/install-summary.json` as a redacted mode-0600 local
  report;
- run package import, typecheck, and tracked-file secret checks when available.

The installer must not:

- create or fill real `.env.vallum.local` values;
- collect keys, tokens, private keys, mnemonics, raw transaction bytes, or
  user signatures in chat;
- contact IOTA, IOTA Gas Station, faucet, npm publication, payment provider,
  public A2A, marketplace, KMS, custody, or physical-device services;
- claim live sponsored execution.

### Guided operator config

Use this after the local scaffold exists and the operator wants to move toward
testnet or production proof.

The agent may guide the human through local configuration, but the human owns
secret entry on the operator machine. Values go into `.env.vallum.local`, the
target platform secret store, or an MCP host secret store. The agent should
name required variables, not collect their values.

Allowed steps before live execution:

- validate local env shape;
- validate package/function allowlist shape;
- render local Gas Station config only when the operator confirms local
  credentials exist;
- run non-networked readiness and operator-gate reports;
- write ignored redacted report templates under `.vallum/reports/` or
  `tmp/vallum/`.

Commands that contact live services, request faucet funds, spend sponsored
testnet gas, call payment providers, probe public A2A endpoints, or validate
custody infrastructure require explicit operator approval immediately before
the command runs.

### Existing gateway/client only

Use this when a team already has a managed Vallum gateway.

The installer wires the target backend or MCP host to server-side environment
names such as `VALLUM_GATEWAY_URL` and `VALLUM_API_KEY`. The managed gateway
operator remains responsible for sponsor-wallet safety, upstream Gas Station
configuration, live proof reports, payment/provider reports, production
custody, and public A2A proof.

## Artifact Model

Do not describe Vallum state as a values folder. That implies a secret vault
and encourages bundling keys with reports.

Use this split instead:

```text
tracked:
  .env.vallum.example
  vallum.config.example.json
  docs/vallum-setup.md

ignored:
  .env.vallum.local
  .vallum/local/
  .vallum/reports/
  tmp/vallum/
  deploy/gas-station/config.local.yaml
```

The installing repo must ignore local state before the installer writes local
reports or templates. The standard block is:

```gitignore
# Vallum local/operator state
.env.vallum.local
.env.vallum.*.local
.vallum/local/
.vallum/reports/
tmp/vallum/
deploy/gas-station/config.local.yaml
```

## Installer CLI

Preview a target install:

```bash
npm run vallum:installer -- --target /path/to/app
```

Write the safe local scaffold:

```bash
npm run vallum:installer -- --target /path/to/app --write
```

Plan MCP plus backend integration:

```bash
npm run vallum:installer -- --target /path/to/app --integration backend,mcp
```

Plan guided operator mode:

```bash
npm run vallum:installer -- --target /path/to/app --mode guided-operator
```

The script never runs package installation or live proof commands by itself.
It prints the package install command and writes local setup artifacts only
when `--write` is passed.

## Verification

For auto-scaffold, expected verification is local only:

```bash
node --input-type=module -e 'import("@vallum/sdk").then(() => console.log("vallum sdk import ok"))'
npm exec tsc --noEmit
npm run secrets:scan
```

For guided operator mode, validation can also include:

```bash
npm run readiness:testnet
npm run gas-station:runtime-preflight
npm run proof:operator-gates
```

Passing those checks does not prove live sponsored execution. Live/testnet
proof remains separate and needs explicit operator approval, current local
credentials, runtime readiness, funding evidence, upstream diagnostic evidence,
and redacted reports.

## Acceptance Criteria

- The installer asks for mode before making changes.
- Safe local auto-scaffold is the default.
- `.gitignore` is updated before any local Vallum state is written.
- Generated tracked files contain placeholders only.
- Ignored summaries are redacted and written with restrictive permissions when
  the platform supports them.
- Live commands are listed as blocked until explicit operator approval.
- Local proof, live proof, and production claims are separated in the install
  summary.
- Re-running the installer does not duplicate the `.gitignore` block.
