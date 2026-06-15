# Product Requirements Document: AgentRail

Date captured: 2026-04-26
Working name: AgentRail
Short name: AgentRail
Grant category: Open-Source Development
License target: Apache-2.0 for application code; documentation may use permissive documentation terms where appropriate
Primary repo: `agentrail`

Agentic direction note, 2026-06-10:
This PRD captures the original AgentRail sponsorship toolkit. The current fork is
being redirected toward AgentRail: the existing Gas Station sponsorship
foundation plus agent accounts, signer references, transaction manifests,
identity/profile checks, contracts, receipts, MCP/A2A surfaces, and
standards-compatible payment bridges. Use
`docs/agentrail/migration-plan.md` and
`docs/agentrail/roadmap.md` for the new implementation direction. Do not
interpret this historical PRD as a claim that agent-specific packages are
already implemented.

## 1. Executive Summary

AgentRail is an open-source infrastructure toolkit that helps IOTA dApp builders deploy, configure, monitor, and operate sponsored-transaction gas stations without rebuilding production tooling from scratch.

The official IOTA Gas Station component solves the core sponsored-transaction primitive: an application provider can sponsor gas fees for users. AgentRail provides the missing developer and operator layer around that primitive:

- repeatable local and cloud-ready deployment templates;
- sponsorship policy controls and spending limits;
- tenant/app-level API keys, quotas, usage logs, and guardrails;
- TypeScript SDK and example integrations;
- operator dashboard for app keys, limits, usage, health, and rejections;
- monitoring, logging, alerting, security, and hardening docs;
- a live or recorded demo showing a gasless IOTA transaction flow.

The grant funds the open-source core. A future managed service may later provide hosting, support, compliance help, SLAs, and enterprise onboarding, but the grant deliverables must remain independently deployable, inspectable, forkable, licensed open source, and useful without that hosted service.

## 2. Problem Statement

### 2.1 User onboarding friction

Many Web3 users abandon apps when asked to acquire a token, bridge funds, understand gas, or manage transaction fees before experiencing product value. Sponsored transactions reduce this friction by allowing an application provider to pay transaction costs on behalf of users.

### 2.2 Production gap

IOTA Gas Station provides the core sponsorship capability, but production teams still need answers to operational questions:

- How do we deploy this safely?
- How do we prevent abuse and runaway sponsor spend?
- How do we limit spend per app, wallet, IP, package, or function?
- How do we monitor sponsored gas usage and failures?
- How do we rotate secrets and protect sponsor wallets?
- How do we expose a clean API/SDK to frontend/backend developers?
- How do we prove to stakeholders that sponsorship is secure, observable, and financially bounded?

Without a standard open-source toolkit, every IOTA builder must invent this layer independently.

### 2.3 Ecosystem impact

Reusable open-source Gas Station tooling can reduce integration time, increase production safety, and encourage more IOTA dApps to ship gasless user experiences.

## 3. Opportunity and Grant Alignment

IOTA already has the core primitive. AgentRail packages the repeatable deployment, policy, usage, SDK, dashboard, monitoring, and documentation layers required for real applications.

This produces reusable developer infrastructure for the IOTA ecosystem. It is useful for dApp teams, enterprise teams, hackathon builders, infrastructure operators, wallet/app developers, and identity/notarization/RWA/supply-chain/trade applications.

## 4. Product Goals

1. Make sponsored IOTA transactions easy to demo: clone, run local stack, open demo app, execute one sponsored transaction within 30 minutes.
2. Make sponsored transactions safer to operate: quotas, package allowlists, app keys, rate limits, and sponsor-wallet guardrails.
3. Make gas sponsorship observable: usage by app, wallet, endpoint, package/function, status, and estimated spend.
4. Make production deployment repeatable: deployment templates and production hardening guidance for Redis, KMS, secrets, TLS, reverse proxy, monitoring, and backup/restore.
5. Produce verifiable deliverables: every milestone has concrete acceptance criteria visible through GitHub, demo, docs, tests, and product evidence.

## 5. Non-Goals

The open-source MVP will not:

- replace the official IOTA Gas Station component;
- custody user funds;
- provide legal, tax, or compliance services;
- guarantee mainnet SLAs;
- launch a fully commercial hosted billing platform;
- create generalized cross-chain gas sponsorship;
- build wallet software;
- support every possible cloud provider in v1;
- offer advanced enterprise SSO in the first milestone;
- create a token or speculative asset.

