/**
 * Dev server for the sandbox and the grid editor. Works the same on Windows, macOS, Linux.
 *
 *   npm run sandbox
 *
 * - Bundles src/sim/index.ts -> sandbox/sim.js (and rebuilds when you edit it)
 * - Serves the project folder on 127.0.0.1 (not "localhost", which on Windows
 *   can resolve to a different program listening on the same port)
 * - If the port is busy, tries the next one, and prints the exact URL to open
 * - Logs every 404 with the file path it looked for
 */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const START_PORT = Number(process.env.PORT) || 5173;
const HOST = "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".css": "text/css",
  ".svg": "image/svg+xml", ".ndjson": "application/x-ndjson",
};

// 1. bundle src/sim/index.ts for the browser, and keep it up to date
const ctx = await esbuild.context({
  entryPoints: [join(ROOT, "src", "sim", "index.ts")],
  bundle: true, format: "esm", outfile: join(ROOT, "sandbox", "sim.js"), logLevel: "warning",
});
await ctx.rebuild();
await ctx.watch();

// 2. static file server
const server = http.createServer(async (req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch { res.writeHead(400, { "Content-Type": "text/plain" }); return res.end("Bad URL"); }
  if (path === "/") { res.writeHead(302, { Location: "/sandbox/" }); return res.end(); }
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    console.log(`404  ${path}  (looked for ${file})`);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`Not found: ${path}`);
  }
});

let port = START_PORT;
server.on("error", (e) => {
  if (e.code === "EADDRINUSE" && port < START_PORT + 20) {
    console.log(`port ${port} is busy, trying ${port + 1}...`);
    server.listen(++port, HOST);
  } else { console.error(e); process.exit(1); }
});
server.on("listening", () => {
  const p = server.address().port; // the port we really got
  console.log(`\n  Serving ${ROOT}`);
  console.log(`  Sandbox:     http://${HOST}:${p}/sandbox/`);
  console.log(`  Grid editor: http://${HOST}:${p}/tools/grid-editor.html\n`);
  console.log("  (Ctrl+C to stop)");
});
server.listen(port, HOST);
