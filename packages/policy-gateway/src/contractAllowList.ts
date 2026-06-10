import {
  defaultContractTemplateRegistry,
  evaluateContractTemplateAction,
  type ContractTemplateRegistry,
} from "@iota-gaskit/contracts-metadata";
import type { AgentTransactionManifest } from "@iota-gaskit/manifest";
import type { AgentPolicyContract } from "./policySchema.js";

export function contractActionAllowed(
  allowedContracts: readonly AgentPolicyContract[],
  action: AgentTransactionManifest["action"],
  registry: ContractTemplateRegistry = defaultContractTemplateRegistry,
): boolean {
  return allowedContracts.some((contract) => (
    templateContractAllowed(contract, action, registry) || rawContractAllowed(contract, action)
  ));
}

function templateContractAllowed(
  contract: AgentPolicyContract,
  action: AgentTransactionManifest["action"],
  registry: ContractTemplateRegistry,
): boolean {
  if (!contract.templateId) return false;
  if (!contract.templateVersion) return false;
  if (contract.templateId !== action.templateId || contract.templateVersion !== action.templateVersion) return false;

  const decision = evaluateContractTemplateAction(registry, action);
  return decision.allowed;
}

function rawContractAllowed(
  contract: AgentPolicyContract,
  action: AgentTransactionManifest["action"],
): boolean {
  return contract.packageId === action.packageId &&
    contract.functionName === action.functionName &&
    (contract.module === undefined || contract.module === action.module);
}
