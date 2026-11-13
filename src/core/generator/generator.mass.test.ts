import { describe, expect, it } from "vitest";
import { LEVELS, type Level } from "../../game/curriculum/levels";
import { DEFAULT_SETUP, type LessonSetup, SETUP_LIMITS, toDrillConfig } from "../../game/session/setup";
import { ALL_SKILLS, type SkillId } from "../rules/skills";
import { applyMoves, fromNumber, toNumber } from "../soroban/abacus";
import { type Drill, type DrillConfig, type Example, GeneratorError, answerOnBeads, generateDrill } from "./generator";

/**
 * Масова перевірка генератора: тисячі прикладів на кожен рівень карти й на налаштування тренажера.
 * Шукаємо те, що дитина побачила б як «застосунок помилився»: хибну відповідь, мінус, число поза межами,
 * прийом, якого ще не вчили, ділення з остачею.
 */

/** Програма дає ланцюжкам від 3 до 5 дій; тренажер — до 15. */
const ACTIONS = [3, 4, 5, 6, 10, SETUP_LIMITS.actions.max];
const EXAMPLES_PER_DRILL = 60;
const SEEDS_PER_ACTIONS = 15;
/**
 * Три- й чотирицифрові ланцюжки складаються в сотні разів довше за решту (до 1800 можливих кроків від кожного числа),
 * тому у звичайному прогоні їх менше. Повний обсяг (близько трьох хвилин): npm run test:full
 */
const FULL = import.meta.env.MODE === "full" || process.env.MASS_FULL === "1";
const HEAVY_LEVELS = new Set(["digits:3", "digits:4"]);
const seedsFor = (level: Level) => (HEAVY_LEVELS.has(level.id) && !FULL ? 1 : SEEDS_PER_ACTIONS);
const LONG = 600_000;

/** Незалежна від генератора перевірка одного прикладу. Повертає опис першої знайденої вади. */
function chainProblem(example: Example, config: DrillConfig): string | null {
  const allowed = new Set<SkillId>(config.allowedSkills);
  const maxValue = config.maxValue ?? 10 ** (config.digits + 1) - 1;
  const operandMin = config.digits === 1 ? 1 : 10 ** (config.digits - 1);
  const operandMax = Math.min(config.operandMax ?? Infinity, 10 ** config.digits - 1);
  const rods = String(maxValue).length + 1;
  let value = 0;
  for (const [index, step] of example.steps.entries()) {
    if (step.before !== value) return `крок ${index} починається з ${step.before}, а на абакусі ${value}`;
    if (index === 0 && step.operation !== "+") return "перше число не набирається додаванням";
    if (config.operations !== "mixed" && index > 0 && step.operation !== config.operations) return `знак ${step.operation} не дозволено`;
    if (step.operand < operandMin || step.operand > operandMax) return `число ${step.operand} поза межами ${operandMin}–${operandMax}`;
    value = step.operation === "+" ? value + step.operand : value - step.operand;
    if (step.after !== value) return `після кроку ${index} записано ${step.after}, а має бути ${value}`;
    if (value < 0) return `проміжний результат ${value} від'ємний`;
    if (value > maxValue) return `проміжний результат ${value} більший за ${maxValue}`;
    for (const skill of step.requiredSkills) if (!allowed.has(skill)) return `прийом ${skill} не дозволено`;
    // Рухи кісточок справді дають те саме число на моделі абакуса.
    const moved = toNumber(applyMoves(fromNumber(step.before, rods), step.beadMoves));
    if (moved !== step.after) return `рухи кісточок дають ${moved}, а не ${step.after}`;
  }
  if (example.answer !== value) return `відповідь ${example.answer}, а ланцюжок дає ${value}`;
  if (!answerOnBeads(example)) return "відповідь не лишається на кісточках";
  return null;
}

