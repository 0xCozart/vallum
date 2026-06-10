export default {
  title: "Agentic GasKit Docs",
  description: "Self-hostable documentation for IOTA gas sponsorship plus agent-safe wallets, manifests, policy controls, receipts, and integrations.",
  repositoryUrl: "https://github.com/0xCozart/agentic-gaskit",
  sections: [
    {
      label: "Start",
      pages: [
        {
          title: "IOTA and GasKit Basics",
          source: "docs/concepts.md",
          slug: "concepts",
          description: "Plain-English explanations of IOTA, sponsored gas, GasKit roles, architecture, and common terms."
        },
        {
          title: "Overview",
          source: "docs/overview.md",
          slug: "overview",
          description: "What GasKit is, why it exists, what exists today, what remains roadmap, and where to start."
        },
        {
          title: "Quickstart",
          source: "docs/quickstart.md",
          slug: "quickstart",
          description: "Run local verification, gateway smoke paths, and demo dApp flows."
        },
        {
          title: "Reviewer Walkthrough",
          source: "docs/reviewer-walkthrough.md",
          slug: "reviewer-walkthrough",
          description: "A reproducible path for reviewers to inspect deterministic proof."
        }
      ]
    },
    {
      label: "Agentic Direction",
      pages: [
        {
          title: "Execution Entry",
          source: "docs/agentic-gaskit/execution-entry.md",
          slug: "agentic-execution-entry",
          description: "Start here to begin actual Agentic GasKit product implementation."
        },
        {
          title: "Next Product Build Handoff",
          source: "docs/agentic-gaskit/handoff-next-product-build.md",
          slug: "agentic-next-product-build-handoff",
          description: "Compact handoff for the next agent implementing the first product slice."
        },
        {
          title: "Migration Plan",
          source: "docs/agentic-gaskit/migration-plan.md",
          slug: "agentic-migration-plan",
          description: "Canonical migration plan for the Agentic GasKit fork, docs, package decisions, and verification gates."
        },
        {
          title: "Agentic Roadmap",
          source: "docs/agentic-gaskit/roadmap.md",
          slug: "agentic-roadmap",
          description: "End-to-end roadmap for agent wallets, manifests, policy, identity, contracts, receipts, and standards bridges."
        },
        {
          title: "Account And Wallet Safety",
          source: "docs/agentic-gaskit/account-wallet-safety.md",
          slug: "agentic-wallet-safety",
          description: "Signer-reference-first safety model for agent-created wallets and recovery boundaries."
        },
        {
          title: "Execution Slices",
          source: "docs/agentic-gaskit/execution-slices.md",
          slug: "agentic-execution-slices",
          description: "Vertical implementation packets and acceptance criteria for the Agentic GasKit buildout."
        },
        {
          title: "Verification Hardening",
          source: "docs/agentic-gaskit/verification-hardening.md",
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
          source: "docs/agentic-gaskit/package-release-strategy.md",
          slug: "agentic-package-release-strategy",
          description: "Current package namespace decision, prerelease metadata gates, and future rename boundaries."
        },
        {
          title: "Device Access Safety Gate",
          source: "docs/agentic-gaskit/device-access-safety-gate.md",
          slug: "agentic-device-access-safety-gate",
          description: "Physical-device blocker and virtual-only path for any future device access lease work."
        },
        {
          title: "Local Dirty Work Review",
          source: "docs/agentic-gaskit/local-dirty-work-review.md",
          slug: "agentic-local-dirty-work-review",
          description: "Review of dirty source GasKit worktree changes and migration decisions for the Agentic fork."
        }
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
          description: "How AI coding agents should navigate, verify, and safely work with GasKit."
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
          description: "Local and production deployment notes for GasKit operators."
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
