import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { pathToFileURL } from "node:url";

import { createGasKitClient } from "@iota-gaskit/sdk";

import { runDemoGrantFlow, type DemoGrantFlowResult } from "./local-flow.js";

export interface DemoBrowserServerOptions {
  gatewayUrl?: string;
  apiKey?: string;
  runFlow?: () => Promise<DemoGrantFlowResult>;
}

export interface DemoBrowserEnv {
  GASKIT_GATEWAY_URL?: string;
  GASKIT_DEMO_APP_KEY?: string;
  GASKIT_DEMO_DAPP_HOST?: string;
  GASKIT_DEMO_DAPP_PORT?: string;
  PORT?: string;
}

function writeJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

function errorStatus(error: unknown): number {
  const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  if (status >= 400 && status <= 599) return status;
  return 500;
}

function redactMessage(message: string): string {
  return message
    .replace(/Bearer\s+[^\s"'}]+/gi, "Bearer [REDACTED]")
    .replace(/local-dev-demo-key/gi, "[REDACTED]")
    .slice(0, 240);
}

function sanitizeError(error: unknown): Record<string, unknown> {
  const status = errorStatus(error);
  const candidate = error as {
    name?: unknown;
    message?: unknown;
    reasonCode?: unknown;
  };
  const rawMessage = typeof candidate.message === "string" ? candidate.message : "Demo flow failed.";

  return {
    name: typeof candidate.name === "string" ? candidate.name : "Error",
    message: status >= 500 ? "Demo flow failed." : redactMessage(rawMessage),
    ...(typeof candidate.reasonCode === "string" ? { reasonCode: candidate.reasonCode } : {}),
    status,
  };
}

function serializePublicResult(result: DemoGrantFlowResult): DemoGrantFlowResult {
  if (
    typeof result.reservationId !== "string" ||
    typeof result.gasKitTransactionId !== "string" ||
    typeof result.digest !== "string" ||
    (result.sponsorAddress !== undefined && typeof result.sponsorAddress !== "string")
  ) {
    throw new Error("Demo flow returned a malformed result.");
  }

  return {
    reservationId: result.reservationId,
    gasKitTransactionId: result.gasKitTransactionId,
    ...(result.sponsorAddress ? { sponsorAddress: result.sponsorAddress } : {}),
    digest: result.digest,
  };
}

async function readRejectedBody(request: IncomingMessage): Promise<{ status: number; message: string } | undefined> {
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk as Buffer);
    if (bytes > 1024) {
      return { status: 413, message: "Request body is too large for this local demo endpoint." };
    }
  }

  if (bytes > 0) {
    return { status: 400, message: "Request body is not accepted for this local demo endpoint." };
  }

  return undefined;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("GASKIT_DEMO_DAPP_PORT must be a valid port in the range 0..65535.");
  }
  return port;
}

function isAllowedOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (!host) return false;

  try {
    const parsed = new URL(origin);
    return parsed.host === host && (parsed.protocol === "http:" || parsed.protocol === "https:");
  } catch {
    return false;
  }
}

function defaultRunFlow(options: DemoBrowserServerOptions): () => Promise<DemoGrantFlowResult> {
  return async () => {
    const client = createGasKitClient({
      baseUrl: options.gatewayUrl ?? "http://127.0.0.1:8787",
      apiKey: options.apiKey ?? "local-dev-demo-key",
    });
    return runDemoGrantFlow(client);
  };
}

