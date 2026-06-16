import { pathToFileURL } from "node:url";

import { createAgentRailClient } from "@sacredlabs/agentrail-sdk";

import { formatDemoGrantFlowResult, runDemoGrantFlow } from "./local-flow.js";

export interface LocalDemoEnv {
  AGENTRAIL_GATEWAY_URL?: string;
  AGENTRAIL_DEMO_APP_KEY?: string;
}

function readLocalDemoEnv(): LocalDemoEnv {
  return {
    AGENTRAIL_GATEWAY_URL: process.env.AGENTRAIL_GATEWAY_URL,
    AGENTRAIL_DEMO_APP_KEY: process.env.AGENTRAIL_DEMO_APP_KEY,
  };
}

export async function runLocalDemoFromEnv(env: LocalDemoEnv = readLocalDemoEnv()): Promise<string> {
  const baseUrl = env.AGENTRAIL_GATEWAY_URL ?? "http://127.0.0.1:8787";
  const apiKey = env.AGENTRAIL_DEMO_APP_KEY ?? "local-dev-demo-key";
  const client = createAgentRailClient({ baseUrl, apiKey });
  const result = await runDemoGrantFlow(client);
  return formatDemoGrantFlowResult(result);
}

async function main(): Promise<void> {
  console.log(await runLocalDemoFromEnv());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
