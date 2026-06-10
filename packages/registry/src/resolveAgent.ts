import {
  validateAgentProfile,
  type AgentProfile,
  type AgentProfileValidationError,
} from "./profileSchema.js";

export type ResolveAgentErrorCode =
  | "PROFILE_NOT_FOUND"
  | "PROFILE_MALFORMED"
  | "PROFILE_UNSUPPORTED_SCHEMA"
  | "PROFILE_REVOKED"
  | "PROFILE_EXPIRED"
  | "PROFILE_UNVERIFIABLE"
  | "PROFILE_STALE_CACHE";

export interface ResolveAgentError {
  readonly code: ResolveAgentErrorCode;
  readonly message: string;
  readonly name: string;
  readonly validationErrors?: readonly AgentProfileValidationError[];
}

export type ResolveAgentResult =
  | {
      readonly ok: true;
      readonly profile: AgentProfile;
    }
  | {
      readonly ok: false;
      readonly error: ResolveAgentError;
    };

export interface AgentResolver {
  resolve(name: string): Promise<ResolveAgentResult>;
}

export interface LocalAgentResolverOptions {
  readonly profiles: readonly unknown[];
  readonly now?: () => Date;
}

export function createLocalAgentResolver(options: LocalAgentResolverOptions): AgentResolver {
  const profilesByName = new Map<string, unknown>();
  for (const profile of options.profiles) {
    if (isNamedProfileRecord(profile)) {
      profilesByName.set(profile.name, profile);
    }
  }

  return {
    async resolve(name) {
      const normalizedName = normalizeName(name);
      const profile = profilesByName.get(normalizedName);
      if (!profile) {
        return {
          ok: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "Agent profile was not found.",
            name: normalizedName,
          },
        };
      }

      return validateResolvedProfile(normalizedName, profile, options.now?.());
    },
  };
}

export async function resolveAgent(name: string, resolver: AgentResolver): Promise<ResolveAgentResult> {
  return resolver.resolve(normalizeName(name));
}

function validateResolvedProfile(name: string, profile: unknown, now?: Date): ResolveAgentResult {
  const validation = validateAgentProfile(profile, { now });
  if (validation.ok) {
    return { ok: true, profile: validation.profile };
  }

  return {
    ok: false,
    error: {
      code: resolveValidationErrorCode(validation.errors),
      message: "Agent profile failed validation.",
      name,
      validationErrors: validation.errors,
    },
  };
}

function resolveValidationErrorCode(errors: readonly AgentProfileValidationError[]): ResolveAgentErrorCode {
  if (errors.some((error) => error.code === "PROFILE_REVOKED")) return "PROFILE_REVOKED";
  if (errors.some((error) => error.code === "PROFILE_EXPIRED")) return "PROFILE_EXPIRED";
  if (errors.some((error) => error.code === "UNSUPPORTED_VERSION")) return "PROFILE_UNSUPPORTED_SCHEMA";
  return "PROFILE_MALFORMED";
}

function normalizeName(name: string): string {
  return name.trim();
}

function isNamedProfileRecord(value: unknown): value is { readonly name: string } {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { readonly name?: unknown }).name === "string";
}
