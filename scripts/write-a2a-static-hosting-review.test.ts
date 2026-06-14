import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createA2AAgentCardFromProfile,
  createA2APublicDiscoveryBundle,
  createA2APublicJwksResponse,
  signA2AAgentCard,
  validAgentProfileFixture,
  writeA2APublicDiscoveryBundle,
} from "../packages/registry/src/index.js";
import {
  formatA2AStaticHostingReview,
  writeA2AStaticHostingReview,
} from "./write-a2a-static-hosting-review.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const publicBaseUrl = "https://agents.example/a2a";
const publicJwksUrl = "https://agents.example/.well-known/jwks.json";

test("A2A static hosting review validates artifacts and redacts deployment details", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-hosting-review-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });

    const review = await writeA2AStaticHostingReview({
      outDir,
      expectedPublicBaseUrl: publicBaseUrl,
      expectedPublicJwksUrl: publicJwksUrl,
      now,
      outFile: join(outDir, "hosting-review.json"),
    });
    const formatted = formatA2AStaticHostingReview(review);
    const written = await readFile(join(outDir, "hosting-review.json"), "utf8");

    assert.equal(review.schemaVersion, 1);
    assert.equal(review.kind, "agentic-gaskit.a2a-static-hosting-review");
    assert.equal(review.status, "ready-for-public-hosting-review");
    assert.equal(review.localArtifactsValid, true);
    assert.equal(review.publicHostingProven, false);
    assert.equal(review.publicDiscoveryProven, false);
    assert.deepEqual(review.files.map((file) => file.path), [
      "/.well-known/agent-card.json",
      "/.well-known/jwks.json",
    ]);
    assert.match(review.files[0]?.requiredHeaders["content-type"] ?? "", /application\/a2a\+json/);
    assert.match(review.files[1]?.requiredHeaders["content-type"] ?? "", /application\/jwk-set\+json/);
    assert.ok(review.commands.some((command) => command.id === "smoke-public-discovery" && command.contactsPublicNetwork));
    assert.ok(review.boundaries.some((boundary) => boundary.includes("does not deploy files")));
    assert.ok(review.requiredOperatorInputs.includes("A2A_PUBLIC_DISCOVERY_REPORT"));
    assert.deepEqual(JSON.parse(written), review);
    assert.doesNotMatch(
      formatted,
      /agents\.example|agent-card-key-1|secret-value|mnemonic-value|seed-value|signer_ref|wallet_|payment-secret|agentic-gaskit-a2a-hosting-review/i,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static hosting review rejects invalid static artifacts", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-hosting-review-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });
    const manifestPath = join(outDir, "a2a-discovery-bundle-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      publicBaseUrl: string;
    };
    manifest.publicBaseUrl = "https://other.example/a2a";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      () => writeA2AStaticHostingReview({
        outDir,
        expectedPublicBaseUrl: publicBaseUrl,
        expectedPublicJwksUrl: publicJwksUrl,
      }),
      /public base URL/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function validBundle() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const profile = {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: publicBaseUrl },
      ...validAgentProfileFixture().endpoints,
    ],
  };
  const card = signA2AAgentCard(createA2AAgentCardFromProfile(profile, {
    now,
    endpointUrl: publicBaseUrl,
    capabilities: { streaming: true, pushNotifications: true },
  }), {
    keyId: "agent-card-key-1",
    privateKey,
    jwksUrl: publicJwksUrl,
    signedAt: now,
  });
  const jwks = createA2APublicJwksResponse({
    keys: [{ keyId: "agent-card-key-1", publicKey }],
    cacheControl: "public, max-age=60",
  });
  return createA2APublicDiscoveryBundle({
    agentCard: card,
    jwks,
    publicBaseUrl,
    publicJwksUrl,
    cacheControl: "public, max-age=60",
  });
}
