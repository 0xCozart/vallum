# Vallum

Vallum is the product direction for the original IOTA GasKit sponsorship
toolkit: a self-hostable system for teams that want to pay IOTA transaction
fees for users and give agents a safe execution stack.

The short version: users and agents can request useful IOTA actions without
managing gas up front, while the operator keeps sponsor secrets server-side,
checks policy before spending gas, and records sanitized usage events.

The current adoption spine is deliberately smaller than the full roadmap:
agent-safe sponsored execution through policy, manifests, signer references,
and receipts. The first runnable path is the paid MCP-style tool flow, followed
by the package consumer tarball proof that installs public packages into a
fresh temporary consumer project and imports package root entrypoints only.

The implemented foundation is Vallum plus the first Vallum slices: SDK,
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
The payment-provider readiness proof checks local x402/AP2 source and tests,
then only accepts an operator-supplied redacted structured report before manual
review of live facilitator, processor, or settlement claims. The payment
proof-plan writer turns that readiness gate into a redacted operator checklist
before any live payment provider is contacted.
The testnet digest proof checks documented public testnet transaction evidence
locally and provides a separate opt-in read-only IOTA testnet lookup.
The A2A public-readiness proof separates local A2A loopback, authenticated
extended-card, local public JWKS serving, local static discovery bundle
generation, local static discovery artifact writing, push configuration,
local static discovery artifact validation, local static discovery loopback
host smoke, local static hosting review, injected push delivery, and opt-in push HTTP transport plus
callback URL admission hardening,
callback host allowlisting, retry/attempt observability, local durable attempt
evidence, local delivery queueing, and a local injected-transport worker from
public hosting, production keys, redacted structured public
discovery/push/conformance report inputs, and external conformance blockers
without contacting public endpoints. Current ignored public discovery and
push-delivery reports from an operator-approved temporary HTTPS Agent
Card/JWKS plus callback probe can be consumed by the non-networked readiness
gate, but they do not prove external conformance.
The verification-profile proof adds a faster deterministic iteration path while
keeping the full local gate as the release, handoff, reviewer, and launch
evidence surface.
The launch-readiness evidence matrix maps each major roadmap area to source
evidence, local commands, blocker codes, and next gates.
The operator live-gate report classifies which remaining gates are blocked by
configuration, require explicit approval, remain production-blocked, or are
safety-deferred before execution, and can write a redacted local JSON handoff
artifact before any live command is approved.

If terms like gas, sponsor wallet, package ID, or IOTA Gas Station are new, start with [IOTA and Vallum Basics](concepts.md).

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

Vallum keeps those controls and extends them with agent manifests,
wallet/account references, identity/profile checks, receipts, contract
workflows, MCP/A2A surfaces, and standards-compatible payment bridges.

## Relationship to IOTA Gas Station

Vallum does not replace the official IOTA Gas Station. It sits around it.

Application backends call the Vallum SDK or gateway. Vallum applies app credentials and sponsorship policy. Only allowed requests are proxied to IOTA Gas Station, which manages sponsor-owned gas objects and talks to the IOTA network.

```text
dApp backend -> Vallum -> IOTA Gas Station -> IOTA network
```

The official Gas Station is the sponsorship engine. Vallum is the app integration and operator safety layer around that engine.

