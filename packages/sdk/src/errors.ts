export class AgentRailError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "AgentRailError";
  }
}

export class AgentRailPolicyError extends AgentRailError {
  constructor(message: string, readonly reasonCode?: string, status?: number, body?: unknown) {
    super(message, status, body);
    this.name = "AgentRailPolicyError";
  }
}

export class AgentRailAuthError extends AgentRailError {
  constructor(message: string, status?: number, body?: unknown) {
    super(message, status, body);
    this.name = "AgentRailAuthError";
  }
}
