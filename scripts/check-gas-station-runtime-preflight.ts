import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type GasStationRuntimePreflightStatus = "ready" | "blocked";

export type GasStationRuntimePreflightCode =
  | "GAS_STATION_RUNTIME_READY"
  | "GAS_STATION_LOCAL_CONFIG_MISSING"
  | "GAS_STATION_DOCKER_CLIENT_MISSING"
  | "GAS_STATION_DOCKER_DAEMON_UNAVAILABLE"
  | "GAS_STATION_DOCKER_COMPOSE_MISSING";

export interface GasStationRuntimePreflightCheck {
  readonly id: string;
  readonly status: GasStationRuntimePreflightStatus;
  readonly code: string;
  readonly message: string;
  readonly command?: string;
}

export interface GasStationRuntimePreflightReport {
  readonly ready: boolean;
  readonly code: GasStationRuntimePreflightCode;
  readonly message: string;
  readonly checks: readonly GasStationRuntimePreflightCheck[];
}

export interface GasStationRuntimeCommandResult {
  readonly ok: boolean;
  readonly output?: string;
}

export type GasStationRuntimeCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<GasStationRuntimeCommandResult>;

export interface CheckGasStationRuntimePreflightOptions {
  readonly configPath?: string;
  readonly cwd?: string;
  readonly directDockerFallback?: boolean;
  readonly runner?: GasStationRuntimeCommandRunner;
}

const DEFAULT_CONFIG_PATH = "deploy/gas-station/config.local.yaml";
const COMMAND_TIMEOUT_MS = 3_000;

export async function checkGasStationRuntimePreflight(
  options: CheckGasStationRuntimePreflightOptions = {},
): Promise<GasStationRuntimePreflightReport> {
  const cwd = options.cwd ?? process.cwd();
  const runner = options.runner ?? createExecRunner(cwd);
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const directDockerFallback = options.directDockerFallback ?? true;
  const checks: GasStationRuntimePreflightCheck[] = [
    await checkLocalConfig(cwd, configPath),
    await checkCommand(runner, {
      id: "docker-client",
      command: "docker --version",
      args: ["--version"],
      readyCode: "DOCKER_CLIENT_PRESENT",
      blockedCode: "DOCKER_CLIENT_MISSING",
      readyMessage: "Docker client command is available.",
      blockedMessage: "Docker client command is not available.",
    }),
    await checkCommand(runner, {
      id: "docker-daemon",
      command: "docker info",
      args: ["info", "--format", "{{json .ServerVersion}}"],
      acceptsOutput: (output) => {
        const trimmed = output.trim();
        return /^"[^"]+"$/.test(trimmed) && trimmed !== "\"\"";
      },
      readyCode: "DOCKER_DAEMON_READY",
      blockedCode: "DOCKER_DAEMON_UNAVAILABLE",
      readyMessage: "Docker daemon is reachable.",
      blockedMessage: "Docker daemon is not reachable from this workspace.",
    }),
    await checkCommand(runner, {
      id: "docker-compose-plugin",
      command: "docker compose version",
      args: ["compose", "version"],
      readyCode: "DOCKER_COMPOSE_PLUGIN_READY",
      blockedCode: "DOCKER_COMPOSE_PLUGIN_MISSING",
      readyMessage: "Docker Compose plugin is available.",
      blockedMessage: "Docker Compose plugin is not available.",
    }),
    await checkCommand(runner, {
      id: "docker-compose-standalone",
      command: "docker-compose version",
      binary: "docker-compose",
      args: ["version"],
      readyCode: "DOCKER_COMPOSE_STANDALONE_READY",
      blockedCode: "DOCKER_COMPOSE_STANDALONE_MISSING",
      readyMessage: "Standalone docker-compose command is available.",
      blockedMessage: "Standalone docker-compose command is not available.",
    }),
  ];

  const localConfig = findCheck(checks, "local-config");
  const dockerClient = findCheck(checks, "docker-client");
  const dockerDaemon = findCheck(checks, "docker-daemon");
  const composeReady = checks.some((check) =>
    (check.id === "docker-compose-plugin" || check.id === "docker-compose-standalone")
    && check.status === "ready"
  );
  const directReady = directDockerFallback
    && localConfig.status === "ready"
    && dockerClient.status === "ready"
    && dockerDaemon.status === "ready";

  checks.push({
    id: "docker-direct-runtime",
    status: directReady ? "ready" : "blocked",
    code: directReady ? "DOCKER_DIRECT_RUNTIME_READY" : "DOCKER_DIRECT_RUNTIME_UNAVAILABLE",
    message: directReady
      ? "Direct Docker runtime fallback is available without Docker Compose."
      : "Direct Docker runtime fallback is unavailable until local config, Docker client, and Docker daemon are ready.",
    command: "npm run gas-station:docker-direct -- --dry-run",
  });

  if (localConfig.status !== "ready") {
    return blocked("GAS_STATION_LOCAL_CONFIG_MISSING", "Rendered local Gas Station config is missing.", checks);
  }
  if (dockerClient.status !== "ready") {
    return blocked("GAS_STATION_DOCKER_CLIENT_MISSING", "Docker client is not available.", checks);
  }
  if (dockerDaemon.status !== "ready") {
    return blocked("GAS_STATION_DOCKER_DAEMON_UNAVAILABLE", "Docker daemon is not reachable.", checks);
  }
  if (!composeReady && !directReady) {
    return blocked("GAS_STATION_DOCKER_COMPOSE_MISSING", "No Docker Compose command is available.", checks);
  }

  return {
    ready: true,
    code: "GAS_STATION_RUNTIME_READY",
    message: composeReady
      ? "Local Gas Station runtime prerequisites are present through Docker Compose."
      : "Local Gas Station runtime prerequisites are present through direct Docker fallback.",
    checks,
  };
}

