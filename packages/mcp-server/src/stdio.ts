import type { Readable, Writable } from "node:stream";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { type VallumMcpConfig } from "./config.js";
import { createIotaMcpServer, type IotaMcpServerOptions } from "./server.js";
import { type IotaMcpToolCallResult, type IotaMcpToolDescriptor } from "./tools.js";

export interface VallumMcpProtocolServerOptions {
  readonly fetchImpl?: IotaMcpServerOptions["fetchImpl"];
  readonly now?: IotaMcpServerOptions["now"];
  readonly stdin?: Readable;
  readonly stdout?: Writable;
}

export interface VallumMcpStdioSession {
  readonly server: Server;
  readonly transport: StdioServerTransport;
  readonly closed: Promise<void>;
  readonly close: () => Promise<void>;
}

export function createVallumMcpProtocolServer(
  config: VallumMcpConfig,
  options: VallumMcpProtocolServerOptions = {},
): Server {
  const facade = createIotaMcpServer({
    gatewayBaseUrl: config.gatewayBaseUrl,
    apiKey: config.apiKey,
    fetchImpl: options.fetchImpl,
    now: options.now,
  });

  const server = new Server({
    name: config.serverName,
    version: config.serverVersion,
  }, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: facade.listTools().map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await facade.callTool(request.params.name, request.params.arguments ?? {});
    return toMcpToolResult(result);
  });

  return server;
}

export async function startVallumMcpStdioServer(
  config: VallumMcpConfig,
  options: VallumMcpProtocolServerOptions = {},
): Promise<VallumMcpStdioSession> {
  const server = createVallumMcpProtocolServer(config, options);
  const transport = new StdioServerTransport(options.stdin, options.stdout);
  let closeStarted = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  server.onclose = resolveClosed;
  await server.connect(transport);

  return {
    server,
    transport,
    closed,
    close: async () => {
      if (closeStarted) return;
      closeStarted = true;
      await server.close();
      resolveClosed();
    },
  };
}

export function toMcpToolResult(result: IotaMcpToolCallResult): CallToolResult {
  return {
    content: [...result.content],
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}

function toMcpTool(descriptor: IotaMcpToolDescriptor): Tool {
  return {
    name: descriptor.name,
    title: descriptor.title,
    description: descriptor.description,
    inputSchema: cloneJsonObject(descriptor.inputSchema) as Tool["inputSchema"],
  };
}

function cloneJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
