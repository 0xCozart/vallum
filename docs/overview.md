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
Move contracts, local service-bounty state, local reputation-receipt state,
local subscription state, and local agent escrow plus paid MCP-style tool demos. It now also
includes the first local Agent Profile schema validator, local fixture resolver,
pure capability policy check, mock-tested IOTA Names and IOTA Identity adapter
interfaces, an opt-in IOTA Names live resolution smoke, bounded local IOTA
Identity verification cache helpers, local VC trust-policy evaluation, an
opt-in IOTA Identity live proof harness, and a local
contract-template metadata registry consumed by agent policy allow-lists. It
also includes local standards bridge proof for x402, AP2, and A2A Agent Card
discovery response generation. Live testnet proof still requires operator-owned
local credentials. Local/mock A2A helpers now model send-message, get-task,
list-tasks, cancel-task, an HTTP-shaped boundary, and a loopback HTTP server
smoke with signed discovery plus bearer-authenticated task routes without
operating a public A2A server. A local read-only marketplace evidence model now
proves provider labels, policy compatibility, receipt access control, and
dispute evidence bundle redaction without operating a production marketplace.
The product-status proof gate now reports local verification, live/testnet
readiness, publication, marketplace, custody, A2A hosting, payment, and device
safety claim boundaries without contacting live services.
The testnet digest proof checks documented public testnet transaction evidence
locally and provides a separate opt-in read-only IOTA testnet lookup.
The A2A public-readiness proof separates local A2A loopback, authenticated
extended-card, local public JWKS serving, local static discovery bundle
generation, local static discovery artifact writing, push configuration,
injected push delivery, and opt-in push HTTP transport plus callback URL
admission hardening, callback host allowlisting, retry/attempt observability,
local durable attempt evidence, local delivery queueing, and a local
injected-transport worker from public hosting, production keys, redacted
structured public discovery/push/conformance report inputs, and external
conformance blockers without contacting public endpoints.
An opt-in public discovery smoke can later probe operator-approved public HTTPS
Agent Card and JWKS URLs and emit a structured local discovery report, but it
is excluded from local verification and does not prove external conformance or
public push delivery.
The verification-profile proof adds a faster deterministic iteration path while
keeping the full local gate as the release, handoff, reviewer, and launch
evidence surface.
The launch-readiness evidence matrix maps each major roadmap area to source
evidence, local commands, blocker codes, and next gates.
The operator live-gate report classifies which remaining gates are blocked by
configuration, require explicit approval, remain production-blocked, or are
safety-deferred before execution.

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
| Receipts and contracts | Local receipt state package, non-custodial Move escrow/receipt/pay-per-call/data-license/service-bounty/reputation-receipt/subscription state contracts, and contract-template metadata allow-list checks are implemented and covered by local tests. Device access remains safety-gated and is not implemented. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Agent escrow demo | Local demo shows one agent hiring another, gateway approval, verifier release, receipt output, and over-budget policy denial without live IOTA calls. | [Agent Escrow Demo](demo-agent-escrow.md) |
| Paid MCP-style tool demo | Local demo returns a paid result only after gateway approval, mock payment confirmation, and receipt submission; denial and failed payment withhold paid results. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Agent profiles | Local `@iota-gaskit/registry` schema validation, fixture resolution, mock-tested IOTA Names/Identity adapter interfaces, an opt-in IOTA Names live resolution smoke, and bounded identity verification cache helpers cover required fields, expired/revoked states, unsupported versions, secret-field rejection, SDK resolution, capability policy checks, and stale identity evidence fail-closed behavior. | [Agentic Roadmap](agentic-gaskit/roadmap.md) |
| Live proof status | `npm run proof:live-status` reports testnet, IOTA Names, IOTA Identity, and VC proof readiness or blockers without contacting live services or printing configured values. | [Live Proof Status](agentic-gaskit/live-proof-status.md) |
| Testnet digest proof | `npm run proof:testnet-digest` checks documented public IOTA testnet digest evidence locally; `npm run proof:testnet-digest:live` performs an opt-in read-only lookup. | [Testnet Digest Proof](agentic-gaskit/testnet-digest-proof.md) |
| A2A public readiness | `npm run proof:a2a-public-readiness` classifies local A2A proof, local authenticated extended-card access, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing, local loopback streaming, local push notification configuration, local injected push delivery, local opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, public hosting inputs, production JWKS/auth decisions, redacted structured public discovery evidence, public push delivery evidence, and structured external conformance blockers without contacting public endpoints. `npm run a2a:write-static-discovery-bundle` prepares local static hosting artifacts from already-signed public inputs, while `npm run smoke:a2a-public-discovery` is an opt-in public Agent Card/JWKS probe for approved public config only and can emit the discovery report consumed by readiness. | [A2A Public Readiness](agentic-gaskit/a2a-public-readiness.md) |
| Verification profiles | `npm run verify:fast` provides a bounded iteration profile, while `npm run proof:verification-profiles` confirms `npm run verify:local` remains the full reviewer and launch evidence gate. | [Verification Profiles](agentic-gaskit/verification-profiles.md) |
| Product status proof | `npm run proof:product-status` reports the current product evidence boundary: local proof configured, live/testnet gates ready or blocked, and production-only claims still blocked or safety-gated. | [Product Status Proof](agentic-gaskit/product-status.md) |
| Launch readiness evidence | `npm run proof:launch-readiness` maps roadmap areas to evidence paths, local commands, blocker codes, and safe next gates without contacting live services. | [Launch Readiness Evidence](agentic-gaskit/launch-readiness-evidence.md) |
| Operator live gates | `npm run proof:operator-gates` classifies remaining live/testnet, publication, public A2A, payment, marketplace, custody, and safety gates before execution. | [Operator Live Gates](agentic-gaskit/operator-live-gates.md) |
| A2A bridge | Local Agent Card mapping, signed-card verification helpers, `/.well-known/agent-card.json` and `/.well-known/jwks.json` response helpers, local static discovery bundle generation and local artifact writing for signed Agent Card plus JWKS artifacts, local/mock task/message operation helpers, authenticated extended-card access, local push notification config CRUD, injected push delivery, opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, a local HTTP-shaped handler, and a loopback HTTP server smoke expose sanitized profile and task metadata with bearer-authenticated task routes and local SSE task events. Public-readiness proof now reports the remaining public hosting, production key/auth, structured public discovery report, structured public push delivery report, and structured conformance blockers; the opt-in public discovery smoke can later verify public Agent Card/JWKS reachability only. | [A2A Public Readiness](agentic-gaskit/a2a-public-readiness.md) |
| Marketplace evidence | Local `@iota-gaskit/marketplace` read model consumes registry profiles, policy compatibility, contract template metadata, receipts, manifests, and standards evidence to prove access-controlled receipt views and redacted dispute bundles without production marketplace operation. | [Marketplace Readiness](marketplace-readiness.md) |
| Package release strategy | The prerelease package strategy keeps `@iota-gaskit/*` package names, keeps the monorepo root private, checks public package metadata mechanically, proves local tarball install/import, provides opt-in pack and publish dry-run gates, and defers any `@agentic-gaskit/*` rename to a dedicated compatibility slice. | [Package Release Strategy](agentic-gaskit/package-release-strategy.md) |
| Device access safety | Physical device operation is blocked; any future proof must start with virtual or simulated devices only. | [Device Access Safety Gate](agentic-gaskit/device-access-safety-gate.md) |
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
- public Agent Card hosting, production Agent Card key management, live A2A
  task/message server operation, public streaming, public push webhook
  delivery, external conformance proof, and live standards-compatible
  discovery;
- configured live IOTA Names proof, configured and passing IOTA Identity proof,
  and live verifiable credential validation beyond the opt-in proof endpoint
  harness and local trust-policy evaluator;
- expanded contract workflow packages beyond the escrow/receipt/pay-per-call/
  data-license/service-bounty/reputation-receipt/subscription MVP and metadata
  allow-listing, including device access workflows;
- production marketplace UI/API, provider onboarding, provider verification,
  public scoring, moderation, and live settlement;
- full dashboard UI;
- production-grade durable usage storage;
- production monitoring and alerting templates;
- real package publication;
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
