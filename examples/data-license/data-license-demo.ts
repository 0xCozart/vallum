import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { AGENT_TRANSACTION_MANIFEST_VERSION, type AgentTransactionManifest } from "@iota-gaskit/manifest";
import { createAgentMockGatewayServer, type AgentActionPolicy, type AgentGatewayEvent } from "@iota-gaskit/policy-gateway";
import { requestDataLicense, type RequestDataLicenseResult } from "@iota-gaskit/sdk";

const now = new Date("2026-06-10T12:00:00.000Z");
const buyerAgentId = "agent:data-buyer";
const providerAgentId = "agent:data-provider";
const packageId = "0x6666666666666666666666666666666666666666666666666666666666666666";

export interface DataLicenseDemoResult {
  readonly approved: RequestDataLicenseResult;
  readonly denied: RequestDataLicenseResult;
  readonly failedAccess: RequestDataLicenseResult;
  readonly gatewayEvents: readonly AgentGatewayEvent[];
}

const policy: AgentActionPolicy = {
  knownAgents: [buyerAgentId],
  maxGasBudget: 50_000_000,
  allowedContracts: [{
    templateId: "data_license_v1",
    templateVersion: "1.0.0",
  }],
  allowedCounterparties: [providerAgentId],
  requireSimulation: true,
};

export async function runDataLicenseDemo(): Promise<DataLicenseDemoResult> {
  const gatewayEvents: AgentGatewayEvent[] = [];
  const gateway = createAgentMockGatewayServer({
    policy,
    now: () => now,
    eventSink: (event) => {
      gatewayEvents.push(event);
    },
    mockGasStation: {
      reserve: async () => ({ sponsorshipId: "mock_sponsorship_data_license_demo" }),
    },
  });

  try {
    const gatewayBaseUrl = await listen(gateway);
    const approved = await requestDataLicense({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: dataLicenseManifest({ idempotencyKey: "idem_data_license_approved_1" }),
      receiptId: "receipt_data_license_approved_1",
      providerId: providerAgentId,
      licenseeId: buyerAgentId,
      datasetId: "dataset:pricing-feed-v1",
      termsHash: "sha256:data-license-terms",
      amount: { amount: "7.50", asset: "USD" },
      requestAccess: async () => ({
        ok: true,
        transactionDigest: "mock_digest_data_license_1",
        accessProofHash: "sha256:data-license-access-proof",
        expiresAt: "2026-07-10T12:00:00.000Z",
      }),
      now: () => now,
    });

    const denied = await requestDataLicense({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: dataLicenseManifest({
        idempotencyKey: "idem_data_license_denied_1",
        maxGasBudget: 50_000_001,
      }),
      receiptId: "receipt_data_license_denied_1",
      providerId: providerAgentId,
      licenseeId: buyerAgentId,
      datasetId: "dataset:pricing-feed-v1",
      termsHash: "sha256:data-license-terms",
      amount: { amount: "7.50", asset: "USD" },
      requestAccess: async () => {
        throw new Error("Access proof must not run when policy denies.");
      },
      now: () => now,
    });

    const failedAccess = await requestDataLicense({
      gatewayBaseUrl,
      apiKey: "demo-api-key",
      manifest: dataLicenseManifest({ idempotencyKey: "idem_data_license_failed_access_1" }),
      receiptId: "receipt_data_license_failed_access_1",
      providerId: providerAgentId,
      licenseeId: buyerAgentId,
      datasetId: "dataset:pricing-feed-v1",
      termsHash: "sha256:data-license-terms",
      amount: { amount: "7.50", asset: "USD" },
      requestAccess: async () => ({ ok: false, reason: "mock-access-proof-failed" }),
      now: () => now,
    });

    return {
      approved,
      denied,
      failedAccess,
      gatewayEvents,
    };
  } finally {
    await close(gateway);
  }
}

export function formatDataLicenseDemoResult(result: DataLicenseDemoResult): string {
  const gatewayEvents = result.gatewayEvents.map((event) => event.outcome).join(",");
  return [
    "Data license demo passed",
    `approved.status=${result.approved.receipt.status}`,
    `approved.sponsorshipId=${result.approved.receipt.sponsorshipId}`,
    `approved.datasetId=${result.approved.receipt.datasetId}`,
    `denied.status=${result.denied.receipt.status}`,
    `failedAccess.status=${result.failedAccess.receipt.status}`,
    `gateway.events=${gatewayEvents}`,
  ].join("\n");
}

function dataLicenseManifest(options: {
  readonly idempotencyKey: string;
  readonly maxGasBudget?: number;
}): AgentTransactionManifest {
  return {
    version: AGENT_TRANSACTION_MANIFEST_VERSION,
    agent: {
      id: buyerAgentId,
      address: "0x1111111111111111111111111111111111111111111111111111111111111111",
    },
    owner: {
      id: "owner:data-buyer",
    },
    wallet: {
      walletId: "wallet_data_license_demo",
      signerRef: "signer_ref_data_license_demo",
    },
    intent: "Purchase access to one data license.",
    spend: {
      maxGasBudget: options.maxGasBudget ?? 50_000_000,
      maxPayment: {
        amount: "7.50",
        asset: "USD",
      },
    },
    action: {
      packageId,
      module: "data_license",
      functionName: "request_license",
      templateId: "data_license_v1",
      templateVersion: "1.0.0",
      displayName: "Request data license",
    },
    counterparty: {
      id: providerAgentId,
      address: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    scope: ["contract:data_license", "action:request_license", "dataset:pricing-feed-v1"],
    expiresAt: "2026-06-10T13:00:00.000Z",
    idempotencyKey: options.idempotencyKey,
    simulation: {
      required: true,
      status: "passed",
      hash: "sha256:data-license-simulation",
    },
    receipt: {
      required: true,
      templateId: "receipt:data_license:v1",
    },
    humanMandate: {
      required: false,
    },
    refundPolicy: {
      type: "refund_to_owner",
    },
    metadata: {
      purpose: "data-license-demo",
      datasetId: "dataset:pricing-feed-v1",
      termsHash: "sha256:data-license-terms",
    },
  };
}

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
