# Vallum Development Roadmap

Last updated: 2026-06-09.

## Intent Read

The docs folder asks for an IOTA-native infrastructure layer for AI agents. The
underlying goal is not to write a whitepaper; it is to create an executable
development plan that can move from repo scaffold to working demos without
losing the product thesis.

Success means a Codex agent can start from this repo, understand the product,
build the infrastructure in the right order, and verify each phase with concrete
checks. Failure means the project becomes a broad "agent economy" narrative with
unclear sequencing, unsafe payment assumptions, or disconnected modules.

## Repo Term Normalization

| Raw term | Normalized product term | Confidence | Execution assumption |
| --- | --- | --- | --- |
| what is in the docs folder | Public Vallum product direction | High | Treat the public roadmap as the durable source and keep raw thesis notes local-only. |
| Codex goal | Active planning objective and durable roadmap artifacts | High | Convert into local docs and executable slices. |
| infra | SDK, policy gateway, MCP server, contract templates, registry, dashboard, tests | High | Build in phases, not all at once. |
| existing Vallum | Vallum code inherited from `github.com/0xCozart/vallum` | High | Reuse as the core Gas Station sponsorship toolkit inside this fork. |
| accounts/wallets/seeds | Account and wallet lifecycle with signer references | High | Agents can create wallets, but should receive signer refs, not raw seeds. |
| modules | Package-level deliverables listed in the thesis | High | Map each module to a phase PRD and work packets. |
| IOTA AgentKit | Descriptive umbrella name | Medium | Use in docs as alternate name. |
| Vallum | Preferred product name | High | Use as implementation/package naming unless changed. |
| executable end to end | A later agent can implement, test, and demo from clean repo setup through demos | High | Require acceptance criteria, verification, and escalation triggers. |

## Objective Contract

Goal:
Create an end-to-end executable development roadmap for Vallum from the
raw IOTA AgentKit thesis and the existing Vallum implementation in this fork.

Why:
The project spans blockchain sponsorship, agent identity, payments, smart
contracts, MCP tooling, policy controls, dashboards, and standards bridges. It
needs sequencing and verification before implementation or it will sprawl.

Current problem:
The staging repo previously treated Vallum as something to build from scratch,
but this fork already contains the core Gas Station toolkit. The agent roadmap
needs to extend that foundation and add a safe account and wallet layer for
agents.

Desired outcome:
The repo contains durable planning artifacts that define what to build, why,
how phases depend on each other, how each module is verified, and when future
agents should escalate.

Users affected:

- AI-agent developers who need safe IOTA actions without raw wallet/gas burden.
- API/data/tool providers who want payment, escrow, receipts, and reputation.
- Operators who sponsor gas and need spend controls, audit logs, and revocation.
- Future Codex agents implementing the roadmap.

In scope:

- product framing and technical architecture
- repo foundation plan
- phase-level PRDs
- module ownership and dependencies
- vertical implementation packets
- security, abuse, and payment-risk verification gates
- objective traceability from thesis need to PRD, slice, gate, and failure
  signal
- standards compatibility plan for MCP, x402, AP2, and A2A
- explicit integration boundary with existing Vallum
- account/wallet/signer-reference model for agent-created wallets

Out of scope for this planning phase:

- implementation source code
- production mainnet custody
- default plaintext seed export
- external issue trackers
- marketplace launch
- tokenomics
- claims that IOTA replaces USD/stablecoins or existing agent standards

Constraints:

- Build boring rails before marketplace.
- Reuse existing Vallum for Gas Station sponsorship, app credentials,
  gateway operations, SDK reserve/execute flow, testnet readiness,
  sponsor-wallet hardening, and secret hygiene.
- Treat policy gateway as a security boundary.
- Treat wallet creation as a security boundary. Agents can create wallets, but
  humans/operators fund them and agents receive scoped signer references rather
  than raw seeds.
- Use IOTA for gas, identity, names, object state, contracts, credentials,
  reputation, receipts, and coordination.
- Use USD/stablecoins and x402/AP2-compatible flows for pricing, budgets, and
  business settlement.
- Verify current external APIs before implementation because the protocols are
  active and may change.

Acceptance criteria:

- Every core module has a phase owner and PRD coverage.
- Each phase PRD has problem, goals, non-goals, requirements, edge cases,
  acceptance criteria, and verification.
- The implementation plan is vertical, not organized as broad horizontal
  rewrites.
- The roadmap names dependencies and escalation triggers.
- The planning structure has a red-team audit that maps the objective to phase
  gates, slices, and failure signals.
- Hardening covers sponsored-gas abuse, prompt injection, payment disputes,
  object locking, credential revocation, secret handling, and stale protocol
  assumptions.

Definition of done:
The planning artifacts are complete enough for a future Codex agent to scaffold
the repo, implement the MVP, and verify each phase without asking for the
missing product architecture.

