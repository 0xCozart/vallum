import type {
  ExecuteSponsoredTransactionResponse,
  ReserveGasResponse,
} from "@vallum/sdk";

export const DEMO_PACKAGE_ID = "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0";
export const DEMO_FUNCTION_NAME = "mint_badge";
export const DEMO_WALLET_ADDRESS = "0xDEMO_WALLET";
export const DEMO_TRANSACTION_BYTES = "AAE=";
export const DEMO_USER_SIGNATURE = "demo-user-signature";

export interface DemoGrantFlowClient {
  reserveGas(request: {
    gasBudget: number;
    walletAddress?: string;
    packageId?: string;
    functionName?: string;
  }): Promise<ReserveGasResponse>;
  executeSponsoredTransaction(request: {
    reservationId: string;
    agentRailTransactionId: string;
    transactionBytes: string;
    userSignature: string;
  }): Promise<ExecuteSponsoredTransactionResponse>;
}

export interface DemoGrantFlowOptions {
  gasBudget?: number;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
  transactionBytes?: string;
  userSignature?: string;
}

export interface DemoGrantFlowResult {
  reservationId: string;
  agentRailTransactionId: string;
  sponsorAddress?: string;
  digest: string;
}

export async function runDemoGrantFlow(
  client: DemoGrantFlowClient,
  options: DemoGrantFlowOptions = {},
): Promise<DemoGrantFlowResult> {
  const reservation = await client.reserveGas({
    gasBudget: options.gasBudget ?? 1,
    walletAddress: options.walletAddress ?? DEMO_WALLET_ADDRESS,
    packageId: options.packageId ?? DEMO_PACKAGE_ID,
    functionName: options.functionName ?? DEMO_FUNCTION_NAME,
  });

  const executed = await client.executeSponsoredTransaction({
    reservationId: reservation.reservationId,
    agentRailTransactionId: reservation.agentRailTransactionId,
    transactionBytes: options.transactionBytes ?? DEMO_TRANSACTION_BYTES,
    userSignature: options.userSignature ?? DEMO_USER_SIGNATURE,
  });

  if (!executed.digest) {
    throw new Error("Demo transaction execution did not return a transaction digest.");
  }

  return {
    reservationId: reservation.reservationId,
    agentRailTransactionId: reservation.agentRailTransactionId,
    sponsorAddress: reservation.sponsorAddress,
    digest: executed.digest,
  };
}

export function formatDemoGrantFlowResult(result: DemoGrantFlowResult): string {
  return [
    "Vallum demo dApp local flow passed",
    `reservationId=${result.reservationId}`,
    `agentRailTransactionId=${result.agentRailTransactionId}`,
    result.sponsorAddress ? `sponsorAddress=${result.sponsorAddress}` : undefined,
    `digest=${result.digest}`,
  ].filter((line): line is string => Boolean(line)).join("\n");
}
