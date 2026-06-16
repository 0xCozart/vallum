import {
  VallumAuthError,
  VallumError,
  VallumPolicyError,
  type ExecuteSponsoredTransactionRequest,
  type ExecuteSponsoredTransactionResponse,
  type ReserveGasRequest,
  type ReserveGasResponse,
} from "../../packages/sdk/src/index.js";
import { POLICY_REASON_CODES } from "../../packages/shared-types/src/policy.js";

export interface VallumBackendClient {
  reserveGas(request: ReserveGasRequest): Promise<ReserveGasResponse>;
  executeSponsoredTransaction(
    request: ExecuteSponsoredTransactionRequest,
  ): Promise<ExecuteSponsoredTransactionResponse>;
}

export interface VallumExampleResponse<TBody extends object> {
  status: number;
  body: TBody;
}

export interface VallumExampleErrorBody {
  error: "AUTH_FAILED" | "POLICY_REJECTED" | "VALLUM_REQUEST_FAILED" | "INTERNAL_ERROR";
  message: string;
  reasonCode?: string;
}

export type VallumExampleResult<TBody extends object> = VallumExampleResponse<TBody | VallumExampleErrorBody>;

export interface CreateVallumBackendHandlersOptions {
  client: VallumBackendClient;
}

export interface ReserveHandlerInput {
  gasBudget: number;
  reserveDurationSecs?: number;
  walletAddress?: string;
  packageId?: string;
  functionName?: string;
}

export interface ReserveHandlerBody {
  reservationId: string;
  agentRailTransactionId: string;
  sponsorAddress?: string;
}

export type ExecuteHandlerInput = ExecuteSponsoredTransactionRequest;

export interface ExecuteHandlerBody {
  digest?: string;
}

function statusOrFallback(status: number | undefined, fallback: number): number {
  return typeof status === "number" && status >= 400 && status <= 599 ? status : fallback;
}

function knownPolicyReasonCode(reasonCode: string | undefined): string | undefined {
  return typeof reasonCode === "string" && (POLICY_REASON_CODES as readonly string[]).includes(reasonCode)
    ? reasonCode
    : undefined;
}

function safeErrorResponse(error: unknown): VallumExampleResponse<VallumExampleErrorBody> {
  if (error instanceof VallumAuthError) {
    return {
      status: statusOrFallback(error.status, 401),
      body: {
        error: "AUTH_FAILED",
        message: "Vallum authentication failed.",
      },
    };
  }

  if (error instanceof VallumPolicyError) {
    const reasonCode = knownPolicyReasonCode(error.reasonCode);

    return {
      status: statusOrFallback(error.status, 400),
      body: {
        error: "POLICY_REJECTED",
        message: "Request rejected by Vallum policy.",
        ...(reasonCode === undefined ? {} : { reasonCode }),
      },
    };
  }

  if (error instanceof VallumError) {
    return {
      status: statusOrFallback(error.status, 502),
      body: {
        error: "VALLUM_REQUEST_FAILED",
        message: "Vallum request failed.",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "INTERNAL_ERROR",
      message: "Internal server error.",
    },
  };
}

export function createVallumBackendHandlers(options: CreateVallumBackendHandlersOptions) {
  return {
    async reserve(input: ReserveHandlerInput): Promise<VallumExampleResult<ReserveHandlerBody>> {
      try {
        const reservation = await options.client.reserveGas({
          gasBudget: input.gasBudget,
          reserveDurationSecs: input.reserveDurationSecs,
          walletAddress: input.walletAddress,
          packageId: input.packageId,
          functionName: input.functionName,
        });

        return {
          status: 200,
          body: {
            reservationId: reservation.reservationId,
            agentRailTransactionId: reservation.agentRailTransactionId,
            ...(reservation.sponsorAddress === undefined ? {} : { sponsorAddress: reservation.sponsorAddress }),
          },
        };
      } catch (error) {
        return safeErrorResponse(error);
      }
    },

    async execute(input: ExecuteHandlerInput): Promise<VallumExampleResult<ExecuteHandlerBody>> {
      try {
        const executed = await options.client.executeSponsoredTransaction({
          reservationId: input.reservationId,
          agentRailTransactionId: input.agentRailTransactionId,
          transactionBytes: input.transactionBytes,
          userSignature: input.userSignature,
        });

        return {
          status: 200,
          body: {
            ...(executed.digest === undefined ? {} : { digest: executed.digest }),
          },
        };
      } catch (error) {
        return safeErrorResponse(error);
      }
    },
  };
}
