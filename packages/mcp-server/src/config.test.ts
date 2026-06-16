import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  VallumMcpConfigError,
  parseVallumMcpConfig,
  redactVallumMcpConfig,
} from "./config.js";
import { runVallumMcpCli } from "./cli.js";

const secretApiKey = "local-secret-vallum-api-key";
const gatewayUrl = "https://gateway.example.test/private/path/";
const packageVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

test("MCP config parser accepts valid environment", () => {
  const config = parseVallumMcpConfig({
    VALLUM_GATEWAY_URL: gatewayUrl,
    VALLUM_API_KEY: secretApiKey,
    VALLUM_MCP_SERVER_NAME: "vallum-local",
    VALLUM_MCP_SERVER_VERSION: "2026.6.16",
    VALLUM_MCP_LOG_LEVEL: "debug",
  });

  assert.equal(config.gatewayBaseUrl, "https://gateway.example.test/private/path");
  assert.equal(config.apiKey, secretApiKey);
  assert.equal(config.serverName, "vallum-local");
  assert.equal(config.serverVersion, "2026.6.16");
  assert.equal(config.logLevel, "debug");
});

test("MCP config parser rejects missing gateway URL", () => {
  assert.throws(
    () => parseVallumMcpConfig({ VALLUM_API_KEY: secretApiKey }),
    (error: unknown) => {
      assert.equal(error instanceof VallumMcpConfigError, true);
      assert.match((error as Error).message, /VALLUM_GATEWAY_URL is required/);
      assert.doesNotMatch((error as Error).message, new RegExp(secretApiKey));
      return true;
    },
  );
});

test("MCP config parser rejects missing API key", () => {
  assert.throws(
    () => parseVallumMcpConfig({ VALLUM_GATEWAY_URL: gatewayUrl }),
    (error: unknown) => {
      assert.equal(error instanceof VallumMcpConfigError, true);
      assert.match((error as Error).message, /VALLUM_API_KEY is required/);
      assert.doesNotMatch((error as Error).message, /gateway\.example\.test/);
      return true;
    },
  );
});

test("MCP config redaction never includes API key or gateway value", () => {
  const config = parseVallumMcpConfig({
    VALLUM_GATEWAY_URL: gatewayUrl,
    VALLUM_API_KEY: secretApiKey,
  });

  const serialized = JSON.stringify(redactVallumMcpConfig(config));

  assert.doesNotMatch(serialized, new RegExp(secretApiKey));
  assert.doesNotMatch(serialized, /gateway\.example\.test/);
  assert.deepEqual(JSON.parse(serialized), {
    gatewayUrl: "configured",
    apiKey: "configured",
    serverName: "vallum",
    serverVersion: "0.0.0",
    logLevel: "error",
  });
});

test("MCP CLI --help and --version do not read secrets", async () => {
  const help = await runCli(["--help"], {});
  const version = await runCli(["--version"], {});

  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /Usage: vallum-mcp/);
  assert.equal(help.stderr, "");
  assert.equal(version.exitCode, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+|^0\.0\.0-prerelease/);
  assert.equal(version.stderr, "");
});

test("MCP CLI --check-config prints redacted status", async () => {
  const result = await runCli(["--check-config"], {
    VALLUM_GATEWAY_URL: gatewayUrl,
    VALLUM_API_KEY: secretApiKey,
  });

  assert.equal(result.exitCode, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secretApiKey));
  assert.doesNotMatch(result.stdout, /gateway\.example\.test/);
  assert.deepEqual(JSON.parse(result.stdout), {
    gatewayUrl: "configured",
    apiKey: "configured",
    serverName: "vallum",
    serverVersion: packageVersion,
    logLevel: "error",
  });
});

test("MCP CLI missing environment fails closed with variable names only", async () => {
  const result = await runCli(["--check-config"], {
    VALLUM_API_KEY: secretApiKey,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /VALLUM_GATEWAY_URL is required/);
  assert.doesNotMatch(result.stderr, new RegExp(secretApiKey));
});

test("built MCP CLI help works from dist output after package build", () => {
  const result = spawnSync(process.execPath, ["packages/mcp-server/dist/cli.js", "--help"], {
    cwd: new URL("../../..", import.meta.url),
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: vallum-mcp/);
  assert.equal(result.stderr, "");
});

async function runCli(
  args: readonly string[],
  env: Record<string, string | undefined>,
): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runVallumMcpCli(args, env, {
    stdout: { write: (chunk: string) => { stdout += chunk; return true; } },
    stderr: { write: (chunk: string) => { stderr += chunk; return true; } },
  });
  return { exitCode, stdout, stderr };
}
