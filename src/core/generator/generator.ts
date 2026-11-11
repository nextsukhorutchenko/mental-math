import { type Sign, type SkillId } from "../rules/skills";
import { type Step, buildStep } from "../rules/step";
import { type Random, createRandom, pick, sample } from "./random";

/** Налаштування тренування: і для рівнів програми, і для вільного тренажера. */
export interface DrillConfig {
  /** Прийоми, якими дозволено користуватися (зазвичай включає "simple"). */
  allowedSkills: SkillId[];
  /** Прийоми, які зараз відпрацьовуємо. Порожньо — просто мікс дозволеного. */
  focusSkills?: SkillId[];
  /** Бажана частка дій із цільовим прийомом серед дій після першого числа (0–1). */
  focusShare?: number;
  /** Кількість прикладів. */
  exampleCount: number;
  /** Кількість дій у прикладі, тобто чисел у ланцюжку; перше число набирається з нуля. */
  actionsPerExample: number;
  /** Розрядність чисел у прикладі. */
  digits: 1 | 2 | 3;
  /** Знаки дій після першого числа. */
  operations: Sign | "mixed";
  /** Найбільший дозволений проміжний результат. За замовчуванням на розряд більше за числа. */
  maxValue?: number;
  /** Seed для повторюваності набору. */
  seed?: number;
}

export interface Example {
  steps: Step[];
  answer: number;
}

export interface Drill {
  config: DrillConfig;
  seed: number;
  examples: Example[];
}

export class GeneratorError extends Error {}

const MAX_ATTEMPTS_PER_EXAMPLE = 400;
const LOOKAHEAD_SAMPLE = 40;

interface Context {
  allowed: Set<SkillId>;
  focus: Set<SkillId>;
  focusShare: number;
  operandMin: number;
  operandMax: number;
  maxValue: number;
  rodCount: number;
  signs: Sign[];
  random: Random;
  /** Кеш: можливі кроки від числа не залежать від історії прикладу. */
  stepCache: Map<number, Step[]>;
  focusCache: Map<number, boolean>;
}

function validate(config: DrillConfig): void {
  const { exampleCount, actionsPerExample, digits, focusShare } = config;
  if (!Number.isInteger(exampleCount) || exampleCount < 1) {
    throw new GeneratorError("Кількість прикладів має бути цілим числом від 1");
  }
  if (!Number.isInteger(actionsPerExample) || actionsPerExample < 2) {
    throw new GeneratorError("У прикладі має бути щонайменше 2 дії");
  }
  if (![1, 2, 3].includes(digits)) {
    throw new GeneratorError("Розрядність чисел має бути 1, 2 або 3");
  }
  if (focusShare !== undefined && (focusShare < 0 || focusShare > 1)) {
    throw new GeneratorError("Частка цільового прийому має бути від 0 до 1");
  }
  const allowed = new Set(config.allowedSkills);
  for (const skill of config.focusSkills ?? []) {
    if (!allowed.has(skill)) {
      throw new GeneratorError(`Цільовий прийом ${skill} відсутній серед дозволених`);
    }
  }
}

function isFocus(step: Step, ctx: Context): boolean {
  return step.requiredSkills.some((skill) => ctx.focus.has(skill));
}

/** Усі кроки, які можна зробити від числа value, не виходячи за дозволені прийоми й межі. */
function candidates(value: number, signs: readonly Sign[], ctx: Context): Step[] {
  const result: Step[] = [];
  for (const sign of signs) {
    for (let operand = ctx.operandMin; operand <= ctx.operandMax; operand++) {
      const step = buildStep(value, sign, operand, ctx.rodCount);
      if (!step || step.after > ctx.maxValue) continue;
      if (step.requiredSkills.every((skill) => ctx.allowed.has(skill))) result.push(step);
    }
  }
  return result;
}

function nextSteps(value: number, ctx: Context): Step[] {
  let steps = ctx.stepCache.get(value);
  if (!steps) {
    steps = candidates(value, ctx.signs, ctx);
    ctx.stepCache.set(value, steps);
  }
  return steps;
}

