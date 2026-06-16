import { IotaAgent } from "@sacredlabs/agentrail-sdk";
import { callIotaMcpTool, IOTA_MCP_TOOLS, type IotaMcpToolCallResult } from "./tools.js";

export interface IotaMcpServerOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

export interface IotaMcpServerFacade {
  readonly listTools: () => typeof IOTA_MCP_TOOLS;
  readonly callTool: (name: string, input: unknown) => Promise<IotaMcpToolCallResult>;
}

export function createIotaMcpServer(options: IotaMcpServerOptions): IotaMcpServerFacade {
  const agent = new IotaAgent({
    gatewayBaseUrl: options.gatewayBaseUrl,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
  });

  return {
    listTools: () => IOTA_MCP_TOOLS,
    callTool: (name, input) => callIotaMcpTool(name, input, {
      agent,
      now: options.now,
    }),
  };
}
