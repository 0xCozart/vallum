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
}

export function createAgentMockGatewayServer(config: AgentMockGatewayServerConfig): Server {
  const mockGasStation = config.mockGasStation ?? createMockGasStationAdapter();
  return createServer((request, response) => {
    void handleAgentGatewayRequest(request, response, {
      policy: config.policy,
      mockGasStation,
      now: config.now,
      eventSink: config.eventSink,
      maxBodyBytes: config.maxBodyBytes,
    });
  });
}
