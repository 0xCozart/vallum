import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  A2A_JWKS_WELL_KNOWN_PATH,
  handleA2APublicJwksRequest,
  type A2APublicJwksOptions,
} from "@iota-gaskit/registry";

import {
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_STREAM_MESSAGE_PATH,
  handleLocalA2AHttpRequest,
  type A2AHttpResponseBody,
  type LocalA2AHttpHandlerOptions,
} from "./a2aHttp.js";

export interface LocalA2ANodeServerOptions extends LocalA2AHttpHandlerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly maxBodyBytes?: number;
  readonly allowNonLoopbackHost?: boolean;
  readonly publicJwks?: A2APublicJwksOptions;
}

export interface LocalA2ANodeServer {
  readonly baseUrl: string;
  readonly host: string;
  readonly port: number;
  readonly boundToLoopback: boolean;
  readonly close: () => Promise<void>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MAX_BODY_BYTES = 64_000;

export async function startLocalA2ANodeServer(options: LocalA2ANodeServerOptions): Promise<LocalA2ANodeServer> {
  const host = options.host ?? DEFAULT_HOST;
  if (!options.allowNonLoopbackHost && !isLoopbackHost(host)) {
    throw new Error("A2A local Node server refuses non-loopback hosts without explicit opt-in.");
  }

  const server = createServer(async (request, response) => {
    try {
      const body = await readBody(request, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
      if (requestPathname(request.url) === A2A_JWKS_WELL_KNOWN_PATH) {
        const handled = handleA2APublicJwksRequest({
          method: request.method,
          path: request.url,
        }, options.publicJwks ?? { keys: [] });
        writeHandledResponse(response, handled.status, handled.headers, handled.json);
        return;
      }

      if (requestPathname(request.url) === A2A_HTTP_STREAM_MESSAGE_PATH) {
        const handled = await handleLocalA2AHttpRequest({
          method: request.method,
          path: A2A_HTTP_SEND_MESSAGE_PATH,
          headers: normalizeHeaders(request.headers),
          body,
        }, options);
        if (handled.status !== 200) {
          writeHandledResponse(response, handled.status, handled.headers, handled.json);
          return;
        }
        writeServerSentEvents(response, [{ event: "task", data: handled.body }]);
        return;
      }

      const handled = await handleLocalA2AHttpRequest({
        method: request.method,
        path: request.url,
        headers: normalizeHeaders(request.headers),
        body,
      }, options);
      writeHandledResponse(response, handled.status, handled.headers, handled.json);
    } catch (error) {
      const status = error instanceof BodyTooLargeError ? 413 : 400;
      writeHandledResponse(response, status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      }, `${JSON.stringify({
        error: {
          code: error instanceof BodyTooLargeError ? "A2A_BODY_TOO_LARGE" : "A2A_BODY_INVALID",
          message: error instanceof BodyTooLargeError
            ? "A2A request body is too large."
            : "A2A request body is invalid.",
        },
      })}\n`);
    }
  });

  await listen(server, host, options.port ?? 0);
  const address = server.address();
  if (!isAddressInfo(address)) {
    await closeServer(server);
    throw new Error("A2A local Node server did not bind to a TCP address.");
  }

  const addressHost = address.address === "::1" ? "[::1]" : address.address;
  return {
    baseUrl: `http://${addressHost}:${address.port}`,
    host: address.address,
    port: address.port,
    boundToLoopback: isLoopbackHost(address.address),
    close: () => closeServer(server),
  };
}

function listen(server: import("node:http").Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: import("node:http").Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function writeHandledResponse(
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

function writeServerSentEvents(
  response: ServerResponse<IncomingMessage>,
  events: readonly { readonly event: string; readonly data: A2AHttpResponseBody }[],
): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");
  for (const event of events) {
    response.write(`event: ${event.event}\n`);
    response.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }
  response.end();
}

function normalizeHeaders(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return normalized;
}

async function readBody(request: IncomingMessage, maxBodyBytes: number): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    byteLength += buffer.byteLength;
    if (byteLength > maxBodyBytes) {
      throw new BodyTooLargeError();
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const body = Buffer.concat(chunks).toString("utf8");
  return body.trim() === "" ? undefined : body;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
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

class BodyTooLargeError extends Error {
  constructor() {
    super("A2A request body is too large.");
    this.name = "BodyTooLargeError";
  }
}
