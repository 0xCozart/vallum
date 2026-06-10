import { validateAgentProfile, type AgentProfile } from "@iota-gaskit/registry";

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
