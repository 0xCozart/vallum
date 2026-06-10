import {
  resolveAgent as resolveRegistryAgent,
  type AgentResolver,
  type ResolveAgentResult,
} from "@iota-gaskit/registry";

export interface ResolveAgentOptions {
  readonly resolver: AgentResolver;
}

export function resolveAgent(name: string, options: ResolveAgentOptions): Promise<ResolveAgentResult> {
  return resolveRegistryAgent(name, options.resolver);
}
