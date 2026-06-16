export const AGENTRAIL_GATEWAY_URL_ENV = "AGENTRAIL_GATEWAY_URL";
export const AGENTRAIL_API_KEY_ENV = "AGENTRAIL_API_KEY";
export const AGENTRAIL_MCP_SERVER_NAME_ENV = "AGENTRAIL_MCP_SERVER_NAME";
export const AGENTRAIL_MCP_SERVER_VERSION_ENV = "AGENTRAIL_MCP_SERVER_VERSION";
export const AGENTRAIL_MCP_LOG_LEVEL_ENV = "AGENTRAIL_MCP_LOG_LEVEL";

export type AgentRailMcpLogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface AgentRailMcpConfig {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly serverName: string;
  readonly serverVersion: string;
  readonly logLevel: AgentRailMcpLogLevel;
}

export interface AgentRailMcpConfigOptions {
  readonly packageVersion?: string;
}

export interface RedactedAgentRailMcpConfig {
  readonly gatewayUrl: "configured";
  readonly apiKey: "configured";
  readonly serverName: string;
  readonly serverVersion: string;
  readonly logLevel: AgentRailMcpLogLevel;
}

export class AgentRailMcpConfigError extends Error {
  readonly code = "AGENTRAIL_MCP_CONFIG_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "AgentRailMcpConfigError";
  }
}

export function parseAgentRailMcpConfig(
  env: Record<string, string | undefined>,
  options: AgentRailMcpConfigOptions = {},
): AgentRailMcpConfig {
  const gatewayBaseUrl = requiredEnv(env, AGENTRAIL_GATEWAY_URL_ENV);
  const apiKey = requiredEnv(env, AGENTRAIL_API_KEY_ENV);

  return {
    gatewayBaseUrl: normalizeGatewayBaseUrl(gatewayBaseUrl),
    apiKey,
    serverName: optionalEnv(env, AGENTRAIL_MCP_SERVER_NAME_ENV) ?? "agentrail",
    serverVersion: optionalEnv(env, AGENTRAIL_MCP_SERVER_VERSION_ENV) ?? options.packageVersion ?? "0.0.0",
    logLevel: parseLogLevel(optionalEnv(env, AGENTRAIL_MCP_LOG_LEVEL_ENV)),
  };
}

export function redactAgentRailMcpConfig(config: AgentRailMcpConfig): RedactedAgentRailMcpConfig {
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
    throw new AgentRailMcpConfigError(`${name} is required.`);
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
    throw new AgentRailMcpConfigError(`${AGENTRAIL_GATEWAY_URL_ENV} must be an absolute http(s) URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AgentRailMcpConfigError(`${AGENTRAIL_GATEWAY_URL_ENV} must be an absolute http(s) URL.`);
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function parseLogLevel(value: string | undefined): AgentRailMcpLogLevel {
  if (value === undefined) return "error";
  if (value === "silent" || value === "error" || value === "warn" || value === "info" || value === "debug") {
    return value;
  }
  throw new AgentRailMcpConfigError(`${AGENTRAIL_MCP_LOG_LEVEL_ENV} must be one of silent, error, warn, info, or debug.`);
}
