import { loadGatewayConfigFromEnv } from "./config.js";
import { createGatewayServer } from "./server.js";

const port = Number(process.env.AGENTRAIL_GATEWAY_PORT ?? 8787);
const host = process.env.AGENTRAIL_GATEWAY_HOST ?? "127.0.0.1";
const config = await loadGatewayConfigFromEnv();
const server = createGatewayServer(config);

server.listen(port, host, () => {
  console.log(`AgentRail policy gateway listening on http://${host}:${port}`);
});
