import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createA2AAgentCardFromProfile,
  createA2APublicJwksResponse,
  signA2AAgentCard,
  validAgentProfileFixture,
} from "../packages/registry/src/index.js";
import {
  formatA2AStaticDiscoveryLocalSmokeResult,
  smokeA2AStaticDiscoveryLocal,
} from "./smoke-a2a-static-discovery-local.js";
import { writeA2AStaticDiscoveryBundleFromFiles } from "./write-a2a-static-discovery-bundle.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const publicBaseUrl = "https://agents.example/a2a";
const publicJwksUrl = "https://agents.example/.well-known/jwks.json";

test("A2A static discovery local smoke serves generated artifacts on loopback only", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-host-"));
  try {
    const { agentCardPath, jwksPath } = await writeInputs(root);
    const outDir = join(root, "public");
    await writeA2AStaticDiscoveryBundleFromFiles({
      agentCardPath,
      jwksPath,
      outDir,
      publicBaseUrl,
      publicJwksUrl,
      cacheControl: "public, max-age=60",
    });

    const result = await smokeA2AStaticDiscoveryLocal({
      outDir,
      expectedPublicBaseUrl: publicBaseUrl,
      expectedPublicJwksUrl: publicJwksUrl,
    });
    const formatted = formatA2AStaticDiscoveryLocalSmokeResult(result);

    assert.deepEqual(result, {
      ok: true,
      files: 2,
      localOnly: true,
      publicHostingProven: false,
    });
    assert.match(formatted, /A2A static discovery local host smoke passed/);
    assert.match(formatted, /localOnly=true/);
    assert.match(formatted, /publicHostingProven=false/);
    assert.doesNotMatch(formatted, /agents\.example|agent-card-key-1|private|secret|token|mnemonic|seed|signer/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("A2A static discovery local smoke refuses non-loopback hosts", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-gaskit-a2a-static-host-"));
  try {
    await assert.rejects(
      () => smokeA2AStaticDiscoveryLocal({ outDir: root, host: "0.0.0.0" }),
      /refuses non-loopback hosts/,
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
