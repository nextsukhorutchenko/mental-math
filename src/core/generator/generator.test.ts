import { describe, expect, it } from "vitest";
import { ALL_SKILLS, FIVE_SKILLS, SIMPLE, type SkillId } from "../rules/skills";
import { type DrillConfig, GeneratorError, formatExample, generateDrill } from "./generator";

const fiveFour: DrillConfig = {
  allowedSkills: [SIMPLE, "five:+4"],
  focusSkills: ["five:+4"],
  exampleCount: 40,
  actionsPerExample: 5,
  digits: 1,
  operations: "mixed",
  seed: 7,
};

function focusShare(config: DrillConfig): number {
  const focus = new Set<SkillId>(config.focusSkills);
  const later = generateDrill(config).examples.flatMap((example) => example.steps.slice(1));
  return later.filter((step) => step.requiredSkills.some((skill) => focus.has(skill))).length / later.length;
}

describe("генератор прикладів", () => {
  it("видає задану кількість прикладів і дій", () => {
    const drill = generateDrill(fiveFour);
    expect(drill.examples).toHaveLength(40);
    for (const example of drill.examples) {
      expect(example.steps).toHaveLength(5);
    }
  });

  it("кожен крок продовжує попередній, а відповідь — це останній результат", () => {
    for (const example of generateDrill(fiveFour).examples) {
      let value = 0;
      for (const step of example.steps) {
        expect(step.before).toBe(value);
        value = step.operation === "+" ? value + step.operand : value - step.operand;
        expect(step.after).toBe(value);
      }
      expect(example.answer).toBe(value);
    }
  });

  it("використовує лише дозволені прийоми", () => {
    const allowed = new Set(fiveFour.allowedSkills);
    for (const example of generateDrill(fiveFour).examples) {
      for (const step of example.steps) {
        for (const skill of step.requiredSkills) expect(allowed.has(skill)).toBe(true);
      }
    }
  });

  it("цільовий прийом є в кожному прикладі і займає помітну частку дій", () => {
    for (const example of generateDrill(fiveFour).examples) {
      expect(example.steps.some((step) => step.requiredSkills.includes("five:+4"))).toBe(true);
    }
    expect(focusShare(fiveFour)).toBeGreaterThanOrEqual(0.3);
  });

  it("той самий seed дає той самий набір, інший — інший", () => {
    const text = (seed: number) => generateDrill({ ...fiveFour, seed }).examples.map(formatExample).join("\n");
    expect(text(7)).toBe(text(7));
    expect(text(7)).not.toBe(text(8));
  });

  it("тримає проміжні результати в межах і не йде в мінус", () => {
    const drill = generateDrill({
      allowedSkills: ALL_SKILLS,
      exampleCount: 30,
      actionsPerExample: 8,
      digits: 2,
      operations: "mixed",
      maxValue: 150,
      seed: 3,
    });
    for (const example of drill.examples) {
      for (const step of example.steps) {
        expect(step.after).toBeGreaterThanOrEqual(0);
        expect(step.after).toBeLessThanOrEqual(150);
        expect(step.operand).toBeGreaterThanOrEqual(10);
        expect(step.operand).toBeLessThanOrEqual(99);
      }
    }
  });

  it("складає приклади лише на додавання і лише на віднімання", () => {
    const base = { allowedSkills: ALL_SKILLS, exampleCount: 20, actionsPerExample: 4, digits: 2, seed: 5 } as const;
    for (const example of generateDrill({ ...base, operations: "+" }).examples) {
      expect(example.steps.every((step) => step.operation === "+")).toBe(true);
    }
    for (const example of generateDrill({ ...base, operations: "-" }).examples) {
      expect(example.steps.slice(1).every((step) => step.operation === "-")).toBe(true);
    }
  });

  it("працює для кожної формули як цільової", () => {
    for (const skill of ALL_SKILLS.filter((id) => id !== SIMPLE)) {
      const drill = generateDrill({
        allowedSkills: ALL_SKILLS,
        focusSkills: [skill],
        exampleCount: 10,
        actionsPerExample: 5,
        digits: 1,
        operations: "mixed",
        seed: 11,
      });
      for (const example of drill.examples) {
        expect(example.steps.some((step) => step.requiredSkills.includes(skill))).toBe(true);
      }
    }
  });

  it("справляється з трицифровими числами", () => {
    const drill = generateDrill({
      allowedSkills: [SIMPLE, ...FIVE_SKILLS],
      focusSkills: FIVE_SKILLS,
      exampleCount: 5,
      actionsPerExample: 6,
      digits: 3,
      operations: "mixed",
      seed: 2,
    });
    expect(drill.examples).toHaveLength(5);
  });

  it("зрозуміло відмовляє, коли налаштування нездійсненні", () => {
    expect(() => generateDrill({ ...fiveFour, focusSkills: ["ten:+9"] })).toThrow(GeneratorError);
    expect(() => generateDrill({ ...fiveFour, exampleCount: 0 })).toThrow(GeneratorError);
    expect(() => generateDrill({ ...fiveFour, actionsPerExample: 1 })).toThrow(GeneratorError);
    // Дев'ять віднімань поспіль від одноцифрового числа без позики неможливі.
    expect(() =>
      generateDrill({ ...fiveFour, focusSkills: [], operations: "-", actionsPerExample: 12 }),
    ).toThrow(GeneratorError);
  });

  it("записує приклад рядком", () => {
    const [example] = generateDrill({ ...fiveFour, exampleCount: 1 }).examples;
    expect(formatExample(example!)).toMatch(/^\d( [+−] \d){4} = \d+$/);
  });
});
