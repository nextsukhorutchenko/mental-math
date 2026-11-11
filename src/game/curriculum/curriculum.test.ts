import { describe, expect, it } from "vitest";
import { divideExample, formatExample, generateDrill, multiplyExample } from "../../core/generator/generator";
import { ALL_SKILLS } from "../../core/rules/skills";
import { type ModeProgress, type SaveData, emptyMode, emptySave, parseSave } from "../../storage/save";
import { creditSession, recordUse } from "../progress/progress";
import { weakSpots, weekStats, skillRows } from "../progress/stats";
import { worldBlock } from "../rewards/rewards";
import { nextExample, startSession, submitAnswer } from "../session/session";
import { toDrillConfig } from "../session/setup";
import {
  LEVELS,
  WORLDS,
  currentLevel,
  earnedRanks,
  levelLabel,
  levelSetup,
  levelStates,
  rankFor,
  recommendLesson,
} from "./curriculum";
import { levelById } from "./levels";

function uses(count: number, clean: boolean, days: string[], from: ModeProgress = emptyMode()): ModeProgress {
  let progress = from;
  for (let i = 0; i < count; i++) progress = recordUse(progress, clean, days[i % days.length]!);
  return progress;
}
const THREE_DAYS = ["2026-11-09", "2026-11-10", "2026-11-11"];
const mastered = () => uses(90, true, THREE_DAYS);
const skill = (physical: ModeProgress, mental: ModeProgress = emptyMode()) => ({ physical, mental });
const stateOf = (skills: SaveData["skills"], id: string, unlockAll = false) =>
  levelStates(skills, unlockAll).find((state) => state.id === id)!;
/** Перші два рівні лісу вже засвоєно — щоб перевіряти рівні після них. */
const forestStart = () => ({ "simple:low": skill(mastered()), "simple:five": skill(mastered()) });