## 6. Target Users

### 6.1 IOTA dApp developer

Needs to integrate sponsored transactions quickly without understanding every operational detail. Success means they can sponsor transactions in a demo app with minimal code.

### 6.2 IOTA infrastructure/operator team

Needs secure deployment, monitoring, quotas, logs, and spend controls. Success means they can deploy a controlled gas sponsorship service with bounded risk.

### 6.3 Enterprise/product team

Needs users to interact with an IOTA app without manually acquiring IOTA tokens. Success means gasless onboarding becomes a product feature rather than an infrastructure blocker.

### 6.4 Grant reviewer / ecosystem evaluator

Needs clear ecosystem value, open-source output, credible milestones, low risk, and fair budget. Success means seeing a concrete toolkit that many IOTA builders can use.

## 7. User Stories

Developer stories:

1. As a dApp developer, I want to run a local Gas Station stack so I can test sponsored transactions quickly.
2. As a frontend developer, I want a TypeScript SDK so I can reserve gas and submit sponsored transactions without hand-writing raw HTTP calls.
3. As a backend developer, I want example server routes so I can keep sponsor credentials and policy enforcement off the frontend.
4. As a hackathon builder, I want a simple demo app so I can copy a working integration into my project.

Operator stories:

5. As an operator, I want to create API keys for different apps so I can track usage separately.
6. As an operator, I want wallet-level and app-level quotas so one bad client cannot drain the sponsor budget.
7. As an operator, I want package/function allowlists so sponsorship only applies to intended transactions.
8. As an operator, I want health checks and metrics so I can monitor availability and usage.
9. As an operator, I want deployment templates so I can move from local development to testnet or production safely.

Ecosystem stories:

10. As an IOTA ecosystem builder, I want reusable open-source gas sponsorship tooling so more apps can onboard users without fee friction.
11. As an enterprise evaluator, I want a documented production checklist so I can understand operational and security requirements.
12. As a grant reviewer, I want milestone evidence so I can verify that funds produced useful ecosystem infrastructure.

## 8. MVP Deliverable Groups

### 8.1 Deployment Kit

A reproducible local and cloud-ready deployment package for running IOTA Gas Station with supporting services.

Features:

- Docker Compose stack for local development;
- environment variable templates;
- Redis configuration;
- reverse proxy example;
- TLS-ready deployment notes;
- testnet configuration guide;
- sponsor wallet setup guide;
- local reset/cleanup scripts;
- health-check scripts.

Acceptance criteria:

- A new developer can clone the repo and run the local stack from the README.
- The stack exposes documented health endpoints.
- Setup guide explains required environment variables.
- Deployment guide includes security notes for production operators.

### 8.2 Policy and Quota Service

A lightweight policy layer in front of or beside Gas Station that decides whether a sponsorship request should be allowed.

Features:

- app-level API keys;
- per-app daily gas budget;
- per-wallet daily request cap;
- package allowlist;
- function allowlist or pattern rules;
- denylist support;
- basic IP/rate-limit support;
- policy config file;
- policy simulation endpoint;
- structured rejection reasons.

Example policy:

```yaml
apps:
  demo-dapp:
    api_key_name: demo-dapp-key
    daily_budget_iota: 10
    max_requests_per_wallet_per_day: 25
    allowed_packages:
      - "0x..."
    allowed_functions:
      - "free_trial"
      - "mint_badge"
```

Acceptance criteria:

- Requests without valid app credentials are rejected.
- Requests over daily app quota are rejected.
- Requests outside allowed package/function rules are rejected.
- Rejections include clear machine-readable reason codes.
- At least five policy tests are included.

### 8.3 TypeScript SDK and Integration Examples

Developer SDK and examples that show how to integrate sponsored transactions into IOTA apps.

Features:

- `createAgentRailClient()` helper;
- `reserveGas()` wrapper;
- `executeSponsoredTransaction()` wrapper;
- typed request/response models;
- error classes for policy rejection, auth failure, network failure, and execution failure;
- Next.js API route example;
- minimal Node backend example;
- example dApp that performs one sponsored transaction.

