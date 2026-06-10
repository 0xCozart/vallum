import {
  validateAgentProfile,
  type AgentProfile,
} from "./profileSchema.js";
import {
  resolveAgentValidationErrorCode,
  type AgentResolver,
  type ResolveAgentError,
  type ResolveAgentResult,
} from "./resolveAgent.js";
import { verifyAgentProfileIdentity, type IotaIdentityVerificationOptions } from "./iotaIdentityAdapter.js";

export const IOTA_NAMES_RESOLVE_ADDRESS_QUERY = `
query ResolveIotaNamesAddress($name: String!) {
  resolveIotaNamesAddress(name: $name) {
    address
  }
}
`;

export interface IotaNamesGraphQLRequest {
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

export interface IotaNamesGraphQLError {
  readonly message?: string;
}

export interface IotaNamesGraphQLResponse<TData> {
  readonly data?: TData;
  readonly errors?: readonly IotaNamesGraphQLError[];
}

export interface IotaNamesGraphQLClient {
  readonly query: <TData>(request: IotaNamesGraphQLRequest) => Promise<IotaNamesGraphQLResponse<TData>>;
}

export type IotaNamesAddressResolution =
  | {
      readonly ok: true;
      readonly name: string;
      readonly address: string;
      readonly source: "iota-names-graphql";
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: "IOTA_NAME_NOT_FOUND" | "IOTA_NAMES_GRAPHQL_ERROR" | "IOTA_NAMES_MALFORMED_RESPONSE";
        readonly message: string;
      };
      readonly name: string;
    };

type IotaNamesAddressResolutionErrorCode =
  Exclude<IotaNamesAddressResolution, { ok: true }>["error"]["code"];

export interface FetchIotaNamesGraphQLClientOptions {
  readonly endpoint: string;
  readonly fetch?: typeof fetch;
}

export interface IotaNamesProfileSource {
  readonly getProfileByAddress: (
    address: string,
    context: { readonly name: string },
  ) => Promise<unknown | undefined>;
}

export interface IotaNamesAgentResolverOptions {
  readonly graphQL: IotaNamesGraphQLClient;
  readonly profileSource: IotaNamesProfileSource;
  readonly identity?: IotaIdentityVerificationOptions;
  readonly now?: () => Date;
}

export function createFetchIotaNamesGraphQLClient(
  options: FetchIotaNamesGraphQLClientOptions,
): IotaNamesGraphQLClient {
  const fetchImpl = options.fetch ?? fetch;
  return {
    async query<TData>(request: IotaNamesGraphQLRequest) {
      const response = await fetchImpl(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        return {
          errors: [{ message: `IOTA Names GraphQL request failed with HTTP ${response.status}.` }],
        };
      }
      return await response.json() as IotaNamesGraphQLResponse<TData>;
    },
  };
}

export async function resolveIotaNamesAddress(
  name: string,
  graphQL: IotaNamesGraphQLClient,
): Promise<IotaNamesAddressResolution> {
  const normalizedName = normalizeName(name);
  let response: IotaNamesGraphQLResponse<IotaNamesResolveAddressData>;
  try {
    response = await graphQL.query<IotaNamesResolveAddressData>({
      query: IOTA_NAMES_RESOLVE_ADDRESS_QUERY,
      variables: { name: normalizedName },
    });
  } catch {
    return {
      ok: false,
      name: normalizedName,
      error: {
        code: "IOTA_NAMES_GRAPHQL_ERROR",
        message: "IOTA Names GraphQL request failed.",
      },
    };
  }

  if (response.errors?.length) {
    return {
      ok: false,
      name: normalizedName,
      error: {
        code: "IOTA_NAMES_GRAPHQL_ERROR",
        message: "IOTA Names GraphQL returned errors.",
      },
    };
  }

  const resolved = response.data?.resolveIotaNamesAddress;
  if (resolved === null) {
    return {
      ok: false,
      name: normalizedName,
      error: {
        code: "IOTA_NAME_NOT_FOUND",
        message: "IOTA name did not resolve to an address.",
      },
    };
  }

  if (!isRecord(resolved) || typeof resolved.address !== "string" || resolved.address.trim() === "") {
    return {
      ok: false,
      name: normalizedName,
      error: {
        code: "IOTA_NAMES_MALFORMED_RESPONSE",
        message: "IOTA Names GraphQL returned a malformed address response.",
      },
    };
  }

  return {
    ok: true,
    name: normalizedName,
    address: resolved.address,
    source: "iota-names-graphql",
  };
}

export function createIotaNamesAgentResolver(options: IotaNamesAgentResolverOptions): AgentResolver {
  return {
    async resolve(name) {
      const normalizedName = normalizeName(name);
      const addressResolution = await resolveIotaNamesAddress(normalizedName, options.graphQL);
      if (!addressResolution.ok) {
        return resolveNamesError(normalizedName, addressResolution.error.message, addressResolution.error.code);
      }

      let profile: unknown | undefined;
      try {
        profile = await options.profileSource.getProfileByAddress(addressResolution.address, {
          name: normalizedName,
        });
      } catch {
        return unresolvedProfile(normalizedName, "Agent Profile metadata source failed.");
      }
      if (!profile) {
        return {
          ok: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "No Agent Profile metadata was found for the resolved IOTA name address.",
            name: normalizedName,
          },
        };
      }

      return validateNamesProfile(normalizedName, addressResolution.address, profile, options);
    },
  };
}

interface IotaNamesResolveAddressData {
  readonly resolveIotaNamesAddress?: unknown;
}

async function validateNamesProfile(
  name: string,
  address: string,
  profile: unknown,
  options: IotaNamesAgentResolverOptions,
): Promise<ResolveAgentResult> {
  const validation = validateAgentProfile(profile, { now: options.now?.() });
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: resolveAgentValidationErrorCode(validation.errors),
        message: "Agent profile failed validation.",
        name,
        validationErrors: validation.errors,
      },
    };
  }

  if (validation.profile.name !== name) {
    return unresolvedProfile(name, "Resolved profile name does not match the IOTA name.");
  }
  if (normalizeAddress(validation.profile.wallet.address) !== normalizeAddress(address)) {
    return unresolvedProfile(name, "Resolved profile wallet address does not match the IOTA name target.");
  }

  if (options.identity) {
    const identity = await verifyAgentProfileIdentity(validation.profile, options.identity);
    if (!identity.ok) {
      return {
        ok: false,
        error: {
          code: identity.error.code,
          message: identity.error.message,
          name,
        },
      };
    }
  }

  return {
    ok: true,
    profile: validation.profile,
  };
}

function resolveNamesError(
  name: string,
  message: string,
  code: IotaNamesAddressResolutionErrorCode,
): ResolveAgentResult {
  if (code === "IOTA_NAME_NOT_FOUND") {
    return {
      ok: false,
      error: {
        code: "PROFILE_NOT_FOUND",
        message,
        name,
      },
    };
  }
  return unresolvedProfile(name, message);
}

function unresolvedProfile(name: string, message: string): ResolveAgentResult {
  return {
    ok: false,
    error: {
      code: "PROFILE_UNVERIFIABLE",
      message,
      name,
    },
  };
}

function normalizeName(name: string): string {
  return name.trim();
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