describe("карта навчання", () => {
  it("сім світів: формули йдуть у порядку програми, далі багатоцифрові, множення й ділення", () => {
    expect(WORLDS.map((world) => world.id)).toEqual(["forest", "caves", "desert", "snow", "mine", "volcano", "sky"]);
    expect(WORLDS.map((world) => world.levels.length)).toEqual([3, 8, 18, 8, 3, 5, 3]);
    expect(LEVELS.flatMap((level) => (level.skill ? [level.skill] : []))).toEqual(ALL_SKILLS);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
    expect(["simple:low", "simple", "five:+4", "mix:-7", "digits:2", "mul:2x1"].map(levelLabel)).toEqual([
      "1–4",
      "1–9",
      "+4",
      "−7",
      "10–99",
      "47×6",
    ]);
  });

  it("спочатку відкрито лише перший рівень", () => {
    const states = levelStates({}, false);
    expect(states[0]).toMatchObject({ id: "simple:low", status: "open" });
    expect(states.slice(1).every((state) => state.status === "locked")).toBe(true);
    expect(currentLevel(states)).toBe("simple:low");
  });

  it("наступний рівень відкривається після засвоєння попереднього на абакусі", () => {
    const learning = { ...forestStart(), simple: skill(uses(30, true, THREE_DAYS)) };
    expect(stateOf(learning, "simple").status).toBe("learning");
    expect(stateOf(learning, "five:+1").status).toBe("locked");

    const done = { ...forestStart(), simple: skill(mastered()) };
    expect(stateOf(done, "simple").status).toBe("mastered");
    expect(stateOf(done, "five:+1").status).toBe("open");
    expect(stateOf(done, "five:+2").status).toBe("locked");
    expect(currentLevel(levelStates(done, false))).toBe("five:+1");
  });

  it("ментальний прогрес не потрібен для відкриття, а батьки можуть відкрити все", () => {
    const done = { ...forestStart(), simple: skill(mastered(), emptyMode()) };
    expect(stateOf(done, "five:+1").status).toBe("open");
    expect(levelStates({}, true).every((state) => state.status === "open")).toBe(true);
  });

  it("старий прогрес не повертає на нові рівні на початку програми", () => {
    // Збереження зі старої карти: прямі рухи засвоєно, працюємо над +2; рівнів «1–4» і «5–9» тоді ще не було.
    const old = { simple: skill(mastered()), "five:+1": skill(mastered()), "five:+2": skill(uses(10, true, THREE_DAYS)) };
    const states = levelStates(old, false);
    expect(stateOf(old, "simple:low")).toMatchObject({ status: "open", skipped: true });
    expect(stateOf(old, "simple:five")).toMatchObject({ skipped: true });
    expect(currentLevel(states)).toBe("five:+2");
    // А рівень після останнього розпочатого лишається звичайним.
    expect(stateOf(old, "five:+3")).toMatchObject({ status: "locked", skipped: false });
    // Проба далекої формули в тренажері нічого не пропускає.
    const tried = { ...old, "ten:+9": skill(uses(5, true, THREE_DAYS)) };
    expect(stateOf(tried, "five:+3").skipped).toBe(false);
    expect(currentLevel(levelStates(tried, false))).toBe("five:+2");
  });

  it("рівень, який уже тренували в тренажері, не зачиняється", () => {
    expect(stateOf({ "ten:+9": skill(uses(5, true, THREE_DAYS)) }, "ten:+9").status).toBe("learning");
  });

  it("радить заняття за етапом: знайомство, практика, закріплення, подумки, повторення", () => {
    const stage = (skills: SaveData["skills"]) => recommendLesson(stateOf(skills, "simple"));
    expect(stage({})).toMatchObject({ stage: "intro", setup: { exampleCount: 10, actionsPerExample: 3, level: "simple" } });
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

  it("рівні лісу тримаються своїх меж", () => {
    const steps = (id: string) =>
      generateDrill({ ...toDrillConfig(levelSetup(levelById(id)!, 20, 4)), seed: 2 }).examples.flatMap((example) => example.steps);
    for (const step of steps("simple:low")) {
      expect(step.operand).toBeLessThanOrEqual(4);
      expect(step.after).toBeLessThanOrEqual(4);
      expect(step.requiredSkills).toEqual(["simple"]);
    }
    const five = generateDrill({ ...toDrillConfig(levelSetup(levelById("simple:five")!, 20, 4)), seed: 2 }).examples;
    for (const example of five) {
      expect(example.steps.every((step) => step.after <= 9 && step.requiredSkills.every((id) => id === "simple"))).toBe(true);
      // у кожному прикладі є дія з п'ятіркою (число від 5)
      expect(example.steps.some((step) => step.operand >= 5)).toBe(true);
    }
  });

  it("багатоцифрові рівні дають числа потрібної розрядності", () => {
    for (const [id, digits] of [["digits:2", 2], ["digits:3", 3], ["digits:4", 4]] as const) {
      const drill = generateDrill({ ...toDrillConfig(levelSetup(levelById(id)!, 6, 4)), seed: 3 });
      for (const example of drill.examples) {
        expect(example.steps).toHaveLength(4);
        expect(example.steps.every((step) => String(step.operand).length === digits && step.after >= 0)).toBe(true);
      }
    }
  });

  it("розряд дається за повністю пройдений світ, номери йдуть від 7 до 1", () => {
    expect(earnedRanks(levelStates({}, false))).toEqual([]);
    const forest = { ...forestStart(), simple: skill(mastered()) };
    const ranks = earnedRanks(levelStates(forest, false));
    expect(ranks.map((rank) => [rank.world.id, rank.number])).toEqual([["forest", 7]]);
    expect(rankFor(WORLDS[WORLDS.length - 1]!).number).toBe(1);
    // без одного рівня світ не зараховується
    expect(earnedRanks(levelStates(forestStart(), false))).toEqual([]);
  });
});

describe("множення й ділення", () => {
  it("множення розкладається на часткові добутки зліва направо", () => {
    const example = multiplyExample(47, 6);
    expect(example).toMatchObject({ prompt: "47 × 6", answer: 282, labels: ["40 × 6 = 240", "7 × 6 = 42"] });
    expect(example.steps.map((step) => step.after)).toEqual([240, 282]);
    expect(multiplyExample(47, 26).labels).toEqual(["40 × 20 = 800", "40 × 6 = 240", "7 × 20 = 140", "7 × 6 = 42"]);
    expect(multiplyExample(205, 3).steps.map((step) => step.after)).toEqual([600, 615]);
  });

  it("ділення віднімає «цифра частки × дільник», доки абакус не спорожніє", () => {
    const example = divideExample(861, 7);
    expect(example).toMatchObject({ prompt: "861 : 7", answer: 123 });
    expect(example.steps.map((step) => step.after)).toEqual([861, 161, 21, 0]);
    expect(divideExample(721, 7).steps.map((step) => step.after)).toEqual([721, 21, 0]);
    expect(() => divideExample(10, 3)).toThrow();
  });

  it("рівні множення й ділення дають правильні відповіді в заданих межах", () => {
    for (const level of LEVELS.filter((item) => item.kind === "multiply" || item.kind === "divide")) {
      const drill = generateDrill({ ...toDrillConfig(levelSetup(level, 30, 2)), seed: 5 });
      expect(drill.examples).toHaveLength(30);
      drill.examples.forEach((example, index) => {
        const [a, sign, b] = example.prompt!.split(" ");
        expect(example.answer).toBe(sign === "×" ? Number(a) * Number(b) : Number(a) / Number(b));
        expect(example.steps[example.steps.length - 1]!.after).toBe(sign === "×" ? example.answer : 0);
        expect(example.labels).toHaveLength(example.steps.length);
        expect(example.prompt).not.toBe(drill.examples[index - 1]?.prompt);
      });
      expect(formatExample(drill.examples[0]!)).toBe(`${drill.examples[0]!.prompt} = ${drill.examples[0]!.answer}`);
    }
    const table = generateDrill({ ...toDrillConfig(levelSetup(levelById("mul:table-low")!, 30, 2)), seed: 1 });
    expect(table.examples.every((example) => example.answer <= 45 && example.steps.length === 1)).toBe(true);
  });

  it("прогрес рівня-не-формули рахується за діями, а блок дає світ рівня", () => {
    const level = levelById("mul:2x1")!;
    const drill = generateDrill({ ...toDrillConfig(levelSetup(level, 5, 2)), seed: 7 });
    let session = startSession(drill);
    drill.examples.forEach((example) => {
      session = nextExample(submitAnswer(session, example.answer));
    });
    const save = creditSession(emptySave(), {
      id: "m1",
      finishedAt: new Date(2026, 10, 11, 18),
      topic: "simple",
      mode: "physical",
      partial: false,
      level: level.id,
      session,
    });
    const totalSteps = drill.examples.reduce((sum, example) => sum + example.steps.length, 0);
    expect(save.skills["mul:2x1"]!.physical).toMatchObject({ total: totalSteps, correct: totalSteps });
    expect(save.history[0]).toMatchObject({ level: "mul:2x1", earned: { gold: 10 } });
    expect(parseSave(JSON.parse(JSON.stringify(save)))!.skills["mul:2x1"]!.physical.total).toBe(totalSteps);
    expect(worldBlock("simple", "div:table")).toBe("glass");
    expect(worldBlock("ten:+9")).toBe("sand");
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
    review: false,
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
