import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";

import {
  A2A_JWKS_WELL_KNOWN_PATH,
  createA2APublicJwksResponse,
  handleA2APublicJwksRequest,
} from "./index.js";

test("A2A JWKS helper serves public signing keys without private material", () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const response = createA2APublicJwksResponse({
    keys: [{ keyId: "agent-card-key-1", publicKey }],
    cacheControl: "public, max-age=300",
  });
  const body = JSON.parse(response.json) as { keys: Array<Record<string, unknown>> };

  assert.equal(response.path, A2A_JWKS_WELL_KNOWN_PATH);
  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"] ?? "", /application\/jwk-set\+json/);
  assert.equal(response.headers["cache-control"], "public, max-age=300");
  assert.equal(body.keys.length, 1);
  assert.equal(body.keys[0]?.kid, "agent-card-key-1");
  assert.equal(body.keys[0]?.kty, "OKP");
  assert.equal(body.keys[0]?.use, "sig");
  assert.equal(body.keys[0]?.alg, "EdDSA");
  assert.doesNotMatch(response.json, /"d"|"p"|"q"|"dp"|"dq"|"qi"|private|secret|mnemonic|seed/i);
});

test("A2A JWKS helper accepts sanitized public JWK input", () => {
  const response = createA2APublicJwksResponse({
    keys: [{
      keyId: "agent-card-key-2",
      jwk: {
        kty: "OKP",
        crv: "Ed25519",
        x: "public-key-fixture",
      },
    }],
  });
  const body = JSON.parse(response.json) as { keys: Array<Record<string, unknown>> };

  assert.deepEqual(body.keys, [{
    kty: "OKP",
    crv: "Ed25519",
    x: "public-key-fixture",
    kid: "agent-card-key-2",
    use: "sig",
    alg: "EdDSA",
  }]);
});

test("A2A JWKS helper fails closed for private keys and invalid key sets", () => {
  const { privateKey } = generateKeyPairSync("ed25519");

  assert.throws(
    () => createA2APublicJwksResponse({
      keys: [{ keyId: "agent-card-key-1", publicKey: privateKey }],
    }),
    /public key material/,
  );
  assert.throws(
    () => createA2APublicJwksResponse({ keys: [] }),
    /at least one public key/,
  );
  assert.throws(
    () => createA2APublicJwksResponse({
      keys: [{ keyId: " ", jwk: { kty: "OKP", crv: "Ed25519", x: "public" } }],
    }),
    /key id/,
  );
  assert.throws(
    () => createA2APublicJwksResponse({
      keys: [{
        keyId: "agent-card-key-1",
        jwk: { kty: "OKP", crv: "Ed25519", x: "public", d: "private" },
      }],
    }),
    /private key material/,
  );
  assert.throws(
    () => createA2APublicJwksResponse({
      keys: [{
        keyId: "agent-card-key-1",
        jwk: { kty: "OKP", crv: "Ed25519", x: "public", privateToken: "secret" },
      }],
    }),
    /private key material/,
  );
});

test("A2A JWKS request handler serves only the well-known GET route", () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const options = { keys: [{ keyId: "agent-card-key-1", publicKey }] };

  const ok = handleA2APublicJwksRequest({ method: "GET", path: A2A_JWKS_WELL_KNOWN_PATH }, options);
  const wrongPath = handleA2APublicJwksRequest({ method: "GET", path: "/jwks.json" }, options);
  const wrongMethod = handleA2APublicJwksRequest({ method: "POST", path: A2A_JWKS_WELL_KNOWN_PATH }, options);
  const unavailable = handleA2APublicJwksRequest({ method: "GET", path: A2A_JWKS_WELL_KNOWN_PATH }, { keys: [] });

  assert.equal(ok.status, 200);
  assert.equal(wrongPath.status, 404);
  assert.match(wrongPath.json, /A2A_JWKS_NOT_FOUND/);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, "GET");
  assert.match(wrongMethod.json, /A2A_JWKS_METHOD_NOT_ALLOWED/);
  assert.equal(unavailable.status, 404);
  assert.match(unavailable.json, /A2A_JWKS_UNAVAILABLE/);
  for (const response of [wrongPath, wrongMethod, unavailable]) {
    assert.doesNotMatch(response.json, /agent-card-key-1|private|secret|seed|mnemonic/i);
  }
});
