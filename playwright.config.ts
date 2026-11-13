import { defineConfig } from "@playwright/test";

/**
 * Наскрізні тести в справжньому браузері проти зібраного застосунку (dist), який віддається з підпапки,
 * як на GitHub Pages. Запуск: npm run e2e (спершу збирає застосунок).
 * На Windows береться встановлений Edge; деінде — Chromium від Playwright (npx playwright install chromium).
 * Інший браузер: PW_CHANNEL=chrome npm run e2e
 */
const channel = process.env.PW_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);
const PORT = 4321;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Сервер один на всіх і вміє «публікувати нову версію», тож тести йдуть по черзі.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/MentalMath/`,
    channel,
    locale: "uk-UA",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node e2e/serve.mjs dist`,
    url: `http://localhost:${PORT}/MentalMath/`,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
  projects: [
    { name: "phone", use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