Acceptance criteria:

- SDK publishes as an npm-ready package structure.
- Example app can execute a sponsored testnet transaction.
- SDK docs include quickstart and error-handling examples.
- SDK includes unit tests for request construction and response parsing.

### 8.4 Operator Dashboard

A lightweight web dashboard for viewing app keys, usage, gas spend, health, and policy status.

Features:

- dashboard home with service health;
- app/API key list;
- per-app sponsored transaction count;
- per-wallet usage table;
- daily quota usage;
- recent sponsored transaction log;
- error/rejection log;
- policy viewer;
- manual key rotation instructions;
- exportable CSV usage data.

Acceptance criteria:

- Dashboard displays health and usage from the local stack.
- Dashboard shows at least three usage dimensions: app, wallet, and status.
- Dashboard distinguishes successful execution, rejected request, and failed execution.
- Dashboard does not expose private sponsor keys.

### 8.5 Observability and Security Pack

Production-readiness assets that help operators monitor and harden their deployment.

Features:

- structured logging format;
- metrics endpoint or metrics export guide;
- Prometheus/Grafana dashboard examples where feasible;
- alerts for failed transactions, high quota usage, low sponsor balance, Redis errors, and high rejection rate;
- production hardening checklist;
- KMS integration notes;
- secret rotation checklist;
- abuse-prevention checklist;
- backup/restore notes for Redis state where applicable.

Acceptance criteria:

- Repo includes a production-readiness checklist.
- Repo includes sample alerts or documented alert conditions.
- Repo includes security guidance for sponsor wallet, bearer tokens, API keys, Redis, reverse proxy, and KMS.
- Repo includes a threat model document.

### 8.6 Grant Demo and Documentation

Public-facing docs and demo assets that prove the toolkit works and help builders adopt it.

Features:

- grant demo video;
- hosted demo page or recorded walkthrough;
- quickstart docs;
- architecture docs;
- deployment docs;
- policy examples;
- SDK docs;
- roadmap;
- contribution guide;
- issue templates;
- security disclosure policy.

Acceptance criteria:

- Public GitHub repo contains a complete README.
- Docs include a 30-minute quickstart.
- Demo shows a user executing a sponsored IOTA transaction.
- Documentation clearly separates open-source toolkit from any future managed service.

## 9. Functional Requirements

### 9.1 App management

- Operators can define one or more apps.
- Each app has a name, API key, quota settings, and policy rules.
- Each request must be attributed to an app.
- App identity must appear in usage logs.

### 9.2 Policy enforcement

- Unauthorized requests are rejected.
- Requests over budget or request limits are rejected.
- Requests outside package/function allowlists are rejected.
- Responses include structured error codes.
- All policy decisions are logged.

### 9.3 Sponsored transaction flow

- SDK supports reserving gas.
- SDK supports submitting the signed transaction for execution.
- Example dApp demonstrates the full flow.
- Flow preserves correct role separation between user signer and sponsor/gas-station signer.

### 9.4 Usage tracking

- Track request counts.
- Track successful sponsored transaction count.
- Track failed execution count.
- Track rejected request count.
- Track usage by app and wallet.

### 9.5 Dashboard

- Display service health.
- Display recent activity.
- Display quota usage.
- Display failed/rejected requests.
- Avoid exposing secrets.

### 9.6 Documentation

- README explains purpose, quickstart, architecture, and roadmap.
- Docs include local setup, testnet setup, production hardening, and contribution instructions.

## 10. Non-Functional Requirements

### Security

- Sponsor private keys must never be exposed to frontend code.
- API keys and bearer tokens must never be committed.
- Environment-based secrets are supported.
- Production docs recommend KMS or external key management.
- Dashboard redacts sensitive fields.
- Threat model covers token leakage, quota abuse, replay, policy bypass, Redis exposure, sponsor-wallet drain risk, and misconfiguration.

### Reliability

- Local stack should be restartable.
- Health checks should identify unavailable services.
- System should fail closed when policy state is unavailable.

### Performance

- Policy checks should add minimal latency.
- Dashboard queries should be optimized for small-to-medium operator workloads.
- MVP does not require enterprise-scale multi-region infrastructure.

### Usability