export function renderDemoBrowserPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IOTA GasKit Local Demo</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07110f;
      --panel: rgba(245, 255, 248, 0.08);
      --line: rgba(189, 255, 218, 0.24);
      --text: #effff4;
      --muted: #a7c7b4;
      --accent: #7cffb2;
      --hot: #f8d36c;
      --bad: #ff8d8d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 18% 18%, rgba(124, 255, 178, 0.18), transparent 32rem),
        linear-gradient(135deg, #07110f 0%, #102019 58%, #07110f 100%);
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    main {
      width: min(48rem, calc(100vw - 2rem));
      padding: 2rem;
      border: 1px solid var(--line);
      border-radius: 1.25rem;
      background: var(--panel);
      box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(18px);
    }
    p { color: var(--muted); line-height: 1.6; }
    button {
      border: 0;
      border-radius: 999px;
      padding: 0.9rem 1.2rem;
      color: #05100b;
      background: linear-gradient(135deg, var(--accent), var(--hot));
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button:disabled { cursor: progress; filter: grayscale(0.5); opacity: 0.7; }
    pre {
      min-height: 8rem;
      overflow: auto;
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 0.8rem;
      background: rgba(0, 0, 0, 0.34);
      white-space: pre-wrap;
    }
    .status { color: var(--accent); }
    .error { color: var(--bad); }
  </style>
</head>
<body>
  <main>
    <p class="status">Local-only Milestone 1 wrapper</p>
    <h1>IOTA GasKit Local Demo</h1>
    <p>This browser page calls a same-origin local backend endpoint. The app key stays on the local server; the browser only receives sanitized flow results.</p>
    <button type="button" data-testid="run-demo" id="run-demo">Run local sponsored flow</button>
    <pre data-testid="result" id="result">Ready.</pre>
  </main>
  <script type="module">
    const button = document.getElementById("run-demo");
    const result = document.getElementById("result");
    button.addEventListener("click", async () => {
      button.disabled = true;
      result.className = "";
      result.textContent = "Running local GasKit flow...";
      try {
        const response = await fetch("/api/run-demo", { method: "POST" });
        const body = await response.json();
        if (!response.ok || !body.ok) {
          result.className = "error";
          result.textContent = JSON.stringify(body.error ?? body, null, 2);
          return;
        }
        result.className = "status";
        result.textContent = JSON.stringify(body.result, null, 2);
      } catch (error) {
        result.className = "error";
        result.textContent = error instanceof Error ? error.message : "Unknown browser demo error";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

export function createDemoBrowserServer(options: DemoBrowserServerOptions = {}): Server {
  const runFlow = options.runFlow ?? defaultRunFlow(options);

  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/") {
      writeText(response, 200, "text/html; charset=utf-8", renderDemoBrowserPage());
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { status: "ok", service: "iota-gaskit-demo-dapp" });
      return;
    }

    if (url.pathname === "/api/run-demo") {
      if (request.method !== "POST") {
        writeJson(response, 405, { ok: false, error: { message: "Method not allowed." } }, { allow: "POST" });
        return;
      }

      try {
        if (!isAllowedOrigin(request)) {
          writeJson(response, 403, {
            ok: false,
            error: { message: "Cross-origin requests are not allowed for this local demo endpoint." },
          });
          return;
        }

        const rejectedBody = await readRejectedBody(request);
        if (rejectedBody) {
          writeJson(response, rejectedBody.status, { ok: false, error: { message: rejectedBody.message } });
          return;
        }

        const result = serializePublicResult(await runFlow());
        writeJson(response, 200, { ok: true, result });
      } catch (error) {
        writeJson(response, errorStatus(error), { ok: false, error: sanitizeError(error) });
      }
      return;
    }

    writeJson(response, 404, { ok: false, error: { message: "Not found." } });
  });
}

export async function startDemoBrowserServerFromEnv(env: DemoBrowserEnv = process.env): Promise<Server> {
  const host = env.GASKIT_DEMO_DAPP_HOST ?? "127.0.0.1";
  if (!isLoopbackHost(host)) {
    throw new Error("GASKIT_DEMO_DAPP_HOST must be loopback-only for the local demo browser wrapper.");
  }

  const port = parsePort(env.GASKIT_DEMO_DAPP_PORT ?? env.PORT ?? "8788");
  const server = createDemoBrowserServer({
    gatewayUrl: env.GASKIT_GATEWAY_URL,
    apiKey: env.GASKIT_DEMO_APP_KEY,
  });

  const errorPromise = once(server, "error").then(([error]) => {
    throw error;
  });
  server.listen(port, host);
  await Promise.race([once(server, "listening"), errorPromise]);
  server.removeAllListeners("error");

  const address = server.address();
  if (address && typeof address === "object") {
    console.log(`IOTA GasKit demo dApp browser wrapper listening on http://${host}:${address.port}`);
  }
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startDemoBrowserServerFromEnv();
}
