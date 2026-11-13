import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { openFresh, openTab, readSave, solveLesson, startLevel, watchConsole } from "./helpers";

/** Офлайн-робота й оновлення версії: застосунок має відкриватися без мережі й оновлюватися лише за згодою. */

test.beforeEach(async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "service worker не залежить від розміру екрана");
  await request.get("/__reset");
});

function distFiles(dir = "dist"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? distFiles(path) : [relative("dist", path).replaceAll("\\", "/")];
  });
}

/** Чекає, доки service worker встановиться й почне керувати сторінкою. */
async function waitForWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test("sw.js кешує кожен файл збірки, і нічого зайвого", async () => {
  const worker = readFileSync("dist/sw.js", "utf8");
  const precache = JSON.parse(/const PRECACHE = (\[.*?\]);/s.exec(worker)![1]!) as string[];
  const files = distFiles().filter((file) => file !== "sw.js");
  expect([...precache].sort()).toEqual(["./", ...files].sort());
  // Сторінка посилається саме на ті скрипти й стилі, що лежать у збірці.
  const html = readFileSync("dist/index.html", "utf8");
  for (const file of files.filter((name) => /\.(js|css)$/.test(name))) expect(html).toContain(file);
  // Шляхи відносні: застосунок працює з підпапки.
  expect(html).not.toMatch(/(src|href)="\//);
  expect(worker).toMatch(/const CACHE = "mental-math-[0-9a-f]{12}"/);
});

test("маніфест коректний, іконки існують і мають заявлений розмір", async ({ page }) => {
  await page.goto("./");
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    const data = (await (await fetch(link.href)).json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string }[] };
    const icons = await Promise.all(
      data.icons.map(async (icon) => {
        const bitmap = await createImageBitmap(await (await fetch(new URL(icon.src, link.href))).blob());
        return { declared: icon.sizes, actual: `${bitmap.width}x${bitmap.height}` };
      }),
    );
    return { ...data, icons };
  });
  expect(manifest.name).toBe("Ментальна математика");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe(".");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  for (const icon of manifest.icons) expect(icon.actual).toBe(icon.declared);
  const touchIcon = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')!.href)).status);
  expect(touchIcon).toBe(200);
});

test("без мережі застосунок відкривається, показує картинки й дає пройти урок", async ({ page, context }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await waitForWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Заняття на сьогодні")).toBeVisible();
  // Картинки скіна й супутника беруться з кешу: застосунок не перейшов на запасні піксельні фігурки.
  await expect(page.locator("svg.avatar-artwork").first()).toBeVisible();
  const pictures = await page.evaluate(async () => {
    const sources = [...document.querySelectorAll("svg image")].map((image) => image.getAttribute("href")!);
    const statuses = await Promise.all(sources.map(async (source) => (await fetch(source)).status));
    return { count: sources.length, bad: sources.filter((_, index) => statuses[index] !== 200) };
  });
  expect(pictures.count).toBeGreaterThan(0);
  expect(pictures.bad).toEqual([]);
  expect(await page.locator("svg.avatar:not(.avatar-artwork)").count()).toBe(0);

  await startLevel(page);
  expect(await solveLesson(page)).toBe(10);
  await expect(page.getByText("Самостійно: 10 з 10")).toBeVisible();
  await page.getByRole("button", { name: "🗺 На карту" }).click();
  for (const tab of [/Картки/, /Острів/, /Тренажер/, /Для батьків/]) {
    await openTab(page, tab);
    await expect(page.locator("main")).not.toBeEmpty();
  }
  // Прогрес, здобутий офлайн, зберігся.
  await page.reload();
  expect((await readSave(page))!.history).toHaveLength(1);
  await context.setOffline(false);
  expect(problems).toEqual([]);
});

test("нова версія чекає на згоду: банер «Оновити», після натискання — нова версія й цілий прогрес", async ({ page, request }) => {
  await openFresh(page);
  await waitForWorker(page);
  await startLevel(page);
  await solveLesson(page);
  await page.getByRole("button", { name: "🗺 На карту" }).click();
  const before = await page.evaluate(() => caches.keys());
  expect(before).toHaveLength(1);
  await expect(page.getByText("Є нова версія застосунку")).toHaveCount(0);

  // Публікуємо нову версію і просимо браузер перевірити оновлення (як при поверненні до застосунку).
  await request.get("/__bump");
  await page.evaluate(async () => void (await (await navigator.serviceWorker.ready).update()));
  await expect(page.getByText("Є нова версія застосунку. Прогрес збережеться.")).toBeVisible({ timeout: 20_000 });
  // Доки не погодилися, працює стара версія.
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).waiting !== null)).toBe(true);

  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Оновити" }).click()]);
  await expect(page.getByText("Заняття на сьогодні")).toBeVisible();
  await expect(page.getByText("Є нова версія застосунку")).toHaveCount(0);
  // Старий кеш видалено, лишився лише новий.
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([`${before[0]}-v1`]);
  expect((await readSave(page))!.history).toHaveLength(1);
});

test("посеред уроку оновлення не пропонується й не перезавантажує сторінку", async ({ page, request }) => {
  await openFresh(page);
  await waitForWorker(page);
  await startLevel(page);
  await request.get("/__bump");
  await page.evaluate(async () => void (await (await navigator.serviceWorker.ready).update()));
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting !== null), { timeout: 20_000 }).toBe(true);
  // Нова версія готова, але дитина рахує: банера немає, приклад на місці.
  await expect(page.getByText("Є нова версія застосунку")).toHaveCount(0);
  await expect(page.getByText("Приклад 1 з 10")).toBeVisible();
  await page.getByRole("button", { name: "✕ Вийти" }).click();
  await expect(page.getByText("Є нова версія застосунку. Прогрес збережеться.")).toBeVisible();
});
