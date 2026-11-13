import { describe, expect, it } from "vitest";
import { type SaveData, emptySave, parseSave } from "../storage/save";
import { child, dayAt, playDay, playLesson } from "../testing/simulate";
import { LEVELS, WORLDS, currentLevel, earnedRanks, levelStates, recommendLesson } from "./curriculum/curriculum";
import { dailyPlan } from "./curriculum/daily";
import { PLACEMENT_STAGES, placementStart, stageDrill } from "./curriculum/placement";
import { skillRows, weekStats } from "./progress/stats";

/**
 * Наскрізна перевірка програми без екрана: «дитина» щодня виконує план дня, і ми дивимося,
 * чи можна пройти всю карту, чи не ламається збереження і чи план завжди має що запропонувати.
 */

/** Нове збереження дитини, яка вже відповіла на перше питання про абакус (до занять без цього не дійти). */
const freshSave = (): SaveData => ({ ...emptySave(), abacusAsked: true });
const statesOf = (save: SaveData) => levelStates(save.skills, save.unlockAll, save.placement);
const masteredCount = (save: SaveData) => statesOf(save).filter((state) => state.status === "mastered").length;

/** Те, що має бути правдою для будь-якого збереження в будь-який день. */
function expectHealthy(save: SaveData, label: string): void {
  for (const [block, count] of Object.entries(save.inventory)) {
    expect(Number.isInteger(count) && count >= 0, `${label}: запас ${block} = ${count}`).toBe(true);
  }
  for (const [id, progress] of Object.entries(save.skills)) {
    for (const mode of ["physical", "mental"] as const) {
      const { correct, total, recent, days } = progress![mode];
      expect(correct <= total, `${label}: ${id} має більше правильних, ніж усього`).toBe(true);
      expect(recent.length <= 30 && days.length <= 60, `${label}: ${id} перевищує ліміти`).toBe(true);
    }
  }
  expect(new Set(save.history.map((record) => record.id)).size, `${label}: повтори в історії`).toBe(save.history.length);
  for (const record of save.history) {
    expect(record.clean + record.withHelp + record.failed, `${label}: лічильники запису ${record.id}`).toBe(record.total);
  }
}

