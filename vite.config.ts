import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * Після збірки пише dist/sw.js зі списком усіх файлів застосунку.
 * Service worker кешує їх під час встановлення, тому застосунок відкривається без мережі.
 * Назва кешу залежить від вмісту файлів: нова збірка — новий кеш, старий видаляється після оновлення.
 */
function offlinePlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "mental-math-offline",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((path) => relative(outDir, path).replaceAll("\\", "/"))
        .filter((path) => path !== "sw.js")
        .sort();
      const hash = createHash("sha256");
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const version = hash.digest("hex").slice(0, 12);
      const precache = ["./", ...files];
      writeFileSync(
        join(outDir, "sw.js"),
        `// Згенеровано під час збірки. Не редагувати.
const CACHE = "mental-math-${version}";
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: "reload" — беремо файли з сервера, а не з кешу браузера, де може лежати попередня версія.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })));
      // Сторінка мусить посилатися саме на скрипти цієї версії. Якщо сервер ще віддає стару сторінку,
      // встановлення скасовується, і браузер спробує пізніше.
      const shell = await cache.match("index.html");
      const html = shell ? await shell.text() : "";
      const scripts = PRECACHE.filter((url) => url.startsWith("assets/") && url.endsWith(".js"));
      if (!scripts.every((url) => html.includes(url))) {
        await caches.delete(CACHE);
        throw new Error("Сервер ще віддає попередню версію сторінки");
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("mental-math-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Нова версія вмикається лише тоді, коли користувач натисне «Оновити».
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreVary: сервер може відповідати з Vary: Origin, а кеш наповнювався без цього заголовка.
      const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await cache.match("index.html");
        if (shell) return shell;
      }
      return fetch(request);
    }),
  );
});
`,
      );
    },
  };
}

export default defineConfig({
  // Відносні шляхи: застосунок працює і з кореня сайту, і з підпапки.
  base: "./",
  // Дата збірки показується в розділі «Для батьків», щоб легко звірити версію на пристрої.
  define: { __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  plugins: [react(), offlinePlugin()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
