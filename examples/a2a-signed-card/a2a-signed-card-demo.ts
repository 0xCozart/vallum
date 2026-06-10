import { generateKeyPairSync } from "node:crypto";

import {
  createA2AAgentCardFromProfile,
  signA2AAgentCard,
  validAgentProfileFixture,
  verifyA2AAgentCardSignature,
} from "@iota-gaskit/registry";

export interface A2ASignedCardDemoResult {
  readonly agentName: string;
  readonly signatureCount: number;
  readonly protectedHeader: {
    readonly alg?: string;
    readonly typ?: string;
    readonly kid?: string;
    readonly hasJwksUrl: boolean;
    readonly hasExpiry: boolean;
  };
  readonly verificationOk: boolean;
  readonly tamperedCode: string | undefined;
  readonly expiredCode: string | undefined;
  readonly unsignedCode: string | undefined;
  readonly redaction: {
    readonly signerRefExposed: boolean;
    readonly walletIdExposed: boolean;
    readonly credentialRefExposed: boolean;
    readonly privateKeyExposed: boolean;
  };
}

export function runA2ASignedCardDemo(): A2ASignedCardDemoResult {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const unsigned = createA2AAgentCardFromProfile(activeA2AProfile(), {
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  const signed = signA2AAgentCard(unsigned, {
    keyId: "agent-card-key-1",
    privateKey,
    jwksUrl: "https://agent.example.test/.well-known/jwks.json",
    signedAt: new Date("2026-06-10T12:00:00.000Z"),
    expiresAt: new Date("2026-06-10T13:00:00.000Z"),
  });

  const verification = verifyA2AAgentCardSignature(signed, {
    requiredKeyId: "agent-card-key-1",
    trustedKeys: { "agent-card-key-1": publicKey },
    now: new Date("2026-06-10T12:05:00.000Z"),
  });
  const tampered = verifyA2AAgentCardSignature({
    ...signed,
    description: "Tampered card.",
  }, {
    trustedKeys: { "agent-card-key-1": publicKey },
    now: new Date("2026-06-10T12:05:00.000Z"),
  });
  const expired = verifyA2AAgentCardSignature(signed, {
    trustedKeys: { "agent-card-key-1": publicKey },
    now: new Date("2026-06-10T13:00:00.000Z"),
  });
  const unsignedVerification = verifyA2AAgentCardSignature(unsigned, {
    trustedKeys: { "agent-card-key-1": publicKey },
    now: new Date("2026-06-10T12:05:00.000Z"),
  });

  const protectedHeader = parseProtectedHeader(signed.signatures[0]?.protected);
  const serialized = JSON.stringify(signed);

  return {
    agentName: signed.name,
    signatureCount: signed.signatures.length,
    protectedHeader: {
      alg: protectedHeader.alg,
      typ: protectedHeader.typ,
      kid: protectedHeader.kid,
      hasJwksUrl: typeof protectedHeader.jku === "string",
      hasExpiry: typeof protectedHeader.exp === "string",
    },
    verificationOk: verification.ok,
    tamperedCode: tampered.ok ? undefined : tampered.code,
    expiredCode: expired.ok ? undefined : expired.code,
    unsignedCode: unsignedVerification.ok ? undefined : unsignedVerification.code,
    redaction: {
      signerRefExposed: serialized.includes("signer_ref_researcher_demo"),
      walletIdExposed: serialized.includes("wallet_researcher_demo"),
      credentialRefExposed: serialized.includes("credential:research-summary:v1"),
      privateKeyExposed: /PRIVATE KEY|BEGIN PRIVATE|privateKey/i.test(serialized),
    },
  };
}

export function formatA2ASignedCardDemoResult(result: A2ASignedCardDemoResult): string {
  return [
    "A2A signed-card demo passed",
    `agentName=${result.agentName}`,
    `signatureCount=${result.signatureCount}`,
    `protected.alg=${result.protectedHeader.alg ?? ""}`,
    `protected.typ=${result.protectedHeader.typ ?? ""}`,
    `protected.kid=${result.protectedHeader.kid ?? ""}`,
    `protected.hasJwksUrl=${result.protectedHeader.hasJwksUrl}`,
    `protected.hasExpiry=${result.protectedHeader.hasExpiry}`,
    `verificationOk=${result.verificationOk}`,
    `tamperedCode=${result.tamperedCode ?? ""}`,
    `expiredCode=${result.expiredCode ?? ""}`,
    `unsignedCode=${result.unsignedCode ?? ""}`,
    `redaction.signerRefExposed=${result.redaction.signerRefExposed}`,
    `redaction.walletIdExposed=${result.redaction.walletIdExposed}`,
    `redaction.credentialRefExposed=${result.redaction.credentialRefExposed}`,
    `redaction.privateKeyExposed=${result.redaction.privateKeyExposed}`,
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

function parseProtectedHeader(value: string | undefined): {
  readonly alg?: string;
  readonly typ?: string;
  readonly kid?: string;
  readonly jku?: string;
  readonly exp?: string;
} {
  if (!value) return {};
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
  return {
    ...(typeof parsed.alg === "string" ? { alg: parsed.alg } : {}),
    ...(typeof parsed.typ === "string" ? { typ: parsed.typ } : {}),
    ...(typeof parsed.kid === "string" ? { kid: parsed.kid } : {}),
    ...(typeof parsed.jku === "string" ? { jku: parsed.jku } : {}),
    ...(typeof parsed.exp === "string" ? { exp: parsed.exp } : {}),
  };
}
