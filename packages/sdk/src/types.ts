import type { PolicyDecision } from "@vallum/shared-types";
import type { AgentTransactionManifest } from "@vallum/manifest";

export interface VallumClientOptions {
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
  agentRailTransactionId: string;
  sponsorAddress?: string;
  gasCoins?: unknown[];
  raw: unknown;
}

export interface ExecuteSponsoredTransactionRequest {
  reservationId: string;
  agentRailTransactionId: string;
  transactionBytes: string;
  userSignature: string;
}

export interface ExecuteSponsoredTransactionResponse {
  digest?: string;
  raw: unknown;
}

export interface SponsoredActionRequest {
  manifest: AgentTransactionManifest;
}

export interface RequestSponsoredActionOptions extends SponsoredActionRequest {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export type SponsoredActionDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reasonCode: string;
      message: string;
    };

export type SponsoredActionResult =
  | {
      approved: true;
      decision: Extract<SponsoredActionDecision, { allowed: true }>;
      mockSponsorshipId: string;
    }
  | {
      approved: false;
      decision: Extract<SponsoredActionDecision, { allowed: false }>;
    };
