import { describe, expect, it } from "vitest";
import { toNumber } from "../soroban/abacus";
import { buildDemoFrames, describeMove, introSteps, rodsFor } from "./demo";
import { ALL_SKILLS } from "./skills";
import { buildStep } from "./step";

describe("демонстрація рухів", () => {
  it("описує рухи словами", () => {
    expect(describeMove({ rod: 0, bead: "upper", direction: "on", count: 1 })).toBe(
      "Присунь верхню кісточку на одиницях (+5)",
    );
    expect(describeMove({ rod: 1, bead: "lower", direction: "off", count: 3 })).toBe(
      "Відсунь 3 нижні кісточки на десятках (−30)",
    );
    expect(describeMove({ rod: 0, bead: "lower", direction: "on", count: 1 })).toBe(
      "Присунь 1 нижню кісточку на одиницях (+1)",
    );
  });

  it("кадри ведуть від початку до відповіді й позначають кінець кожної дії", () => {
    const steps = [buildStep(0, "+", 1)!, buildStep(1, "+", 4)!, buildStep(5, "+", 9)!];
    const frames = buildDemoFrames(steps);
    expect(toNumber(frames[0]!.abacus)).toBe(0);
    expect(toNumber(frames[frames.length - 1]!.abacus)).toBe(14);
    const ends = frames.filter((frame) => frame.stepIndex >= 0 && frame.stepDone);
    expect(ends.map((frame) => toNumber(frame.abacus))).toEqual([1, 5, 14]);
    expect(frames).toHaveLength(1 + steps.reduce((sum, step) => sum + step.beadMoves.length, 0));
  });

  it("підбирає кількість спиць під найбільше число", () => {
    expect(rodsFor([buildStep(0, "+", 7)!])).toBe(2);
    expect(rodsFor([buildStep(95, "+", 7)!])).toBe(3);
  });

  it("має вступний приклад для кожного прийому", () => {
    for (const skill of ALL_SKILLS) {
      const steps = introSteps(skill);
      expect(steps.some((step) => step.requiredSkills.includes(skill))).toBe(true);
      expect(buildDemoFrames(steps).length).toBeGreaterThan(1);
    }
  });
});