export function formatGasStationRuntimePreflightReport(report: GasStationRuntimePreflightReport): string {
  const lines = [
    `Agentic GasKit Gas Station runtime preflight ${report.ready ? "ready" : "blocked"}`,
    `ready=${report.ready}`,
    `code=${report.code}`,
    `message=${report.message}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
    if (check.command) lines.push(`command=${check.command}`);
  }
  return lines.join("\n");
}

async function checkLocalConfig(cwd: string, configPath: string): Promise<GasStationRuntimePreflightCheck> {
  try {
    await access(resolve(cwd, configPath));
    return {
      id: "local-config",
      status: "ready",
      code: "GAS_STATION_LOCAL_CONFIG_PRESENT",
      message: "Rendered local Gas Station config exists.",
      command: "npm run gas-station:render-config",
    };
  } catch {
    return {
      id: "local-config",
      status: "blocked",
      code: "GAS_STATION_LOCAL_CONFIG_MISSING",
      message: "Rendered local Gas Station config is missing.",
      command: "npm run gas-station:render-config",
    };
  }
}

async function checkCommand(
  runner: GasStationRuntimeCommandRunner,
  options: {
    readonly args: readonly string[];
    readonly acceptsOutput?: (output: string) => boolean;
    readonly binary?: string;
    readonly blockedCode: string;
    readonly blockedMessage: string;
    readonly command: string;
    readonly id: string;
    readonly readyCode: string;
    readonly readyMessage: string;
  },
): Promise<GasStationRuntimePreflightCheck> {
  const result = await runner(options.binary ?? "docker", options.args);
  const ready = result.ok && (!options.acceptsOutput || options.acceptsOutput(result.output ?? ""));
  return {
    id: options.id,
    status: ready ? "ready" : "blocked",
    code: ready ? options.readyCode : options.blockedCode,
    message: ready ? options.readyMessage : options.blockedMessage,
    command: options.command,
  };
}

function createExecRunner(cwd: string): GasStationRuntimeCommandRunner {
  return (command, args) => new Promise((resolveRunner) => {
    const child = execFile(command, [...args], {
      cwd,
      timeout: COMMAND_TIMEOUT_MS,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolveRunner({ ok: !error, output: `${stdout}${stderr}` });
    });
    child.stdin?.end();
  });
}

function findCheck(
  checks: readonly GasStationRuntimePreflightCheck[],
  id: string,
): GasStationRuntimePreflightCheck {
  const check = checks.find((candidate) => candidate.id === id);
  if (!check) throw new Error(`Missing Gas Station runtime preflight check: ${id}`);
  return check;
}

function blocked(
  code: Exclude<GasStationRuntimePreflightCode, "GAS_STATION_RUNTIME_READY">,
  message: string,
  checks: readonly GasStationRuntimePreflightCheck[],
): GasStationRuntimePreflightReport {
  return {
    ready: false,
    code,
    message,
    checks,
  };
}

async function main(): Promise<number> {
  const report = await checkGasStationRuntimePreflight();
  console.log(formatGasStationRuntimePreflightReport(report));
  return report.ready ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
