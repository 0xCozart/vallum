# Agentic GasKit

Agentic GasKit is the next direction for IOTA GasKit: a self-hostable toolkit
for teams that want to pay IOTA transaction fees for users and give agents a
safe execution stack.

The short version: users and agents can request useful IOTA actions without
managing gas up front, while the operator keeps sponsor secrets server-side,
checks policy before spending gas, and records sanitized usage events.

The implemented foundation is GasKit plus the first Agentic GasKit slices: SDK,
policy gateway, local service, examples, deployment docs, observability
foundations, account/signer-reference primitives, manifests, mock agent
sponsorship, MCP tool facade, receipts, local escrow/receipt/pay-per-call
Move contracts, local service-bounty state, and local agent escrow plus paid
MCP-style tool demos. It now also
includes the first local Agent Profile schema validator, local fixture resolver,
pure capability policy check, mock-tested IOTA Names and IOTA Identity adapter
interfaces, and a local contract-template metadata registry consumed by agent
policy allow-lists. It also includes local standards bridge proof for x402,
AP2, and A2A Agent Card discovery response generation. Live testnet proof still
requires operator-owned local credentials.

If terms like gas, sponsor wallet, package ID, or IOTA Gas Station are new, start with [IOTA and GasKit Basics](concepts.md).

## Why This Exists

Gas sponsorship removes a common onboarding problem: users and agents should
not need to find testnet tokens, buy IOTA, or understand fee mechanics before
trying an app or executing a bounded task.

The hard part is not paying the fee once. The hard part is paying fees safely
over time. A sponsor wallet can spend real funds on Mainnet, so operators need
controls:

- which apps are allowed to request sponsorship;
- which agents are allowed to request sponsored execution;
- which signer references and wallet scopes are valid;
- which wallets can use the sponsor;
- which Move packages and functions may be sponsored;
- how much gas an app or wallet can use;
- what happened when a request was allowed or rejected.

Agentic GasKit keeps those controls and extends them with agent manifests,
wallet/account references, identity/profile checks, receipts, contract
workflows, MCP/A2A surfaces, and standards-compatible payment bridges.

## Relationship to IOTA Gas Station

GasKit does not replace the official IOTA Gas Station. It sits around it.

Application backends call the GasKit SDK or gateway. GasKit applies app credentials and sponsorship policy. Only allowed requests are proxied to IOTA Gas Station, which manages sponsor-owned gas objects and talks to the IOTA network.

```text
dApp backend -> GasKit -> IOTA Gas Station -> IOTA network
```

The official Gas Station is the sponsorship engine. GasKit is the app integration and operator safety layer around that engine.

## What GasKit Helps With

- Keep sponsor credentials and app API keys off the frontend.
- Apply app-level and wallet-level sponsorship limits.
- Restrict sponsorship to allowed packages and functions.
- Preflight policy decisions before creating reservations.
- Emit sanitized decision events for usage and rejection visibility.
- Provide TypeScript SDK and backend examples for dApp teams.
- Document the operator path from local proof to testnet and production hardening.

## Who It Is For

- dApp builders who want users to try IOTA flows without first holding IOTA tokens.
- Teams running their own sponsor wallet and needing policy, usage visibility, and safer backend integration.
- Grant reviewers or contributors who need a deterministic local proof path before live testnet credentials are used.
- Operators who want a self-hostable path rather than a closed hosted sponsorship service.

## What Exists Today

