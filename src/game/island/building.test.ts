import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../../storage/save";
import { emptyIsland, emptyPlot, isCell, makeCell, parseCell, starterInventory } from "../rewards/blocks";
import { taskLoot } from "../rewards/rewards";
import { placeBlock, removeBlock } from "./island";
import { claimQuests, questProgress } from "./quests";

const info = { mode: "physical" as const, actions: 3, accurate: false };

describe("форми деталей", () => {
  it("матеріал має будь-яку форму, предмети — лише свою", () => {
    expect(parseCell("wood/cone")).toEqual({ block: "wood", shape: "cone" });
    expect(parseCell("stone")).toEqual({ block: "stone", shape: "full" });
    expect(isCell("stairs/mirror")).toBe(true);
    expect(isCell("door/cone")).toBe(false);
    expect(isCell("wood/mirror")).toBe(false);
    expect(isCell("lava/tri")).toBe(false);
    expect(isCell("wood/tri/x")).toBe(false);
  });

  it("деталь коштує один блок, а зміна форми того самого матеріалу — безкоштовна", () => {
    let build = { inventory: { ...starterInventory(), wood: 1 }, island: emptyIsland() };
    build = placeBlock(build, 0, makeCell("wood", "tri"));
    expect(build.inventory.wood).toBe(0);
    build = placeBlock(build, 0, makeCell("wood", "cyl"));
    expect(build.island[0]).toBe("wood/cyl");
    expect(build.inventory.wood).toBe(0);
    expect(placeBlock(build, 1, "wood")).toBe(build);
    build = placeBlock(build, 0, "grass/circle");
    expect(build.inventory).toMatchObject({ wood: 1, grass: 11 });
    build = removeBlock(build, 0);
    expect(build.inventory.grass).toBe(12);
  });

  it("збереження приймає форми й відкидає невідомі", () => {
    const cells = emptyIsland();
    cells[0] = "brick/slope-l";
    cells[1] = "door/tri";
    const parsed = parseSave({ ...emptySave(), plots: [{ kind: "detail", cells: emptyPlot("detail").cells }, { kind: "island", cells }] })!;
    expect(parsed.plots[0]!.kind).toBe("detail");
    expect(parsed.plots[1]!.cells.slice(0, 2)).toEqual(["brick/slope-l", null]);
  });
});

describe("предмети за тренування", () => {
  it("кожен вид тренування дає свій предмет", () => {
    expect(taskLoot({ ...info, mode: "mental" }, 10, false)).toEqual({ window: 1 });
    expect(taskLoot({ ...info, pacing: "voice" }, 10, false)).toEqual({ door: 1 });
    expect(taskLoot({ ...info, pacing: "auto" }, 10, false)).toEqual({ lamp: 1 });
    expect(taskLoot({ ...info, levelKind: "multiply", actions: 6 }, 10, false)).toEqual({ stairs: 2 });
    expect(taskLoot({ ...info, actions: 5 }, 10, false)).toEqual({ solar: 1 });
    expect(taskLoot({ ...info, accurate: true }, 10, false)).toEqual({ flower: 2 });
  });

  it("за коротке чи перерване заняття предметів немає", () => {
    expect(taskLoot({ ...info, mode: "mental" }, 4, false)).toEqual({});
    expect(taskLoot({ ...info, mode: "mental" }, 10, true)).toEqual({});
  });
});

describe("завдання будівельника", () => {
  it("рахує прогрес і видає приз один раз", () => {
    const cells = emptyIsland();
    cells[0] = "door";
    cells[1] = "wood/tri";
    cells[2] = "wood/slope-r";
    const data = { plots: [{ kind: "house" as const, cells }], inventory: starterInventory(), questsDone: [] as string[] };
    expect(questProgress(data.plots)).toMatchObject({ door: 1, roof: 2 });
    const claimed = claimQuests(data);
    expect(claimed.questsDone).toEqual(["door"]);
    expect(claimed.inventory.window).toBe(2);
    expect(claimQuests(claimed)).toBe(claimed);
  });
});