- Quickstart should be understandable by a competent TypeScript/Web3 developer.
- Error messages should be actionable.
- Dashboard prioritizes clarity over visual complexity.

### Maintainability

- Modular code.
- Tests for policy logic and SDK wrappers.
- Docs versioned with repo.
- Clear contribution guide.

## 11. Proposed Technical Architecture

Components:

1. IOTA Gas Station component: official underlying gas sponsorship component.
2. AgentRail Policy Gateway: validates app credentials, applies quotas/allowlists, logs decisions, and proxies approved requests.
3. AgentRail Usage Store: stores app config, quotas, request records, and usage counters. MVP may use Postgres or SQLite for app metadata and usage logs. Redis remains where required by Gas Station.
4. AgentRail SDK: TypeScript client for backend and dApp integration.
5. Operator Dashboard: web UI for health, usage, app keys, quotas, and logs.
6. Demo dApp: shows a user-triggered sponsored transaction.

Example request flow:

1. User opens demo dApp.
2. dApp backend calls AgentRail SDK with app credentials.
3. Policy Gateway validates app key and policy.
4. Gateway calls Gas Station reservation endpoint.
5. User signs transaction using reserved gas objects.
6. Backend submits signed transaction through AgentRail.
7. Gateway validates execution policy again if needed.
8. Gateway calls Gas Station execution endpoint.
9. Gas Station sponsors and executes transaction.
10. Usage log updates dashboard.

## 12. Data Model Draft

### App

```ts
type App = {
  id: string;
  name: string;
  apiKeyHash: string;
  status: "active" | "disabled";
  dailyBudgetIota: number;
  dailyRequestLimit: number;
  createdAt: string;
  updatedAt: string;
};
```

### Policy

```ts
type SponsorshipPolicy = {
  appId: string;
  allowedPackages: string[];
  allowedFunctions?: string[];
  deniedWallets?: string[];
  maxRequestsPerWalletPerDay: number;
  maxGasBudgetPerTx?: number;
};
```

### Usage event

```ts
type UsageEvent = {
  id: string;
  appId: string;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  status: "approved" | "rejected" | "executed" | "failed";
  reasonCode?: string;
  estimatedGasBudget?: number;
  transactionDigest?: string;
  createdAt: string;
};
```

## 13. Policy Reason Codes

MVP reason codes:

- `AUTH_MISSING`
- `AUTH_INVALID`
- `APP_DISABLED`
- `APP_DAILY_BUDGET_EXCEEDED`
- `APP_DAILY_REQUEST_LIMIT_EXCEEDED`
- `WALLET_DAILY_LIMIT_EXCEEDED`
- `PACKAGE_NOT_ALLOWED`
- `FUNCTION_NOT_ALLOWED`
- `WALLET_DENIED`
- `GAS_BUDGET_TOO_HIGH`
- `POLICY_CONFIG_INVALID`
- `GAS_STATION_UNAVAILABLE`
- `EXECUTION_FAILED`

## 14. Metrics and Success Criteria

Grant delivery metrics:

- Public GitHub repo shipped.
- Local quickstart works from clean clone.
- Demo app executes sponsored transaction.
- SDK has typed methods and docs.
- Dashboard shows health and usage.
- Policy gateway enforces quotas and allowlists.
- Production hardening docs published.
- Demo video published.

Post-launch adoption metrics:

- GitHub stars/forks;
- issues/discussions from builders;
- completed quickstart runs;
- demo transactions executed;
- external dApp integrations;
- IOTA community mentions/tutorials;
- operator deployments;
- contributors.

Product usage metrics:

- sponsored transactions executed;
- policy rejections by reason;
- gas spend by app;
- requests by app and wallet;
- success/failure rate;
- reserve-to-execute latency.

## 15. Milestone Plan

### Milestone 0: Pre-Grant Proof of Concept

Duration: 1-2 weeks. Funding: none or self-funded.

Deliverables:

- repo skeleton;
- README with project vision;
- local Gas Station setup notes;
- initial demo dApp scaffold;
- grant application draft;
- architecture diagram;
- short proof-of-concept video if possible.

### Milestone 1: Deployment Kit and Testnet Demo

Duration: 2 weeks.

Deliverables:

- clean local deployment path;
- Docker Compose local stack;
- environment templates;
- local quickstart README;
- working sponsored transaction demo;
- basic health checks;
- testnet setup guide.

