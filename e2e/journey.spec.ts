import { expect, test } from "@playwright/test";
import { openFresh, openTab, patchSave, readSave, shownAnswer, solveLesson, startLevel, typeAnswer, watchConsole } from "./helpers";

/** Шлях дитини від першого запуску до нагороди — на телефоні, планшеті й комп'ютері. */

test("перший запуск → урок → нагорода → прогрес переживає перезавантаження", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await expect(page.getByRole("button", { name: "Відкрити урок ▶" })).toBeVisible();
  await expect(page.getByText("Заняття на сьогодні")).toBeVisible();

  await startLevel(page);
  expect(await solveLesson(page)).toBe(10);
  await expect(page.getByText("Самостійно: 10 з 10")).toBeVisible();
  await expect(page.getByText("💎 Кристал за уважне заняття")).toBeVisible();

  await page.reload();
  // Після перезавантаження заняття зараховано, питання про абакус не повторюється.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".daily-part.daily-done", { hasText: "Рівень" })).toBeVisible();
  const save = await readSave(page);
  expect(save!.history).toHaveLength(1);
  expect(save!.history[0]).toMatchObject({ total: 10, clean: 10, partial: false });
  expect(save!.inventory.wood).toBe(20);
  expect(problems).toEqual([]);
});

test("екранний абакус: увесь урок дотиками до кісточок", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page, "screen");
  await startLevel(page);
  await expect(page.locator(".keypad")).toHaveCount(0);
  expect(await solveLesson(page, "beads")).toBe(10);
  await expect(page.getByText("Самостійно: 10 з 10")).toBeVisible();
  expect(problems).toEqual([]);
});

test("перезавантаження посеред уроку повертає той самий приклад", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await startLevel(page);
  for (let index = 0; index < 3; index++) {
    await typeAnswer(page, await shownAnswer(page));
    await page.getByRole("button", { name: "Далі ▶" }).click();
  }
  const before = await page.getByLabel("Приклад", { exact: true }).innerText();
  await page.reload();
  await expect(page.getByText("Є незавершене тренування: приклад 4 з 10.")).toBeVisible();
  await page.getByRole("button", { name: "Продовжити ▶" }).click();
  expect(await page.getByLabel("Приклад", { exact: true }).innerText()).toBe(before);
  expect(await solveLesson(page)).toBe(7);
  await expect(page.getByText("Самостійно: 10 з 10")).toBeVisible();
  expect(problems).toEqual([]);
});

