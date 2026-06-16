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

export interface PackagePaidMcpConsumerSmokeOptions {
  readonly cwd?: string;
  readonly run?: Runner;
}

export function buildPaidMcpConsumerSmokeSource(): string {
  return String.raw`
import assert from "node:assert/strict";
import { once } from "node:events";

import { AGENT_TRANSACTION_MANIFEST_VERSION } from "@sacredlabs/agentrail-manifest";
import { createAgentMockGatewayServer } from "@sacredlabs/agentrail-policy-gateway";
import { callPaidTool } from "@sacredlabs/agentrail-sdk";

const now = new Date("2026-06-15T12:00:00.000Z");
const buyerAgentId = "agent:package-consumer-paid-tool-buyer";
const providerAgentId = "agent:package-consumer-paid-tool-provider";
const packageId = "0x5555555555555555555555555555555555555555555555555555555555555555";

const gatewayEvents = [];
const gateway = createAgentMockGatewayServer({
  policy: {
    knownAgents: [buyerAgentId],
    maxGasBudget: 50_000_000,
    allowedContracts: [{
      templateId: "pay_per_call_v1",
      templateVersion: "1.0.0",
    }],
    allowedCounterparties: [providerAgentId],
    requireSimulation: true,
  },
  now: () => now,
  eventSink: (event) => {
    gatewayEvents.push(event);
  },
  mockGasStation: {
    reserve: async () => ({ sponsorshipId: "mock_sponsorship_package_consumer_paid_mcp" }),
  },
});

try {
  const gatewayBaseUrl = await listen(gateway);
  const approved = await callPaidTool({
    gatewayBaseUrl,
    apiKey: "consumer-demo-api-key",
    manifest: paidToolManifest({ idempotencyKey: "idem_package_consumer_paid_mcp_approved_1" }),
    receiptId: "receipt_package_consumer_paid_mcp_approved_1",
    providerId: providerAgentId,
    toolName: "premium_analysis",
    amount: { amount: "3.00", asset: "USD" },
    confirmPayment: async () => ({ ok: true, transactionDigest: "mock_digest_package_consumer_paid_mcp_1" }),
    invokeTool: async () => ({
      result: "premium-analysis: package consumer path works",
      resultHash: "sha256:package-consumer-premium-analysis-result",
    }),
    now: () => now,
  });

  const denied = await callPaidTool({
    gatewayBaseUrl,
    apiKey: "consumer-demo-api-key",
    manifest: paidToolManifest({
      idempotencyKey: "idem_package_consumer_paid_mcp_denied_1",
      maxGasBudget: 50_000_001,
    }),
    receiptId: "receipt_package_consumer_paid_mcp_denied_1",
    providerId: providerAgentId,
    toolName: "premium_analysis",
    amount: { amount: "3.00", asset: "USD" },
    confirmPayment: async () => {
      throw new Error("Payment confirmation must not run when policy denies.");
    },
    invokeTool: async () => {
      throw new Error("Paid tool must not run when policy denies.");
    },
    now: () => now,
  });

  const failedPayment = await callPaidTool({
    gatewayBaseUrl,
    apiKey: "consumer-demo-api-key",
    manifest: paidToolManifest({ idempotencyKey: "idem_package_consumer_paid_mcp_failed_payment_1" }),
    receiptId: "receipt_package_consumer_paid_mcp_failed_payment_1",
    providerId: providerAgentId,
    toolName: "premium_analysis",
    amount: { amount: "3.00", asset: "USD" },
    confirmPayment: async () => ({ ok: false, reason: "mock-payment-failed" }),
    invokeTool: async () => {
      throw new Error("Paid tool must not run when payment fails.");
    },
    now: () => now,
  });

  assert.equal(approved.paid, true);
  assert.equal(approved.receipt.status, "completed");
  assert.equal(approved.result, "premium-analysis: package consumer path works");
  assert.equal(denied.paid, false);
  assert.equal(denied.receipt.status, "denied");
  assert.equal(failedPayment.paid, false);
  assert.equal(failedPayment.receipt.status, "failed");
  assert.equal(failedPayment.receipt.failureReason, "mock-payment-failed");
  assert.deepEqual(gatewayEvents.map((event) => event.outcome), ["approved", "denied", "approved"]);

  const approvedEvents = receiptEvents(approved.receipt.events);
  const deniedEvents = receiptEvents(denied.receipt.events);
  const failedPaymentEvents = receiptEvents(failedPayment.receipt.events);
  assert.equal(approvedEvents, "pay_per_call_created,approved,sponsored,submitted,completed");
  assert.equal(deniedEvents, "pay_per_call_created,denied");
  assert.equal(failedPaymentEvents, "pay_per_call_created,approved,sponsored,failed");

  const output = [
    "Package paid MCP consumer smoke passed",
    "mode=package-consumer",
    "install=local-tarballs",
    "boundary.liveNetwork=false",
    "boundary.route=SDK->mock-policy-gateway",
    "imports.rootOnly=true",
    "approval.status=completed",
    "approval.paid=true",
    "denial.status=denied",
    "denial.reason=GAS_BUDGET_TOO_HIGH",
    "failedPayment.status=failed",
    "failedPayment.reason=mock-payment-failed",
    "receipt.events.approved=" + approvedEvents,
    "receipt.events.denied=" + deniedEvents,
    "receipt.events.failedPayment=" + failedPaymentEvents,
    "redaction.apiKey=redacted",
    "redaction.signerReference=redacted",
    "redaction.tempPaths=redacted",
  ].join("\n");

  assert.doesNotMatch(output, /consumer-demo-api-key|signer_ref_package_consumer_paid_mcp|Bearer|privateKey|mnemonic|seed|rawTransactionBytes=|userSignature=/i);
  console.log(output);
} finally {
  await close(gateway);
}

function paidToolManifest(options) {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: buyerAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:package-consumer-paid-tool-buyer",
    },
    wallet: {
      walletId: "wallet_package_consumer_paid_mcp",
      signerRef: "signer_ref_package_consumer_paid_mcp",
    },
    intent: "Purchase one premium MCP tool result.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 50_000_000,
      maxPayment: {
        amount: "3.00",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "pay_per_call",
      functionName: "request_call",
      templateId: "pay_per_call_v1",
      templateVersion: "1.0.0",
      displayName: "Request paid MCP tool call",
    },
    counterparty: {
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:pay_per_call", "action:request_call", "tool:premium_analysis"],
    expiresAt: "2026-06-15T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:package-consumer-paid-mcp-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:pay_per_call:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "package-consumer-paid-mcp-smoke",
    },
  };
}

function receiptEvents(events) {
  return events.map((event) => event.type).join(",");
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return "http://127.0.0.1:" + address.port;
}

async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
`.trimStart();
}