## What Vallum Helps With

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
| Package integration | Published npm packages are available under `@vallum/*`. Most consumers install one entry package: SDK for backend use, MCP facade for programmatic agent-tool integration, or policy gateway for operator/platform work. | [Package Integration Guide](vallum/package-integration-guide.md) |
| Canonical adoption wedge | `npm run smoke:paid-mcp-tool` proves a local paid MCP-style tool call through SDK to mock policy gateway, with manifest/action intent, signer-reference redaction, policy approval, policy denial, failed-payment withholding, receipt events, and local-only boundaries. | [Quickstart](quickstart.md) |
| Package consumer proof | `npm run smoke:package-paid-mcp-consumer` proves the local tarball consumer path, and `npm run smoke:npm-registry-paid-mcp-consumer` proves a fresh temporary consumer can install the published npm packages and run the same canonical paid MCP-style flow. | [Package Release Strategy](vallum/package-release-strategy.md) |
| Agentic migration | The fork direction, migrated planning docs, code-slice gates, and remote/package decisions are documented. | [Agentic Migration Plan](vallum/migration-plan.md) |
| Agent workflow harness | The reviewed `apex.workflow.json` profile uses local-only manifests, no external tracker, focused-search code review, no browser adapter, and repo-local verification presets; local Codex goal and handoff docs stay outside product authority. | [Agentic Migration Plan](vallum/migration-plan.md) |
| Agent wallets | Signer-reference-first account/wallet safety model and local package implementation exist; production custody remains blocked behind `npm run proof:custody-readiness` and an operator-approved status-only report covering signer references, custody controls, lifecycle, recovery, audit, incident, and compliance review; `npm run proof:custody-readiness -- --out tmp/vallum/custody-readiness.json` writes a redacted mode-600 audit artifact, and `npm run custody:write-production-proof-bundle` writes the custody report template, proof plan, readiness artifact, and redacted summary together as ignored local artifacts. | [Account And Wallet Safety](vallum/account-wallet-safety.md) |
| Agent manifests and policy | Manifest validation, pure agent action policy, and loopback-only mock sponsorship gateway are implemented locally. The mock gateway is test/demo infrastructure, not the production policy gateway. | [Architecture](architecture.md) |
| Agent MCP tools | Local MCP-shaped sponsorship tools route through the SDK and policy gateway. | [Agentic Roadmap](vallum/roadmap.md) |
| Receipts and contracts | Local receipt state package, non-custodial Move escrow/receipt/pay-per-call/data-license/service-bounty/reputation-receipt/subscription state contracts, and contract-template metadata allow-list checks are implemented and covered by local tests. Device access remains safety-gated and is not implemented. | [Agentic Roadmap](vallum/roadmap.md) |
| Agent escrow demo | Local demo shows one agent hiring another, gateway approval, verifier release, receipt output, and over-budget policy denial without live IOTA calls. | [Agent Escrow Demo](demo-agent-escrow.md) |
| Paid MCP-style tool demo | Local demo returns a paid result only after gateway approval, mock payment confirmation, and receipt submission; denial and failed payment withhold paid results. | [Agentic Roadmap](vallum/roadmap.md) |
| Agent profiles | Local `@vallum/registry` schema validation, fixture resolution, mock-tested IOTA Names/Identity adapter interfaces, an opt-in IOTA Names live resolution smoke, and bounded identity verification cache helpers cover required fields, expired/revoked states, unsupported versions, secret-field rejection, SDK resolution, capability policy checks, and stale identity evidence fail-closed behavior. | [Agentic Roadmap](vallum/roadmap.md) |
| Live proof status | `npm run proof:live-status` reports testnet, local Gas Station runtime, IOTA Names, IOTA Identity, and VC proof readiness or blockers without contacting live services or printing configured values; `npm run live:write-identity-proof-bundle` writes the linked identity templates, live proof plan, live proof status artifact, and redacted summary together as ignored local artifacts. | [Live Proof Status](vallum/live-proof-status.md) |
| Testnet digest proof | `npm run proof:testnet-digest` checks documented public IOTA testnet digest evidence locally; `npm run proof:testnet-digest:live` performs an opt-in read-only lookup. | [Testnet Digest Proof](vallum/testnet-digest-proof.md) |
| A2A public readiness | `npm run proof:a2a-public-readiness` classifies local A2A proof, local authenticated extended-card access, local public JWKS serving, local static discovery bundle generation, local static discovery artifact writing, validation, loopback host smoke, local static hosting review, redacted public proof planning, local loopback streaming, local push notification configuration, local injected push delivery, local opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, public hosting inputs, production JWKS/auth decisions, redacted structured public discovery evidence, public push delivery evidence, and structured external conformance blockers without contacting public endpoints. Current ignored local state includes passing public discovery and push-delivery reports from an operator-approved temporary HTTPS Agent Card/JWKS plus callback probe; public readiness remains blocked until the external conformance report is generated and configured. `npm run smoke:a2a-external-conformance -- --report <ignored-json-path>` can generate that bearer-authenticated public task-route report when `A2A_PUBLIC_TASK_BEARER_TOKEN` is configured locally; it is operator-review evidence, not official TCK certification. `npm run a2a:wrap-tck-conformance -- --compatibility <reports/compatibility.json> --out <ignored-json-path> --public-agent-card-url <url> --public-base-url <url>` can instead wrap an operator-reviewed official A2A TCK compatibility report into the accepted redacted external-conformance shape. A local official A2A TCK diagnostic now reports 98.4% overall compatibility and HTTP+JSON 73/88 through a loopback auth-injecting proxy; the remaining diagnostic gap is the upstream TCK `CORE-SEND-003` requirement metadata rather than Vallum's 415 unsupported-media response. A temporary local TCK metadata patch passes HTTP+JSON at 100.0% and 74/88. `npm run a2a:write-static-discovery-bundle` prepares local static hosting artifacts from already-signed public inputs, `npm run a2a:check-static-discovery-bundle` validates those local artifacts before upload, `npm run smoke:a2a-static-discovery-local` serves and fetches them over loopback only, `npm run a2a:write-static-hosting-review` emits a redacted local review packet for canonical paths and required headers, `npm run a2a:write-public-proof-plan` emits a redacted non-networked operator plan, `npm run smoke:a2a-public-discovery` is an opt-in public Agent Card/JWKS probe, `npm run smoke:a2a-public-push-delivery` is an opt-in public callback-delivery probe, and `npm run smoke:a2a-external-conformance` is an opt-in public task-route probe for approved public config only. | [A2A Public Readiness](vallum/a2a-public-readiness.md) |
| Payment provider readiness | `npm run proof:payment-provider-readiness` validates local x402/AP2 source and tests plus an optional ignored structured report path, without contacting payment providers or printing report paths or secret-like fields. Accepted live reports must include status-only `x402Proof` evidence for facilitator verify, settle, and payment-response confirmation plus status-only `ap2Proof` evidence for mandate-chain validation, checkout receipt, payment receipt, and accountability review. `npm run smoke:payment-provider-live -- --report <ignored-json-path>` is the opt-in operator-approved x402 verify/settle smoke that can write that redacted report after an ignored x402 request envelope and status-only AP2 proof input pass. `npm run proof:payment-provider-readiness -- --out tmp/vallum/payment-provider-readiness.json` writes a redacted mode-600 audit artifact. `npm run payment:write-provider-proof-plan` emits a redacted non-networked command/report checklist, and `npm run payment:write-provider-proof-bundle` writes the report template, proof plan, readiness artifact, and redacted summary together as ignored local artifacts for the operator-approved proof. | [Product Status Proof](vallum/product-status.md) |
| Verification profiles | `npm run verify:fast` provides a bounded iteration profile, while `npm run proof:verification-profiles` confirms `npm run verify:local` remains the full reviewer and launch evidence gate. | [Verification Profiles](vallum/verification-profiles.md) |
| Product status proof | `npm run proof:product-status` reports the current product evidence boundary: local proof configured, live/testnet gates ready or blocked, and production-only claims still blocked or safety-gated. | [Product Status Proof](vallum/product-status.md) |
| Launch readiness evidence | `npm run proof:launch-readiness` maps roadmap areas to evidence paths, local commands, blocker codes, and safe next gates without contacting live services. | [Launch Readiness Evidence](vallum/launch-readiness-evidence.md) |
| Operator live gates | `npm run proof:operator-gates` classifies remaining live/testnet, publication, public A2A, payment, marketplace, custody, and safety gates before execution; `npm run operator:write-live-gate-report` writes the redacted local JSON handoff artifact, and `npm run device-access:write-safety-proof-bundle` prepares the non-networked physical-device safety report path without operating devices. | [Operator Live Gates](vallum/operator-live-gates.md) |
| A2A bridge | Local Agent Card mapping, signed-card verification helpers, `/.well-known/agent-card.json` and `/.well-known/jwks.json` response helpers, local static discovery bundle generation plus local artifact writing, validation, loopback host smoke, and static hosting review for signed Agent Card plus JWKS artifacts, local/mock task/message operation helpers, authenticated extended-card access, local push notification config CRUD, injected push delivery, opt-in push HTTP transport, callback URL admission hardening, callback host allowlisting, local retry/attempt observability, local durable attempt evidence, local delivery queueing, a local injected-transport worker, a local HTTP-shaped handler, AIP-193 ErrorInfo responses, opt-in official A2A HTTP+JSON response shapes, and a loopback HTTP server smoke expose sanitized profile and task metadata with bearer-authenticated task routes and local SSE task events. Public-readiness proof now accepts current structured public discovery and push-delivery reports under ignored local state; the remaining public A2A blocker is external conformance, with the local official HTTP+JSON diagnostic narrowed to upstream TCK metadata for `CORE-SEND-003`. | [A2A Public Readiness](vallum/a2a-public-readiness.md) |
| Marketplace evidence | Local `@vallum/marketplace` read model consumes registry profiles, policy compatibility, contract template metadata, receipts, manifests, and standards evidence to prove access-controlled receipt views and redacted dispute bundles without production marketplace operation; a non-networked readiness gate keeps production marketplace claims blocked until an operator report exists. Accepted reports must include status-only provider, moderation, access-control, settlement, dispute, and operations review sections, not raw provider, payment, moderation, dispute, or account artifacts. `npm run proof:marketplace-readiness -- --out tmp/vallum/marketplace-readiness.json` writes a redacted mode-600 audit artifact, and `npm run marketplace:write-production-proof-bundle` writes the report template, proof plan, readiness artifact, and redacted summary together as ignored local artifacts. | [Marketplace Readiness](marketplace-readiness.md) |
| Package release strategy | The coordinated `0.0.1-prerelease.0` package line publishes to npm under `@vallum/*`, including the runnable `@vallum/mcp-server` stdio CLI. The old `@sacredlabs/agentrail-*` package line has been unpublished. The release path keeps the monorepo root private, checks public package metadata mechanically, proves local tarball install/import plus registry consumer flows, and validates ignored structured npm publication evidence when `PACKAGE_PUBLICATION_REPORT` is configured. | [Package Release Strategy](vallum/package-release-strategy.md) |
| Device access safety | Physical device operation is blocked; any future proof must start with virtual or simulated devices only. | [Device Access Safety Gate](vallum/device-access-safety-gate.md) |
| Agent roadmap | PRDs, execution slices, module specs, and hardening gates have been migrated into this fork. | [Agentic Roadmap](vallum/roadmap.md) |
| Beginner concepts | Plain-English explanations of IOTA, sponsored gas, Vallum roles, and common terms. | [IOTA and Vallum Basics](concepts.md) |
| Code examples | Backend SDK calls, Next.js route shape, browser caller shape, curl requests, and policy YAML. | [Code Examples](examples.md) |
| Agent workflow | Repo-local Codex skill for agents that need to navigate, develop, verify, or integrate Vallum safely. | [Agent Guide](agent-guide.md) |
| Local verification | Tests, typecheck, local gateway smoke, demo dApp smoke, agent escrow smoke, package dry-runs, contract tests, and secret scan run without live IOTA services. | [Quickstart](quickstart.md) |
| Policy gateway | App auth, allowlists, quotas, wallet denial, simulation, reserve proxying, execute proxying, and safe errors are implemented for local proof. | [Policy Gateway](policy.md) |
| SDK | Backend client helpers cover policy simulation, reserve, execute, typed errors, and malformed-response handling. | [TypeScript SDK](sdk.md) |
| Usage visibility | Sanitized decision events, in-memory usage snapshots, JSONL replay, and a local authenticated operator usage API exist as foundations. | [Observability](observability.md) |
| Testnet proof | A real sponsored IOTA testnet execute has been documented, but fresh live proof still requires operator-owned local credentials, Gas Station runtime readiness through local Docker or explicit managed-upstream mode, upstream diagnostics, and explicit operator intent. | [Testnet Readiness](testnet-readiness.md) |

