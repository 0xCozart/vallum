import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  A2A_JWKS_WELL_KNOWN_PATH,
  handleA2APublicJwksRequest,
  type A2APublicJwksOptions,
} from "@vallum/registry";

import {
  A2A_HTTP_SEND_MESSAGE_PATH,
  A2A_HTTP_SUBSCRIBE_TASK_SUFFIX,
  A2A_HTTP_STREAM_MESSAGE_PATH,
  handleLocalA2AHttpRequest,
  type A2AHttpA2ATaskBody,
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
  const subscribers = new Map<string, Set<ServerResponse<IncomingMessage>>>();

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
        notifySubscribers(subscribers, handled.body, options);
        writeServerSentEvents(response, [{ event: "task", data: streamResponseBody(handled.body, options) }]);
        return;
      }

      if (isSubscribeTaskPath(requestPathname(request.url))) {
        const handled = await handleLocalA2AHttpRequest({
          method: request.method,
          path: request.url,
          headers: normalizeHeaders(request.headers),
          body,
        }, options);
        if (handled.status !== 200) {
          writeHandledResponse(response, handled.status, handled.headers, handled.json);
          return;
        }
        const task = a2aTaskFromResponseBody(handled.body);
        if (!task) {
          writeServerSentEvents(response, [{ event: "task", data: streamResponseBody(handled.body, options) }]);
          return;
        }
        writeSubscribeResponse(response, task, subscribers, options);
        return;
      }

      const handled = await handleLocalA2AHttpRequest({
        method: request.method,
        path: request.url,
        headers: normalizeHeaders(request.headers),
        body,
      }, options);
      if (handled.status === 200) {
        notifySubscribers(subscribers, handled.body, options);
      }
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
    close: async () => {
      closeSubscribers(subscribers);
      await closeServer(server);
    },
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
  events: readonly { readonly event: string; readonly data: A2AHttpResponseBody | A2AHttpStreamResponseBody }[],
): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");
  for (const event of events) {
    writeServerSentEvent(response, event);
  }
  response.end();
}

function writeSubscribeResponse(
  response: ServerResponse<IncomingMessage>,
  task: A2AHttpA2ATaskBody,
  subscribers: Map<string, Set<ServerResponse<IncomingMessage>>>,
  options: LocalA2ANodeServerOptions,
): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("connection", "keep-alive");
  response.setHeader("x-accel-buffering", "no");
  writeServerSentEvent(response, { event: "task", data: streamResponseBody(task, options) });
  if (isTerminalTaskState(task.status.state)) {
    response.end();
    return;
  }
  const taskSubscribers = subscribers.get(task.id) ?? new Set<ServerResponse<IncomingMessage>>();
  taskSubscribers.add(response);
  subscribers.set(task.id, taskSubscribers);
  response.once("close", () => {
    taskSubscribers.delete(response);
    if (taskSubscribers.size === 0) subscribers.delete(task.id);
  });
}

function notifySubscribers(
  subscribers: Map<string, Set<ServerResponse<IncomingMessage>>>,
  body: A2AHttpResponseBody,
  options: LocalA2ANodeServerOptions,
): void {
  const task = a2aTaskFromResponseBody(body);
  if (!task) return;
  const taskSubscribers = subscribers.get(task.id);
  if (!taskSubscribers || taskSubscribers.size === 0) return;
  for (const subscriber of [...taskSubscribers]) {
    if (subscriber.destroyed || subscriber.writableEnded) {
      taskSubscribers.delete(subscriber);
      continue;
    }
    writeServerSentEvent(subscriber, { event: "task", data: streamResponseBody(task, options) });
    if (isTerminalTaskState(task.status.state)) {
      taskSubscribers.delete(subscriber);
      subscriber.end();
    }
  }
  if (taskSubscribers.size === 0) subscribers.delete(task.id);
}

function closeSubscribers(subscribers: Map<string, Set<ServerResponse<IncomingMessage>>>): void {
  for (const taskSubscribers of subscribers.values()) {
    for (const subscriber of taskSubscribers) {
      if (!subscriber.destroyed && !subscriber.writableEnded) subscriber.end();
    }
  }
  subscribers.clear();
}

function writeServerSentEvent(
  response: ServerResponse<IncomingMessage>,
  event: { readonly event: string; readonly data: A2AHttpResponseBody | A2AHttpStreamResponseBody },
): void {
  response.write(`event: ${event.event}\n`);
  response.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

interface A2AHttpStreamResponseBody {
  readonly status_update: {
    readonly taskId: string;
    readonly contextId: string;
    readonly status: A2AHttpA2ATaskBody["status"];
  };
}

function streamResponseBody(
  body: A2AHttpResponseBody,
  options: LocalA2ANodeServerOptions,
): A2AHttpResponseBody | A2AHttpStreamResponseBody {
  if (options.standardsBodyMode !== "a2a") return body;
  const task = a2aTaskFromResponseBody(body);
  if (!task) return body;
  return {
    status_update: {
      taskId: task.id,
      contextId: task.contextId,
      status: task.status,
    },
  };
}

function a2aTaskFromResponseBody(body: A2AHttpResponseBody): A2AHttpA2ATaskBody | undefined {
  if (!isRecord(body)) return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.id === "string" && isRecord(record.status)) {
    return record as unknown as A2AHttpA2ATaskBody;
  }
  const task = record.task;
  if (isRecord(task) && typeof task.id === "string" && isRecord(task.status)) {
    return task as unknown as A2AHttpA2ATaskBody;
  }
  return undefined;
}

function isTerminalTaskState(state: A2AHttpA2ATaskBody["status"]["state"]): boolean {
  return [
    "TASK_STATE_COMPLETED",
    "TASK_STATE_CANCELED",
    "TASK_STATE_FAILED",
    "TASK_STATE_REJECTED",
  ].includes(state);
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

function isSubscribeTaskPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "tasks" && (parts[1] ?? "").endsWith(A2A_HTTP_SUBSCRIBE_TASK_SUFFIX);
}

function isAddressInfo(value: unknown): value is AddressInfo {
  return Boolean(value)
    && typeof value === "object"
    && value !== null
    && "address" in value
    && "port" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class BodyTooLargeError extends Error {
  constructor() {
    super("A2A request body is too large.");
    this.name = "BodyTooLargeError";
  }
}
