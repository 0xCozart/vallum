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
  checkA2AStaticDiscoveryBundle,
  formatA2AStaticDiscoveryBundleCheckResult,
} from "./check-a2a-static-discovery-bundle.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const publicBaseUrl = "https://agents.example/a2a";
const publicJwksUrl = "https://agents.example/.well-known/jwks.json";

test("A2A static discovery bundle check validates generated local artifacts", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-check-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });

    const result = await checkA2AStaticDiscoveryBundle({
      outDir,
      expectedPublicBaseUrl: publicBaseUrl,
      expectedPublicJwksUrl: publicJwksUrl,
    });
    const formatted = formatA2AStaticDiscoveryBundleCheckResult(result);

    assert.equal(result.ok, true);
    assert.equal(result.files, 2);
    assert.equal(result.publicHostingProven, false);
    assert.match(formatted, /A2A static discovery bundle artifacts valid/);
    assert.match(formatted, /publicHostingProven=false/);
    assert.doesNotMatch(formatted, /agents\.example|agent-card-key-1|private|secret|token/i);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle check rejects tampered local metadata", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-check-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });
    const manifestPath = join(outDir, "a2a-discovery-bundle-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: Array<{ headers: Record<string, string> }>;
    };
    manifest.files[0].headers["content-type"] = "application/json";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      () => checkA2AStaticDiscoveryBundle({ outDir }),
      /content-type/,
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
