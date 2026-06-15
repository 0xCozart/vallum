import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";

export interface GasStationDockerDirectOptions {
  readonly configPath?: string;
  readonly env?: Record<string, string | undefined>;
  readonly image?: string;
  readonly networkName?: string;
  readonly redisNetworkAlias?: string;
  readonly redisContainer?: string;
  readonly gasStationContainer?: string;
}

export interface GasStationDockerDirectStatusOptions extends GasStationDockerDirectOptions {
  readonly runner?: DockerInspectRunner;
}

export interface GasStationDockerCommand {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly printsSecret?: boolean;
}

export interface GasStationDockerDirectPlan {
  readonly configPath: string;
  readonly gasStationContainer: string;
  readonly image: string;
  readonly networkName: string;
  readonly redisNetworkAlias: string;
  readonly redisContainer: string;
  readonly usesGasStationAuth: boolean;
  readonly commands: readonly GasStationDockerCommand[];
}

export interface GasStationDockerDirectStatusCheck {
  readonly id: string;
  readonly status: "ready" | "blocked";
  readonly code: string;
  readonly message: string;
}

export interface GasStationDockerDirectStatusReport {
  readonly ready: boolean;
  readonly code: "DOCKER_DIRECT_STACK_READY" | "DOCKER_DIRECT_STACK_NOT_READY";
  readonly startsContainers: false;
  readonly contactsLiveServices: false;
  readonly checks: readonly GasStationDockerDirectStatusCheck[];
}

interface CliOptions {
  readonly dryRun: boolean;
  readonly envFile: string;
  readonly execute: boolean;
  readonly help: boolean;
  readonly status: boolean;
}

type MutableCliOptions = {
  -readonly [Key in keyof CliOptions]: CliOptions[Key];
};

type DockerRunner = (command: string, args: readonly string[]) => Promise<void>;
export type DockerInspectRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ ok: boolean; output?: string }>;

const DEFAULT_CONFIG_PATH = "deploy/gas-station/config.local.yaml";
const DEFAULT_GAS_STATION_CONTAINER = "agentrail-gas-station";
const DEFAULT_GAS_STATION_IMAGE = "iotaledger/gas-station:latest";
const DEFAULT_NETWORK = "agentrail-local";
const DEFAULT_REDIS_CONTAINER = "agentrail-redis";
const DEFAULT_REDIS_NETWORK_ALIAS = "redis";
const START_COMMAND_ATTEMPTS = 3;
const START_COMMAND_RETRY_DELAY_MS = 1_000;
const REDIS_IMAGE = "redis:7-alpine";
const usage = `usage: npm exec tsx -- scripts/gas-station-docker-direct.ts [--dry-run] [--status] [--execute] [--env-file <path>]

Prints or runs a direct Docker fallback for the local Gas Station stack when Docker Compose is unavailable.
Default mode is --dry-run and prints sanitized command metadata only.
--status inspects the expected local Docker network and containers without starting containers or contacting live services.
--execute may pull images, start containers, and let Gas Station contact configured testnet services.`;

export function buildGasStationDockerDirectPlan(
  options: GasStationDockerDirectOptions = {},
): GasStationDockerDirectPlan {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const env = options.env ?? {};
  const image = env.IOTA_GAS_STATION_IMAGE ?? options.image ?? DEFAULT_GAS_STATION_IMAGE;
  const networkName = options.networkName ?? DEFAULT_NETWORK;
  const redisContainer = options.redisContainer ?? DEFAULT_REDIS_CONTAINER;
  const redisNetworkAlias = options.redisNetworkAlias ?? DEFAULT_REDIS_NETWORK_ALIAS;
  const gasStationContainer = options.gasStationContainer ?? DEFAULT_GAS_STATION_CONTAINER;
  const usesGasStationAuth = Boolean(env.GAS_STATION_AUTH);
  const configMount = `${resolve(process.cwd(), configPath)}:/app/config.yaml:ro`;

  const gasStationArgs = [
    "run",
    "-d",
    "--name",
    gasStationContainer,
    "--network",
    networkName,
    "-p",
    "127.0.0.1:9527:9527",
    "-p",
    "127.0.0.1:9184:9184",
    "-e",
    "RUST_BACKTRACE=1",
    "-v",
    configMount,
  ];
  if (usesGasStationAuth) {
    gasStationArgs.push("-e", "GAS_STATION_AUTH");
  }
  gasStationArgs.push(image, "--config-path", "/app/config.yaml");

  return {
    configPath,
    gasStationContainer,
    image,
    networkName,
    redisNetworkAlias,
    redisContainer,
    usesGasStationAuth,
    commands: [
      {
        label: "create-network",
        command: "docker",
        args: ["network", "create", networkName],
      },
      {
        label: "remove-existing-redis",
        command: "docker",
        args: ["rm", "-f", redisContainer],
      },
      {
        label: "remove-existing-gas-station",
        command: "docker",
        args: ["rm", "-f", gasStationContainer],
      },
      {
        label: "start-redis",
        command: "docker",
        args: [
          "run",
          "-d",
          "--name",
          redisContainer,
          "--network",
          networkName,
          "--network-alias",
          redisNetworkAlias,
          "-p",
          "127.0.0.1:6379:6379",
          REDIS_IMAGE,
        ],
      },
      {
        label: "start-gas-station",
        command: "docker",
        args: gasStationArgs,
      },
    ],
  };
}

