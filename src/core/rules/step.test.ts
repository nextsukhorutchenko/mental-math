import { describe, expect, it } from "vitest";
import { applyMoves, fromNumber, toNumber } from "../soroban/abacus";
import { ALL_SKILLS, type Sign, type SkillId, describeSkill } from "./skills";
import { buildStep } from "./step";

function skills(before: number, operation: Sign, operand: number): SkillId[] {
  const step = buildStep(before, operation, operand);
  if (!step) throw new Error("крок неможливий");
  return step.requiredSkills;
}

describe("прийом залежить від положення кісточок", () => {
  it("+4 від різних чисел потребує різних прийомів", () => {
    expect(skills(0, "+", 4)).toEqual(["simple"]);
    expect(skills(1, "+", 4)).toEqual(["five:+4"]);
    expect(skills(5, "+", 4)).toEqual(["simple"]);
    expect(skills(7, "+", 4)).toEqual(["ten:+4", "simple"]);
  });

  it("розпізнає комбіновані формули", () => {
    expect(skills(5, "+", 6)).toEqual(["mix:+6", "simple"]);
    expect(skills(6, "+", 9)).toEqual(["ten:+9", "simple"]);
    expect(skills(11, "-", 6)).toEqual(["mix:-6", "simple"]);
    expect(skills(15, "-", 6)).toEqual(["ten:-6", "simple"]);
  });

  it("віднімання дзеркальне до додавання", () => {
    expect(skills(4, "-", 3)).toEqual(["simple"]);
    expect(skills(5, "-", 1)).toEqual(["five:-1"]);
    expect(skills(10, "-", 1)).toEqual(["ten:-1", "simple"]);
  });

  it("перенос і позика тягнуть прийоми на старших спицях", () => {
    expect(skills(49, "+", 1)).toEqual(["ten:+1", "five:+1"]);
    expect(skills(99, "+", 1)).toEqual(["ten:+1", "simple"]);
    expect(skills(50, "-", 1)).toEqual(["ten:-1", "five:-1"]);
    expect(skills(100, "-", 1)).toEqual(["ten:-1", "simple"]);
  });

  it("на одній спиці five:+n трапляється рівно в n положеннях", () => {
    for (let n = 1; n <= 4; n++) {
      const states = [];
      for (let digit = 0; digit <= 9; digit++) {
        if (skills(digit, "+", n).includes(`five:+${n}`)) states.push(digit);
      }
      expect(states).toHaveLength(n);
    }
  });
});

describe("рухи кісточок", () => {
  it("+4 від 1 — це п'ятірка вниз і одна нижня геть", () => {
    expect(buildStep(1, "+", 4)!.beadMoves).toEqual([
      { rod: 0, bead: "upper", direction: "on", count: 1 },
      { rod: 0, bead: "lower", direction: "off", count: 1 },
    ]);
  });

  it("+9 від 6 — зняти одну на одиницях і додати десяток", () => {
    expect(buildStep(6, "+", 9)!.beadMoves).toEqual([
      { rod: 0, bead: "lower", direction: "off", count: 1 },
      { rod: 1, bead: "lower", direction: "on", count: 1 },
    ]);
  });

  it("числова відповідь і рухи узгоджені для всіх кроків до 999", () => {
    const seen = new Set<SkillId>();
    for (let before = 0; before <= 999; before++) {
      for (let operand = 1; operand <= 99; operand++) {
        for (const operation of ["+", "-"] as const) {
          const step = buildStep(before, operation, operand);
          if (operation === "-" && operand > before) {
            expect(step).toBeNull();
            continue;
          }
          const expected = operation === "+" ? before + operand : before - operand;
          expect(step!.after).toBe(expected);
          // Рухи відтворюються незалежно: неможливий рух кине помилку.
          expect(toNumber(applyMoves(fromNumber(before), step!.beadMoves))).toBe(expected);
          step!.requiredSkills.forEach((skill) => seen.add(skill));
        }
      }
    }
    // Кожна з 35 позицій каталогу справді трапляється, і нічого зайвого немає.
    expect([...seen].sort()).toEqual([...ALL_SKILLS].sort());
  });

  it("не будує крок, що не вміщається на спицях або дає від'ємне число", () => {
    expect(buildStep(95, "+", 7, 2)).toBeNull();
    expect(buildStep(3, "-", 5)).toBeNull();
    expect(buildStep(3, "+", 0)).toBeNull();
  });
});

describe("опис формул", () => {
  it("показує розклад словами", () => {
    expect(describeSkill("five:+4")).toBe("+4 = +5 −1");
    expect(describeSkill("five:-3")).toBe("−3 = −5 +2");
    expect(describeSkill("ten:+9")).toBe("+9 = −1 +10");
    expect(describeSkill("ten:-7")).toBe("−7 = −10 +3");
    expect(describeSkill("mix:+6")).toBe("+6 = +1 −5 +10");
    expect(describeSkill("mix:-8")).toBe("−8 = −10 +5 −3");
  });
});