Acceptance criteria:

- Reviewer can run local stack from clean clone.
- Demo app completes one sponsored transaction.
- README documents setup, environment variables, and troubleshooting.
- Documented testnet demo path is clear.

### Milestone 2: Policy Gateway, Quotas, and Abuse Controls

Duration: 3 weeks.

Deliverables:

- app API key validation;
- app-level quotas;
- wallet-level limits;
- package/function allowlists;
- denylist;
- structured reason codes;
- policy config examples;
- test coverage for policy decisions.

Acceptance criteria:

- Unauthorized requests are rejected.
- Over-quota requests are rejected.
- Non-allowlisted package/function requests are rejected.
- Approved requests flow to Gas Station component.
- Policy tests pass.

### Milestone 3: TypeScript SDK and Integration Examples

Duration: 2 weeks.

Deliverables:

- TypeScript SDK package;
- typed client wrappers;
- Next.js integration example;
- Node.js backend example;
- package publication or publication-ready artifacts;
- SDK docs;
- error-handling examples.

Acceptance criteria:

- SDK can be used by demo dApp.
- SDK has typed request/response models.
- Docs show reserve and execute flow.
- SDK tests pass.
- Package dry-run or package publication evidence is present.

### Milestone 4: Usage Tracking and Lightweight Operator Dashboard

Duration: 3 weeks.

Deliverables:

- dashboard UI;
- service health view;
- app usage view;
- wallet usage view;
- recent transaction/rejection log;
- quota usage display;
- basic export or logs.

Acceptance criteria:

- Dashboard shows app-level usage.
- Dashboard shows wallet-level usage.
- Dashboard shows policy rejections.
- Dashboard shows successful and failed transactions.
- Dashboard redacts secrets.

### Milestone 5: Hardening, Observability Docs, and Final Demo

Duration: 2 weeks.

Deliverables:

- production hardening guide;
- threat model;
- monitoring and alerting templates;
- KMS notes;
- contribution guide;
- final walkthrough/demo;
- roadmap;
- grant completion report.

Acceptance criteria:

- Docs explain safe production deployment considerations.
- Threat model covers key abuse and operational risks.
- Final demo proves end-to-end usage.
- Repo is ready for community contributions.

## 16. Risks and Mitigations

### Risk: project looks like a private hosted-service wrapper

Mitigation: make deliverables fully open source, independently deployable, and valuable without a future managed service.

### Risk: security concerns around sponsoring transactions

Mitigation: include policy limits, threat model, KMS guidance, bearer token guidance, dashboard redaction, and safe defaults.

### Risk: scope creep

Mitigation: keep MVP focused on deployment, policy, SDK, dashboard, observability, and docs. Exclude billing, enterprise SSO, multi-cloud automation, and commercial SLAs from the grant scope.

### Risk: dependency on official Gas Station changes

Mitigation: build around documented APIs and keep wrappers modular. Track upstream versions and document compatibility.

### Risk: abuse or runaway gas spend

Mitigation: quotas, allowlists, denylist, app keys, rate limiting, policy simulation, and low-budget test configurations.

### Risk: reviewer questions long-term viability

Mitigation: show future managed hosting/support model while keeping the open-source toolkit sustainable through community contributions and optional commercial services.

## 17. Open-Source Strategy

Target repo structure:

```txt
agentrail/
  apps/
    dashboard/
    demo-dapp/
  packages/
    sdk/
    policy-gateway/
    shared-types/
  deploy/
    docker-compose/
    nginx/
    redis/
  docs/
    quickstart.md
    architecture.md
    deployment.md
    policy.md
    sdk.md
    threat-model.md
    production-hardening.md
  examples/
    nextjs-api-route/
    node-backend/
  scripts/
  .github/
    ISSUE_TEMPLATE/
    workflows/
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
```

Recommended license: Apache-2.0. Rationale: common for infrastructure projects, permissive for ecosystem adoption, includes patent grant language, and is acceptable for commercial and open-source use.

Contribution model:

- public GitHub issues;
- discussions for integration questions;
- good-first-issue labels;
- roadmap labels;
- security disclosure policy;
- monthly changelog during grant period.

## 18. Grant Application Narrative