## What Is Still Roadmap

These are not complete production claims yet:

- signer adapter storage beyond documented safety model;
- public Agent Card hosting, production Agent Card key management, live A2A
  task/message server operation, public streaming, public push webhook
  delivery, external conformance proof, and live standards-compatible
  discovery;
- production-backed IOTA Identity service operation and live verifiable
  credential validation beyond the opt-in proof endpoint harness and local
  trust-policy evaluator;
- expanded contract workflow packages beyond the escrow/receipt/pay-per-call/
  data-license/service-bounty/reputation-receipt/subscription MVP and metadata
  allow-listing, including device access workflows;
- production marketplace UI/API, provider onboarding, provider verification,
  public scoring, moderation, and live settlement;
- full dashboard UI;
- production-grade durable usage storage;
- production monitoring and alerting templates;
- stable package release after the current `0.0.1-prerelease.0` package set;
- KMS or external signer production integration;
- mainnet operational validation;
- final public walkthrough assets.

## Recommended First Path

1. Read [IOTA and Vallum Basics](concepts.md) if sponsored gas or IOTA terms are unfamiliar.
2. Read [Package Integration Guide](vallum/package-integration-guide.md) to
   choose the package entrypoint and configuration path.
3. Run [Quickstart](quickstart.md), starting with
   `npm run smoke:paid-mcp-tool`.