describe("дитина проходить програму за планом дня", () => {
  it("уважна дитина доходить до кінця карти, і кожен рівень досяжний", { timeout: 300_000 }, () => {
    const who = child(1);
    let save = freshSave();
    let day = 0;
    const reached = new Set<string>();
    while (currentLevel(statesOf(save)) !== null && day < 1500) {
      const level = currentLevel(statesOf(save))!;
      reached.add(level);
      const before = masteredCount(save);
      const result = playDay(save, day, who);
      // План ніколи не порожній: є розминка й заняття рівня.
      expect(result.plan.map((part) => part.id)).toEqual(expect.arrayContaining(["cards", "level"]));
      save = result.save;
      // Без помилок засвоєне не втрачається.
      expect(masteredCount(save), `день ${day}`).toBeGreaterThanOrEqual(before);
      // Виконане сьогодні позначається виконаним.
      const evening = dailyPlan(save, dayAt(day, undefined));
      expect(evening.find((part) => part.id === "cards")!.done, `день ${day}: картки`).toBe(true);
      expect(evening.find((part) => part.id === "level")!.done, `день ${day}: рівень`).toBe(true);
      if (day % 25 === 0) {
        expectHealthy(save, `день ${day}`);
        // Перезавантаження сторінки нічого не змінює й не губить.
        expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
      }
      day++;
    }
    expect(currentLevel(statesOf(save)), `за ${day} днів карту не пройдено`).toBeNull();
    // Кожен рівень був поточним у плані. Виняток — «усі числа 1–9»: прямі рухи зараховуються в нього
    // вже на рівнях «1–4» і «5–9», тож він може засвоїтися попутно.
    expect([...reached].filter((id) => id !== "simple")).toEqual(LEVELS.map((level) => level.id).filter((id) => id !== "simple"));
    // Раніше «5–9 з п'ятіркою» пропускався одразу після «1–4», і дитина йшла на формули без уроку про верхню кісточку.
    expect([...reached].slice(0, 2)).toEqual(["simple:low", "simple:five"]);
    expect(earnedRanks(statesOf(save))).toHaveLength(WORLDS.length);
    // Розумна тривалість програми: не тижні й не десятиліття.
    expect(day).toBeGreaterThan(LEVELS.length * 3 - 1);
    expect(day).toBeLessThan(LEVELS.length * 12);

    // Після карти план не зникає: лишаються розминка, повторення й рахунок подумки.
    const after = dailyPlan(save, dayAt(day));
    expect(after.length).toBeGreaterThanOrEqual(2);
    for (let extra = 0; extra < 30; extra++) save = playDay(save, day + extra, who).save;
    expectHealthy(save, "після карти");
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it("дитина, що часто помиляється, не ламає план, запас і статистику", { timeout: 120_000 }, () => {
    for (const accuracy of [0, 0.5, 0.85]) {
      const who = child(accuracy, 7);
      let save = freshSave();
      for (let day = 0; day < 120; day++) {
        const result = playDay(save, day, who);
        expect(result.plan.length, `точність ${accuracy}, день ${day}`).toBeGreaterThanOrEqual(2);
        save = result.save;
      }
      expectHealthy(save, `точність ${accuracy}`);
      expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
      const stats = weekStats(save.history, dayAt(119));
      expect(stats.activeDays).toBe(7);
      expect(stats.clean).toBeLessThanOrEqual(stats.examples);
      for (const row of skillRows(save.skills)) {
        expect(row.recentAccuracy === null || (row.recentAccuracy >= 0 && row.recentAccuracy <= 1)).toBe(true);
      }
    }
  });

  it("дитина без жодної правильної відповіді лишається на першому рівні й не отримує розрядів", () => {
    const who = child(0, 3);
    let save = freshSave();
    for (let day = 0; day < 40; day++) save = playDay(save, day, who).save;
    expect(currentLevel(statesOf(save))).toBe(LEVELS[0]!.id);
    expect(earnedRanks(statesOf(save))).toEqual([]);
  });

  it("пропущені дні й переведений назад годинник не ламають план", () => {
    const who = child(1, 5);
    let save = freshSave();
    for (const day of [0, 1, 2, 5, 40, 41, 450, 451, 449, 3, 452]) {
      const result = playDay(save, day, who);
      expect(result.plan.length, `день ${day}`).toBeGreaterThanOrEqual(2);
      save = result.save;
    }
    expectHealthy(save, "стрибки в часі");
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it("рекомендоване заняття складається для кожного рівня на кожному етапі", { timeout: 120_000 }, () => {
    // Етапи залежать від прогресу, тому проганяємо рівень, відкривши всю карту, поки він не буде засвоєний.
    const who = child(1, 11);
    for (const level of LEVELS) {
      let save: SaveData = { ...freshSave(), unlockAll: true };
      const stages = new Set<string>();
      for (let lesson = 0; lesson < 40; lesson++) {
        const state = statesOf(save).find((item) => item.id === level.id)!;
        const next = recommendLesson(state);
        stages.add(next.stage);
        if (next.stage === "review") break;
        save = playLesson(save, next.setup, dayAt(lesson), who);
      }
      // Уважна дитина може перескочити «закріплення» (60–79 самостійних застосувань), решта етапів обов'язкова.
      expect([...stages].filter((stage) => stage !== "mix"), level.id).toEqual(["intro", "practice", "mental", "review"]);
    }
  });
});

describe("стартова перевірка", () => {
  it("кожен етап складається для сотень різних seed і має лише прийоми свого світу й попередніх", () => {
    for (const stage of PLACEMENT_STAGES) {
      for (let seed = 1; seed <= 300; seed++) {
        const drill = stageDrill(stage, seed);
        expect(drill.examples).toHaveLength(4);
        const allowed = new Set(drill.config.allowedSkills);
        for (const example of drill.examples) {
          for (const step of example.steps) for (const skill of step.requiredSkills) expect(allowed.has(skill)).toBe(true);
        }
      }
    }
  });

  it("місце старту ніколи не вище за перший непройдений етап", () => {
    const ids = LEVELS.map((level) => level.id);
    let previous = -1;
    for (let passed = 0; passed <= PLACEMENT_STAGES.length + 2; passed++) {
      const index = ids.indexOf(placementStart(passed));
      expect(index).toBeGreaterThanOrEqual(previous);
      if (passed < PLACEMENT_STAGES.length) expect(placementStart(passed)).toBe(PLACEMENT_STAGES[passed]!.start);
      previous = index;
    }
  });
});
