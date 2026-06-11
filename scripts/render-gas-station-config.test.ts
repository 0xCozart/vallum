import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";

import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

import {
  gasStationKeypairForConfig,
  renderGasStationConfig,
} from "./render-gas-station-config.js";

test("renders official-style local Gas Station config from an IOTA private key", () => {
  const keypair = Ed25519Keypair.generate().getSecretKey();
  const config = renderGasStationConfig({
    keypair,
    rpcUrl: "https://api.testnet.iota.cafe",
  });
  const renderedKey = config.match(/keypair: "([^"]+)"/)?.[1];

  assert.ok(renderedKey);
  assert.equal(Buffer.from(renderedKey, "base64").length, 33);
  assert.match(config, /redis-url: "redis:\/\/redis:6379"/);
  assert.match(config, /fullnode-url: "https:\/\/api\.testnet\.iota\.cafe"/);
  assert.match(config, /rpc-port: 9527/);
  assert.match(config, /access-policy: "disabled"/);
  assert.doesNotMatch(config, /iotaprivkey|replace-with|bearer|GAS_STATION_AUTH/);
});

test("normalizes raw 32-byte base64 keys to the official 33-byte local key format", () => {
  const raw = Buffer.alloc(32, 7).toString("base64");
  const rendered = gasStationKeypairForConfig(raw);
  const bytes = Buffer.from(rendered, "base64");

  assert.equal(bytes.length, 33);
  assert.equal(bytes[0], 0);
  assert.equal(bytes.subarray(1).every((byte) => byte === 7), true);
});

test("keeps existing 33-byte base64 keys stable", () => {
  const officialShape = Buffer.concat([Buffer.from([0]), Buffer.alloc(32, 9)]).toString("base64");

  assert.equal(gasStationKeypairForConfig(officialShape), officialShape);
});

test("fails closed on placeholders and invalid numeric config", () => {
  assert.throws(
    () => gasStationKeypairForConfig("replace-with-local-testnet-sponsor-key"),
    /non-placeholder/,
  );
  assert.throws(
    () => renderGasStationConfig({
      keypair: Buffer.concat([Buffer.from([0]), Buffer.alloc(32, 1)]).toString("base64"),
      rpcUrl: "https://api.testnet.iota.cafe",
      rpcPort: "not-a-port",
    }),
    /GAS_STATION_RPC_PORT/,
  );
});
