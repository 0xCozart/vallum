import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_JWKS_WELL_KNOWN_PATH,
  createA2AAgentCardFromProfile,
  createA2APublicDiscoveryBundle,
  createA2APublicJwksResponse,
  signA2AAgentCard,
  validateA2APublicDiscoveryBundleArtifacts,
  validAgentProfileFixture,
  writeA2APublicDiscoveryBundle,
} from "./index.js";

const now = new Date("2026-06-10T12:00:00.000Z");
const publicBaseUrl = "https://agents.example/a2a";
const publicJwksUrl = "https://agents.example/.well-known/jwks.json";

test("A2A static discovery bundle packages signed Agent Card and JWKS safely", () => {
  const bundle = validBundle();

  assert.deepEqual(bundle.files.map((file) => file.path), [
    A2A_AGENT_CARD_WELL_KNOWN_PATH,
    A2A_JWKS_WELL_KNOWN_PATH,
  ]);
  assert.equal(bundle.publicBaseUrl, publicBaseUrl);
  assert.equal(bundle.publicJwksUrl, publicJwksUrl);
  assert.match(bundle.files[0]?.headers["content-type"] ?? "", /application\/a2a\+json/);
  assert.match(bundle.files[1]?.headers["content-type"] ?? "", /application\/jwk-set\+json/);
  assert.equal(bundle.files[0]?.headers["cache-control"], "public, max-age=60");
  assert.equal(bundle.files[1]?.headers["cache-control"], "public, max-age=60");
  assert.equal(JSON.parse(bundle.files[0]?.json ?? "{}").supportedInterfaces[0].url, publicBaseUrl);
  assert.equal(JSON.parse(bundle.files[1]?.json ?? "{}").keys[0].kid, "agent-card-key-1");
  assert.doesNotMatch(JSON.stringify(bundle), /"d"|"p"|"q"|privateToken|secret-value|mnemonic|seed|signer_ref|wallet_|payment-secret/i);
});

test("A2A static discovery bundle fails closed when signatures or JWKS binding are missing", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const unsignedCard = createA2AAgentCardFromProfile(profileFixture(), {
    now,
    endpointUrl: publicBaseUrl,
  });
  const signedWrongJwks = signA2AAgentCard(unsignedCard, {
    keyId: "agent-card-key-1",
    privateKey,
    jwksUrl: "https://other.example/.well-known/jwks.json",
    signedAt: now,
  });
  const jwks = createA2APublicJwksResponse({
    keys: [{ keyId: "agent-card-key-1", publicKey }],
  });

  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: unsignedCard,
      jwks,
      publicBaseUrl,
      publicJwksUrl,
    }),
    /signed Agent Card/,
  );
  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: signedWrongJwks,
      jwks,
      publicBaseUrl,
      publicJwksUrl,
    }),
    /JWKS URL/,
  );
});

test("A2A static discovery bundle requires every signing key id in JWKS", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const signed = signA2AAgentCard(createA2AAgentCardFromProfile(profileFixture(), {
    now,
    endpointUrl: publicBaseUrl,
  }), {
    keyId: "agent-card-key-1",
    privateKey,
    jwksUrl: publicJwksUrl,
    signedAt: now,
  });
  const jwks = createA2APublicJwksResponse({
    keys: [{
      keyId: "agent-card-key-2",
      jwk: { kty: "OKP", crv: "Ed25519", x: "public-key-fixture" },
    }],
  });

  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: signed,
      jwks,
      publicBaseUrl,
      publicJwksUrl,
    }),
    /signing key/,
  );
});

test("A2A static discovery bundle rejects noncanonical paths and secret-like public fields", () => {
  const bundle = validBundle();
  const card = JSON.parse(bundle.files[0]?.json ?? "{}") as Record<string, unknown>;
  const jwks = JSON.parse(bundle.files[1]?.json ?? "{}") as Record<string, unknown>;

  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: { ...card, privateToken: "secret" } as never,
      jwks: {
        path: A2A_JWKS_WELL_KNOWN_PATH,
        status: 200,
        headers: bundle.files[1]?.headers ?? {},
        body: jwks as never,
        json: JSON.stringify(jwks),
      },
      publicBaseUrl,
      publicJwksUrl,
    }),
    /private/,
  );
  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: card as never,
      jwks: {
        path: "/jwks.json" as never,
        status: 200,
        headers: bundle.files[1]?.headers ?? {},
        body: jwks as never,
        json: JSON.stringify(jwks),
      },
      publicBaseUrl,
      publicJwksUrl,
    }),
    /canonical/,
  );
  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: card as never,
      jwks: {
        path: A2A_JWKS_WELL_KNOWN_PATH,
        status: 200,
        headers: bundle.files[1]?.headers ?? {},
        body: jwks as never,
        json: JSON.stringify(jwks),
      },
      publicBaseUrl: "https://user:pass@agents.example/a2a?token=value",
      publicJwksUrl,
    }),
    /public HTTPS/,
  );
  assert.throws(
    () => createA2APublicDiscoveryBundle({
      agentCard: card as never,
      jwks: {
        path: A2A_JWKS_WELL_KNOWN_PATH,
        status: 200,
        headers: bundle.files[1]?.headers ?? {},
        body: jwks as never,
        json: JSON.stringify(jwks),
      },
      publicBaseUrl,
      publicJwksUrl: "https://192.168.1.10/.well-known/jwks.json",
    }),
    /public HTTPS/,
  );
});

