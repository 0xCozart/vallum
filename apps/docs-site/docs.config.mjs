export default {
  title: "AgentRail Docs",
  description: "Self-hostable documentation for IOTA gas sponsorship plus agent-safe wallets, manifests, policy controls, receipts, and integrations.",
  repositoryUrl: "https://github.com/0xCozart/agentrail",
  sections: [
    {
      label: "Start",
      pages: [
        {
          title: "IOTA and AgentRail Basics",
          source: "docs/concepts.md",
          slug: "concepts",
          description: "Plain-English explanations of IOTA, sponsored gas, AgentRail roles, architecture, and common terms."
        },
        {
          title: "Overview",
          source: "docs/overview.md",
          slug: "overview",
          description: "What AgentRail is, why it exists, what exists today, what remains roadmap, and where to start."
        },
        {
          title: "Quickstart",
          source: "docs/quickstart.md",
          slug: "quickstart",
          description: "Run the canonical paid MCP-style local proof, package consumer tarball proof, and core local verification paths."
        },
        {
          title: "Package Integration Guide",
          source: "docs/agentrail/package-integration-guide.md",
          slug: "package-integration-guide",
          description: "What AgentRail packages do, which package to install, how to configure SDK and agent integrations, and what remains outside the prerelease."
        },
        {
          title: "Reviewer Walkthrough",
          source: "docs/reviewer-walkthrough.md",
          slug: "reviewer-walkthrough",
          description: "A reproducible path for reviewers to inspect deterministic local proof, package adoption proof, and remaining operator gates."
        }
      ]
    },
    {
      label: "Agentic Direction",
      pages: [
        {
          title: "Execution Entry",
          source: "docs/agentrail/execution-entry.md",
          slug: "agentic-execution-entry",
          description: "Start here to begin actual AgentRail product implementation."
        },
        {
          title: "Migration Plan",
          source: "docs/agentrail/migration-plan.md",
          slug: "agentic-migration-plan",
          description: "Canonical migration plan for the AgentRail fork, docs, package decisions, and verification gates."
        },
        {
          title: "Agentic Roadmap",
          source: "docs/agentrail/roadmap.md",
          slug: "agentic-roadmap",
          description: "End-to-end roadmap for agent wallets, manifests, policy, identity, contracts, receipts, and standards bridges."
        },
        {
          title: "Account And Wallet Safety",
          source: "docs/agentrail/account-wallet-safety.md",
          slug: "agentic-wallet-safety",
          description: "Signer-reference-first safety model for agent-created wallets and recovery boundaries."
        },
        {
          title: "Execution Slices",
          source: "docs/agentrail/execution-slices.md",
          slug: "agentic-execution-slices",
          description: "Vertical implementation packets and acceptance criteria for the AgentRail buildout."
        },
        {
          title: "Verification Hardening",
          source: "docs/agentrail/verification-hardening.md",
          slug: "agentic-verification-hardening",
          description: "Risk register, verification matrix, and hardening gates for agentic sponsored execution."
        },
        {
          title: "Marketplace Readiness",
          source: "docs/marketplace-readiness.md",
          slug: "marketplace-readiness",
          description: "Phase 5 readiness gate separating local marketplace design readiness from live or production marketplace proof."
        },
        {
          title: "Package Release Strategy",
          source: "docs/agentrail/package-release-strategy.md",
          slug: "agentic-package-release-strategy",
          description: "Current package namespace decision, local tarball consumer proof, prerelease metadata gates, and registry-publication boundaries."
        },
        {
          title: "Device Access Safety Gate",
          source: "docs/agentrail/device-access-safety-gate.md",
          slug: "agentic-device-access-safety-gate",
          description: "Physical-device blocker and virtual-only path for any future device access lease work."
        },
        {
          title: "Live Proof Status",
          source: "docs/agentrail/live-proof-status.md",
          slug: "agentic-live-proof-status",
          description: "Non-networked live/testnet proof status command, blocker codes, and safe next commands."
        },
        {
          title: "Testnet Digest Proof",
          source: "docs/agentrail/testnet-digest-proof.md",
          slug: "agentic-testnet-digest-proof",
          description: "Non-networked documented digest check plus opt-in read-only IOTA testnet lookup for public transaction evidence."
        },
        {
          title: "A2A Public Readiness",
          source: "docs/agentrail/a2a-public-readiness.md",
          slug: "agentic-a2a-public-readiness",
          description: "Non-networked A2A public-readiness gate for local proof, public hosting inputs, unsupported capabilities, and conformance blockers."
        },
        {
          title: "Product Status Proof",
          source: "docs/agentrail/product-status.md",
          slug: "agentic-product-status",
          description: "Non-networked product evidence audit that separates local proof from live, production, publication, and safety blockers."
        },
        {
          title: "Launch Readiness Evidence",
          source: "docs/agentrail/launch-readiness-evidence.md",
          slug: "agentic-launch-readiness-evidence",
          description: "Non-networked launch-readiness matrix mapping roadmap areas to evidence, commands, blockers, and next gates."
        },
        {
          title: "Operator Live Gates",
          source: "docs/agentrail/operator-live-gates.md",
          slug: "agentic-operator-live-gates",
          description: "Non-networked operator runbook classifying live, production, publication, custody, and safety gates before execution."
        },
        {
          title: "Verification Profiles",
          source: "docs/agentrail/verification-profiles.md",
          slug: "agentic-verification-profiles",
          description: "Fast and full local verification profiles for iteration, handoff, reviewer, and launch evidence."
        },
      ]
    },
    {
      label: "Build",
      pages: [
        {
          title: "Best Practices",
          source: "docs/best-practices.md",
          slug: "best-practices",
          description: "Safe defaults for app keys, policy simulation, sponsor-wallet risk, and observability."
        },
        {
          title: "Code Examples",
          source: "docs/examples.md",
          slug: "examples",
          description: "SDK calls, backend routes, browser caller shape, curl requests, and policy YAML."
        },
        {
          title: "Agent Escrow Demo",
          source: "docs/demo-agent-escrow.md",
          slug: "agent-escrow-demo",
          description: "Local agent-to-agent escrow demo with approved release and policy denial paths."
        },
        {
          title: "Agent Guide",
          source: "docs/agent-guide.md",
          slug: "agent-guide",
          description: "How AI coding agents should navigate, verify, and safely work with AgentRail."
        },
        {
          title: "Policy Gateway",
          source: "docs/policy.md",
          slug: "policy-gateway",
          description: "How sponsorship decisions are evaluated before reaching IOTA Gas Station."
        },
        {
          title: "TypeScript SDK",
          source: "docs/sdk.md",
          slug: "sdk",
          description: "Backend SDK calls for policy simulation, reserve, and sponsored execute."
        },
        {
          title: "Deployment",
          source: "docs/deployment.md",
          slug: "deployment",
          description: "Local and production deployment notes for AgentRail operators."
        }
      ]
    },
    {
      label: "Operate",
      pages: [
        {
          title: "Architecture",
          source: "docs/architecture.md",
          slug: "architecture",
          description: "Plain-English system shape, why the layers exist, trust boundaries, and current usage-event foundations."
        },
        {
          title: "Observability",
          source: "docs/observability.md",
          slug: "observability",
          description: "Sanitized decision events, usage snapshots, and production direction."
        },
        {
          title: "Testnet Readiness",
          source: "docs/testnet-readiness.md",
          slug: "testnet-readiness",
          description: "Local checks before live testnet sponsor credentials are used."
        },
        {
          title: "Production Hardening",
          source: "docs/production-hardening.md",
          slug: "production-hardening",
          description: "Sponsor-wallet, gateway, persistence, and deployment hardening guidance."
        },
        {
          title: "Threat Model",
          source: "docs/threat-model.md",
          slug: "threat-model",
          description: "Risk boundaries and failure modes for gas sponsorship."
        }
      ]
    },
    {
      label: "Security",
      pages: [
        {
          title: "Sponsor Wallet",
          source: "docs/security/sponsor-wallet.md",
          slug: "sponsor-wallet",
          description: "Sponsor-wallet handling and operational safety notes."
        },
        {
          title: "Secrets",
          source: "docs/security/secrets.md",
          slug: "secrets",
          description: "Secret boundaries, local files, and repository hygiene."
        }
      ]
    }
  ]
};
