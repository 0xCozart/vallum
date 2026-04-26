import { loadGatewayConfigFromEnv } from "./config.js";
import { createGatewayServer } from "./server.js";

const port = Number(process.env.GASKIT_GATEWAY_PORT ?? 8787);
const host = process.env.GASKIT_GATEWAY_HOST ?? "127.0.0.1";
const config = await loadGatewayConfigFromEnv();
const server = createGatewayServer(config);

server.listen(port, host, () => {
  console.log(`IOTA GasKit policy gateway listening on http://${host}:${port}`);
});
