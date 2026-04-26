import type {
  ExecuteSponsoredTransactionResponse,
  ReserveGasResponse,
} from "@iota-gaskit/sdk";

export const DEMO_PACKAGE_ID = "0xYOUR_DEMO_PACKAGE_ID";
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
    gasKitTransactionId: string;
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
  gasKitTransactionId: string;
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
    gasKitTransactionId: reservation.gasKitTransactionId,
    transactionBytes: options.transactionBytes ?? DEMO_TRANSACTION_BYTES,
    userSignature: options.userSignature ?? DEMO_USER_SIGNATURE,
  });

  if (!executed.digest) {
    throw new Error("Demo transaction execution did not return a transaction digest.");
  }

  return {
    reservationId: reservation.reservationId,
    gasKitTransactionId: reservation.gasKitTransactionId,
    sponsorAddress: reservation.sponsorAddress,
    digest: executed.digest,
  };
}

export function formatDemoGrantFlowResult(result: DemoGrantFlowResult): string {
  return [
    "IOTA GasKit demo dApp local flow passed",
    `reservationId=${result.reservationId}`,
    `gasKitTransactionId=${result.gasKitTransactionId}`,
    result.sponsorAddress ? `sponsorAddress=${result.sponsorAddress}` : undefined,
    `digest=${result.digest}`,
  ].filter((line): line is string => Boolean(line)).join("\n");
}
