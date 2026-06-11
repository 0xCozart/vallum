import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_JWKS_WELL_KNOWN_PATH,
  validateA2APublicDiscoveryBundleArtifacts,
  type WrittenA2APublicDiscoveryBundleFile,
} from "../packages/registry/src/index.js";

interface CliOptions {
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly help: boolean;
  readonly host?: string;
  readonly outDir?: string;
  readonly port?: number;
}

export interface SmokeA2AStaticDiscoveryLocalOptions {
  readonly expectedPublicBaseUrl?: string;
  readonly expectedPublicJwksUrl?: string;
  readonly fetch?: typeof fetch;
  readonly host?: string;
  readonly outDir: string;
  readonly port?: number;
}

export interface SmokeA2AStaticDiscoveryLocalResult {
  readonly ok: true;
  readonly files: number;
  readonly localOnly: true;
  readonly publicHostingProven: false;
}

interface StaticFile {
  readonly sourcePath: typeof A2A_AGENT_CARD_WELL_KNOWN_PATH | typeof A2A_JWKS_WELL_KNOWN_PATH;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const DEFAULT_HOST = "127.0.0.1";
const usage = `usage: npm exec tsx -- scripts/smoke-a2a-static-discovery-local.ts --out-dir <dir> [--expected-public-base-url <url>] [--expected-public-jwks-url <url>] [--host 127.0.0.1] [--port 0]

Serves validated local A2A static discovery artifacts over loopback and fetches
the canonical well-known Agent Card and JWKS paths.
The command does not fetch public URLs, deploy hosting, or prove public A2A discovery.`;

function parseArgs(argv: string[]): CliOptions {
  const options: {
    expectedPublicBaseUrl?: string;
    expectedPublicJwksUrl?: string;
    help: boolean;
    host?: string;
    outDir?: string;
    port?: number;
  } = { help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out-dir") {
      options.outDir = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expected-public-base-url") {
      options.expectedPublicBaseUrl = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--expected-public-jwks-url") {
      options.expectedPublicJwksUrl = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--host") {
      options.host = requiredArg(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--port") {
      options.port = parsePort(requiredArg(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

export async function smokeA2AStaticDiscoveryLocal(
  options: SmokeA2AStaticDiscoveryLocalOptions,
): Promise<SmokeA2AStaticDiscoveryLocalResult> {
  const host = options.host ?? DEFAULT_HOST;
  if (!isLoopbackHost(host)) {
    throw new Error("A2A static discovery local smoke refuses non-loopback hosts.");
  }

  const validated = await validateA2APublicDiscoveryBundleArtifacts({
    outDir: options.outDir,
    expectedPublicBaseUrl: options.expectedPublicBaseUrl,
    expectedPublicJwksUrl: options.expectedPublicJwksUrl,
  });
  const files = await loadStaticFiles(validated.files);
  const server = createServer((request, response) => {
    serveStaticDiscoveryFile(request, response, files);
  });

  try {
    await listen(server, host, options.port ?? 0);
    const address = server.address();
    if (!isAddressInfo(address) || !isLoopbackHost(address.address)) {
      throw new Error("A2A static discovery local smoke did not bind to loopback.");
    }
    const baseUrl = `http://${address.address === "::1" ? "[::1]" : address.address}:${address.port}`;
    await assertStaticResponse(options.fetch ?? fetch, `${baseUrl}${A2A_AGENT_CARD_WELL_KNOWN_PATH}`, "application/a2a+json");
    await assertStaticResponse(options.fetch ?? fetch, `${baseUrl}${A2A_JWKS_WELL_KNOWN_PATH}`, "application/jwk-set+json");

    return {
      ok: true,
      files: files.length,
      localOnly: true,
      publicHostingProven: false,
    };
  } finally {
    await closeServer(server);
  }
}

export function formatA2AStaticDiscoveryLocalSmokeResult(
  result: SmokeA2AStaticDiscoveryLocalResult,
): string {
  return [
    "A2A static discovery local host smoke passed",
    `ok=${result.ok}`,
    `files=${result.files}`,
    `localOnly=${result.localOnly}`,
    "publicHostingProven=false",
  ].join("\n");
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    return 2;
  }
  if (options.help) {
    console.log(usage);
    return 0;
  }
  if (!options.outDir) {
    console.error("Missing required arguments: --out-dir");
    return 2;
  }

  try {
    const result = await smokeA2AStaticDiscoveryLocal({
      outDir: resolve(process.cwd(), options.outDir),
      expectedPublicBaseUrl: options.expectedPublicBaseUrl,
      expectedPublicJwksUrl: options.expectedPublicJwksUrl,
      host: options.host,
      port: options.port,
    });
    console.log(formatA2AStaticDiscoveryLocalSmokeResult(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "A2A static discovery local smoke failed.");
    return 1;
  }
}

async function loadStaticFiles(
  files: readonly WrittenA2APublicDiscoveryBundleFile[],
): Promise<readonly StaticFile[]> {
  return Promise.all(files.map(async (file) => ({
    sourcePath: file.sourcePath,
    headers: file.headers,
    body: await readFile(join(file.path), "utf8"),
  })));
}

function serveStaticDiscoveryFile(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  files: readonly StaticFile[],
): void {
  const pathname = requestPathname(request.url);
  const file = files.find((candidate) => candidate.sourcePath === pathname);
  if (!file) {
    writeResponse(response, 404, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }, `${JSON.stringify({ error: { code: "A2A_STATIC_DISCOVERY_NOT_FOUND" } })}\n`);
    return;
  }
  if (request.method !== "GET") {
    writeResponse(response, 405, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      allow: "GET",
    }, `${JSON.stringify({ error: { code: "A2A_STATIC_DISCOVERY_METHOD_NOT_ALLOWED" } })}\n`);
    return;
  }
  writeResponse(response, 200, file.headers, file.body);
}

async function assertStaticResponse(fetchImpl: typeof fetch, url: string, expectedContentType: string): Promise<void> {
  const response = await fetchImpl(url, { method: "GET" });
  if (response.status !== 200) {
    throw new Error("A2A static discovery local smoke returned an unexpected status.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes(expectedContentType)) {
    throw new Error("A2A static discovery local smoke returned an unexpected content-type.");
  }
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (cacheControl.trim() === "") {
    throw new Error("A2A static discovery local smoke returned no cache-control metadata.");
  }
  const body = await response.json() as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("A2A static discovery local smoke returned invalid JSON.");
  }
}

function writeResponse(
  response: ServerResponse<IncomingMessage>,
  status: number,
  headers: Record<string, string>,
  body: string,
): void {
  response.statusCode = status;
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  response.end(body);
}

function listen(server: import("node:http").Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
}

function closeServer(server: import("node:http").Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    if (!server.listening) {
      resolveClose();
      return;
    }
    server.close((error) => error ? reject(error) : resolveClose());
  });
}

function requestPathname(url = "/"): string {
  try {
    return new URL(url, "http://127.0.0.1").pathname;
  } catch {
    return "/";
  }
}

function isAddressInfo(value: unknown): value is AddressInfo {
  return Boolean(value)
    && typeof value === "object"
    && value !== null
    && "address" in value
    && "port" in value;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("--port must be an integer from 0 to 65535.");
  }
  return port;
}

function requiredArg(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value.`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
