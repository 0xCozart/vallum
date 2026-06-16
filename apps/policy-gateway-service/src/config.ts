import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { SponsorshipPolicy } from "@vallum/shared-types";

import type { GatewayConfig } from "./server.js";
import { createFileGatewayUsageEventStore } from "./usage-store.js";

interface DemoPolicyYaml {
  appId: string;
  apiKeyName?: string;
  status: string;
  dailyBudgetIota?: number;
  dailyRequestLimit?: number;
  maxRequestsPerWalletPerDay?: number;
  maxGasBudgetPerTx?: number;
  allowedPackages: string[];
  allowedFunctions?: string[];
  deniedWallets?: string[];
}

function parseScalar(value: string): string | number {
  const unquoted = value.trim().replace(/^"|"$/g, "");
  const asNumber = Number(unquoted);
  return Number.isFinite(asNumber) && unquoted !== "" ? asNumber : unquoted;
}

function parseDemoPolicyYaml(source: string): DemoPolicyYaml {
  const lines = source.split(/\r?\n/);
  let appId: string | undefined;
  const scalars = new Map<string, string | number>();
  const lists = new Map<string, string[]>();
  let currentList: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed === "apps:") continue;
    if (line.startsWith("  ") && !line.startsWith("    ") && trimmed.endsWith(":")) {
      appId = trimmed.slice(0, -1);
      currentList = undefined;
      continue;
    }
    if (line.startsWith("    ") && !line.startsWith("      ")) {
      const [rawKey, ...rest] = trimmed.split(":");
      const key = rawKey;
      const value = rest.join(":").trim();
      if (value === "[]") {
        lists.set(key, []);
        currentList = undefined;
      } else if (value === "") {
        lists.set(key, []);
        currentList = key;
      } else {
        scalars.set(key, parseScalar(value));
        currentList = undefined;
      }
      continue;
    }
    if (line.startsWith("      -") && currentList) {
      const item = trimmed.replace(/^-\s*/, "").replace(/^"|"$/g, "");
      lists.get(currentList)?.push(item);
    }
  }

  if (!appId) throw new Error("Policy config must define one app under apps.");
  return {
    appId,
    apiKeyName: scalars.get("api_key_name")?.toString(),
    status: scalars.get("status")?.toString() ?? "",
    dailyBudgetIota: typeof scalars.get("daily_budget_iota") === "number" ? (scalars.get("daily_budget_iota") as number) : undefined,
    dailyRequestLimit:
      typeof scalars.get("daily_request_limit") === "number" ? (scalars.get("daily_request_limit") as number) : undefined,
    maxRequestsPerWalletPerDay:
      typeof scalars.get("max_requests_per_wallet_per_day") === "number"
        ? (scalars.get("max_requests_per_wallet_per_day") as number)
        : undefined,
    maxGasBudgetPerTx:
      typeof scalars.get("max_gas_budget_per_tx") === "number" ? (scalars.get("max_gas_budget_per_tx") as number) : undefined,
    allowedPackages: lists.get("allowed_packages") ?? [],
    allowedFunctions: lists.get("allowed_functions"),
    deniedWallets: lists.get("denied_wallets") ?? [],
  };
}

