import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  AgentRailMcpConfigError,
  parseAgentRailMcpConfig,
  redactAgentRailMcpConfig,
} from "./config.js";
import { runAgentRailMcpCli } from "./cli.js";

const secretApiKey = "local-secret-agentrail-api-key";
const gatewayUrl = "https://gateway.example.test/private/path/";
const packageVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

test("MCP config parser accepts valid environment", () => {
  const config = parseAgentRailMcpConfig({
    AGENTRAIL_GATEWAY_URL: gatewayUrl,
    AGENTRAIL_API_KEY: secretApiKey,
    AGENTRAIL_MCP_SERVER_NAME: "agentrail-local",
    AGENTRAIL_MCP_SERVER_VERSION: "2026.6.16",
    AGENTRAIL_MCP_LOG_LEVEL: "debug",
  });

  assert.equal(config.gatewayBaseUrl, "https://gateway.example.test/private/path");
  assert.equal(config.apiKey, secretApiKey);
  assert.equal(config.serverName, "agentrail-local");
  assert.equal(config.serverVersion, "2026.6.16");
  assert.equal(config.logLevel, "debug");
});

test("MCP config parser rejects missing gateway URL", () => {
  assert.throws(
    () => parseAgentRailMcpConfig({ AGENTRAIL_API_KEY: secretApiKey }),
    (error: unknown) => {
      assert.equal(error instanceof AgentRailMcpConfigError, true);
      assert.match((error as Error).message, /AGENTRAIL_GATEWAY_URL is required/);
      assert.doesNotMatch((error as Error).message, new RegExp(secretApiKey));
      return true;
    },
  );
});

test("MCP config parser rejects missing API key", () => {
  assert.throws(
    () => parseAgentRailMcpConfig({ AGENTRAIL_GATEWAY_URL: gatewayUrl }),
    (error: unknown) => {
      assert.equal(error instanceof AgentRailMcpConfigError, true);
      assert.match((error as Error).message, /AGENTRAIL_API_KEY is required/);
      assert.doesNotMatch((error as Error).message, /gateway\.example\.test/);
      return true;
    },
  );
});

test("MCP config redaction never includes API key or gateway value", () => {
  const config = parseAgentRailMcpConfig({
    AGENTRAIL_GATEWAY_URL: gatewayUrl,
    AGENTRAIL_API_KEY: secretApiKey,
  });

  const serialized = JSON.stringify(redactAgentRailMcpConfig(config));

  assert.doesNotMatch(serialized, new RegExp(secretApiKey));
  assert.doesNotMatch(serialized, /gateway\.example\.test/);
  assert.deepEqual(JSON.parse(serialized), {
    gatewayUrl: "configured",
    apiKey: "configured",
    serverName: "agentrail",
    serverVersion: "0.0.0",
    logLevel: "error",
  });
});

test("MCP CLI --help and --version do not read secrets", async () => {
  const help = await runCli(["--help"], {});
  const version = await runCli(["--version"], {});

  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /Usage: agentrail-mcp/);
  assert.equal(help.stderr, "");
  assert.equal(version.exitCode, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+|^0\.0\.0-prerelease/);
  assert.equal(version.stderr, "");
});

test("MCP CLI --check-config prints redacted status", async () => {
  const result = await runCli(["--check-config"], {
    AGENTRAIL_GATEWAY_URL: gatewayUrl,
    AGENTRAIL_API_KEY: secretApiKey,
  });

  assert.equal(result.exitCode, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secretApiKey));
  assert.doesNotMatch(result.stdout, /gateway\.example\.test/);
  assert.deepEqual(JSON.parse(result.stdout), {
    gatewayUrl: "configured",
    apiKey: "configured",
    serverName: "agentrail",
    serverVersion: packageVersion,
    logLevel: "error",
  });
});

test("MCP CLI missing environment fails closed with variable names only", async () => {
  const result = await runCli(["--check-config"], {
    AGENTRAIL_API_KEY: secretApiKey,
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /AGENTRAIL_GATEWAY_URL is required/);
  assert.doesNotMatch(result.stderr, new RegExp(secretApiKey));
});

test("built MCP CLI help works from dist output after package build", () => {
  const result = spawnSync(process.execPath, ["packages/mcp-server/dist/cli.js", "--help"], {
    cwd: new URL("../../..", import.meta.url),
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: agentrail-mcp/);
  assert.equal(result.stderr, "");
});

async function runCli(
  args: readonly string[],
  env: Record<string, string | undefined>,
): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runAgentRailMcpCli(args, env, {
    stdout: { write: (chunk: string) => { stdout += chunk; return true; } },
    stderr: { write: (chunk: string) => { stderr += chunk; return true; } },
  });
  return { exitCode, stdout, stderr };
}
