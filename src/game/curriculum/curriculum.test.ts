import { describe, expect, it } from "vitest";
import { generateDrill } from "../../core/generator/generator";
import { ALL_SKILLS, type SkillId } from "../../core/rules/skills";
import { type ModeProgress, type SaveData, emptyMode } from "../../storage/save";
import { recordUse } from "../progress/progress";
import { weakSpots, weekStats, skillRows } from "../progress/stats";
import { toDrillConfig } from "../session/setup";
import { WORLDS, currentLevel, levelLabel, levelStates, recommendLesson } from "./curriculum";

function uses(count: number, clean: boolean, days: string[], from: ModeProgress = emptyMode()): ModeProgress {
  let progress = from;
  for (let i = 0; i < count; i++) progress = recordUse(progress, clean, days[i % days.length]!);
  return progress;
}
const THREE_DAYS = ["2026-11-09", "2026-11-10", "2026-11-11"];
const mastered = () => uses(90, true, THREE_DAYS);
const skill = (physical: ModeProgress, mental: ModeProgress = emptyMode()) => ({ physical, mental });
const stateOf = (skills: SaveData["skills"], id: SkillId, unlockAll = false) =>
  levelStates(skills, unlockAll).find((state) => state.skill === id)!;

describe("карта навчання", () => {
  it("світи покривають усі прийоми в порядку програми", () => {
    expect(WORLDS.flatMap((world) => world.levels)).toEqual(ALL_SKILLS);
    expect(WORLDS.map((world) => world.levels.length)).toEqual([1, 8, 18, 8]);
    expect([levelLabel("simple"), levelLabel("five:+4"), levelLabel("mix:-7")]).toEqual(["1–9", "+4", "−7"]);
  });

  it("спочатку відкрито лише перший рівень", () => {
    const states = levelStates({}, false);
    expect(states[0]!.status).toBe("open");
    expect(states.slice(1).every((state) => state.status === "locked")).toBe(true);
    expect(currentLevel(states)).toBe("simple");
  });

  it("наступний рівень відкривається після засвоєння попереднього на абакусі", () => {
    const learning = { simple: skill(uses(30, true, THREE_DAYS)) };
    expect(stateOf(learning, "simple").status).toBe("learning");
    expect(stateOf(learning, "five:+1").status).toBe("locked");

    const done = { simple: skill(mastered()) };
    expect(stateOf(done, "simple").status).toBe("mastered");
    expect(stateOf(done, "five:+1").status).toBe("open");
    expect(stateOf(done, "five:+2").status).toBe("locked");
    expect(currentLevel(levelStates(done, false))).toBe("five:+1");
  });

  it("ментальний прогрес не потрібен для відкриття, а батьки можуть відкрити все", () => {
    const done = { simple: skill(mastered(), emptyMode()) };
    expect(stateOf(done, "five:+1").status).toBe("open");
    expect(levelStates({}, true).every((state) => state.status === "open")).toBe(true);
  });

  it("рівень, який уже тренували в тренажері, не зачиняється", () => {
    expect(stateOf({ "ten:+9": skill(uses(5, true, THREE_DAYS)) }, "ten:+9").status).toBe("learning");
  });

  it("радить заняття за етапом: знайомство, практика, закріплення, подумки, повторення", () => {
    const stage = (skills: SaveData["skills"]) => recommendLesson(stateOf(skills, "simple"));
    expect(stage({})).toMatchObject({ stage: "intro", setup: { exampleCount: 10, actionsPerExample: 3 } });
    expect(stage({ simple: skill(uses(20, true, THREE_DAYS)) })).toMatchObject({
      stage: "practice",
      setup: { exampleCount: 20, actionsPerExample: 4, mode: "physical" },
    });
    expect(stage({ simple: skill(uses(70, true, ["2026-11-11"])) }).stage).toBe("mix");
    expect(stage({ simple: skill(mastered()) })).toMatchObject({ stage: "mental", setup: { mode: "mental" } });
    expect(stage({ simple: skill(mastered(), uses(40, true, THREE_DAYS)) }).stage).toBe("review");
  });

  it("рекомендоване заняття можна згенерувати для кожного рівня", () => {
    for (const state of levelStates({}, true)) {
      const { setup } = recommendLesson(state);
      expect(generateDrill({ ...toDrillConfig(setup), seed: 1 }).examples).toHaveLength(setup.exampleCount);
    }
  });
});

describe("статистика для батьків", () => {
  const record = (id: string, finishedAt: Date, total: number, clean: number) => ({
    id,
    finishedAt: finishedAt.toISOString(),
    topic: "simple" as const,
    mode: "physical" as const,
    total,
    clean,
    withHelp: total - clean,
    failed: 0,
    partial: false,
    earned: {},
    bonuses: [],
  });
  const now = new Date(2026, 10, 11, 20, 0);

  it("рахує заняття за останні сім днів", () => {
    const week = weekStats(
      [
        record("old", new Date(2026, 10, 4, 12), 10, 10),
        record("a", new Date(2026, 10, 5, 12), 10, 8),
        record("b", new Date(2026, 10, 11, 9), 20, 15),
        record("c", new Date(2026, 10, 11, 19), 5, 5),
      ],
      now,
    );
    expect(week.days).toHaveLength(7);
    expect(week.days[0]!.day).toBe("2026-11-05");
    expect(week.days[6]).toEqual({ day: "2026-11-11", sessions: 2, examples: 25, clean: 20 });
    expect(week).toMatchObject({ sessions: 3, examples: 35, clean: 28, activeDays: 2 });
  });

  it("показує лише прийоми, які тренували, і знаходить слабкі місця", () => {
    const skills = {
      simple: skill(mastered()),
      "five:+4": skill(uses(8, false, THREE_DAYS, uses(12, true, THREE_DAYS))),
      "five:+3": skill(uses(3, false, THREE_DAYS)),
      "five:+2": skill(emptyMode(), uses(4, true, THREE_DAYS)),
    };
    expect(skillRows(skills).map((row) => row.skill)).toEqual(["simple", "five:+2", "five:+3", "five:+4"]);
    // five:+3 має замало спроб, щоб робити висновки.
    const weak = weakSpots(skills);
    expect(weak.map((row) => row.skill)).toEqual(["five:+4"]);
    expect(weak[0]!.recentAccuracy).toBeCloseTo(0.6);
  });
});