4. Run `npm run smoke:package-paid-mcp-consumer` when you need proof that a
   fresh local consumer project can use the public package root entrypoints.
5. Run `npm run smoke:npm-registry-paid-mcp-consumer` when you need proof that
   a fresh external consumer can install the published npm packages.
6. Read [Agentic Migration Plan](vallum/migration-plan.md) before
   changing repo branding, package names, wallet behavior, or agent surfaces.
7. Read [Account And Wallet Safety](vallum/account-wallet-safety.md)
   before adding any wallet/account API.
8. Read [Architecture](architecture.md) to understand why the gateway, SDK, and policy layers are separate.
9. Copy the safe backend and route patterns from [Code Examples](examples.md).
10. Use [Agent Guide](agent-guide.md) when handing work to an AI coding agent.
11. Read [Best Practices](best-practices.md) before adding live credentials.
12. Review [Testnet Readiness](testnet-readiness.md) before a live sponsored transaction attempt.
13. Use [Deployment](deployment.md) and [Production Hardening](production-hardening.md) when moving beyond local proof.

## Safety Boundary

Treat the sponsor wallet as a funded operational asset. Every sponsored path
should be authenticated, allowlisted, budgeted, observable, and secret-free in
logs. Use `simulatePolicy()` when possible, and keep browser code behind
same-origin backend routes that own Vallum app credentials.

Agent-created wallets must be signer-reference-first. Normal APIs return
addresses and scoped signer references, not seeds, mnemonics, private keys, or
raw keypairs. A signer reference is not bearer authorization. `npm run
proof:custody-readiness` validates the local signer-reference boundary while
keeping production KMS, lifecycle, recovery, audit, incident-response,
staking, bonding, slashing, and custody claims behind an operator-approved
status-only structured report.