## External Assumptions Checked

The following assumptions were refreshed on 2026-06-09 and must be rechecked
before implementation:

- IOTA Gas Station is a self-hosted component for application providers and
  includes access control, usage metrics, customizable limits, gas coin pool
  management, and JSON-RPC APIs for gas reservation/sponsorship.
- IOTA Move uses object-centric state and programmable transaction blocks.
- IOTA dApp Kit and TypeScript SDK exist for client-side integration.
- IOTA Identity supports W3C-aligned DIDs and verifiable credentials with Rust
  and WASM tooling.
- IOTA Names has an official repository and mainnet release, but implementation
  agents must verify the current API and metadata capabilities before depending
  on specific name/profile behavior.
- MCP has an official specification and schema repository.
- x402 is an HTTP 402-based open payment standard for programmatic API/content
  payments and includes facilitator-style verify/settle flows.
- AP2 v0.2 describes checkout mandates, payment mandates, receipts, dispute
  evidence, and agentic/non-agentic role boundaries.
- A2A discovery should be treated as an evolving standard; implementation must
  verify the current Agent Card schema/path before coding.

## Existing Vallum Foundation

This fork was created from the existing self-hostable IOTA GasKit toolkit. Its
source remote is `https://github.com/0xCozart/iota-gaskit`.

It already owns:

- Gas Station gateway and SDK reserve/execute flows
- app credentials, quotas, wallet denylists, package/function allowlists
- local gateway and demo smoke tests
- usage events, usage read models, and operator visibility foundations
- testnet readiness and real sponsored testnet execution evidence
- sponsor-wallet safety, secret scanning, and production hardening docs

Vallum should not rebuild those surfaces by default. It should add the
agent-specific layer: manifests, MCP/A2A tools, agent profiles, account/wallet
signer references, contracts, receipts, x402/AP2/A2A mappings, and agent
workflow demos that call into or adapt the existing sponsorship foundation.

## Architecture

```text
Agent app / LLM / automation runtime
  -> MCP server and optional A2A adapter
  -> Vallum SDK
       - agent wallet/account creation
       - signer references and scoped capabilities
  -> Policy gateway
       - agent identity check
       - signed transaction manifest validation
       - spend budget check
       - allow-list check
       - simulation requirement
       - human approval threshold
       - rate limit and abuse controls
       - receipt/audit-log requirement
  -> IOTA integration layer
       - existing Vallum / Gas Station sponsorship
       - IOTA Names/profile resolution
       - IOTA Identity DID/VC verification
       - Move contract block execution
  -> Settlement/receipt layer
       - IOTA state and receipts
       - x402/AP2-compatible external payment proofs
  -> Dashboard/operator controls
       - logs
       - policies
       - approvals
       - revocation
       - usage and spend analytics
```

## Module Ownership

| Module | Phase | Primary responsibility | Hard dependency |
| --- | --- | --- | --- |
| Repo foundation | Phase 0 | Monorepo, scripts, config, test harness | none |
| Existing Vallum integration | Phase 0 then all phases | Reuse canonical Vallum gateway, SDK, deployment, testnet readiness, and sponsor-wallet safety | current fork |
| Account/wallet manager | Phase 1 then expanded | Agent-created wallets, signer references, safe storage adapters, rotation/revocation | Existing Vallum safety model |
| Manifest package | Phase 1 | Signed intent schema and validation | Phase 0 |
| Policy gateway | Phase 1 | Deny/allow decisions for sponsored/value actions | Manifest package |
| SDK | Phase 1 | Agent-native API wrapping policy and IOTA calls | Policy gateway |
| MCP server | Phase 1 | Tool surface for agents | SDK and policy gateway |
| Escrow contract | Phase 1 | Minimal verifier-release escrow | Phase 0 contract harness |
| Receipt contract/package | Phase 1 | Proof and audit receipt model | Manifest package |
| Registry | Phase 2 | Agent profile, name resolution, metadata | SDK, identity/name APIs |
| Identity integration | Phase 2 | Agent DID, owner DID, capabilities, revocation | Registry |
| Contract library | Phase 3 | Pay-per-call, data license, bounty, subscription, device lease | Phase 1 contracts |
| x402/AP2 bridge | Phase 4 | External payment and mandate compatibility | Receipt and manifest packages |
| A2A profile endpoint | Phase 4 | Agent Card compatibility | Registry |
| Dashboard | Phase 1 then expanded | Logs, policies, approvals, spend, revocation | Policy gateway |
| Marketplace | Phase 5 | Discovery, pricing, reputation, disputes | Phases 1-4 |

## Phase Roadmap

### Phase 0: Foundation

Purpose:
Create the repo, build harness, dependency strategy, localnet/testnet workflow,
documentation conventions, and test structure that every later phase relies on.

