import { describe, expect, it } from "vitest";
import { generateDrill } from "../../core/generator/generator";
import { type SaveData, emptySave, parseSave } from "../../storage/save";
import {
  type World,
  addPlot,
  demolishPlot,
  editPlot,
  placeBlock,
  placedCount,
  removeBlock,
} from "../island/island";
import { creditSession, recordUse } from "../progress/progress";
import { type Session, markHint, nextExample, startSession, submitAnswer } from "../session/session";
import { DEFAULT_SETUP, toDrillConfig } from "../session/setup";
import {
  ISLAND_COLS,
  ISLAND_ROWS,
  MAX_PLOTS,
  PLOT_SIZE,
  emptyIsland,
  emptyPlot,
  starterInventory,
} from "./blocks";
import { sessionLoot, weekActiveDays, weekId, worldBlock } from "./rewards";

const drill = generateDrill({ ...toDrillConfig({ ...DEFAULT_SETUP, exampleCount: 5, actionsPerExample: 3 }), seed: 4 });
const right = (index: number) => drill.examples[index]!.answer;

/** Грає заняття за сценарієм: clean — одразу правильно, fix — з другої спроби, hint — з підказкою, fail — двічі помилка. */
function play(script: ("clean" | "fix" | "hint" | "fail")[]): Session {
  let session = startSession(drill);
  script.forEach((kind, index) => {
    if (kind === "hint") session = markHint(session);
    if (kind === "fix" || kind === "fail") session = submitAnswer(session, right(index) + 1);
    session = submitAnswer(session, kind === "fail" ? right(index) + 2 : right(index));
    session = nextExample(session);
  });
  return session;
}

const credit = (session: Session, id: string, finishedAt: Date, partial = false) => ({
  id,
  finishedAt,
  topic: DEFAULT_SETUP.topic,
  mode: "physical" as const,
  partial,
  session,
});

describe("здобич за заняття", () => {
  it("кожен світ дає свій матеріал", () => {
    expect(["simple", "five:+4", "ten:-9", "mix:+6"].map((topic) => worldBlock(topic as never))).toEqual([
      "wood",
      "stone",
      "sand",
      "ice",
    ]);
  });

  it("нагороджує самостійність, виправлену помилку й розбір, а не швидкість", () => {
    const { loot, accurate } = sessionLoot(play(["clean", "fix", "hint", "fail", "clean"]), "five:+4", false);
    // камінь: 2 + 2 + 1 + 0 + 2; трава: 1 за розбір + 2 за завершення
    expect(loot).toEqual({ stone: 7, grass: 3 });
    expect(accurate).toBe(false);
  });

  it("уважне заняття дає кристал, перерване — ні", () => {
    const all = play(["clean", "clean", "clean", "clean", "fix"]);
    expect(sessionLoot(all, "five:+4", false).loot).toEqual({ stone: 10, grass: 2, crystal: 1 });
    expect(sessionLoot(all, "five:+4", true).loot).toEqual({ stone: 10 });
  });

  it("зарахування кладе блоки в інвентар і не дублює їх", () => {
    const session = play(["clean", "clean", "clean", "clean", "clean"]);
    const once = creditSession(emptySave(), credit(session, "s1", new Date(2026, 10, 11, 18)));
    expect(once.inventory).toMatchObject({ grass: 12 + 2, stone: 10, crystal: 1 });
    expect(once.history[0]).toMatchObject({ earned: { stone: 10, grass: 2, crystal: 1 }, bonuses: ["accuracy"] });
    expect(creditSession(once, credit(session, "s1", new Date(2026, 10, 11, 19)))).toBe(once);
  });

  it("за щойно засвоєну формулу дає кристали один раз", () => {
    let almost = { correct: 0, total: 0, recent: [] as boolean[], days: [] as string[] };
    for (let i = 0; i < 90; i++) almost = recordUse(almost, true, i % 2 ? "2026-11-09" : "2026-11-10");
    const before: SaveData = {
      ...emptySave(),
      skills: { "five:+4": { physical: almost, mental: { correct: 0, total: 0, recent: [], days: [] } } },
    };
    const session = play(["clean", "clean", "clean", "clean", "clean"]);
    const after = creditSession(before, credit(session, "s1", new Date(2026, 10, 11, 18)));
    expect(after.history[0]!.bonuses).toContain("mastery");
    expect(after.inventory.crystal).toBe(1 + 5);
    const again = creditSession(after, credit(session, "s2", new Date(2026, 10, 11, 19)));
    expect(again.history[1]!.bonuses).not.toContain("mastery");
  });
});

describe("тижнева ціль", () => {
  it("тиждень починається з понеділка", () => {
    expect(weekId(new Date(2026, 10, 11))).toBe("2026-11-09");
    expect(weekId(new Date(2026, 10, 15, 23))).toBe("2026-11-09");
    expect(weekId(new Date(2026, 10, 16))).toBe("2026-11-16");
  });

  it("четвертий день із заняттями дає кристали один раз; пропуски нічого не забирають", () => {
    const session = play(["hint"]);
    let save = emptySave();
    // пн, ср (пропуск вівторка), чт — ще не ціль
    [9, 11, 12].forEach((date) => {
      save = creditSession(save, credit(session, `d${date}`, new Date(2026, 10, date, 18)));
    });
    expect(weekActiveDays(save.history, new Date(2026, 10, 12))).toBe(3);
    expect(save.inventory.crystal).toBe(0);
    save = creditSession(save, credit(session, "d14", new Date(2026, 10, 14, 18)));
    expect(save.history[3]!.bonuses).toEqual(["week"]);
    expect(save.inventory.crystal).toBe(5);
    save = creditSession(save, credit(session, "d15", new Date(2026, 10, 15, 18)));
    expect(save.inventory.crystal).toBe(5);
    expect(save.weekGoalsPaid).toEqual(["2026-11-09"]);
  });
});

