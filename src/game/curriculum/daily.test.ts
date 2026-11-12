import { describe, expect, it } from "vitest";
import { generateDrill } from "../../core/generator/generator";
import type { SkillId } from "../../core/rules/skills";
import { type ModeProgress, type SaveData, emptyMode, emptySave, parseSave } from "../../storage/save";
import { creditCards, generateCards } from "../cards/cards";
import { DEFAULT_CARDS, cardSpan } from "../cards/types";
import { creditSession, daysBetween, overdueDays, recordUse } from "../progress/progress";
import { type Session, nextExample, startSession, submitAnswer } from "../session/session";
import { type LessonSetup, toDrillConfig } from "../session/setup";
import { dailyPlan, dueReviews, reviewSetup } from "./daily";

function mastered(lastDay: string, extra: Partial<ModeProgress> = {}): ModeProgress {
  let progress = emptyMode();
  for (let i = 0; i < 90; i++) progress = recordUse(progress, true, ["2026-10-01", "2026-10-02", lastDay][i % 3]!);
  // recordUse тримає дні в порядку появи; останнім має бути lastDay
  return { ...progress, days: ["2026-10-01", "2026-10-02", lastDay], ...extra };
}
const withSkills = (skills: SaveData["skills"]): SaveData => ({ ...emptySave(), skills });
const skill = (physical: ModeProgress) => ({ physical, mental: emptyMode() });

/** Грає заняття: ok — усе правильно, bad — усе з другої спроби. */
function play(setupSkills: SkillId[], how: "ok" | "bad", seed = 3): Session {
  const drill = generateDrill({ ...toDrillConfig(reviewSetup(setupSkills)), seed });
  let session = startSession(drill);
  drill.examples.forEach((example) => {
    if (how === "bad") session = submitAnswer(session, example.answer + 1);
    session = nextExample(submitAnswer(session, example.answer));
  });
  return session;
}

/** Грає заняття з цими налаштуваннями: усе правильно або один приклад із двома помилками. */
function playSetup(setup: LessonSetup, how: "ok" | "fail" = "ok", seed = 3): Session {
  const drill = generateDrill({ ...toDrillConfig(setup), seed });
  let session = startSession(drill);
  drill.examples.forEach((example) => {
    if (how === "fail") session = submitAnswer(submitAnswer(session, example.answer + 1), example.answer + 2);
    else session = submitAnswer(session, example.answer);
    session = nextExample(session);
  });
  return session;
}

