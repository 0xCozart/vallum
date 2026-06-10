export const AGENT_TRANSACTION_MANIFEST_VERSION = "agent-tx-manifest/v1" as const;

export interface ManifestParty {
  readonly id: string;
  readonly address?: string;
}

export interface ManifestSpend {
  readonly maxGasBudget: number;
  readonly maxPayment?: {
    readonly amount: string;
    readonly asset: string;
  };
}

export interface ManifestAction {
  readonly packageId: string;
  readonly module?: string;
  readonly functionName: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
  readonly displayName?: string;
}

export interface ManifestSimulation {
  readonly required: boolean;
  readonly status?: "pending" | "passed" | "failed";
  readonly hash?: string;
}

export interface ManifestReceiptRequirement {
  readonly required: boolean;
  readonly templateId?: string;
}

export interface AgentTransactionManifest {
  readonly version: typeof AGENT_TRANSACTION_MANIFEST_VERSION;
  readonly agent: ManifestParty;
  readonly owner: ManifestParty;
  readonly wallet?: {
    readonly walletId?: string;
    readonly signerRef?: string;
  };
  readonly intent: string;
  readonly spend: ManifestSpend;
  readonly action: ManifestAction;
  readonly counterparty: ManifestParty;
  readonly scope: readonly string[];
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly simulation: ManifestSimulation;
  readonly receipt: ManifestReceiptRequirement;
  readonly humanMandate?: {
    readonly required: boolean;
    readonly mandateId?: string;
  };
  readonly refundPolicy?: {
    readonly type: "none" | "refund_to_owner" | "refund_to_agent_wallet";
  };
  readonly metadata?: Record<string, string>;
}
