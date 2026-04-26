import { pathToFileURL } from "node:url";

import { createGasKitClient } from "@iota-gaskit/sdk";

import { formatDemoGrantFlowResult, runDemoGrantFlow } from "./local-flow.js";

export interface LocalDemoEnv {
  GASKIT_GATEWAY_URL?: string;
  GASKIT_DEMO_APP_KEY?: string;
}

export async function runLocalDemoFromEnv(env: LocalDemoEnv = process.env): Promise<string> {
  const baseUrl = env.GASKIT_GATEWAY_URL ?? "http://127.0.0.1:8787";
  const apiKey = env.GASKIT_DEMO_APP_KEY ?? "local-dev-demo-key";
  const client = createGasKitClient({ baseUrl, apiKey });
  const result = await runDemoGrantFlow(client);
  return formatDemoGrantFlowResult(result);
}

async function main(): Promise<void> {
  console.log(await runLocalDemoFromEnv());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