export function formatGasStationDockerDirectPlan(plan: GasStationDockerDirectPlan): string {
  const lines = [
    "AgentRail direct Docker Gas Station plan",
    `configPath=${plan.configPath}`,
    `image=${plan.image}`,
    `network=${plan.networkName}`,
    `redisNetworkAlias=${plan.redisNetworkAlias}`,
    `redisContainer=${plan.redisContainer}`,
    `gasStationContainer=${plan.gasStationContainer}`,
    `gasStationAuthConfigured=${plan.usesGasStationAuth}`,
    "printsSecrets=false",
  ];
  for (const command of plan.commands) {
    lines.push(`${command.label}: ${command.command} ${redactedArgs(command.args).join(" ")}`);
  }
  return lines.join("\n");
}

export async function checkGasStationDockerDirectStatus(
  options: GasStationDockerDirectStatusOptions = {},
): Promise<GasStationDockerDirectStatusReport> {
  const plan = buildGasStationDockerDirectPlan(options);
  const runner = options.runner ?? createInspectRunner();
  const checks = [
    await inspectNetwork(plan, runner),
    await inspectContainer("redis-container", plan.redisContainer, runner),
    await inspectContainer("gas-station-container", plan.gasStationContainer, runner),
  ];
  const ready = checks.every((check) => check.status === "ready");
  return {
    ready,
    code: ready ? "DOCKER_DIRECT_STACK_READY" : "DOCKER_DIRECT_STACK_NOT_READY",
    startsContainers: false,
    contactsLiveServices: false,
    checks,
  };
}

export function formatGasStationDockerDirectStatus(report: GasStationDockerDirectStatusReport): string {
  const lines = [
    "AgentRail direct Docker Gas Station status",
    `ready=${report.ready}`,
    `code=${report.code}`,
    `startsContainers=${report.startsContainers}`,
    `contactsLiveServices=${report.contactsLiveServices}`,
  ];
  for (const check of report.checks) {
    lines.push(`${check.status}: ${check.id}: code=${check.code}`);
    lines.push(`message=${check.message}`);
  }
  lines.push(report.ready
    ? "next=npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json"
    : "next=Start the local stack intentionally with npm run gas-station:docker-direct -- --execute, then rerun --status.");
  return lines.join("\n");
}

function redactedArgs(args: readonly string[]): string[] {
  return args.map((arg) => {
    if (arg.endsWith(":/app/config.yaml:ro")) {
      return "<absolute-config-path>:/app/config.yaml:ro";
    }
    if (arg === "GAS_STATION_AUTH") {
      return "GAS_STATION_AUTH=<from-env>";
    }
    return arg;
  });
}

async function runPlan(plan: GasStationDockerDirectPlan, env: Record<string, string | undefined>): Promise<void> {
  await access(resolve(process.cwd(), plan.configPath));
  const runner = createExecRunner(env);
  for (const command of plan.commands) {
    try {
      await runCommandWithRetries(plan, command, runner);
    } catch (error) {
      if (command.label === "create-network" || command.label.startsWith("remove-existing-")) continue;
      throw new Error(`Direct Docker Gas Station command failed at step: ${command.label}.`, {
        cause: error,
      });
    }
  }
}

