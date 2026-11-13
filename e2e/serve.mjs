// Статичний сервер для наскрізних тестів: віддає dist із підпапки /MentalMath/, як GitHub Pages.
// GET /__bump імітує публікацію нової версії: sw.js починає віддаватися з іншою назвою кешу.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "dist");
const PORT = Number(process.env.PORT ?? 4321);
const BASE = "/MentalMath/";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

let version = 0;

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/__bump") {
    version++;
    response.writeHead(200, { "content-type": "text/plain" }).end(String(version));
    return;
  }
  if (url.pathname === "/__reset") {
    version = 0;
    response.writeHead(200, { "content-type": "text/plain" }).end("0");
    return;
  }
  if (!url.pathname.startsWith(BASE)) {
    response.writeHead(404).end("not found");
    return;
  }
  const relative = decodeURIComponent(url.pathname.slice(BASE.length)) || "index.html";
  const file = normalize(join(ROOT, relative));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    let body = await readFile(file);
    if (relative === "sw.js" && version > 0) {
      body = Buffer.from(body.toString("utf8").replace(/const CACHE = "(mental-math-[0-9a-f]+)"/, `const CACHE = "$1-v${version}"`));
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" }).end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
}).listen(PORT, () => console.log(`e2e server: http://localhost:${PORT}${BASE}`));
