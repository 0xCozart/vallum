import { createServer, type Server } from "node:http";

import { createMockGasStationAdapter, type MockGasStationAdapter } from "./mockGasStationAdapter.js";
import { handleAgentGatewayRequest, type AgentGatewayEvent } from "./routes.js";
import type { AgentActionPolicy } from "./policySchema.js";

export interface AgentMockGatewayServerConfig {
  readonly policy: AgentActionPolicy;
  readonly mockGasStation?: MockGasStationAdapter;
  readonly now?: () => Date;
  readonly eventSink?: (event: AgentGatewayEvent) => void | Promise<void>;
  readonly maxBodyBytes?: number;
  readonly allowUnsafeNonLoopback?: boolean;
}

export function createAgentMockGatewayServer(config: AgentMockGatewayServerConfig): Server {
  const mockGasStation = config.mockGasStation ?? createMockGasStationAdapter();
  const server = createServer((request, response) => {
    void handleAgentGatewayRequest(request, response, {
      policy: config.policy,
      mockGasStation,
      now: config.now,
      eventSink: config.eventSink,
      maxBodyBytes: config.maxBodyBytes,
    });
  });
  guardMockGatewayListen(server, Boolean(config.allowUnsafeNonLoopback));
  return server;
}

function guardMockGatewayListen(server: Server, allowUnsafeNonLoopback: boolean): void {
  const listen = server.listen.bind(server) as (...args: unknown[]) => Server;
  server.listen = ((...args: unknown[]) => {
    if (!allowUnsafeNonLoopback) {
      const host = listenHost(args);
      if (!isLoopbackListenHost(host)) {
        throw new Error("Agent mock gateway must bind to 127.0.0.1, ::1, or localhost unless allowUnsafeNonLoopback is true.");
      }
    }
    return listen(...args);
  }) as Server["listen"];
}

function listenHost(args: readonly unknown[]): string | undefined {
  const first = args[0];
  const second = args[1];
  if (typeof first === "object" && first !== null && "host" in first) {
    const host = (first as { host?: unknown }).host;
    return typeof host === "string" ? host : undefined;
  }
  if (typeof first === "string") return "local-socket";
  return typeof second === "string" ? second : undefined;
}

function isLoopbackListenHost(host: string | undefined): boolean {
  if (host === "local-socket") return true;
  const normalized = host?.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}