describe("острів", () => {
  const start = () => ({ inventory: { ...starterInventory(), stone: 1 }, island: emptyIsland() });

  it("ставить блок і зменшує запас", () => {
    const build = placeBlock(start(), 5, "grass");
    expect(build.island[5]).toBe("grass");
    expect(build.inventory.grass).toBe(11);
    expect(placedCount(build.island)).toBe(1);
  });

  it("не ставить блок, якого немає, і не виходить за межі", () => {
    const build = start();
    expect(placeBlock(build, 0, "ice")).toBe(build);
    expect(placeBlock(build, ISLAND_COLS * ISLAND_ROWS, "grass")).toBe(build);
    expect(placeBlock(build, -1, "grass")).toBe(build);
  });

  it("заміна повертає попередній блок, а кирка забирає блок назад", () => {
    let build = placeBlock(start(), 0, "grass");
    build = placeBlock(build, 0, "stone");
    expect(build.island[0]).toBe("stone");
    expect(build.inventory).toMatchObject({ grass: 12, stone: 0 });
    build = removeBlock(build, 0);
    expect(build.island[0]).toBeNull();
    expect(build.inventory.stone).toBe(1);
    expect(removeBlock(build, 0)).toBe(build);
  });

  it("загальна кількість блоків не змінюється від будівництва", () => {
    const total = (b: ReturnType<typeof start>) =>
      Object.values(b.inventory).reduce((sum, n) => sum + n, 0) + placedCount(b.island);
    let build = start();
    const before = total(build);
    for (let i = 0; i < 30; i++) build = i % 3 === 2 ? removeBlock(build, i % 7) : placeBlock(build, i % 7, i % 2 ? "grass" : "stone");
    expect(total(build)).toBe(before);
  });
});

describe("ділянки", () => {
  const world = (): World => ({ inventory: { ...starterInventory() }, plots: [emptyPlot("island")] });

  it("додає ділянки до межі", () => {
    let w = addPlot(world(), "house");
    expect(w.plots.map((plot) => plot.kind)).toEqual(["island", "house"]);
    expect(w.plots[1]!.cells).toHaveLength(PLOT_SIZE.house.cols * PLOT_SIZE.house.rows);
    for (let i = 0; i < 20; i++) w = addPlot(w, "island");
    expect(w.plots).toHaveLength(MAX_PLOTS);
  });

  it("будує на вибраній ділянці, а розібрана ділянка повертає блоки", () => {
    let w = addPlot(world(), "house");
    w = editPlot(w, 1, (build) => placeBlock(build, 0, "grass"));
    w = editPlot(w, 1, (build) => placeBlock(build, 1, "grass"));
    expect(w.plots[1]!.cells.slice(0, 2)).toEqual(["grass", "grass"]);
    expect(w.plots[0]!.cells.every((cell) => cell === null)).toBe(true);
    expect(w.inventory.grass).toBe(10);
    const unchanged = editPlot(w, 1, (build) => placeBlock(build, 0, "ice"));
    expect(unchanged).toBe(w);
    w = demolishPlot(w, 1);
    expect(w.plots).toHaveLength(1);
    expect(w.inventory.grass).toBe(12);
    expect(demolishPlot(w, 0)).toBe(w);
  });
});

describe("збереження блоків", () => {
  it("старе збереження без блоків отримує стартовий набір і порожній острів", () => {
    const { inventory, plots, weekGoalsPaid, ...old } = emptySave();
    void [inventory, plots, weekGoalsPaid];
    const parsed = parseSave(old)!;
    expect(parsed.inventory).toEqual(starterInventory());
    expect(parsed.plots).toEqual([emptyPlot("island")]);
    expect(parsed.weekGoalsPaid).toEqual([]);
  });

  it("старий острів стає першою ділянкою", () => {
    const { plots, ...rest } = emptySave();
    void plots;
    const island = emptyIsland();
    island[7] = "brick";
    const parsed = parseSave({ ...rest, island })!;
    expect(parsed.plots).toEqual([{ kind: "island", cells: island }]);
  });

  it("зіпсовані ділянки й невідомі блоки відкидаються", () => {
    const island = emptyIsland();
    island[3] = "stone";
    const cells = [...island.slice(0, 4), "lava", ...island.slice(5)];
    const dirty = {
      ...emptySave(),
      plots: [{ kind: "island", cells }, { kind: "castle", cells }, { kind: "house", cells: ["grass"] }],
      inventory: { grass: 2, lava: 9, stone: -1 },
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(dirty)))!;
    expect(parsed.plots.map((plot) => plot.kind)).toEqual(["island", "house"]);
    expect(parsed.plots[0]!.cells[3]).toBe("stone");
    expect(parsed.plots[0]!.cells[4]).toBeNull();
    expect(parsed.plots[1]).toEqual(emptyPlot("house"));
    expect(parsed.inventory).toEqual({ ...starterInventory(), grass: 2 });
  });
});