Exit gate:
An implementer can clone the repo, install dependencies, run tests, run a local
policy gateway, and run contract tests without any product module being complete.

Public phase summary:
Foundation work covers repository setup, build harness, dependency strategy,
local/testnet workflow, documentation conventions, and test structure.

### Phase 1: Sponsored Policy MVP

Purpose:
Let an agent safely request a sponsored IOTA action through MCP/SDK, have the
policy gateway validate the signed manifest, simulate or mock-simulate the
transaction, create or reference an agent wallet safely, open a minimal escrow,
and issue an audit receipt.

Exit gate:
A local demo can show an agent opening escrow for a paid task with denied
negative cases for unknown agent, missing manifest, over-budget spend, expired
mandate, disallowed contract, and missing simulation.

Public phase summary:
Sponsored policy work covers MCP/SDK action requests, signed manifests, policy
checks, sponsor-gas boundaries, wallet signer references, escrow, and receipts.

### Phase 2: Identity And Registry

Purpose:
Turn names, DIDs, credentials, capabilities, endpoints, payment methods,
allowed contracts, and reputation pointers into a resolvable agent profile.

Exit gate:
`resolveAgent("researcher.demo.iota")` returns a validated local/testnet profile
with wallet, owner, DID, capabilities, MCP/A2A endpoint, allowed contracts,
payment methods, signer reference, policy pointer, revocation status, and
reputation pointer.

Public phase summary:
Identity and registry work covers validated agent profiles, names, DID-style
identity evidence, credentials, capabilities, endpoints, payment metadata,
policy pointers, revocation, and reputation references.

### Phase 3: Contract Block Library

Purpose:
Move from one escrow demo to reusable Move contract blocks and deployment
tooling for agent service, API/data, and later IoT workflows.

Exit gate:
Developers can deploy and use audited/tested contract templates for escrow,
receipt, pay-per-call, data license, bounty, subscription, reputation receipt,
and any approved virtual device access lease in localnet/testnet. Physical
device access remains blocked by
`docs/vallum/device-access-safety-gate.md` until a separate owner
approved safety design exists.

Public phase summary:
Contract block work covers reusable local/testnet contract templates for agent
service workflows while keeping physical device access under a separate safety
gate.

### Phase 4: Standards Bridges

Purpose:
Avoid a walled garden by integrating x402 payment flows, AP2-style mandates and
receipts, and A2A-compatible profile discovery.

Exit gate:
An external paid API/tool flow can negotiate payment through x402 or a mocked
facilitator, anchor receipt/contract state on IOTA, and expose A2A-compatible
metadata without bypassing policy controls.

Public phase summary:
Standards bridge work covers local x402, AP2, and A2A-compatible flows without
bypassing Vallum policy controls.

### Phase 5: Marketplace

Purpose:
Only after primitives work, expose searchable agents, verified capabilities,
contract templates, pricing, reputation, escrow, usage logs, provider
staking/bonding, and dispute workflows.

Exit gate:
The marketplace can onboard a provider, publish a verified agent profile, show
pricing/contracts/reputation, execute a paid escrow/pay-per-call workflow, and
surface dispute evidence.

Public phase summary:
Marketplace work covers local read models and readiness evidence before any
production provider onboarding, settlement, moderation, or public marketplace
claims.

## Design Improvement Loop

Run this loop before each phase and after each major slice:

1. Extract: reread the public roadmap section and local-only planning notes if
   they exist in this workspace.
2. Verify external APIs: refresh official protocol docs for any touched
   integration.
3. Narrow: choose one vertical slice with one observable outcome.
4. Design: define interfaces, policy invariants, data shape, and failure modes.
5. Harden: check abuse, security, payment, staleness, and rollback risks.
6. Implement: make the smallest change that satisfies the slice.
7. Verify: run tests, negative cases, and manual demo steps.
8. Record: update docs only where the execution contract changed and commit the
   slice separately from unrelated work.
9. Escalate: stop if scope spills into mainnet custody, new protocol behavior,
   legal/compliance obligations, or unresolved external API ambiguity.

## First Implementation Recommendation

Start with Phase 0 and an integration pass against the existing Vallum code in
this fork before choosing or rebuilding any sponsorship tooling:

1. inspect the current SDK/gateway/security docs and map reusable
   surfaces
2. refresh external API notes for package names, Move tests, localnet, Gas
   Station, MCP, and adapter interfaces
3. define the account/wallet signer-reference model before adding live signing
4. scaffold or adapt TypeScript monorepo and Move contract test harness
5. define transaction manifest schema
6. implement pure policy evaluator with negative tests
7. expose a local policy gateway API or adapter to existing Vallum
8. add SDK `requestSponsoredAction`
9. add MCP tool `iota.request_sponsored_transaction`
10. add mocked/localnet escrow path
11. emit audit receipt and dashboard log

Do not start with marketplace, full registry, IoT, or standards bridges.