test("помилка двічі → розбір із правильною відповіддю й демонстрацією рухів", async ({ page }) => {
  await openFresh(page);
  await startLevel(page);
  const answer = await shownAnswer(page);
  await typeAnswer(page, answer + 1);
  await expect(page.getByText(/Не зовсім/)).toBeVisible();
  await typeAnswer(page, answer + 2);
  await expect(page.getByText("Розберімо разом")).toBeVisible();
  await expect(page.getByText(`Правильна відповідь: ${answer}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Рух ▶" })).toBeVisible();
});

test("острів: блоки малюються, якщо вести пальцем чи мишею, і запас зменшується", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await openTab(page, /Острів/);
  const cells = page.locator("[data-cell]");
  const first = (await cells.nth(13).boundingBox())!;
  const last = (await cells.nth(16).boundingBox())!;
  await cells.nth(13).scrollIntoViewIfNeeded();
  const from = (await cells.nth(13).boundingBox())!;
  const to = (await cells.nth(16).boundingBox())!;
  expect(first.width).toBeGreaterThan(10);
  expect(last.width).toBeGreaterThan(10);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("[data-cell].filled")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "трава: 8" })).toBeVisible();

  // Один дотик — один блок; повторний дотик у ту саму клітинку нічого не змінює.
  await cells.nth(40).click();
  await cells.nth(40).click();
  await expect(page.locator("[data-cell].filled")).toHaveCount(5);
  const save = await readSave(page);
  expect(save!.inventory.grass).toBe(7);
  expect(problems).toEqual([]);
});

test("тренажер: ділення проходить до кінця, нездійсненні налаштування дають підказку", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await openTab(page, /Тренажер/);
  await page.getByRole("button", { name: "➕ Лише додавання" }).click();
  await page.getByRole("combobox").selectOption("ten:-3");
  await page.getByRole("button", { name: "трицифрові" }).click();
  await page.getByRole("button", { name: "Почати ⛏" }).click();
  await expect(page.getByText(/прийом на віднімання, а вибрано лише додавання/)).toBeVisible();

  await page.getByRole("button", { name: "➗ Ділення" }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Почати ⛏" }).click();
  await page.getByRole("button", { name: "До вправ ▶" }).click();
  expect(await solveLesson(page)).toBe(5);
  await expect(page.getByText("Самостійно: 5 з 5")).toBeVisible();
  expect(problems).toEqual([]);
});

test("картки: число читається з намальованих кісточок", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await openTab(page, /Картки/);
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Почати ▶" }).click();
  for (let card = 0; card < 5; card++) {
    const number = await page.locator(".card-picture svg").evaluate((svg) => {
      const beads = [...svg.querySelectorAll("g.bead")];
      let value = 0;
      for (let rod = 0; rod * 5 < beads.length; rod++) {
        const group = beads.slice(rod * 5, rod * 5 + 5);
        const lower = group.slice(1).filter((bead) => bead.classList.contains("bead-on")).length;
        value += ((group[0]!.classList.contains("bead-on") ? 5 : 0) + lower) * 10 ** rod;
      }
      return value;
    });
    await typeAnswer(page, number);
    await expect(page.getByText("Правильно! ⭐")).toBeVisible();
    await page.getByRole("button", { name: "Далі ▶" }).click();
  }
  await expect(page.getByText("Правильно: 5 з 5")).toBeVisible();
  expect(problems).toEqual([]);
});

test("флеш-виклик: числа справді блимають із потрібним темпом, і сума зараховується", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "темп однаковий на всіх екранах; досить одного прогону");
  await openFresh(page);
  await openTab(page, /Тренажер/);
  await page.getByRole("button", { name: "Відкрити" }).click();
  await page.locator(".flash-level").first().click();
  for (let round = 0; round < 3; round++) {
    await page.evaluate(() => {
      const seen: { text: string; at: number }[] = [];
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      new MutationObserver(() => {
        const text = document.querySelector(".flash-number")?.textContent?.trim() ?? "";
        if (text !== (seen[seen.length - 1]?.text ?? "")) seen.push({ text, at: performance.now() });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await page.getByRole("button", { name: "Старт ▶" }).click();
    await expect(page.getByText("Яка сума?")).toBeVisible({ timeout: 15_000 });
    const seen = await page.evaluate(() => (window as unknown as { __seen: { text: string; at: number }[] }).__seen);
    const numbers = seen.filter((item) => item.text !== "");
    expect(numbers).toHaveLength(3);
    // Перший рівень — 2 секунди на число.
    for (let index = 1; index < numbers.length; index++) {
      const gap = numbers[index]!.at - numbers[index - 1]!.at;
      expect(gap).toBeGreaterThan(1700);
      expect(gap).toBeLessThan(2400);
    }
    await typeAnswer(page, numbers.reduce((total, item) => total + Number(item.text), 0));
    await expect(page.getByText("Правильно! ⭐")).toBeVisible();
    await page.getByRole("button", { name: "Далі ▶" }).click();
  }
  await expect(page.getByText("Рівень пройдено! ⭐")).toBeVisible();
  expect((await readSave(page))!.flashBest).toBe(1);
});

test("розділ для батьків: налаштування зберігаються й переживають перезавантаження", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await openTab(page, /Для батьків/);
  await page.getByPlaceholder("Ім'я дитини").fill("Орися");
  await page.getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ім'я: Орися. Змінити" })).toBeVisible();
  const save = await readSave(page);
  expect(save).toMatchObject({ childName: "Орися", unlockAll: true });
  // Усі рівні відкрито: жодного замка на карті.
  await expect(page.locator(".tile-locked")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("резервна копія: файл завантажується й відновлює прогрес на «іншому пристрої»", async ({ page, browser }) => {
  await openFresh(page);
  await startLevel(page);
  await solveLesson(page);
  await page.getByRole("button", { name: "🗺 На карту" }).click();
  await openTab(page, /Для батьків/);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "⬇ Зберегти копію у файл" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^mental-math-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();

  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: "uk-UA" });
  const second = await other.newPage();
  await openFresh(second);
  await openTab(second, /Для батьків/);
  await expect(second.getByText("Занять ще не було.")).toBeVisible();
  second.on("dialog", (dialog) => void dialog.accept());
  await second.locator('input[type="file"]').setInputFiles(path);
  await expect(second.getByText(/Прогрес відновлено з файлу/)).toBeVisible();
  await expect(second.getByText("Усього занять: 1. Останні:")).toBeVisible();
  const restored = await readSave(second);
  const original = await readSave(page);
  expect(restored!.history).toEqual(original!.history);
  expect(restored!.skills).toEqual(original!.skills);
  await other.close();
});

test("пошкоджене збереження не валить застосунок і не затирається", async ({ page }) => {
  await openFresh(page);
  await page.evaluate(() => window.localStorage.setItem("mental-math:save", "{зламано"));
  await page.reload();
  await expect(page.getByText(/Збережений прогрес пошкоджено/)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("mental-math:save-unreadable"))).toBe("{зламано");
  // Перший запуск після збою: застосунок працює, план дня є.
  await page.getByRole("dialog").getByRole("button", { name: /Є абакус/ }).click();
  await expect(page.getByText("Заняття на сьогодні")).toBeVisible();
});

test("карту пройдено: грамота відкривається, усі світи з зірками", async ({ page }) => {
  const problems = watchConsole(page);
  await openFresh(page);
  await expect(page.locator(".tile")).toHaveCount(LEVEL_IDS.length);
  // Засвоєння рівня: щонайменше 80 самостійних застосувань, 18 з останніх 20, три різні дні.
  const mode = { correct: 100, total: 100, recent: Array(30).fill(true), days: ["2026-01-01", "2026-01-02", "2026-01-03"] };
  await patchSave(page, {
    childName: "Соломія",
    skills: Object.fromEntries(LEVEL_IDS.map((id) => [id, { physical: mode, mental: mode }])),
  });
  await expect(page.getByText(/1-й розряд — «Небесний навігатор»/)).toBeVisible();
  await expect(page.locator(".tile-mastered")).toHaveCount(LEVEL_IDS.length);
  await page.getByRole("button", { name: "🏅 Грамота" }).first().click();
  await expect(page.locator(".certificate-name")).toHaveText("Соломія");
  await expect(page.getByText(/7-й розряд — «Лісовий слідопит»/)).toBeVisible();
  expect(problems).toEqual([]);
});

/** Ідентифікатори рівнів у порядку програми (48 штук). */
const formulas = (family: string, sign: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => `${family}:${sign}${from + index}`);
const LEVEL_IDS = [
  "simple:low",
  "simple:five",
  "simple",
  ...formulas("five", "+", 1, 4),
  ...formulas("five", "-", 1, 4),
  ...formulas("ten", "+", 1, 9),
  ...formulas("ten", "-", 1, 9),
  ...formulas("mix", "+", 6, 9),
  ...formulas("mix", "-", 6, 9),
  "digits:2",
  "digits:3",
  "digits:4",
  "mul:table-low",
  "mul:table-high",
  "mul:2x1",
  "mul:3x1",
  "mul:2x2",
  "div:table",
  "div:2by1",
  "div:3by1",
];