export async function runPackagePaidMcpConsumerSmoke(
  options: PackagePaidMcpConsumerSmokeOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const run =
    options.run ??
    ((command: string, args: readonly string[], runCwd: string) =>
      spawnSync(command, args, { cwd: runCwd, encoding: "utf8", stdio: "pipe" }));

  const packages = await collectPublishablePackages(cwd);
  if (packages.length === 0) {
    console.error("Package paid MCP consumer smoke failed: no public packages found.");
    return 1;
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "agentrail-package-paid-mcp-consumer-"));
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
    await writeFile(join(consumerDir, "index.mjs"), buildPaidMcpConsumerSmokeSource(), "utf8");

    const install = run("npm", buildNpmInstallArgs(), consumerDir);
    if (install.status !== 0) {
      writeFailure("install", "consumer", install, cwd);
      return install.status ?? 1;
    }

    const smoke = run("node", ["index.mjs"], consumerDir);
    if (smoke.status !== 0) {
      writeFailure("paid-mcp-consumer", "consumer", smoke, cwd);
      return smoke.status ?? 1;
    }

    process.stdout.write(smoke.stdout);
    console.log(`Package paid MCP consumer smoke installed local tarballs packages=${packages.length}`);
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
  console.error(`Package paid MCP consumer smoke failed during ${step}: ${label}`);
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
  process.exitCode = await runPackagePaidMcpConsumerSmoke();
}