describe("повторення через 3, 7 і 21 день", () => {
  it("рахує дні між датами", () => {
    expect(daysBetween("2026-11-08", "2026-11-11")).toBe(3);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  it("засвоєний прийом стає до повторення на третій день", () => {
    const skills = { "five:+4": skill(mastered("2026-11-08")) };
    expect(dueReviews(skills, "2026-11-10")).toEqual([]);
    expect(dueReviews(skills, "2026-11-11")).toEqual(["five:+4"]);
  });

  it("незасвоєні прийоми не повторюються — ними займається рівень", () => {
    const learning = recordUse(emptyMode(), true, "2026-10-01");
    expect(dueReviews({ "five:+4": skill(learning) }, "2026-11-11")).toEqual([]);
  });

  it("бере найбільш прострочені, але показує в порядку програми", () => {
    const skills = {
      simple: skill(mastered("2026-11-01")),
      "five:+1": skill(mastered("2026-10-20")),
      "five:+2": skill(mastered("2026-11-07")),
      "five:+3": skill(mastered("2026-10-25")),
    };
    expect(dueReviews(skills, "2026-11-11")).toEqual(["simple", "five:+1", "five:+3"]);
  });

  it("вдале повторення подовжує інтервал до 7, потім до 21 дня", () => {
    let save = withSkills({ simple: skill(mastered("2026-11-01")), "five:+4": skill(mastered("2026-11-08")) });
    const credit = (session: Session, id: string, at: Date) => ({
      id,
      finishedAt: at,
      topic: "five:+4" as const,
      mode: "physical" as const,
      partial: false,
      review: true,
      session,
    });
    save = creditSession(save, credit(play(["five:+4"], "ok"), "r1", new Date(2026, 10, 11, 18)));
    const first = save.skills["five:+4"]!.physical;
    expect(first).toMatchObject({ reviewed: "2026-11-11", stage: 1 });
    expect(save.history[0]!.review).toBe(true);
    expect(overdueDays(first, "2026-11-17")).toBe(-1);
    expect(overdueDays(first, "2026-11-18")).toBe(0);

    save = creditSession(save, credit(play(["five:+4"], "ok", 4), "r2", new Date(2026, 10, 18, 18)));
    expect(save.skills["five:+4"]!.physical.stage).toBe(2);
    expect(dueReviews(save.skills, "2026-12-08")).not.toContain("five:+4");
    expect(dueReviews(save.skills, "2026-12-09")).toContain("five:+4");
  });

  it("практика раніше строку інтервал не змінює, а невдале повторення скидає його", () => {
    const start = withSkills({ simple: skill(mastered("2026-11-10")), "five:+4": skill(mastered("2026-11-10", { stage: 2 })) });
    const credit = (session: Session, at: Date) => ({
      id: "x",
      finishedAt: at,
      topic: "five:+4" as const,
      mode: "physical" as const,
      partial: false,
      session,
    });
    const early = creditSession(start, credit(play(["five:+4"], "ok"), new Date(2026, 10, 11, 18)));
    expect(early.skills["five:+4"]!.physical).toMatchObject({ reviewed: "2026-11-11", stage: 2 });

    const late = creditSession(start, credit(play(["five:+4"], "bad"), new Date(2026, 11, 20, 18)));
    expect(late.skills["five:+4"]!.physical.stage).toBe(0);
  });

  it("заняття-повторення тренує кожен із вибраних прийомів", () => {
    const skills: SkillId[] = ["five:+2", "five:-3", "ten:+9"];
    const setup = reviewSetup(skills);
    expect(setup).toMatchObject({ topic: "ten:+9", exampleCount: 10, actionsPerExample: 5, mode: "physical" });
    for (const seed of [1, 2, 3, 4, 5]) {
      const steps = generateDrill({ ...toDrillConfig(setup), seed }).examples.flatMap((example) => example.steps);
      for (const id of skills) {
        expect(steps.filter((step) => step.requiredSkills.includes(id)).length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("позначки повторення переживають збереження", () => {
    const save = withSkills({ simple: skill(mastered("2026-11-08", { reviewed: "2026-11-09", stage: 2 })) });
    const parsed = parseSave(JSON.parse(JSON.stringify(save)))!;
    expect(parsed.skills.simple!.physical).toMatchObject({ reviewed: "2026-11-09", stage: 2 });
  });
});

describe("картки з абакусом", () => {
  it("одноцифрові картки проходять усі цифри 1–9 по колу", () => {
    const cards = generateCards({ digits: 1, count: 18 }, 5);
    expect([...cards.slice(0, 9)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...cards.slice(9)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("числа потрібної розрядності, без двох однакових поспіль, повторювані за seed", () => {
    for (const digits of [1, 2, 3] as const) {
      const cards = generateCards({ digits, count: 40 }, 9);
      expect(cards).toHaveLength(40);
      cards.forEach((card, index) => {
        expect(String(card)).toHaveLength(digits);
        expect(card).not.toBe(cards[index - 1]);
      });
      expect(generateCards({ digits, count: 40 }, 9)).toEqual(cards);
    }
  });

  it("зараховує набір один раз і дає траву за правильні картки", () => {
    const credit = {
      id: "c1",
      finishedAt: new Date(2026, 10, 11, 18),
      setup: DEFAULT_CARDS,
      results: [true, true, true, false, true, true, true, false, true, true],
    };
    const once = creditCards(emptySave(), credit);
    expect(once.cardLog[0]).toMatchObject({ kind: "read", digits: 1, total: 10, correct: 8, earned: { grass: 4 } });
    expect(once.inventory.grass).toBe(12 + 4);
    expect(creditCards(once, credit)).toBe(once);
    expect(creditCards(emptySave(), { ...credit, results: [] }).cardLog).toEqual([]);
  });

  it("дні з картками рахуються в тижневу ціль", () => {
    let save = emptySave();
    [9, 10, 11, 12].forEach((date) => {
      save = creditCards(save, { id: `c${date}`, finishedAt: new Date(2026, 10, date, 18), setup: DEFAULT_CARDS, results: [true, true] });
    });
    expect(save.cardLog[3]!.week).toBe(true);
    expect(save.inventory.crystal).toBe(5);
    expect(save.weekGoalsPaid).toEqual(["2026-11-09"]);
  });

  it("журнал карток переживає збереження, а сміття відкидається", () => {
    const save = creditCards(emptySave(), { id: "c1", finishedAt: new Date(2026, 10, 11), setup: DEFAULT_CARDS, results: [true] });
    const dirty = { ...save, cardLog: [...save.cardLog, { id: "bad", kind: "dance" }, { ...save.cardLog[0], id: "c2", correct: 99 }] };
    expect(parseSave(JSON.parse(JSON.stringify(dirty)))!.cardLog.map((record) => record.id)).toEqual(["c1"]);
    const { cardLog, ...old } = emptySave();
    void cardLog;
    expect(parseSave(old)!.cardLog).toEqual([]);
  });
});

describe("заняття на сьогодні", () => {
  const now = new Date(2026, 10, 11, 17); // 11-те — непарний день: картки «набери число»

  it("для початківця — картки й знайомство з першим рівнем, без повторення", () => {
    const plan = dailyPlan(emptySave(), now);
    expect(plan.map((part) => part.id)).toEqual(["cards", "level"]);
    expect(plan[0]).toMatchObject({ done: false, cards: { kind: "set", digits: 1, count: 10 } });
    expect(plan[1]).toMatchObject({ done: false, lesson: { level: "simple:low", exampleCount: 10, actionsPerExample: 3 } });
    expect(dailyPlan(emptySave(), new Date(2026, 10, 12, 17))[0]).toMatchObject({ cards: { kind: "read" } });
    expect(dailyPlan(emptySave(), new Date(2026, 10, 13, 17))[0]).toMatchObject({
      cards: { kind: "memory", digits: 1, count: 5, span: 2, showSeconds: 2 },
    });
  });

  it("картки на пам'ять: числа на всі картинки, трава за кожну правильну спробу", () => {
    const setup = { kind: "memory" as const, digits: 1 as const, count: 5, showSeconds: 2, span: 3 };
    expect(cardSpan(setup)).toBe(3);
    expect(cardSpan(DEFAULT_CARDS)).toBe(1);
    expect(generateCards({ digits: 1, count: setup.count * cardSpan(setup) }, 1)).toHaveLength(15);
    const save = creditCards(emptySave(), { id: "m", finishedAt: now, setup, results: [true, false, true, true, false] });
    expect(save.cardLog[0]).toMatchObject({ kind: "memory", total: 5, correct: 3, earned: { grass: 3 } });
    expect(parseSave(JSON.parse(JSON.stringify(save)))!.cardLog[0]!.kind).toBe("memory");
  });

  it("після десятків число набирають двома руками", () => {
    const save = withSkills({ "ten:+9": skill(recordUse(emptyMode(), true, "2026-11-10")) });
    expect(dailyPlan(save, now)[0]).toMatchObject({ cards: { kind: "set", digits: 2, twoHands: true } });
    expect(dailyPlan(save, new Date(2026, 10, 13, 17))[0]).toMatchObject({ cards: { kind: "memory", span: 3 } });
  });

  it("додає повторення, коли настав час, і двоцифрові картки після десятків", () => {
    const save = withSkills({
      simple: skill(mastered("2026-11-01")),
      "five:+1": skill(mastered("2026-11-10")),
      "ten:+9": skill(recordUse(emptyMode(), true, "2026-11-10")),
    });
    const plan = dailyPlan(save, now);
    expect(plan.map((part) => part.id)).toEqual(["cards", "review", "level", "mental"]);
    expect(plan[0]).toMatchObject({ cards: { digits: 2 } });
    expect(plan[1]).toMatchObject({ done: false, lesson: { review: ["simple"], topic: "simple" } });
    // «1–4» і «5–9» не займані, але після них уже засвоєно інші рівні — тож вони не повертають назад.
    expect(plan[2]).toMatchObject({ lesson: { topic: "five:+2", level: "five:+2" } });
  });

  it("позначає зроблене сьогодні", () => {
    let save = withSkills({ simple: skill(mastered("2026-11-01")) });
    save = creditCards(save, { id: "c", finishedAt: now, setup: DEFAULT_CARDS, results: [true, true] });
    save = creditSession(save, {
      id: "r",
      finishedAt: now,
      topic: "simple",
      mode: "physical",
      partial: false,
      review: true,
      session: play(["simple"], "ok"),
    });
    const plan = dailyPlan(save, now);
    expect(plan.map((part) => [part.id, part.done])).toEqual([
      ["cards", true],
      ["review", true],
      ["level", false],
      ["mental", false],
    ]);
    // Учорашні записи сьогодні не рахуються.
    expect(dailyPlan(save, new Date(2026, 10, 12, 9)).every((part) => !part.done)).toBe(true);
  });

  it("пункт рівня закриває саме заплановане заняття, а не будь-яке", () => {
    const save = emptySave();
    const level = dailyPlan(save, now).find((part) => part.id === "level")!;
    if (level.id === "cards") throw new Error("unreachable");
    expect(level.lesson.planned).toBe("level");

    // Один невдалий приклад з іншої теми у вільному тренажері — не те, що заплановано.
    const other: LessonSetup = { ...level.lesson, topic: "ten:+9", level: undefined, planned: undefined, exampleCount: 1 };
    const stray = creditSession(save, {
      id: "x",
      finishedAt: now,
      topic: other.topic,
      mode: "physical",
      partial: false,
      session: playSetup(other, "fail"),
    });
    expect(dailyPlan(stray, now).find((part) => part.id === "level")!.done).toBe(false);

    // Той самий рівень і обсяг, обраний вручну, — зараховується.
    const manual = { ...level.lesson, planned: undefined };
    const same = creditSession(save, {
      id: "m",
      finishedAt: now,
      topic: manual.topic,
      mode: "physical",
      partial: false,
      level: manual.level,
      session: playSetup(manual),
    });
    expect(dailyPlan(same, now).find((part) => part.id === "level")!.done).toBe(true);

    // Запущене з плану зараховується, навіть якщо після нього рекомендація змінилася.
    const planned = creditSession(save, {
      id: "p",
      finishedAt: now,
      topic: level.lesson.topic,
      mode: "physical",
      partial: false,
      level: level.lesson.level,
      planned: "level",
      session: playSetup({ ...level.lesson, exampleCount: 1 }),
    });
    expect(dailyPlan(planned, now).find((part) => part.id === "level")!.done).toBe(true);
  });

  it("додає коротку практику подумки для рівня, засвоєного руками", () => {
    const save = withSkills({ "simple:low": skill(mastered("2026-11-10")) });
    const mental = dailyPlan(save, now).find((part) => part.id === "mental");
    expect(mental).toMatchObject({
      done: false,
      lesson: { level: "simple:low", mode: "mental", exampleCount: 5, planned: "mental" },
    });
    if (!mental || mental.id === "cards") throw new Error("немає пункту подумки");
    const done = creditSession(save, {
      id: "mm",
      finishedAt: now,
      topic: mental.lesson.topic,
      mode: "mental",
      partial: false,
      level: mental.lesson.level,
      planned: "mental",
      session: playSetup(mental.lesson),
    });
    expect(dailyPlan(done, now).find((part) => part.id === "mental")!.done).toBe(true);
    // Коли подумки теж засвоєно — пункту немає.
    const both = withSkills({ "simple:low": { physical: mastered("2026-11-10"), mental: mastered("2026-11-10") } });
    expect(dailyPlan(both, now).some((part) => part.id === "mental")).toBe(false);
  });
});
