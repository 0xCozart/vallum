import { pathToFileURL } from "node:url";

import { createVallumClient } from "@vallum/sdk";

import { formatDemoGrantFlowResult, runDemoGrantFlow } from "./local-flow.js";

export interface LocalDemoEnv {
  VALLUM_GATEWAY_URL?: string;
  VALLUM_DEMO_APP_KEY?: string;
}

function readLocalDemoEnv(): LocalDemoEnv {
  return {
    VALLUM_GATEWAY_URL: process.env.VALLUM_GATEWAY_URL,
    VALLUM_DEMO_APP_KEY: process.env.VALLUM_DEMO_APP_KEY,
  };
}

export async function runLocalDemoFromEnv(env: LocalDemoEnv = readLocalDemoEnv()): Promise<string> {
  const baseUrl = env.VALLUM_GATEWAY_URL ?? "http://127.0.0.1:8787";
  const apiKey = env.VALLUM_DEMO_APP_KEY ?? "local-dev-demo-key";
  const client = createVallumClient({ baseUrl, apiKey });
  const result = await runDemoGrantFlow(client);
  return formatDemoGrantFlowResult(result);
}

async function main(): Promise<void> {
  console.log(await runLocalDemoFromEnv());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