function multiplyProblem(example: Example, config: DrillConfig): string | null {
  const match = /^(\d+) × (\d+)$/.exec(example.prompt ?? "");
  if (!match) return `незрозумілий запис «${example.prompt}»`;
  const [a, b] = [Number(match[1]), Number(match[2])];
  const { aDigits, bMin, bMax } = config.factors!;
  if (String(a).length !== aDigits) return `перший множник ${a} не має ${aDigits} цифр`;
  if (a < 2) return `перший множник ${a} замалий`;
  if (b < bMin || b > bMax) return `другий множник ${b} поза межами ${bMin}–${bMax}`;
  if (example.answer !== a * b) return `${a} × ${b} = ${a * b}, а записано ${example.answer}`;
  let value = 0;
  for (const step of example.steps) {
    if (step.operation !== "+" || step.before !== value) return "кроки множення не є послідовними додаваннями";
    value += step.operand;
    if (step.after !== value) return "крок множення записано з помилкою";
  }
  if (value !== example.answer) return `часткові добутки дають ${value}, а не ${example.answer}`;
  if (example.labels?.length !== example.steps.length) return "підписів не стільки ж, скільки кроків";
  return null;
}

function divideProblem(example: Example, config: DrillConfig): string | null {
  const match = /^(\d+) : (\d+)$/.exec(example.prompt ?? "");
  if (!match) return `незрозумілий запис «${example.prompt}»`;
  const [dividend, divisor] = [Number(match[1]), Number(match[2])];
  const { digits, divisorMin, divisorMax } = config.quotient!;
  if (divisor === 0) return "ділення на нуль";
  if (divisor < divisorMin || divisor > divisorMax) return `дільник ${divisor} поза межами ${divisorMin}–${divisorMax}`;
  if (dividend % divisor !== 0) return `${dividend} : ${divisor} ділиться з остачею`;
  if (example.answer !== dividend / divisor) return `${dividend} : ${divisor} = ${dividend / divisor}, а записано ${example.answer}`;
  if (String(example.answer).length !== digits) return `частка ${example.answer} не має ${digits} цифр`;
  if (example.answer < 2) return `частка ${example.answer} замала`;
  const [first, ...rest] = example.steps;
  if (!first || first.operation !== "+" || first.operand !== dividend) return "ділене не набрано першим кроком";
  let value = dividend;
  for (const step of rest) {
    if (step.operation !== "-" || step.before !== value) return "кроки ділення не є послідовними відніманнями";
    value -= step.operand;
    if (value < 0 || step.after !== value) return "крок ділення записано з помилкою";
  }
  if (value !== 0) return `після ділення на абакусі лишилося ${value}`;
  if (example.labels?.length !== example.steps.length) return "підписів не стільки ж, скільки кроків";
  return null;
}

function problemOf(example: Example, config: DrillConfig): string | null {
  if (config.kind === "multiply") return multiplyProblem(example, config);
  if (config.kind === "divide") return divideProblem(example, config);
  return chainProblem(example, config);
}

/** Усі вади набору: кожен приклад окремо плюс те, що видно лише на наборі загалом. */
function drillProblems(drill: Drill): string[] {
  const { config } = drill;
  const found: string[] = [];
  if (drill.examples.length !== config.exampleCount) found.push(`прикладів ${drill.examples.length}, а просили ${config.exampleCount}`);
  drill.examples.forEach((example, index) => {
    const problem = problemOf(example, config);
    if (problem) found.push(`приклад ${index}: ${problem}`);
    if (!config.kind || config.kind === "chain") {
      if (example.steps.length !== config.actionsPerExample) found.push(`приклад ${index}: дій ${example.steps.length}, а просили ${config.actionsPerExample}`);
    } else if (example.prompt === drill.examples[index - 1]?.prompt) {
      found.push(`приклад ${index}: «${example.prompt}» двічі поспіль`);
    }
  });
  return found;
}

function levelConfig(level: Level, actions: number, seed: number): DrillConfig {
  return { ...level.drill, exampleCount: EXAMPLES_PER_DRILL, actionsPerExample: actions, seed };
}

