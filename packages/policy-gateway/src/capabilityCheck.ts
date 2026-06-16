import { validateAgentProfile, type AgentProfile, type ResolveAgentResult } from "@vallum/registry";

export interface AgentCapabilityRequirement {
  readonly capabilityId: string;
  readonly scope?: string;
  readonly contract?: string;
}

export type AgentCapabilityPolicyDecision =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reasonCode:
        | "PROFILE_INVALID"
        | "PROFILE_REVOKED"
        | "PROFILE_EXPIRED"
        | "PROFILE_UNVERIFIABLE"
        | "PROFILE_STALE_CACHE"
        | "CAPABILITY_NOT_ALLOWED";
      readonly message: string;
    };

export interface AgentCapabilityPolicyOptions {
  readonly now?: Date;
}

export function evaluateProfileCapabilityPolicy(
  profile: unknown,
  requirement: AgentCapabilityRequirement,
  options: AgentCapabilityPolicyOptions = {},
): AgentCapabilityPolicyDecision {
  const validation = validateAgentProfile(profile, { now: options.now });
  if (!validation.ok) {
    if (validation.errors.some((error) => error.code === "PROFILE_REVOKED")) {
      return deny("PROFILE_REVOKED", "Agent profile is revoked.");
    }
    if (validation.errors.some((error) => error.code === "PROFILE_EXPIRED")) {
      return deny("PROFILE_EXPIRED", "Agent profile is expired.");
    }
    return deny("PROFILE_INVALID", "Agent profile failed validation.");
  }

  if (!hasRequiredCapability(validation.profile, requirement)) {
    return deny("CAPABILITY_NOT_ALLOWED", "Required agent capability is not present.");
  }

  return { allowed: true };
}

export function evaluateResolvedProfileCapabilityPolicy(
  resolved: ResolveAgentResult,
  requirement: AgentCapabilityRequirement,
  options: AgentCapabilityPolicyOptions = {},
): AgentCapabilityPolicyDecision {
  if (!resolved.ok) {
    if (resolved.error.code === "PROFILE_REVOKED") {
      return deny("PROFILE_REVOKED", resolved.error.message);
    }
    if (resolved.error.code === "PROFILE_EXPIRED") {
      return deny("PROFILE_EXPIRED", resolved.error.message);
    }
    if (resolved.error.code === "PROFILE_STALE_CACHE") {
      return deny("PROFILE_STALE_CACHE", resolved.error.message);
    }
    if (resolved.error.code === "PROFILE_UNVERIFIABLE") {
      return deny("PROFILE_UNVERIFIABLE", resolved.error.message);
    }
    return deny("PROFILE_INVALID", resolved.error.message);
  }

  return evaluateProfileCapabilityPolicy(resolved.profile, requirement, options);
}

function hasRequiredCapability(profile: AgentProfile, requirement: AgentCapabilityRequirement): boolean {
  return profile.capabilities.some((capability) => {
    if (capability.id !== requirement.capabilityId) return false;
    if (requirement.scope && !capability.scopes?.includes(requirement.scope)) return false;
    if (requirement.contract && !capability.contracts?.includes(requirement.contract)) return false;
    return true;
  });
}

function deny(
  reasonCode: Exclude<AgentCapabilityPolicyDecision, { allowed: true }>["reasonCode"],
  message: string,
): AgentCapabilityPolicyDecision {
  return { allowed: false, reasonCode, message };
}