One-line pitch:

AgentRail is an open-source toolkit that helps IOTA dApp builders deploy, secure, monitor, and integrate gas-sponsored transactions using the IOTA Gas Station component.

Short description:

The project provides a production-oriented open-source layer around IOTA Gas Station: deployment templates, a policy and quota gateway, a TypeScript SDK, integration examples, an operator dashboard, observability templates, and hardening documentation.

Why now:

IOTA has the core Gas Station component, but production adoption requires reusable tooling around deployment, policy enforcement, quotas, monitoring, and developer integration. Funding this open-source toolkit reduces friction for builders and makes sponsored transactions a standard onboarding pattern.

Who benefits:

- IOTA dApp developers;
- enterprise teams building on IOTA;
- hackathon builders;
- infrastructure operators;
- identity, notarization, RWA, trade, and supply-chain applications;
- end users who should not need to acquire tokens before using an application.

Why this deserves grant funding:

The project creates ecosystem-wide public goods. The grant does not fund a closed hosted product; it funds reusable open-source infrastructure that any IOTA builder can deploy, inspect, fork, or extend.

## 19. Demo Scenario

Final demo flow:

1. Operator clones `agentrail`.
2. Operator runs `docker compose up`.
3. Operator opens dashboard and sees Gas Station health.
4. Operator creates or configures a demo app key.
5. Operator sets policy: allow one demo package/function and a daily quota.
6. User opens demo dApp.
7. User triggers a sponsored transaction.
8. AgentRail policy gateway approves the request.
9. Gas Station executes the sponsored transaction.
10. Dashboard updates with transaction status, app usage, wallet usage, and gas/quota information.
11. Operator changes policy to block the function.
12. Demo dApp retries and receives a clear rejection reason.

## 20. Review-Ready Acceptance Checklist

Before submitting the grant application:

- [ ] GitHub repo created.
- [ ] README with clear pitch.
- [ ] Architecture diagram.
- [ ] Milestone table with budget.
- [ ] Local setup instructions.
- [ ] Clear distinction between open-source grant scope and future managed service.
- [ ] Basic proof-of-concept branch or demo scaffold.
- [ ] Grant application draft.
- [ ] Demo video outline.
- [ ] Security and abuse-prevention plan.
- [ ] Sustainability plan.

Before grant completion:

- [ ] Working local deployment kit.
- [ ] Sponsored transaction demo.
- [ ] Policy gateway.
- [ ] Quota enforcement.
- [ ] TypeScript SDK.
- [ ] Example integrations.
- [ ] Dashboard.
- [ ] Usage tracking.
- [ ] Observability templates.
- [ ] Threat model.
- [ ] Production hardening guide.
- [ ] Final demo video.
- [ ] Public roadmap.

## 21. Future Roadmap After Grant

Phase 2: Managed Hosting Beta

- hosted testnet gas station instances;
- team accounts;
- billing integration;
- hosted metrics;
- onboarding support.

Phase 3: Enterprise Controls

- multi-tenant dashboard;
- SSO;
- audit logs;
- advanced KMS integrations;
- SLA monitoring;
- compliance export.

Phase 4: Ecosystem Integrations

- templates for IOTA identity apps;
- templates for notarization apps;
- templates for RWA/product passport apps;
- templates for supply-chain/trade workflows;
- wallet and SDK partnerships.

## 22. Positioning Rules

Use this framing:

- open-source gas sponsorship toolkit;
- production-readiness layer for IOTA Gas Station;
- safer sponsored transactions;
- gasless onboarding infrastructure;
- reusable ecosystem tooling;
- deployment, policy, monitoring, and SDK package.

Avoid this framing:

- private hosted-service wrapper;
- pay me to build my startup;
- closed-source monetization play;
- generic Web3 infrastructure with no IOTA-specific value;
- enterprise platform before open-source MVP.

## 23. Final Product Thesis

IOTA Gas Station solves the core sponsored-transaction primitive. AgentRail solves the builder adoption layer around it.

If IOTA wants more real-world applications, users should not have to understand or acquire gas before interacting with useful products. A reusable open-source gas sponsorship toolkit can help make that experience normal across the ecosystem.

The grant should fund the open-source foundation. The business can later grow around hosting, support, and enterprise operations.