test("A2A static discovery bundle writer creates canonical deployable artifacts", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "vallum-a2a-static-bundle-"));
  try {
    const bundle = validBundle();
    const written = await writeA2APublicDiscoveryBundle({ bundle, outDir });
    const agentCardPath = join(outDir, ".well-known", "agent-card.json");
    const jwksPath = join(outDir, ".well-known", "jwks.json");
    const manifestPath = join(outDir, "a2a-discovery-bundle-manifest.json");

    assert.equal(written.outDir, outDir);
    assert.equal(written.publicBaseUrl, publicBaseUrl);
    assert.equal(written.publicJwksUrl, publicJwksUrl);
    assert.deepEqual(written.files.map((file) => file.sourcePath), [
      A2A_AGENT_CARD_WELL_KNOWN_PATH,
      A2A_JWKS_WELL_KNOWN_PATH,
    ]);
    assert.deepEqual(written.files.map((file) => file.path), [agentCardPath, jwksPath]);
    assert.equal(written.manifestPath, manifestPath);

    const card = JSON.parse(await readFile(agentCardPath, "utf8")) as { supportedInterfaces?: Array<{ url?: string }> };
    const jwks = JSON.parse(await readFile(jwksPath, "utf8")) as { keys?: Array<{ kid?: string }> };
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      kind?: string;
      publicBaseUrl?: string;
      files?: Array<{ path?: string; headers?: Record<string, string> }>;
    };

    assert.equal(card.supportedInterfaces?.[0]?.url, publicBaseUrl);
    assert.equal(jwks.keys?.[0]?.kid, "agent-card-key-1");
    assert.equal(manifest.kind, "vallum.a2a-static-discovery-bundle");
    assert.equal(manifest.publicBaseUrl, publicBaseUrl);
    assert.equal(manifest.files?.[0]?.path, A2A_AGENT_CARD_WELL_KNOWN_PATH);
    assert.match(manifest.files?.[0]?.headers?.["content-type"] ?? "", /application\/a2a\+json/);
    assert.doesNotMatch(
      JSON.stringify({ card, jwks, manifest }),
      /"d"|"p"|"q"|privateToken|secret-value|mnemonic|seed|signer_ref|wallet_|payment-secret/i,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle writer fails closed for unexpected or missing paths", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "vallum-a2a-static-bundle-"));
  try {
    const bundle = validBundle();

    await assert.rejects(
      () => writeA2APublicDiscoveryBundle({
        bundle: {
          ...bundle,
          files: [
            { ...bundle.files[0], path: "/../agent-card.json" as never },
            bundle.files[1],
          ],
        },
        outDir,
      }),
      /unexpected static file path/,
    );

    await assert.rejects(
      () => writeA2APublicDiscoveryBundle({
        bundle: {
          ...bundle,
          files: [bundle.files[0], { ...bundle.files[0] }] as never,
        },
        outDir,
      }),
      /unexpected static file path/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle artifact validator accepts canonical generated files", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "vallum-a2a-static-bundle-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });

    const validated = await validateA2APublicDiscoveryBundleArtifacts({
      outDir,
      expectedPublicBaseUrl: publicBaseUrl,
      expectedPublicJwksUrl: publicJwksUrl,
    });

    assert.equal(validated.outDir, outDir);
    assert.equal(validated.publicBaseUrl, publicBaseUrl);
    assert.equal(validated.publicJwksUrl, publicJwksUrl);
    assert.deepEqual(validated.files.map((file) => file.sourcePath), [
      A2A_AGENT_CARD_WELL_KNOWN_PATH,
      A2A_JWKS_WELL_KNOWN_PATH,
    ]);
    assert.equal(validated.manifestPath, join(outDir, "a2a-discovery-bundle-manifest.json"));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle artifact validator rejects tampered files", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "vallum-a2a-static-bundle-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });
    const agentCardPath = join(outDir, ".well-known", "agent-card.json");
    const card = JSON.parse(await readFile(agentCardPath, "utf8")) as Record<string, unknown>;
    await writeFile(agentCardPath, `${JSON.stringify({ ...card, supportedInterfaces: [] }, null, 2)}\n`);

    await assert.rejects(
      () => validateA2APublicDiscoveryBundleArtifacts({ outDir }),
      /public base URL/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("A2A static discovery bundle artifact validator rejects unsafe manifests", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "vallum-a2a-static-bundle-"));
  try {
    await writeA2APublicDiscoveryBundle({ bundle: validBundle(), outDir });
    const manifestPath = join(outDir, "a2a-discovery-bundle-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;

    await assert.rejects(
      () => validateA2APublicDiscoveryBundleArtifacts({
        outDir,
        expectedPublicBaseUrl: "https://other.example/a2a",
      }),
      /expected value/,
    );

    await writeFile(manifestPath, `${JSON.stringify({
      ...manifest,
      [`sec${"ret"}Token`]: "redacted-fixture",
    }, null, 2)}\n`);
    await assert.rejects(
      () => validateA2APublicDiscoveryBundleArtifacts({ outDir }),
      /private fields/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function validBundle() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const card = signA2AAgentCard(createA2AAgentCardFromProfile(profileFixture(), {
    now,
    endpointUrl: publicBaseUrl,
    capabilities: {
      streaming: true,
      pushNotifications: true,
    },
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

function profileFixture() {
  return {
    ...validAgentProfileFixture(),
    endpoints: [
      { type: "a2a" as const, url: publicBaseUrl },
      ...validAgentProfileFixture().endpoints,
    ],
  };
}
