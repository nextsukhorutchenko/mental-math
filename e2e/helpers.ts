import { type Page, expect } from "@playwright/test";

export const SAVE_KEY = "mental-math:save";

/** Помилки консолі й необроблені винятки за весь тест. */
export function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

/** Відкриває застосунок і відповідає на перше питання про абакус. */
export async function openFresh(page: Page, abacus: "real" | "screen" = "real"): Promise<void> {
  await page.goto("./");
  const dialog = page.getByRole("dialog", { name: "Чим будемо рахувати?" });
  await dialog.getByRole("button", { name: abacus === "real" ? /Є абакус/ : /Без абакуса/ }).click();
  await expect(dialog).toBeHidden();
}

export const readSave = (page: Page) =>
  page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null") as Record<string, any> | null, SAVE_KEY);

/** Змінює збереження й перезавантажує сторінку, щоб застосунок його підхопив. */
export async function patchSave(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ([key, changes]) => {
      const save = JSON.parse(window.localStorage.getItem(key as string)!);
      window.localStorage.setItem(key as string, JSON.stringify({ ...save, ...(changes as object) }));
    },
    [SAVE_KEY, patch] as const,
  );
  await page.reload();
}

/** Відповідь на приклад, який зараз на екрані, порахована з намальованих чисел. */
export function shownAnswer(page: Page): Promise<number> {
  return page.getByLabel("Приклад", { exact: true }).evaluate((example) => {
    const fact = /^(\d+) ([×:]) (\d+)$/.exec(example.textContent ?? "");
    if (fact) return fact[2] === "×" ? Number(fact[1]) * Number(fact[3]) : Number(fact[1]) / Number(fact[3]);
    let value = 0;
    for (const line of example.querySelectorAll(".example-line")) {
      const sign = line.querySelector(".example-sign")!.textContent;
      const operand = Number(line.lastElementChild!.textContent);
      value += sign === "−" ? -operand : operand;
    }
    return value;
  });
}

export async function typeAnswer(page: Page, answer: number): Promise<void> {
  const keypad = page.locator(".keypad");
  for (const digit of String(answer)) await keypad.getByRole("button", { name: digit, exact: true }).click();
  await keypad.getByRole("button", { name: "OK", exact: true }).click();
}

/** Набирає число на екранному абакусі дотиками (або клацанням) по кісточках. */
export async function setBeads(page: Page, value: number): Promise<void> {
  const places = ["одиниці", "десятки", "сотні", "тисячі"];
  const digits = String(value).split("").reverse().map(Number);
  for (const [rod, digit] of digits.entries()) {
    if (digit >= 5) await page.getByRole("button", { name: `${places[rod]}: верхня кісточка`, exact: true }).click();
    if (digit % 5 > 0) await page.getByRole("button", { name: `${places[rod]}: нижня кісточка ${digit % 5}`, exact: true }).click();
  }
}

/** Проходить заняття до підсумку; повертає кількість розв'язаних прикладів. */
export async function solveLesson(page: Page, how: "keypad" | "beads" = "keypad"): Promise<number> {
  let solved = 0;
  for (;;) {
    await expect(page.locator(".progress, .eyebrow").first()).toBeVisible();
    if (!(await page.locator(".progress").count())) break;
    const answer = await shownAnswer(page);
    if (how === "beads") {
      await setBeads(page, answer);
      await page.getByRole("button", { name: "Готово ✓" }).click();
    } else {
      await typeAnswer(page, answer);
    }
    await expect(page.getByText("Правильно! ⭐")).toBeVisible();
    solved++;
    await page.getByRole("button", { name: "Далі ▶" }).click();
  }
  return solved;
}

export const openTab = (page: Page, label: RegExp) => page.getByRole("navigation", { name: "Розділи" }).getByRole("button", { name: label }).click();

/** Запускає заняття рівня з плану дня й проходить пояснення теми. */
export async function startLevel(page: Page): Promise<void> {
  await page.locator(".daily-part", { hasText: /^.?\s*Рівень / }).getByRole("button").click();
  await page.getByRole("button", { name: "До вправ ▶" }).click();
}

/** Сторінка не ширша за екран і не прокручується вбік. */
export async function expectNoSideScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const wide: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // Те, що лежить у власній прокручуваній смузі (таблиця, панель інструментів), сторінку не розширює.
      if (element.closest(".table-wrap, .toolbar, .tiles, .backdrop")) continue;
      if (box.right > width + 1 || box.left < -1) wide.push(`${element.tagName.toLowerCase()}.${element.className} [${Math.round(box.left)}..${Math.round(box.right)}]`);
    }
    return { scroll: document.documentElement.scrollWidth, width, wide: wide.slice(0, 5) };
  });
  expect(overflow.scroll, `${where}: сторінка ширша за екран (${overflow.wide.join("; ")})`).toBeLessThanOrEqual(overflow.width + 1);
}