async function inspectNetwork(
  plan: GasStationDockerDirectPlan,
  runner: DockerInspectRunner,
): Promise<GasStationDockerDirectStatusCheck> {
  const result = await runner("docker", ["network", "inspect", plan.networkName, "--format", "{{.Name}}"]);
  const ready = result.ok && result.output?.trim() === plan.networkName;
  return {
    id: "docker-network",
    status: ready ? "ready" : "blocked",
    code: ready ? "DOCKER_DIRECT_NETWORK_PRESENT" : "DOCKER_DIRECT_NETWORK_MISSING",
    message: ready
      ? "Expected local Docker network exists."
      : "Expected local Docker network is missing or not inspectable.",
  };
}

async function inspectContainer(
  id: string,
  containerName: string,
  runner: DockerInspectRunner,
): Promise<GasStationDockerDirectStatusCheck> {
  const result = await runner("docker", ["inspect", containerName, "--format", "{{.State.Status}}"]);
  const status = result.output?.trim();
  const ready = result.ok && status === "running";
  return {
    id,
    status: ready ? "ready" : "blocked",
    code: ready ? "DOCKER_DIRECT_CONTAINER_RUNNING" : "DOCKER_DIRECT_CONTAINER_NOT_RUNNING",
    message: ready
      ? `Expected local Docker container ${containerName} is running.`
      : `Expected local Docker container ${containerName} is not running.`,
  };
}

async function runCommandWithRetries(
  plan: GasStationDockerDirectPlan,
  command: GasStationDockerCommand,
  runner: DockerRunner,
): Promise<void> {
  const attempts = command.label.startsWith("start-") ? START_COMMAND_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runner(command.command, command.args);
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await removePossiblyCreatedContainer(plan, command, runner);
      await delay(START_COMMAND_RETRY_DELAY_MS);
    }
  }
}

async function removePossiblyCreatedContainer(
  plan: GasStationDockerDirectPlan,
  command: GasStationDockerCommand,
  runner: DockerRunner,
): Promise<void> {
  const container = command.label === "start-redis"
    ? plan.redisContainer
    : command.label === "start-gas-station"
      ? plan.gasStationContainer
      : undefined;
  if (!container) return;
  try {
    await runner("docker", ["rm", "-f", container]);
  } catch {
    // Best-effort cleanup only. The final failure stays on the required start step.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function createExecRunner(env: Record<string, string | undefined>): DockerRunner {
  return (command, args) => new Promise((resolveRunner, rejectRunner) => {
    const child = execFile(command, [...args], {
      env: {
        ...process.env,
        GAS_STATION_AUTH: env.GAS_STATION_AUTH ?? "",
      },
      windowsHide: true,
    }, (error) => {
      if (error) {
        rejectRunner(new Error("Direct Docker Gas Station command failed."));
        return;
      }
      resolveRunner();
    });
    child.stdin?.end();
  });
}

function createInspectRunner(): DockerInspectRunner {
  return (command, args) => new Promise((resolveRunner) => {
    const child = execFile(command, [...args], {
      timeout: 20_000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      resolveRunner({ ok: !error, output: `${stdout}${stderr}` });
    });
    child.stdin?.end();
  });
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: MutableCliOptions = {
    dryRun: true,
    envFile: ".env",
    execute: false,
    help: false,
    status: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--execute") {
      options.execute = true;
      options.dryRun = false;
      continue;
    }
    if (arg === "--status") {
      options.status = true;
      options.dryRun = false;
      continue;
    }
    if (arg === "--env-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env-file requires a path.");
      options.envFile = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.execute && options.status) {
    throw new Error("Choose only one of --execute or --status.");
  }
  return options;
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    return 2;
  }
  if (options.help) {
    console.log(usage);
    return 0;
  }

  const env = await loadEnvFile(resolve(process.cwd(), options.envFile));
  const plan = buildGasStationDockerDirectPlan({ env });
  if (options.status) {
    const report = await checkGasStationDockerDirectStatus({ env });
    console.log(formatGasStationDockerDirectStatus(report));
    return report.ready ? 0 : 1;
  }

  console.log(formatGasStationDockerDirectPlan(plan));

  if (options.execute) {
    try {
      await runPlan(plan, env);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Direct Docker Gas Station command failed.");
      return 1;
    }
    console.log("executed=true");
    console.log("next=npm run diagnose:gas-station -- --report tmp/agentrail/testnet-upstream-diagnostic.json");
  } else {
    console.log("executed=false");
    console.log("next=npm run gas-station:docker-direct -- --execute");
  }

  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
