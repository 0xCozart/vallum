import {
  validateAgentTransactionManifest,
  type AgentTransactionManifest,
  type ManifestValidationError,
} from "@agentrail/manifest";
import { contractActionAllowed } from "./contractAllowList.js";
import type { AgentActionPolicy, AgentPolicyDecision } from "./policySchema.js";

export interface AgentActionPolicyEvaluationOptions {
  readonly now?: Date;
}

export function evaluateAgentActionPolicy(
  policy: AgentActionPolicy,
  manifest: unknown,
  options: AgentActionPolicyEvaluationOptions = {},
): AgentPolicyDecision {
  if (manifest === undefined || manifest === null) {
    return reject("MISSING_MANIFEST", "Agent transaction manifest is required.");
  }

  const manifestResult = validateAgentTransactionManifest(manifest, { now: options.now });
  if (!manifestResult.ok) return manifestValidationDecision(manifestResult.errors);

  const validManifest = manifestResult.manifest;
  if (!policy.knownAgents.includes(validManifest.agent.id)) {
    return reject("UNKNOWN_AGENT", "Agent is not known to policy.");
  }
  if (policy.revokedAgents?.includes(validManifest.agent.id)) {
    return reject("AGENT_REVOKED", "Agent is revoked by policy.");
  }
  if (validManifest.spend.maxGasBudget > policy.maxGasBudget) {
    return reject("GAS_BUDGET_TOO_HIGH", "Manifest gas budget exceeds policy.");
  }
  if (!contractActionAllowed(policy.allowedContracts, validManifest.action)) {
    return reject("CONTRACT_NOT_ALLOWED", "Manifest contract action is not allowed by policy.");
  }
  if (!policy.allowedCounterparties.includes(validManifest.counterparty.id)) {
    return reject("COUNTERPARTY_NOT_ALLOWED", "Manifest counterparty is not allowed by policy.");
  }
  if (policy.requireSimulation && !simulationSatisfied(validManifest)) {
    return reject("SIMULATION_REQUIRED", "Passing simulation is required before sponsorship.");
  }
  if (
    typeof policy.humanApprovalGasThreshold === "number" &&
    validManifest.spend.maxGasBudget > policy.humanApprovalGasThreshold
  ) {
    return reject("HUMAN_APPROVAL_REQUIRED", "Human approval is required for this manifest budget.");
  }

  return { allowed: true };
}

function manifestValidationDecision(errors: readonly ManifestValidationError[]): AgentPolicyDecision {
  if (errors.some((error) => error.code === "UNSUPPORTED_VERSION")) {
    return reject("UNSUPPORTED_MANIFEST_VERSION", "Manifest version is unsupported.");
  }
  if (errors.some((error) => error.code === "MANIFEST_EXPIRED")) {
    return reject("MANIFEST_EXPIRED", "Manifest is expired.");
  }
  return reject("MANIFEST_INVALID", "Manifest failed validation.");
}

function simulationSatisfied(manifest: AgentTransactionManifest): boolean {
  return manifest.simulation.required === true &&
    manifest.simulation.status === "passed" &&
    typeof manifest.simulation.hash === "string" &&
    manifest.simulation.hash.trim() !== "";
}

function reject(
  reasonCode: Exclude<AgentPolicyDecision, { allowed: true }>["reasonCode"],
  message: string,
): AgentPolicyDecision {
  return { allowed: false, reasonCode, message };
}