async function readPolicyConfig(policyPath: string, env: NodeJS.ProcessEnv): Promise<string> {
  const candidates = isAbsolute(policyPath)
    ? [policyPath]
    : [
        resolve(process.cwd(), policyPath),
        ...(env.INIT_CWD ? [resolve(env.INIT_CWD, policyPath)] : []),
        resolve(process.cwd(), "../..", policyPath),
      ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function requireNonNegative(name: string, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number.`);
  return value;
}

function validateDemoPolicy(parsed: DemoPolicyYaml): SponsorshipPolicy["appStatus"] {
  if (parsed.status !== "active" && parsed.status !== "disabled") {
    throw new Error("Policy config status must be active or disabled.");
  }
  if (!parsed.allowedPackages.length) {
    throw new Error("Policy config allowed_packages must contain at least one package for the demo gateway.");
  }
  requireNonNegative("daily_budget_iota", parsed.dailyBudgetIota);
  requireNonNegative("daily_request_limit", parsed.dailyRequestLimit);
  requireNonNegative("max_requests_per_wallet_per_day", parsed.maxRequestsPerWalletPerDay);
  requireNonNegative("max_gas_budget_per_tx", parsed.maxGasBudgetPerTx);
  return parsed.status;
}

function demoAppKeyFromEnv(env: NodeJS.ProcessEnv): string {
  if (env.VALLUM_DEMO_APP_KEY) return env.VALLUM_DEMO_APP_KEY;
  if (env.VALLUM_ALLOW_INSECURE_DEMO_KEY === "true") return "local-dev-demo-key";
  throw new Error("VALLUM_DEMO_APP_KEY must be set. Use VALLUM_ALLOW_INSECURE_DEMO_KEY=true only for local smoke demos.");
}

function parseOperatorUsageMaxRecentEvents(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000) {
    throw new Error("VALLUM_OPERATOR_USAGE_MAX_RECENT_EVENTS must be an integer between 0 and 1000.");
  }
  return parsed;
}

function configureLocalUsageStore(config: GatewayConfig, env: NodeJS.ProcessEnv, appKey: string): GatewayConfig {
  const rawUsageStorePath = env.VALLUM_USAGE_EVENT_STORE_PATH;
  const usageStorePath = rawUsageStorePath?.trim();
  const operatorToken = env.VALLUM_OPERATOR_USAGE_TOKEN;
  if (rawUsageStorePath !== undefined && !usageStorePath) {
    throw new Error("VALLUM_USAGE_EVENT_STORE_PATH must be a non-empty path when set.");
  }
  if (!usageStorePath && operatorToken) {
    throw new Error("VALLUM_USAGE_EVENT_STORE_PATH must be set before enabling VALLUM_OPERATOR_USAGE_TOKEN.");
  }
  if (!usageStorePath) return config;

  const store = createFileGatewayUsageEventStore({ filePath: usageStorePath });
  let pendingWrites = Promise.resolve();
  const withUsageStore: GatewayConfig = {
    ...config,
    eventSink(event) {
      pendingWrites = pendingWrites.catch(() => undefined).then(() => store.append(event));
      return pendingWrites;
    },
  };

  if (!operatorToken) return withUsageStore;
  if (!operatorToken.trim()) {
    throw new Error("VALLUM_OPERATOR_USAGE_TOKEN must be a non-empty token.");
  }
  if (operatorToken === appKey || operatorToken === env.GAS_STATION_BEARER_TOKEN) {
    throw new Error("VALLUM_OPERATOR_USAGE_TOKEN must be distinct from app and upstream credentials.");
  }

  const maxRecentEvents = parseOperatorUsageMaxRecentEvents(env.VALLUM_OPERATOR_USAGE_MAX_RECENT_EVENTS);
  return {
    ...withUsageStore,
    operatorUsage: {
      token: operatorToken,
      source: "local-file-usage-event-store",
      async loadSnapshot() {
        await pendingWrites;
        return store.loadReadModel({ maxRecentEvents });
      },
    },
  };
}

export async function loadGatewayConfigFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<GatewayConfig> {
  const policyPath = env.VALLUM_POLICY_PATH ?? "examples/policies/demo-dapp.yaml";
  const appKey = demoAppKeyFromEnv(env);
  const parsed = parseDemoPolicyYaml(await readPolicyConfig(policyPath, env));
  const appStatus = validateDemoPolicy(parsed);
  const policy: SponsorshipPolicy = {
    appId: parsed.appId,
    appStatus,
    dailyBudgetNanos:
      typeof parsed.dailyBudgetIota === "number" ? Math.floor(parsed.dailyBudgetIota * 1_000_000_000) : undefined,
    dailyRequestLimit: parsed.dailyRequestLimit,
    allowedPackages: parsed.allowedPackages,
    allowedFunctions: parsed.allowedFunctions,
    deniedWallets: parsed.deniedWallets,
    maxRequestsPerWalletPerDay: parsed.maxRequestsPerWalletPerDay,
    maxGasBudgetPerTx: parsed.maxGasBudgetPerTx,
  };

  const config: GatewayConfig = {
    apps: {
      [parsed.appId]: {
        apiKey: appKey,
        policy,
      },
    },
    upstreamBaseUrl: env.GAS_STATION_URL,
    upstreamBearerToken: env.GAS_STATION_BEARER_TOKEN,
  };

  return configureLocalUsageStore(config, env, appKey);
}