function hasFocusCandidate(value: number, ctx: Context): boolean {
  let result = ctx.focusCache.get(value);
  if (result === undefined) {
    result = nextSteps(value, ctx).some((step) => isFocus(step, ctx));
    ctx.focusCache.set(value, result);
  }
  return result;
}

function chooseNext(previous: Step, ctx: Context): Step | null {
  let options = nextSteps(previous.after, ctx);
  // Не скасовуємо щойно зроблену дію (+4, а потім одразу −4), якщо є інший вибір.
  const notUndo = options.filter(
    (step) => !(step.operand === previous.operand && step.operation !== previous.operation),
  );
  if (notUndo.length > 0) options = notUndo;
  if (options.length === 0) return null;

  if (ctx.focus.size === 0 || ctx.random() >= ctx.focusShare) return pick(ctx.random, options);

  const focused = options.filter((step) => isFocus(step, ctx));
  if (focused.length > 0) return pick(ctx.random, focused);

  // Цільовий прийом звідси недоступний — готуємо для нього положення кісточок.
  const setups = sample(ctx.random, options, LOOKAHEAD_SAMPLE).filter((step) => hasFocusCandidate(step.after, ctx));
  return pick(ctx.random, setups.length > 0 ? setups : options);
}

function firstStep(ctx: Context): Step | null {
  let options = candidates(0, ["+"], ctx);
  if (ctx.signs.length === 1 && ctx.signs[0] === "-") {
    // Для прикладів лише на віднімання починаємо з більшого числа.
    const middle = (ctx.operandMin + ctx.operandMax) / 2;
    const upperHalf = options.filter((step) => step.operand >= middle);
    if (upperHalf.length > 0) options = upperHalf;
  }
  return options.length > 0 ? pick(ctx.random, options) : null;
}

function tryExample(actions: number, ctx: Context): Example | null {
  const first = firstStep(ctx);
  if (!first) return null;
  const steps: Step[] = [first];
  while (steps.length < actions) {
    const next = chooseNext(steps[steps.length - 1]!, ctx);
    if (!next) return null;
    steps.push(next);
  }
  if (ctx.focus.size > 0 && !steps.some((step) => isFocus(step, ctx))) return null;
  return { steps, answer: steps[steps.length - 1]!.after };
}

export function generateDrill(config: DrillConfig): Drill {
  validate(config);
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 32);
  const maxValue = config.maxValue ?? 10 ** (config.digits + 1) - 1;
  const ctx: Context = {
    allowed: new Set(config.allowedSkills),
    focus: new Set(config.focusSkills ?? []),
    focusShare: config.focusShare ?? 0.4,
    operandMin: config.digits === 1 ? 1 : 10 ** (config.digits - 1),
    operandMax: 10 ** config.digits - 1,
    maxValue,
    rodCount: String(maxValue).length + 1,
    signs: config.operations === "mixed" ? ["+", "-"] : [config.operations],
    random: createRandom(seed),
    stepCache: new Map(),
    focusCache: new Map(),
  };

  const examples: Example[] = [];
  for (let i = 0; i < config.exampleCount; i++) {
    let example: Example | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EXAMPLE && !example; attempt++) {
      example = tryExample(config.actionsPerExample, ctx);
    }
    if (!example) {
      throw new GeneratorError(
        "Не вдалося скласти приклад із такими налаштуваннями: спробуйте менше дій, інші знаки або більше дозволених прийомів",
      );
    }
    examples.push(example);
  }
  return { config, seed, examples };
}

/** Запис прикладу рядком: «3 + 4 − 2 = 5». */
export function formatExample(example: Example): string {
  const parts = example.steps.map((step, index) => {
    if (index === 0) return String(step.operand);
    return `${step.operation === "+" ? "+" : "−"} ${step.operand}`;
  });
  return `${parts.join(" ")} = ${example.answer}`;
}