describe("масова перевірка генератора на рівнях карти", () => {
  for (const level of LEVELS) {
    const total = ACTIONS.length * seedsFor(level) * EXAMPLES_PER_DRILL;
    it(`${level.id}: ${total} прикладів без жодної вади`, { timeout: LONG }, () => {
      let checked = 0;
      for (const actions of ACTIONS) {
        for (let seed = 1; seed <= seedsFor(level); seed++) {
          const drill = generateDrill(levelConfig(level, actions, seed * 7919 + actions));
          expect(drillProblems(drill), `${level.id}, дій ${actions}, seed ${drill.seed}`).toEqual([]);
          checked += drill.examples.length;
        }
      }
      expect(checked).toBe(total);
    });
  }

  it("з двома діями відмовляють лише прийоми з позикою десятка: одноцифрове число ще не має десятка", () => {
    for (const level of LEVELS.filter((item) => item.kind === "formula" || item.kind === "chain")) {
      const needsTen = /^(ten|mix):-/.test(level.id);
      const build = () => generateDrill(levelConfig(level, 2, 9));
      if (needsTen) expect(build, level.id).toThrow(GeneratorError);
      else expect(drillProblems(build()), level.id).toEqual([]);
    }
  });

  it("рівень-формула дає свій прийом у кожному прикладі", () => {
    for (const level of LEVELS.filter((item) => item.kind === "formula" && item.skill !== "simple")) {
      for (const actions of [3, 4, 10]) {
        const drill = generateDrill(levelConfig(level, actions, 31));
        for (const example of drill.examples) {
          expect(
            example.steps.some((step) => step.requiredSkills.includes(level.skill!)),
            `${level.id}, дій ${actions}`,
          ).toBe(true);
        }
      }
    }
  });

  it("рівень «з п'ятіркою» дає число від 5 у кожному прикладі", () => {
    const level = LEVELS.find((item) => item.id === "simple:five")!;
    for (const example of generateDrill(levelConfig(level, 4, 5)).examples) {
      expect(example.steps.some((step) => step.operand >= 5)).toBe(true);
    }
  });

  it("найважчий набір (100 чотирицифрових прикладів по 15 дій) складається за лічені секунди", { timeout: LONG }, () => {
    const level = LEVELS.find((item) => item.id === "digits:4")!;
    const started = performance.now();
    const drill = generateDrill({
      ...level.drill,
      exampleCount: SETUP_LIMITS.examples.max,
      actionsPerExample: SETUP_LIMITS.actions.max,
      seed: 1,
    });
    expect(drillProblems(drill)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(10_000);
  });

  it("звичайне заняття з 10 прикладів майже не повторює той самий приклад", { timeout: LONG }, () => {
    // Де чисел мало (лише 1–4, до 4), повтори неминучі; на решті рівнів їх має бути не більше одного.
    for (const level of LEVELS.filter((item) => item.id !== "simple:low")) {
      for (let seed = 1; seed <= (HEAVY_LEVELS.has(level.id) ? 3 : 20); seed++) {
        const drill = generateDrill({ ...level.drill, exampleCount: 10, actionsPerExample: 4, seed });
        const texts = drill.examples.map((example) => example.prompt ?? example.steps.map((step) => `${step.operation}${step.operand}`).join(""));
        expect(texts.length - new Set(texts).size, `${level.id}, seed ${seed}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("масова перевірка тренажера: будь-який вибір батьків", () => {
  const topics: SkillId[] = ALL_SKILLS;
  const operations: LessonSetup["operations"][] = ["mixed", "+", "-"];
  const digits: LessonSetup["digits"][] = [1, 2, 3];
  const HEAVY_TOPICS: SkillId[] = ["simple", "five:+4", "five:-1", "ten:+9", "ten:-3", "mix:+6", "mix:-9"];

  it("кожна тема з кожною розрядністю і знаками або дає правильні приклади, або зрозумілу відмову", { timeout: LONG }, () => {
    const refused: string[] = [];
    let checked = 0;
    for (const topic of topics) {
      for (const digit of digits) {
        // Трицифрові числа складаються найдовше: для них беремо по одній темі з кожної родини й знака.
        if (digit === 3 && !HEAVY_TOPICS.includes(topic)) continue;
        for (const operation of operations) {
          for (const actions of digit === 3 ? [4] : [SETUP_LIMITS.actions.min, 4, SETUP_LIMITS.actions.max]) {
            const setup: LessonSetup = { ...DEFAULT_SETUP, topic, digits: digit, operations: operation, actionsPerExample: actions, exampleCount: 8 };
            const label = `${topic}, цифр ${digit}, знаки ${operation}, дій ${actions}`;
            try {
              const drill = generateDrill({ ...toDrillConfig(setup), seed: 17 });
              expect(drillProblems(drill), label).toEqual([]);
              checked += drill.examples.length;
            } catch (problem) {
              // Будь-яка інша помилка — це збій застосунку, а не відмова генератора.
              expect(problem, label).toBeInstanceOf(GeneratorError);
              refused.push(label);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
    // Зі змішаними знаками й типовою кількістю дій генератор не має права відмовляти.
    expect(refused.filter((label) => label.includes("знаки mixed") && label.includes("дій 4"))).toEqual([]);
  });

  it("прийом на віднімання з «лише додаванням» (і навпаки) відхиляється миттєво, а не після зависання", () => {
    // Раніше така комбінація на трицифрових числах думала понад 5 секунд і займала понад 2 ГБ пам'яті.
    const cases: [SkillId, LessonSetup["operations"]][] = [
      ["ten:-3", "+"],
      ["mix:-9", "+"],
      ["five:-1", "+"],
      ["ten:+9", "-"],
      ["five:+4", "-"],
    ];
    for (const [topic, operation] of cases) {
      const setup: LessonSetup = { ...DEFAULT_SETUP, topic, digits: 3, operations: operation, actionsPerExample: 15, exampleCount: 100 };
      const started = performance.now();
      expect(() => generateDrill({ ...toDrillConfig(setup), seed: 1 })).toThrow(GeneratorError);
      expect(performance.now() - started, `${topic} зі знаком ${operation}`).toBeLessThan(50);
    }
  });

  it("повторення зі змішаними прийомами не відхиляється через знак, якщо хоч один прийом підходить", () => {
    const setup: LessonSetup = { ...DEFAULT_SETUP, review: ["five:+4", "five:-1"], operations: "+", exampleCount: 5 };
    const drill = generateDrill({ ...toDrillConfig(setup), seed: 4 });
    expect(drillProblems(drill)).toEqual([]);
  });

  it("нездійсненні важкі налаштування не з'їдають пам'ять", { timeout: LONG }, () => {
    // 15 додавань трицифрових чисел самими прямими рухами неможливі: генератор перебирає тисячі положень.
    const before = process.memoryUsage().heapUsed;
    for (let seed = 1; seed <= 4; seed++) {
      const setup: LessonSetup = { ...DEFAULT_SETUP, topic: "simple", digits: 3, operations: "+", actionsPerExample: 15 };
      expect(() => generateDrill({ ...toDrillConfig(setup), seed })).toThrow(GeneratorError);
    }
    expect((process.memoryUsage().heapUsed - before) / 1e6).toBeLessThan(600);
  });

  it("повторення кількох прийомів дає лише дозволене й рівно стільки прикладів, скільки просили", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const review = ALL_SKILLS.filter((skill, index) => skill !== "simple" && (index * 7 + seed) % 5 === 0);
      const setup: LessonSetup = { ...DEFAULT_SETUP, review, exampleCount: 20, actionsPerExample: 5 };
      const drill = generateDrill({ ...toDrillConfig(setup), seed });
      expect(drillProblems(drill), `seed ${seed}`).toEqual([]);
    }
  });

  it("крайні значення налаштувань: 1 приклад і 100 прикладів", () => {
    for (const exampleCount of [SETUP_LIMITS.examples.min, SETUP_LIMITS.examples.max]) {
      const drill = generateDrill({ ...toDrillConfig({ ...DEFAULT_SETUP, exampleCount }), seed: 3 });
      expect(drillProblems(drill)).toEqual([]);
    }
  });
});
