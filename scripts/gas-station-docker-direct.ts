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
  readonly redisContainer?: string;
  readonly gasStationContainer?: string;
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
  readonly redisContainer: string;
  readonly usesGasStationAuth: boolean;
  readonly commands: readonly GasStationDockerCommand[];
}

interface CliOptions {
  readonly dryRun: boolean;
  readonly envFile: string;
  readonly execute: boolean;
  readonly help: boolean;
}

type DockerRunner = (command: string, args: readonly string[]) => Promise<void>;

const DEFAULT_CONFIG_PATH = "deploy/gas-station/config.local.yaml";
const DEFAULT_GAS_STATION_CONTAINER = "gaskit-gas-station";
const DEFAULT_GAS_STATION_IMAGE = "iotaledger/gas-station:latest";
const DEFAULT_NETWORK = "gaskit-local";
const DEFAULT_REDIS_CONTAINER = "gaskit-redis";
const REDIS_IMAGE = "redis:7-alpine";
const usage = `usage: npm exec tsx -- scripts/gas-station-docker-direct.ts [--dry-run] [--execute] [--env-file <path>]

Prints or runs a direct Docker fallback for the local Gas Station stack when Docker Compose is unavailable.
Default mode is --dry-run and prints sanitized command metadata only.
--execute may pull images, start containers, and let Gas Station contact configured testnet services.`;

export function buildGasStationDockerDirectPlan(
  options: GasStationDockerDirectOptions = {},
): GasStationDockerDirectPlan {
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const env = options.env ?? {};
  const image = env.IOTA_GAS_STATION_IMAGE ?? options.image ?? DEFAULT_GAS_STATION_IMAGE;
  const networkName = options.networkName ?? DEFAULT_NETWORK;
  const redisContainer = options.redisContainer ?? DEFAULT_REDIS_CONTAINER;
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
    "Agentic GasKit direct Docker Gas Station plan",
    `configPath=${plan.configPath}`,
    `image=${plan.image}`,
    `network=${plan.networkName}`,
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
      await runner(command.command, command.args);
    } catch (error) {
      if (command.label === "create-network" || command.label.startsWith("remove-existing-")) continue;
      throw error;
    }
  }
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

function parseArgs(argv: readonly string[]): CliOptions {
  const options: { dryRun: boolean; envFile: string; execute: boolean; help: boolean } = {
    dryRun: true,
    envFile: ".env",
    execute: false,
    help: false,
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
  console.log(formatGasStationDockerDirectPlan(plan));

  if (options.execute) {
    await runPlan(plan, env);
    console.log("executed=true");
    console.log("next=npm run diagnose:gas-station -- --report tmp/gaskit/testnet-upstream-diagnostic.json");
  } else {
    console.log("executed=false");
    console.log("next=npm run gas-station:docker-direct -- --execute");
  }

  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
