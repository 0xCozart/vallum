export const VALLUM_GATEWAY_URL_ENV = "VALLUM_GATEWAY_URL";
export const VALLUM_API_KEY_ENV = "VALLUM_API_KEY";
export const VALLUM_MCP_SERVER_NAME_ENV = "VALLUM_MCP_SERVER_NAME";
export const VALLUM_MCP_SERVER_VERSION_ENV = "VALLUM_MCP_SERVER_VERSION";
export const VALLUM_MCP_LOG_LEVEL_ENV = "VALLUM_MCP_LOG_LEVEL";

export type VallumMcpLogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface VallumMcpConfig {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly serverName: string;
  readonly serverVersion: string;
  readonly logLevel: VallumMcpLogLevel;
}

export interface VallumMcpConfigOptions {
  readonly packageVersion?: string;
}

export interface RedactedVallumMcpConfig {
  readonly gatewayUrl: "configured";
  readonly apiKey: "configured";
  readonly serverName: string;
  readonly serverVersion: string;
  readonly logLevel: VallumMcpLogLevel;
}

export class VallumMcpConfigError extends Error {
  readonly code = "VALLUM_MCP_CONFIG_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "VallumMcpConfigError";
  }
}

export function parseVallumMcpConfig(
  env: Record<string, string | undefined>,
  options: VallumMcpConfigOptions = {},
): VallumMcpConfig {
  const gatewayBaseUrl = requiredEnv(env, VALLUM_GATEWAY_URL_ENV);
  const apiKey = requiredEnv(env, VALLUM_API_KEY_ENV);

  return {
    gatewayBaseUrl: normalizeGatewayBaseUrl(gatewayBaseUrl),
    apiKey,
    serverName: optionalEnv(env, VALLUM_MCP_SERVER_NAME_ENV) ?? "vallum",
    serverVersion: optionalEnv(env, VALLUM_MCP_SERVER_VERSION_ENV) ?? options.packageVersion ?? "0.0.0",
    logLevel: parseLogLevel(optionalEnv(env, VALLUM_MCP_LOG_LEVEL_ENV)),
  };
}

export function redactVallumMcpConfig(config: VallumMcpConfig): RedactedVallumMcpConfig {
  return {
    gatewayUrl: "configured",
    apiKey: "configured",
    serverName: config.serverName,
    serverVersion: config.serverVersion,
    logLevel: config.logLevel,
  };
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new VallumMcpConfigError(`${name} is required.`);
  }
  return value;
}

function optionalEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function normalizeGatewayBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VallumMcpConfigError(`${VALLUM_GATEWAY_URL_ENV} must be an absolute http(s) URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new VallumMcpConfigError(`${VALLUM_GATEWAY_URL_ENV} must be an absolute http(s) URL.`);
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function parseLogLevel(value: string | undefined): VallumMcpLogLevel {
  if (value === undefined) return "error";
  if (value === "silent" || value === "error" || value === "warn" || value === "info" || value === "debug") {
    return value;
  }
  throw new VallumMcpConfigError(`${VALLUM_MCP_LOG_LEVEL_ENV} must be one of silent, error, warn, info, or debug.`);
}
