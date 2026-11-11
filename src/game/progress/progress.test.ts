import { describe, expect, it } from "vitest";
import { generateDrill } from "../../core/generator/generator";
import { type ActiveSession, type ModeProgress, emptyMode, emptySave } from "../../storage/save";
import { type Session, markHint, nextExample, startSession, submitAnswer } from "../session/session";
import { DEFAULT_SETUP, mentalTryout, toDrillConfig } from "../session/setup";
import { closeActive, creditSession, localDay, masteryOf, recordUse, restoreSession } from "./progress";

const config = { ...toDrillConfig({ ...DEFAULT_SETUP, exampleCount: 3, actionsPerExample: 3 }), seed: 1 };
const drill = generateDrill(config);
const day = new Date(2026, 10, 11, 18, 30);

/** Перший приклад — самостійно, другий — з підказкою, третій не розв'язано. */
function playedTwo(): Session {
  let session = nextExample(submitAnswer(startSession(drill), drill.examples[0]!.answer));
  return nextExample(submitAnswer(markHint(session), drill.examples[1]!.answer));
}

const credit = (session: Session, id = "s1") => ({
  id,
  finishedAt: day,
  topic: DEFAULT_SETUP.topic,
  mode: "physical" as const,
  partial: false,
  session,
});

function uses(index: number, skill: string): number {
  return drill.examples[index]!.steps.filter((step) => step.requiredSkills.includes(skill as never)).length;
}

describe("зарахування заняття", () => {
  it("додає запис в історію й рахує застосування прийомів", () => {
    const save = creditSession(emptySave(), credit(playedTwo()));
    expect(save.history).toHaveLength(1);
    expect(save.history[0]).toMatchObject({ id: "s1", total: 2, clean: 1, withHelp: 1, failed: 0 });
    const focus = save.skills["five:+4"]!.physical;
    expect(focus.total).toBe(uses(0, "five:+4") + uses(1, "five:+4"));
    expect(focus.correct).toBe(uses(0, "five:+4"));
    expect(focus.days).toEqual(["2026-11-11"]);
    expect(save.skills["five:+4"]!.mental.total).toBe(0);
  });

  it("не зараховує те саме заняття двічі", () => {
    const once = creditSession(emptySave(), credit(playedTwo()));
    expect(creditSession(once, credit(playedTwo()))).toBe(once);
  });

  it("не створює запис, якщо жодного прикладу не розв'язано", () => {
    const save = emptySave();
    expect(creditSession(save, credit(startSession(drill)))).toBe(save);
  });

  it("ментальний режим рахується окремо від фізичного", () => {
    const save = creditSession(emptySave(), { ...credit(playedTwo()), mode: "mental" });
    expect(save.skills["five:+4"]!.physical.total).toBe(0);
    expect(save.skills["five:+4"]!.mental.total).toBeGreaterThan(0);
  });
});

describe("незавершене заняття", () => {
  const active = (session: Session): ActiveSession => ({
    id: "a1",
    setup: { ...DEFAULT_SETUP, exampleCount: 3, actionsPerExample: 3 },
    config,
    started: true,
    index: session.index,
    results: session.results,
    current: session.current,
    status: "answering",
  });

  it("відновлюється з тими самими прикладами", () => {
    const restored = restoreSession(active(playedTwo()))!;
    expect(restored.index).toBe(2);
    expect(restored.drill.examples.map((example) => example.answer)).toEqual(
      drill.examples.map((example) => example.answer),
    );
  });

  it("не відновлюється з несумісних даних", () => {
    expect(restoreSession({ ...active(playedTwo()), index: 7 })).toBeNull();
    expect(
      restoreSession({ ...active(playedTwo()), config: { ...config, focusSkills: ["ten:+9"] } }),
    ).toBeNull();
  });

  it("при закритті зараховує розв'язане як часткове заняття", () => {
    const closed = closeActive({ ...emptySave(), active: active(playedTwo()) }, day);
    expect(closed.active).toBeNull();
    expect(closed.history[0]).toMatchObject({ id: "a1", partial: true, total: 2 });
    expect(closeActive(closed, day)).toBe(closed);
  });

  it("перерване ментальне заняття йде в ментальний прогрес", () => {
    const mental = { ...active(playedTwo()), setup: { ...active(playedTwo()).setup, mode: "mental" as const } };
    const closed = closeActive({ ...emptySave(), active: mental }, day);
    expect(closed.history[0]!.mode).toBe("mental");
    expect(closed.skills["five:+4"]!.physical.total).toBe(0);
    expect(closed.skills["five:+4"]!.mental.total).toBeGreaterThan(0);
  });

  it("проба подумки — п'ять коротких прикладів тієї самої теми", () => {
    const tryout = mentalTryout({ ...DEFAULT_SETUP, actionsPerExample: 8, pacing: "auto" });
    expect(tryout).toMatchObject({ topic: DEFAULT_SETUP.topic, mode: "mental", exampleCount: 5, actionsPerExample: 3, pacing: "all" });
    expect(mentalTryout({ ...DEFAULT_SETUP, actionsPerExample: 2 }).actionsPerExample).toBe(2);
  });
});

describe("засвоєння прийому", () => {
  const repeat = (progress: ModeProgress, count: number, clean: boolean, on: string) => {
    for (let i = 0; i < count; i++) progress = recordUse(progress, clean, on);
    return progress;
  };

  it("нова формула, потім у роботі", () => {
    expect(masteryOf(undefined, "physical").status).toBe("new");
    expect(masteryOf(repeat(emptyMode(), 5, true, "2026-11-11"), "physical").status).toBe("learning");
  });

  it("потребує 80 правильних, 18 з останніх 20 і трьох різних днів", () => {
    let progress = repeat(emptyMode(), 40, true, "2026-11-11");
    progress = repeat(progress, 40, true, "2026-11-12");
    expect(masteryOf(progress, "physical")).toMatchObject({ status: "learning", correct: 80, days: 2 });
    progress = repeat(progress, 1, true, "2026-11-13");
    expect(masteryOf(progress, "physical").status).toBe("mastered");
  });

  it("свіжі помилки знімають засвоєння", () => {
    let progress = repeat(emptyMode(), 90, true, "2026-11-11");
    progress = repeat(repeat(progress, 1, true, "2026-11-12"), 1, true, "2026-11-13");
    progress = repeat(progress, 3, false, "2026-11-14");
    expect(masteryOf(progress, "physical")).toMatchObject({ status: "learning", recentClean: 17 });
  });

  it("день береться за місцевим часом", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
