import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { collectPublishablePackages, type PublishablePackage } from "./package-publish-dry-run.js";
import {
  buildConsumerPackageJson,
  buildNpmInstallArgs,
  buildNpmPackArgs,
  type PackageTarball,
} from "./smoke-package-install.js";

type Runner = (command: string, args: readonly string[], cwd: string) => SpawnSyncReturns<string>;

const REQUIRED_CONSUMER_PACKAGE_NAMES = new Set([
  "@sacredlabs/agentrail-contracts-metadata",
  "@sacredlabs/agentrail-manifest",
  "@sacredlabs/agentrail-mcp-server",
  "@sacredlabs/agentrail-policy-gateway",
  "@sacredlabs/agentrail-receipts",
  "@sacredlabs/agentrail-registry",
  "@sacredlabs/agentrail-sdk",
  "@sacredlabs/agentrail-shared-types",
]);

export interface PackageMcpStdioConsumerSmokeOptions {
  readonly cwd?: string;
  readonly run?: Runner;
}

export function buildMcpStdioConsumerSmokeSource(): string {
  return String.raw`
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access } from "node:fs/promises";
import { join } from "node:path";

import { validManifestFixture } from "@sacredlabs/agentrail-manifest";
import { createAgentMockGatewayServer } from "@sacredlabs/agentrail-policy-gateway";

const fakeApiKey = "local-package-mcp-stdio-secret-key";
const now = new Date("2026-06-10T12:00:00.000Z");
const binPath = process.platform === "win32"
  ? join(process.cwd(), "node_modules", ".bin", "agentrail-mcp.cmd")
  : join(process.cwd(), "node_modules", ".bin", "agentrail-mcp");

const gateway = createAgentMockGatewayServer({
  policy: {
    knownAgents: ["agent:quote-bot"],
    maxGasBudget: 50_000_000,
    allowedContracts: [{
      packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      module: "escrow",
      functionName: "open_escrow",
    }],
    allowedCounterparties: ["provider:quote-service"],
    requireSimulation: true,
  },
  now: () => now,
  mockGasStation: {
    reserve: async () => ({ sponsorshipId: "mock_sponsorship_package_mcp_stdio_1" }),
  },
});

let child;

try {
  await access(binPath);
  const gatewayBaseUrl = await listen(gateway);
  const mcp = await startMcpProcess(gatewayBaseUrl);

  child = mcp.child;
  const initialized = await mcp.request("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: {
      name: "agentrail-package-mcp-stdio-consumer",
      version: "0.0.0-local",
    },
  });
  assert.equal(initialized.protocolVersion, "2025-11-25");
  mcp.notify("notifications/initialized");

  const listed = await mcp.request("tools/list", {});
  assert.deepEqual(listed.tools.map((tool) => tool.name), [
    "iota.request_sponsored_transaction",
    "iota.open_escrow",
  ]);

  const approved = await mcp.request("tools/call", {
    name: "iota.request_sponsored_transaction",
    arguments: { manifest: freshManifestFixture() },
  });
  assert.equal(approved.isError, false);
  assert.deepEqual(approved.structuredContent, {
    approved: true,
    decision: { allowed: true },
    mockSponsorshipId: "mock_sponsorship_package_mcp_stdio_1",
  });

  const denied = await mcp.request("tools/call", {
    name: "iota.open_escrow",
    arguments: {
      manifest: {
        ...freshManifestFixture(),
        spend: { maxGasBudget: 50_000_001 },
      },
    },
  });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent.error.code, "GAS_BUDGET_TOO_HIGH");

  const invalid = await mcp.request("tools/call", {
    name: "iota.request_sponsored_transaction",
    arguments: {},
  });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent.error.code, "INVALID_TOOL_INPUT");

  await mcp.close();
  assert.doesNotMatch(mcp.stderr(), new RegExp(fakeApiKey));
  assert.doesNotMatch(mcp.stderr(), /signerRef|transactionBytes|userSignature|raw upstream|private key|mnemonic/i);

  const output = [
    "Package MCP stdio consumer smoke passed",
    "mode=package-consumer",
    "install=local-tarballs",
    "bin=node_modules/.bin/agentrail-mcp",
    "boundary.liveNetwork=false",
    "boundary.route=MCP-stdio->SDK->mock-policy-gateway",
    "approval.approved=true",
    "denial.reason=GAS_BUDGET_TOO_HIGH",
    "invalid.reason=INVALID_TOOL_INPUT",
    "redaction.apiKey=redacted",
  ].join("\n");
  assert.doesNotMatch(output, new RegExp(fakeApiKey));
  console.log(output);
} finally {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  await close(gateway);
}

async function startMcpProcess(gatewayBaseUrl) {
  const pending = new Map();
  let nextId = 1;
  let stdout = "";
  let stderr = "";
  const child = spawn(binPath, [], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      AGENTRAIL_GATEWAY_URL: gatewayBaseUrl,
      AGENTRAIL_API_KEY: fakeApiKey,
      AGENTRAIL_MCP_LOG_LEVEL: "error",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    for (;;) {
      const newline = stdout.indexOf("\n");
      if (newline === -1) break;
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      if (line.trim() === "") continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        const { resolve, reject, timeout } = pending.get(message.id);
        clearTimeout(timeout);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("error", (error) => {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    pending.clear();
  });
  child.on("close", (code, signal) => {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(new Error("MCP process closed before response. code=" + code + " signal=" + signal + " stderr=" + stderr));
    }
    pending.clear();
  });
  await once(child, "spawn");

  return {
    child,
    stderr: () => stderr,
    request(method, params) {
      const id = nextId++;
      const payload = { jsonrpc: "2.0", id, method, params };
      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Timed out waiting for MCP response to " + method + ". stderr=" + stderr));
        }, 15_000);
        pending.set(id, { resolve, reject, timeout });
      });
      child.stdin.write(JSON.stringify(payload) + "\n");
      return promise;
    },
    notify(method, params = {}) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    },
    async close() {
      child.stdin.end();
      await waitForChildClose(child);
    },
  };
}

async function waitForChildClose(child) {
  if (child.exitCode !== null) return;
  const closePromise = once(child, "close");
  const timeout = new Promise((resolve) => setTimeout(resolve, 2_000));
  await Promise.race([closePromise, timeout]);
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([closePromise, timeout]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return "http://127.0.0.1:" + address.port;
}

function freshManifestFixture() {
  return {
    ...validManifestFixture(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function close(server) {
  if (!server.listening) return;
  let timeout;
  const closePromise = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
      reject(new Error("Timed out closing package MCP stdio mock gateway."));
    }, 2_000);
  });
  try {
    await Promise.race([closePromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
`.trimStart();
}