| Area | Current status | Start here |
| --- | --- | --- |
| Agentic migration | The fork direction, migrated planning docs, code-slice gates, and remote/package decisions are documented. | [Agentic Migration Plan](agentic-gaskit/migration-plan.md) |
| Agent wallets | Signer-reference-first account/wallet safety model and local package implementation exist. | [Account And Wallet Safety](agentic-gaskit/account-wallet-safety.md) |
| Agent manifests and policy | Manifest validation, pure agent action policy, and mock sponsorship gateway are implemented locally. | [Architecture](architecture.md) |
| Agent MCP tools | Local MCP-shaped sponsorship tools route through the SDK and policy gateway. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Receipts and contracts | Local receipt state package, non-custodial Move escrow/receipt/pay-per-call/data-license/service-bounty state contracts, and contract-template metadata allow-list checks are implemented and covered by local tests. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Agent escrow demo | Local demo shows one agent hiring another, gateway approval, verifier release, receipt output, and over-budget policy denial without live IOTA calls. | [Agent Escrow Demo](demo-agent-escrow.md) |
| Paid MCP-style tool demo | Local demo returns a paid result only after gateway approval, mock payment confirmation, and receipt submission; denial and failed payment withhold paid results. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Agent profiles | Local `@iota-gaskit/registry` schema validation, fixture resolution, and mock-tested IOTA Names/Identity adapter interfaces cover required fields, expired/revoked states, unsupported versions, secret-field rejection, SDK resolution, and capability policy checks. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| A2A discovery | Local Agent Card mapping and `/.well-known/agent-card.json` response helpers expose sanitized profile metadata without serving task/message operations or live public discovery. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Agent roadmap | PRDs, execution slices, module specs, and hardening gates have been migrated into this fork. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Beginner concepts | Plain-English explanations of IOTA, sponsored gas, GasKit roles, and common terms. | [IOTA and GasKit Basics](concepts.md) |
| Code examples | Backend SDK calls, Next.js route shape, browser caller shape, curl requests, and policy YAML. | [Code Examples](examples.md) |
| Agent workflow | Repo-local Codex skill for agents that need to navigate, develop, verify, or integrate GasKit safely. | [Agent Guide](agent-guide.md) |
| Local verification | Tests, typecheck, local gateway smoke, demo dApp smoke, agent escrow smoke, package dry-runs, contract tests, and secret scan run without live IOTA services. | [Quickstart](quickstart.md) |
| Policy gateway | App auth, allowlists, quotas, wallet denial, simulation, reserve proxying, execute proxying, and safe errors are implemented for local proof. | [Policy Gateway](policy.md) |
| SDK | Backend client helpers cover policy simulation, reserve, execute, typed errors, and malformed-response handling. | [TypeScript SDK](sdk.md) |
| Usage visibility | Sanitized decision events, in-memory usage snapshots, JSONL replay, and a local authenticated operator usage API exist as foundations. | [Observability](observability.md) |
| Testnet proof | A real sponsored IOTA testnet execute has been documented, but live proof still requires operator-owned local credentials. | [Testnet Readiness](testnet-readiness.md) |

## What Is Still Roadmap

These are not complete production claims yet:

- signer adapter storage beyond documented safety model;
- A2A protocol task/message tools, signed public Agent Cards, and live
  standards-compatible discovery;
- live registry proof, full verifiable credential validation, and cache policy;
- expanded contract workflow packages beyond the escrow/receipt/pay-per-call/
  data-license/service-bounty MVP and metadata allow-listing;
- full dashboard UI;
- production-grade durable usage storage;
- production monitoring and alerting templates;
- package publication;
- KMS or external signer production integration;
- mainnet operational validation;
- final public walkthrough assets.

## Recommended First Path

1. Read [IOTA and GasKit Basics](concepts.md) if sponsored gas or IOTA terms are unfamiliar.
2. Read [Agentic Migration Plan](agentic-gaskit/migration-plan.md) before
   changing repo branding, package names, wallet behavior, or agent surfaces.
3. Read [Account And Wallet Safety](agentic-gaskit/account-wallet-safety.md)
   before adding any wallet/account API.
4. Read [Architecture](architecture.md) to understand why the gateway, SDK, and policy layers are separate.
5. Copy the safe backend and route patterns from [Code Examples](examples.md).
6. Use [Agent Guide](agent-guide.md) when handing work to an AI coding agent.
7. Run the deterministic local checks in [Quickstart](quickstart.md).
8. Read [Best Practices](best-practices.md) before adding live credentials.
9. Review [Testnet Readiness](testnet-readiness.md) before a live sponsored transaction attempt.
10. Use [Deployment](deployment.md) and [Production Hardening](production-hardening.md) when moving beyond local proof.

## Safety Boundary

Treat the sponsor wallet as a funded operational asset. Every sponsored path
should be authenticated, allowlisted, budgeted, observable, and secret-free in
logs. Use `simulatePolicy()` when possible, and keep browser code behind
same-origin backend routes that own GasKit app credentials.

Agent-created wallets must be signer-reference-first. Normal APIs return
addresses and scoped signer references, not seeds, mnemonics, private keys, or
raw keypairs. A signer reference is not bearer authorization.
