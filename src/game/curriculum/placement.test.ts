import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../../storage/save";
import { currentLevel, levelStates } from "./curriculum";
import { dailyPlan } from "./daily";
import { PLACEMENT, PLACEMENT_STAGES, placementStart, stageConfig, stageDrill, stagePassed } from "./placement";

describe("стартова перевірка", () => {
  it("має по етапу на кожен світ, від простого до складного", () => {
    expect(PLACEMENT_STAGES.map((stage) => stage.world.id)).toEqual(["forest", "caves", "desert", "snow"]);
    expect(PLACEMENT_STAGES.map((stage) => stage.start)).toEqual(["simple:low", "five:+1", "ten:+1", "mix:+6"]);
  });

  it("приклади етапу не виходять за його світ і тренують саме його прийоми", () => {
    for (const stage of PLACEMENT_STAGES) {
      const allowed = new Set(stageConfig(stage).allowedSkills);
      for (const seed of [1, 2, 3]) {
        const drill = stageDrill(stage, seed);
        expect(drill.examples).toHaveLength(PLACEMENT.examples);
        for (const example of drill.examples) {
          expect(example.steps).toHaveLength(PLACEMENT.actions);
          const used = example.steps.flatMap((step) => step.requiredSkills);
          expect(used.every((skill) => allowed.has(skill))).toBe(true);
          const own = stage.world.levels.flatMap((level) => (level.skill ? [level.skill] : []));
          expect(used.some((skill) => own.includes(skill))).toBe(true);
        }
      }
    }
  });

  it("етап пройдено від трьох правильних із чотирьох", () => {
    expect([2, 3, 4].map(stagePassed)).toEqual([false, true, true]);
  });

  it("починати треба з першого рівня непройденого світу", () => {
    expect([0, 1, 2, 3].map(placementStart)).toEqual(["simple:low", "five:+1", "ten:+1", "mix:+6"]);
    // усі формули знайомі — далі багатоцифрові числа
    expect(placementStart(4)).toBe("digits:2");
  });

  it("карта відкриває все до місця старту і вважає поточним саме його", () => {
    const states = levelStates({}, false, "ten:+1");
    const at = (id: string) => states.find((state) => state.id === id)!;
    expect(at("simple")).toMatchObject({ status: "open", skipped: true });
    expect(at("five:-4")).toMatchObject({ status: "open", skipped: true });
    expect(at("ten:+1")).toMatchObject({ status: "open", skipped: false });
    expect(at("ten:+2").status).toBe("locked");
    expect(currentLevel(states)).toBe("ten:+1");
    // Без перевірки все як раніше.
    expect(currentLevel(levelStates({}, false))).toBe("simple:low");
    expect(levelStates({}, false).every((state) => !state.skipped)).toBe(true);
  });

  it("план дня веде на рівень зі стартової перевірки, а вибір зберігається", () => {
    const save = { ...emptySave(), placement: "five:+1" as const };
    const level = dailyPlan(save, new Date(2026, 10, 11)).find((part) => part.id === "level")!;
    expect(level).toMatchObject({ lesson: { topic: "five:+1" } });
    expect(parseSave(JSON.parse(JSON.stringify(save)))!.placement).toBe("five:+1");
    expect(parseSave({ ...emptySave(), placement: "nonsense" })!.placement).toBeNull();
  });
});
