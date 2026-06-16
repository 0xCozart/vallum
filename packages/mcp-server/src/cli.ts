#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };
import {
  AgentRailMcpConfigError,
  parseAgentRailMcpConfig,
  redactAgentRailMcpConfig,
} from "./config.js";
import { startAgentRailMcpStdioServer } from "./stdio.js";

export interface AgentRailMcpCliIo {
  readonly stdout: Pick<NodeJS.WriteStream, "write">;
  readonly stderr: Pick<NodeJS.WriteStream, "write">;
}

export async function runAgentRailMcpCli(
  args: readonly string[],
  env: Record<string, string | undefined>,
  io: AgentRailMcpCliIo,
): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    io.stdout.write(usage());
    return 0;
  }

  if (args.includes("--version")) {
    io.stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  if (args.some((arg) => arg.startsWith("--") && arg !== "--check-config")) {
    io.stderr.write("Unknown option. Run agentrail-mcp --help for usage.\n");
    return 1;
  }

  try {
    const config = parseAgentRailMcpConfig(env, { packageVersion: packageJson.version });
    if (args.includes("--check-config")) {
      io.stdout.write(`${JSON.stringify(redactAgentRailMcpConfig(config), null, 2)}\n`);
      return 0;
    }

    const session = await startAgentRailMcpStdioServer(config);
    installShutdownHandlers(session.close);
    await session.closed;
    return 0;
  } catch (error) {
    io.stderr.write(`${formatCliError(error)}\n`);
    return 1;
  }
}

function installShutdownHandlers(close: () => Promise<void>): void {
  const shutdown = (): void => {
    void close();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function usage(): string {
  return `Usage: agentrail-mcp [--help] [--version] [--check-config]

Runs the AgentRail MCP server. Configuration is read from the MCP server process environment.

Required environment:
  AGENTRAIL_GATEWAY_URL    AgentRail-compatible policy gateway base URL.
  AGENTRAIL_API_KEY        Gateway app credential.

Optional environment:
  AGENTRAIL_MCP_SERVER_NAME       MCP server name, defaults to agentrail.
  AGENTRAIL_MCP_SERVER_VERSION    MCP server version, defaults to package version.
  AGENTRAIL_MCP_LOG_LEVEL         silent, error, warn, info, or debug. Defaults to error.

Flags:
  --help          Print this help text without reading configuration.
  --version       Print the package version without reading configuration.
  --check-config  Validate configuration and print redacted status.
`;
}

function formatCliError(error: unknown): string {
  if (error instanceof AgentRailMcpConfigError) {
    return `Configuration error: ${error.message}`;
  }
  return "AgentRail MCP failed before startup.";
}

if (isDirectCliExecution()) {
  const exitCode = await runAgentRailMcpCli(process.argv.slice(2), process.env, {
    stdout: process.stdout,
    stderr: process.stderr,
  });
  process.exitCode = exitCode;
}

function isDirectCliExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrypoint);
  } catch {
    return false;
  }
}