export async function runPackageMcpStdioConsumerSmoke(
  options: PackageMcpStdioConsumerSmokeOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const run =
    options.run ??
    ((command: string, args: readonly string[], runCwd: string) =>
      spawnSync(command, args, { cwd: runCwd, encoding: "utf8", stdio: "pipe" }));

  const packages = (await collectPublishablePackages(cwd))
    .filter((packageInfo) => REQUIRED_CONSUMER_PACKAGE_NAMES.has(packageInfo.name));
  if (packages.length === 0) {
    console.error("Package MCP stdio consumer smoke failed: no required public packages found.");
    return 1;
  }
  const missing = [...REQUIRED_CONSUMER_PACKAGE_NAMES].filter(
    (packageName) => !packages.some((packageInfo) => packageInfo.name === packageName),
  );
  if (missing.length > 0) {
    console.error(`Package MCP stdio consumer smoke failed: missing packages ${missing.join(", ")}.`);
    return 1;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "agentrail-package-mcp-stdio-consumer-"));
  const packDir = join(tempRoot, "packs");
  const consumerDir = join(tempRoot, "consumer");

  try {
    await mkdir(packDir);
    await mkdir(consumerDir);

    const tarballs: PackageTarball[] = [];
    for (const packageInfo of packages) {
      const result = run("npm", buildNpmPackArgs(packageInfo, packDir), cwd);
      if (result.status !== 0) {
        writeFailure("pack", packageInfo.name, result, cwd);
        return result.status ?? 1;
      }

      const tarballPath = await findPackedTarball(packDir, packageInfo);
      tarballs.push({ name: packageInfo.name, tarballPath });
    }

    await writeFile(join(consumerDir, "package.json"), buildConsumerPackageJson(tarballs), "utf8");
    await writeFile(join(consumerDir, "index.mjs"), buildMcpStdioConsumerSmokeSource(), "utf8");

    const install = run("npm", buildNpmInstallArgs(), consumerDir);
    if (install.status !== 0) {
      writeFailure("install", "consumer", install, cwd);
      return install.status ?? 1;
    }

    const smoke = run("node", ["index.mjs"], consumerDir);
    if (smoke.status !== 0) {
      writeFailure("mcp-stdio-consumer", "consumer", smoke, cwd);
      return smoke.status ?? 1;
    }

    process.stdout.write(smoke.stdout);
    console.log(`Package MCP stdio consumer smoke installed local tarballs packages=${packages.length}`);
    return 0;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function findPackedTarball(packDir: string, packageInfo: PublishablePackage): Promise<string> {
  const expectedPrefix = packageInfo.name.replace(/^@/, "").replace("/", "-");
  const entries = await readdir(packDir);
  const matches = entries.filter((entry) => entry.startsWith(expectedPrefix) && entry.endsWith(".tgz"));

  if (matches.length !== 1) {
    throw new Error(`Expected one tarball for ${packageInfo.name}, found ${matches.length}.`);
  }

  return resolve(packDir, matches[0] ?? "");
}

function writeFailure(step: string, label: string, result: SpawnSyncReturns<string>, cwd: string): void {
  console.error(`Package MCP stdio consumer smoke failed during ${step}: ${label}`);
  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(redactLocalPaths(result.stderr, cwd));
  if (result.stdout) console.error(redactLocalPaths(result.stdout, cwd));
}

function redactLocalPaths(output: string, cwd: string): string {
  return output
    .split("\n")
    .map((line) => line.replaceAll(cwd, "<repo>"))
    .map((line) => line.replaceAll(tmpdir(), "<tmp>"))
    .join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await runPackageMcpStdioConsumerSmoke();
}
