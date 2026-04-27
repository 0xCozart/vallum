import type { PolicyDecision } from "@iota-gaskit/shared-types";

export interface GasKitClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface ReserveGasRequest {
  gasBudget: number;
  reserveDurationSecs?: number;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
}

export interface PolicySimulationRequest {
  gasBudget?: number;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
}

export type PolicySimulationResponse = PolicyDecision;

export interface ReserveGasResponse {
  reservationId: string;
  gasKitTransactionId: string;
  sponsorAddress?: string;
  gasCoins?: unknown[];
  raw: unknown;
}

export interface ExecuteSponsoredTransactionRequest {
  reservationId: string;
  gasKitTransactionId: string;
  transactionBytes: string;
  userSignature: string;
}

export interface ExecuteSponsoredTransactionResponse {
  digest?: string;
  raw: unknown;
}
