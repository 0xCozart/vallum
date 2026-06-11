import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createA2AAgentCardFromProfile,
  createA2APublicJwksResponse,
  signA2AAgentCard,
  validAgentProfileFixture,
} from "../packages/registry/src/index.js";
import { writeA2AStaticDiscoveryBundleFromFiles } from "./write-a2a-static-discovery-bundle.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const publicBaseUrl = "https://agents.example/a2a";
const publicJwksUrl = "https://agents.example/.well-known/jwks.json";

test("A2A static discovery bundle script writes deployable artifacts from public JSON inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-script-"));
  try {
    const { agentCardPath, jwksPath } = await writeInputs(root);
    const outDir = join(root, "public");

    const written = await writeA2AStaticDiscoveryBundleFromFiles({
      agentCardPath,
      jwksPath,
      outDir,
      publicBaseUrl,
      publicJwksUrl,
      cacheControl: "public, max-age=60",
    });

    assert.equal(written.files.length, 2);
    assert.equal(written.manifestPath, join(outDir, "a2a-discovery-bundle-manifest.json"));
    const card = JSON.parse(await readFile(join(outDir, ".well-known", "agent-card.json"), "utf8")) as {
      supportedInterfaces?: Array<{ url?: string }>;
    };
    const jwks = JSON.parse(await readFile(join(outDir, ".well-known", "jwks.json"), "utf8")) as {
      keys?: Array<{ kid?: string }>;
    };
    const manifest = JSON.parse(await readFile(written.manifestPath, "utf8")) as {
      files?: Array<{ headers?: Record<string, string> }>;
    };

    assert.equal(card.supportedInterfaces?.[0]?.url, publicBaseUrl);
    assert.equal(jwks.keys?.[0]?.kid, "agent-card-key-1");
    assert.equal(manifest.files?.[0]?.headers?.["cache-control"], "public, max-age=60");
    assert.doesNotMatch(
      JSON.stringify({ card, jwks, manifest }),
      /"d"|"p"|"q"|privateToken|secret-value|mnemonic|seed|signer_ref|wallet_|payment-secret/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle script rejects JWKS private material", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-script-"));
  try {
    const { agentCardPath, jwksPath } = await writeInputs(root);
    const jwks = JSON.parse(await readFile(jwksPath, "utf8")) as { keys: Array<Record<string, unknown>> };
    jwks.keys[0] = { ...jwks.keys[0], d: "private-key-material" };
    await writeFile(jwksPath, `${JSON.stringify(jwks, null, 2)}\n`);

    await assert.rejects(
      () => writeA2AStaticDiscoveryBundleFromFiles({
        agentCardPath,
        jwksPath,
        outDir: join(root, "public"),
        publicBaseUrl,
        publicJwksUrl,
      }),
      /private key material/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeInputs(root: string): Promise<{ agentCardPath: string; jwksPath: string }> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const profile = {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: publicBaseUrl },
      ...validAgentProfileFixture().endpoints,
    ],
  };
  const agentCard = signA2AAgentCard(createA2AAgentCardFromProfile(profile, {
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
  const agentCardPath = join(root, "agent-card.json");
  const jwksPath = join(root, "jwks.json");
  await writeFile(agentCardPath, `${JSON.stringify(agentCard, null, 2)}\n`);
  await writeFile(jwksPath, jwks.json);
  return { agentCardPath, jwksPath };
}
