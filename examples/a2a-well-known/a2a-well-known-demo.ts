import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  handleA2AAgentCardWellKnownRequest,
  validAgentProfileFixture,
} from "@vallum/registry";

export interface A2AWellKnownDemoResult {
  readonly canonical: {
    readonly path: string;
    readonly status: number;
    readonly agentName: string;
    readonly skillIds: readonly string[];
  };
  readonly legacy: {
    readonly status: number;
  };
  readonly revoked: {
    readonly status: number;
  };
  readonly redaction: {
    readonly signerRefExposed: boolean;
    readonly walletIdExposed: boolean;
    readonly credentialRefExposed: boolean;
    readonly paymentAddressExposed: boolean;
  };
}

export function runA2AWellKnownDemo(): A2AWellKnownDemoResult {
  const profile = activeA2AProfile();
  const now = new Date("2026-06-10T12:00:00.000Z");
  const canonical = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, profile, { now });
  if (canonical.status !== 200) {
    throw new Error("A2A canonical well-known response was not available.");
  }

  const legacy = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: "/.well-known/agent.json",
  }, profile, { now });

  const revoked = handleA2AAgentCardWellKnownRequest({
    method: "GET",
    path: A2A_AGENT_CARD_WELL_KNOWN_PATH,
  }, {
    ...profile,
    status: "revoked" as const,
    revocation: {
      revoked: true,
      reason: "owner_revoked",
      revokedAt: "2026-06-10T12:30:00.000Z",
    },
  }, { now });

  return {
    canonical: {
      path: canonical.path,
      status: canonical.status,
      agentName: canonical.body.name,
      skillIds: canonical.body.skills.map((skill) => skill.id),
    },
    legacy: {
      status: legacy.status,
    },
    revoked: {
      status: revoked.status,
    },
    redaction: {
      signerRefExposed: canonical.json.includes("signer_ref_researcher_demo"),
      walletIdExposed: canonical.json.includes("wallet_researcher_demo"),
      credentialRefExposed: canonical.json.includes("credential:research-summary:v1"),
      paymentAddressExposed: canonical.json.includes("0x1111111111111111111111111111111111111111111111111111111111111111"),
    },
  };
}

export function formatA2AWellKnownDemoResult(result: A2AWellKnownDemoResult): string {
  return [
    "A2A well-known demo passed",
    `canonical.path=${result.canonical.path}`,
    `canonical.status=${result.canonical.status}`,
    `canonical.agentName=${result.canonical.agentName}`,
    `canonical.skillIds=${result.canonical.skillIds.join(",")}`,
    `legacy.status=${result.legacy.status}`,
    `revoked.status=${result.revoked.status}`,
    `redaction.signerRefExposed=${result.redaction.signerRefExposed}`,
    `redaction.walletIdExposed=${result.redaction.walletIdExposed}`,
    `redaction.credentialRefExposed=${result.redaction.credentialRefExposed}`,
    `redaction.paymentAddressExposed=${result.redaction.paymentAddressExposed}`,
  ].join("\n");
}

function activeA2AProfile() {
  return {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: "https://agent.example.test/a2a" },
      ...validAgentProfileFixture().endpoints,
    ],
  };
}
