import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(appRoot, "dist");
const portArgIndex = process.argv.indexOf("--port");
const port = Number(process.env.DOCS_PORT || (portArgIndex >= 0 ? process.argv[portArgIndex + 1] : 4175));

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let target = resolve(distDir, `.${clean}`);

  if (!target.startsWith(distDir)) {
    return null;
  }

  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, "index.html");
  }

  return target;
}

const server = createServer((request, response) => {
  const file = resolveRequest(request.url || "/");

  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": types.get(extname(file)) || "application/octet-stream",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AgentRail docs site available at http://127.0.0.1:${port}`);
});
