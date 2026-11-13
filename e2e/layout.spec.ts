import { AxeBuilder } from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { expectNoSideScroll, openFresh, openTab, shownAnswer, startLevel, typeAnswer } from "./helpers";

/** Верстка й доступність: малі екрани, альбомна орієнтація, розмір кнопок, перевірка axe. */

const TABS = [/Карта/, /Картки/, /Острів/, /Тренажер/, /Для батьків/];

const SIZES = [
  { name: "найменший телефон 320×568", width: 320, height: 568 },
  { name: "телефон боком 740×360", width: 740, height: 360 },
  { name: "планшет боком 1024×768", width: 1024, height: 768 },
];

/** Найменша сторона кожної видимої кнопки з переліку, у пікселях CSS. */
async function smallTargets(page: Page, selector: string, minimum: number): Promise<string[]> {
  return page.evaluate(
    ([css, min]) =>
      [...document.querySelectorAll<HTMLElement>(css as string)]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && box.height > 0 && Math.min(box.width, box.height) < (min as number))
        .map(({ element, box }) => `${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)} ${Math.round(box.width)}×${Math.round(box.height)}`),
    [selector, minimum] as const,
  );
}

for (const size of SIZES) {
  test(`${size.name}: жоден розділ і жоден екран уроку не вилазить за край`, async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "розміри задаються в самому тесті");
    await page.setViewportSize({ width: size.width, height: size.height });
    await openFresh(page);
    for (const tab of TABS) {
      await openTab(page, tab);
      await expectNoSideScroll(page, `розділ ${tab.source}`);
    }
    await openTab(page, /Карта/);
    await page.getByRole("button", { name: "Відкрити урок ▶" }).click();
    for (let step = 0; step < 4; step++) {
      await expectNoSideScroll(page, `вступний урок, сторінка ${step + 1}`);
      await page.getByRole("button", { name: /Далі ▶|Зрозуміло, до карти/ }).click();
    }
    await page.locator(".daily-part", { hasText: "Рівень" }).getByRole("button").click();
    await expectNoSideScroll(page, "пояснення теми");
    await page.getByRole("button", { name: "До вправ ▶" }).click();
    await expectNoSideScroll(page, "приклад");
    await page.getByRole("button", { name: "👀 Покажи рухи" }).click();
    await expectNoSideScroll(page, "демонстрація рухів");
    await page.getByRole("button", { name: /Зрозуміло/ }).click();
    const answer = await shownAnswer(page);
    await typeAnswer(page, answer + 1);
    await typeAnswer(page, answer + 2);
    await expectNoSideScroll(page, "розбір помилки");
  });
}

test("екранний абакус на найменшому телефоні: усі кісточки в межах екрана", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "розміри задаються в самому тесті");
  await page.setViewportSize({ width: 320, height: 568 });
  await openFresh(page, "screen");
  await startLevel(page);
  await expectNoSideScroll(page, "екранний абакус");
  const beads = await page.locator(".screen-abacus g.bead").evaluateAll((items) => items.map((bead) => bead.getBoundingClientRect()).map((box) => ({ left: box.left, right: box.right, width: box.width, height: box.height })));
  expect(beads.length).toBeGreaterThanOrEqual(15);
  for (const bead of beads) {
    expect(bead.left).toBeGreaterThanOrEqual(0);
    expect(bead.right).toBeLessThanOrEqual(320);
  }
});

test("у кнопки, якими рахує дитина, легко влучити пальцем", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "розмір дотику важливий на телефоні й планшеті");
  await openFresh(page);
  // Розділи й план дня.
  expect(await smallTargets(page, ".tab, .daily-part .btn, .tile", 40)).toEqual([]);
  await startLevel(page);
  // Цифрова клавіатура — головний інструмент відповіді.
  expect(await smallTargets(page, ".keypad .key", 44)).toEqual([]);
  expect(await smallTargets(page, ".btn-big", 44)).toEqual([]);
  // Клавіатуру видно разом із прикладом, без прокручування до кнопки OK.
  const ok = (await page.locator(".keypad .key-ok").boundingBox())!;
  const viewport = page.viewportSize()!;
  await page.locator(".keypad .key-ok").scrollIntoViewIfNeeded();
  expect(ok.width).toBeGreaterThanOrEqual(44);
  expect(viewport.width).toBeGreaterThanOrEqual(ok.x + ok.width);
});

test("кісточки екранного абакуса мають зону дотику, не меншу за палець", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "розмір дотику важливий на телефоні й планшеті");
  await openFresh(page, "screen");
  await startLevel(page);
  const hits = await page.locator(".screen-abacus .bead-hit").evaluateAll((items) => items.map((hit) => hit.getBoundingClientRect()).map((box) => ({ width: box.width, height: box.height })));
  expect(hits.length).toBeGreaterThanOrEqual(15);
  for (const hit of hits) {
    expect(hit.width).toBeGreaterThanOrEqual(40);
    expect(hit.height).toBeGreaterThanOrEqual(24);
  }
});

test("доступність: axe не знаходить критичних і серйозних порушень у жодному розділі", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "правила axe не залежать від розміру екрана");
  await openFresh(page);
  const found: string[] = [];
  const scan = async (where: string) => {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const violation of results.violations.filter((item) => item.impact === "critical" || item.impact === "serious")) {
      found.push(`${where}: ${violation.id} (${violation.impact}) — ${violation.nodes.length} ел., напр. ${violation.nodes[0]!.target.join(" ")}`);
    }
  };
  for (const tab of TABS) {
    await openTab(page, tab);
    await scan(`розділ ${tab.source}`);
  }
  await openTab(page, /Карта/);
  await startLevel(page);
  await scan("приклад");
  expect(found).toEqual([]);
});

test("усе керується з клавіатури: Tab доходить до кнопки «Почати», Enter запускає урок", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "клавіатура — на комп'ютері");
  await openFresh(page);
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => (document.activeElement?.closest(".daily-part") && document.activeElement.textContent) || "");
    if (focused.includes("Почати") && (await page.evaluate(() => document.activeElement?.closest(".daily-part")?.textContent?.includes("Рівень")))) break;
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "До вправ ▶" })).toBeVisible();
  // Фокус видно: у сфокусованої кнопки є контур або тінь.
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(outline).toBe(true);
});
