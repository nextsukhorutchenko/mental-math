import { cleanup, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { SAVE_KEY } from "../storage/localStore";
import { type SaveData, emptySave, parseSave } from "../storage/save";
import { child, playDay } from "./simulate";

/**
 * Спільне для тестів застосунку цілком: чисте сховище перед кожним тестом, перевірка консолі після,
 * і дії «як дитина» — прочитати приклад з екрана, натиснути цифри, пересунути кісточки.
 */

/** Викликати один раз у файлі з тестами: готує середовище й стежить, щоб у консолі не було помилок. */
export function setupAppHarness(): void {
  let errors: string[] = [];
  beforeEach(() => {
    window.localStorage.clear();
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => void errors.push(parts.map(String).join(" ")));
    vi.spyOn(console, "warn").mockImplementation((...parts: unknown[]) => void errors.push(parts.map(String).join(" ")));
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    // Жоден сценарій не повинен лишати помилок чи попереджень у консолі.
    expect(errors).toEqual([]);
  });
}

export const stored = (): SaveData => parseSave(JSON.parse(window.localStorage.getItem(SAVE_KEY)!))!;
export const seed = (save: SaveData) => window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
/** Збереження дитини, яка вже відповіла про абакус і бачила вступний урок. */
export const ready = (): SaveData => ({ ...emptySave(), abacusAsked: true, introSeen: true });

/** Збереження дитини, яка `days` днів займалася за планом і закінчила вчора. */
export function lived(days: number, accuracy = 0.9, base: SaveData = ready()): SaveData {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const who = child(accuracy, 5);
  let save = base;
  for (let day = 0; day < days; day++) save = playDay(save, day, who, start).save;
  return save;
}

/** Відповідь на приклад, який зараз на екрані, порахована з намальованих чисел, а не взята з коду. */
export function shownAnswer(): number {
  const example = screen.getByLabelText("Приклад");
  const fact = /^(\d+) ([×:]) (\d+)$/.exec(example.textContent ?? "");
  if (fact) return fact[2] === "×" ? Number(fact[1]) * Number(fact[3]) : Number(fact[1]) / Number(fact[3]);
  let value = 0;
  for (const line of example.querySelectorAll(".example-line")) {
    const sign = line.querySelector(".example-sign")!.textContent;
    const operand = Number(line.lastElementChild!.textContent);
    value += sign === "−" ? -operand : operand;
  }
  return value;
}

export async function typeAnswer(user: UserEvent, answer: number): Promise<void> {
  for (const digit of String(answer)) await user.click(screen.getByRole("button", { name: digit }));
  await user.click(screen.getByRole("button", { name: "OK" }));
}

/** Набирає число на екранному абакусі дотиками до кісточок. */
export async function setBeads(user: UserEvent, value: number): Promise<void> {
  const places = ["одиниці", "десятки", "сотні", "тисячі"];
  const digits = String(value).split("").reverse().map(Number);
  for (const [rod, digit] of digits.entries()) {
    if (digit >= 5) await user.click(screen.getByRole("button", { name: `${places[rod]}: верхня кісточка` }));
    if (digit % 5 > 0) await user.click(screen.getByRole("button", { name: `${places[rod]}: нижня кісточка ${digit % 5}` }));
  }
}

/** Число на намальованому абакусі: спиці йдуть від одиниць, на кожній — верхня кісточка й чотири нижні. */
export function drawnNumber(svg: Element): number {
  const beads = [...svg.querySelectorAll("g.bead")];
  let value = 0;
  for (let rod = 0; rod * 5 < beads.length; rod++) {
    const group = beads.slice(rod * 5, rod * 5 + 5);
    const lower = group.slice(1).filter((bead) => bead.classList.contains("bead-on")).length;
    value += ((group[0]!.classList.contains("bead-on") ? 5 : 0) + lower) * 10 ** rod;
  }
  return value;
}

export const progressText = () => screen.getByText(/^Приклад \d+ з \d+$/).textContent!;

/** Розв'язує заняття до кінця; `wrong` — номери прикладів (з нуля), де дитина двічі помиляється. */
export async function solveLesson(user: UserEvent, wrong: number[] = []): Promise<number> {
  let solved = 0;
  while (screen.queryByText(/^Приклад \d+ з \d+$/)) {
    const index = Number(/^Приклад (\d+)/.exec(progressText())![1]) - 1;
    const answer = shownAnswer();
    if (wrong.includes(index)) {
      await typeAnswer(user, answer + 1);
      expect(screen.getByText(/Не зовсім/)).toBeTruthy();
      await typeAnswer(user, answer + 2);
      expect(screen.getByText("Розберімо разом")).toBeTruthy();
      expect(screen.getByText(new RegExp(`Правильна відповідь: ${answer}\\.`))).toBeTruthy();
    } else {
      await typeAnswer(user, answer);
      expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
      expect(screen.getByText(`Відповідь: ${answer}`)).toBeTruthy();
    }
    solved++;
    await user.click(screen.getByRole("button", { name: "Далі ▶" }));
  }
  return solved;
}

/** На екрані немає слідів зламаних даних. */
export function expectCleanText(): void {
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/undefined|NaN|\[object|Infinity/);
  expect(text).not.toMatch(/\bnull\b/);
}

export const openTab = (user: UserEvent, label: RegExp) =>
  user.click(within(screen.getByRole("navigation", { name: "Розділи" })).getByRole("button", { name: label }));

/** Запускає заняття рівня з плану дня. */
export async function startLevel(user: UserEvent): Promise<void> {
  const part = screen.getByText(/^Рівень /).closest("li")!;
  await user.click(within(part).getByRole("button", { name: /Почати|Ще раз/ }));
}
