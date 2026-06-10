export interface AgentActionPolicy {
  readonly knownAgents: readonly string[];
  readonly revokedAgents?: readonly string[];
  readonly maxGasBudget: number;
  readonly allowedContracts: readonly AgentPolicyContract[];
  readonly allowedCounterparties: readonly string[];
  readonly requireSimulation?: boolean;
  readonly humanApprovalGasThreshold?: number;
}

export interface AgentPolicyContract {
  readonly packageId?: string;
  readonly module?: string;
  readonly functionName?: string;
  readonly templateId?: string;
  readonly templateVersion?: string;
}

export type AgentPolicyDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reasonCode:
        | "MISSING_MANIFEST"
        | "MANIFEST_INVALID"
        | "MANIFEST_EXPIRED"
        | "UNSUPPORTED_MANIFEST_VERSION"
        | "UNKNOWN_AGENT"
        | "AGENT_REVOKED"
        | "GAS_BUDGET_TOO_HIGH"
        | "CONTRACT_NOT_ALLOWED"
        | "COUNTERPARTY_NOT_ALLOWED"
        | "SIMULATION_REQUIRED"
        | "HUMAN_APPROVAL_REQUIRED";
      readonly message: string;
    };
