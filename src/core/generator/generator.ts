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
  digits: 1 | 2 | 3 | 4;
  /** Вид вправи: ланцюжок додавань і віднімань (типово), множення або ділення. */
  kind?: "chain" | "multiply" | "divide";
  /** Найбільше число в ланцюжку, якщо треба менше, ніж дозволяє розрядність (наприклад, лише 1–4). */
  operandMax?: number;
  /** Дії з числом від цього значення вважаються цільовими (наприклад, від 5 — рухи з п'ятіркою). */
  focusOperandMin?: number;
  /** Множення: розрядність першого множника й межі другого. */
  factors?: { aDigits: number; bMin: number; bMax: number };
  /** Ділення без остачі: розрядність частки й межі дільника. */
  quotient?: { digits: number; divisorMin: number; divisorMax: number };
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
  /** Запис завдання для множення й ділення («47 × 6»); у ланцюжків його немає. */
  prompt?: string;
  /** Підписи до кроків у демонстрації (часткові добутки, цифри частки). */
  labels?: string[];
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
  focusOperandMin: number;
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
  reachCache: Map<string, boolean>;
  /** Скільки разів кожен цільовий прийом уже трапився в наборі — щоб ділити дії між ними порівну. */
  focusUses: Map<SkillId, number>;
  /** Чи є взагалі цільові дії (прийоми або великі числа). */
  hasFocus: boolean;
}

function validate(config: DrillConfig): void {
  const { exampleCount, actionsPerExample, digits, focusShare } = config;
  if (!Number.isInteger(exampleCount) || exampleCount < 1) {
    throw new GeneratorError("Кількість прикладів має бути цілим числом від 1");
  }
  if (!Number.isInteger(actionsPerExample) || actionsPerExample < 2) {
    throw new GeneratorError("У прикладі має бути щонайменше 2 дії");
  }
  if (![1, 2, 3, 4].includes(digits)) {
    throw new GeneratorError("Розрядність чисел має бути від 1 до 4");
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
  return step.operand >= ctx.focusOperandMin || step.requiredSkills.some((skill) => ctx.focus.has(skill));
}

/** Скільки чисел перебирати від одного положення: для 4 цифр усі 9000 перебирати задовго. */
const OPERAND_SAMPLE = 300;

/** Усі кроки, які можна зробити від числа value, не виходячи за дозволені прийоми й межі. */
function candidates(value: number, signs: readonly Sign[], ctx: Context): Step[] {
  const result: Step[] = [];
  const range = ctx.operandMax - ctx.operandMin + 1;
  const operands =
    range > 1000
      ? Array.from({ length: OPERAND_SAMPLE }, () => ctx.operandMin + Math.floor(ctx.random() * range))
      : Array.from({ length: range }, (_, index) => ctx.operandMin + index);
  for (const sign of signs) {
    for (const operand of operands) {
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

function canReach(value: number, skill: SkillId, ctx: Context): boolean {
  const key = `${value}:${skill}`;
  let result = ctx.reachCache.get(key);
  if (result === undefined) {
    result = nextSteps(value, ctx).some((step) => step.requiredSkills.includes(skill));
    ctx.reachCache.set(key, result);
  }
  return result;
}

/**
 * Кілька цільових прийомів (повторення): беремо той, що досі траплявся найрідше.
 * Якщо звідси він недоступний — готуємо для нього положення кісточок, і лише потім переходимо до наступного.
 */
function chooseBalanced(options: Step[], ctx: Context): Step {
  const order = [...ctx.focus].sort((a, b) => (ctx.focusUses.get(a) ?? 0) - (ctx.focusUses.get(b) ?? 0));
  const sampled = sample(ctx.random, options, LOOKAHEAD_SAMPLE);
  for (const skill of order) {
    const direct = options.filter((step) => step.requiredSkills.includes(skill));
    if (direct.length > 0) return pick(ctx.random, direct);
    const setups = sampled.filter((step) => canReach(step.after, skill, ctx));
    if (setups.length > 0) return pick(ctx.random, setups);
  }
  return pick(ctx.random, options);
}

function countFocus(step: Step, ctx: Context): void {
  for (const skill of step.requiredSkills) {
    if (ctx.focus.has(skill)) ctx.focusUses.set(skill, (ctx.focusUses.get(skill) ?? 0) + 1);
  }
}

function chooseNext(previous: Step, ctx: Context): Step | null {
  let options = nextSteps(previous.after, ctx);
  // Не скасовуємо щойно зроблену дію (+4, а потім одразу −4), якщо є інший вибір.
  const notUndo = options.filter(
    (step) => !(step.operand === previous.operand && step.operation !== previous.operation),
  );
  if (notUndo.length > 0) options = notUndo;
  if (options.length === 0) return null;

  if (!ctx.hasFocus || ctx.random() >= ctx.focusShare) return pick(ctx.random, options);
  if (ctx.focus.size > 1) return chooseBalanced(options, ctx);

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
  // Лічильники відхиленого прикладу не повинні впливати на наступні спроби.
  const usesBefore = new Map(ctx.focusUses);
  const steps: Step[] = [first];
  while (steps.length < actions) {
    const next = chooseNext(steps[steps.length - 1]!, ctx);
    if (!next) break;
    countFocus(next, ctx);
    steps.push(next);
  }
  if (steps.length < actions || (ctx.hasFocus && !steps.some((step) => isFocus(step, ctx)))) {
    ctx.focusUses = usesBefore;
    return null;
  }
  return { steps, answer: steps[steps.length - 1]!.after };
}

export function generateDrill(config: DrillConfig): Drill {
  validate(config);
  const seed = config.seed ?? Math.floor(Math.random() * 2 ** 32);
  if (config.kind === "multiply" || config.kind === "divide") {
    return { config, seed, examples: generateFacts(config, createRandom(seed)) };
  }
  const maxValue = config.maxValue ?? 10 ** (config.digits + 1) - 1;
  const ctx: Context = {
    allowed: new Set(config.allowedSkills),
    focus: new Set(config.focusSkills ?? []),
    focusOperandMin: config.focusOperandMin ?? Infinity,
    hasFocus: (config.focusSkills ?? []).length > 0 || config.focusOperandMin !== undefined,
    focusShare: config.focusShare ?? 0.4,
    operandMin: config.digits === 1 ? 1 : 10 ** (config.digits - 1),
    operandMax: Math.min(config.operandMax ?? Infinity, 10 ** config.digits - 1),
    maxValue,
    rodCount: String(maxValue).length + 1,
    signs: config.operations === "mixed" ? ["+", "-"] : [config.operations],
    random: createRandom(seed),
    stepCache: new Map(),
    focusCache: new Map(),
    reachCache: new Map(),
    focusUses: new Map(),
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

const digitsOf = (value: number) => String(value).split("").map(Number);

/**
 * Множення на соробані як накопичення часткових добутків: цифри першого множника беруться зліва направо,
 * кожен добуток додається на абакус у своєму розряді. Кроки — звичайні додавання, тому демонстрація рухів
 * і облік прийомів працюють так само, як для ланцюжків.
 */
export function multiplyExample(a: number, b: number): Example {
  const product = a * b;
  const rods = String(product).length + 1;
  const steps: Step[] = [];
  const labels: string[] = [];
  let value = 0;
  const aDigits = digitsOf(a);
  const bDigits = digitsOf(b);
  aDigits.forEach((da, i) => {
    bDigits.forEach((db, j) => {
      const left = da * 10 ** (aDigits.length - 1 - i);
      const right = db * 10 ** (bDigits.length - 1 - j);
      if (left * right === 0) return;
      const step = buildStep(value, "+", left * right, rods);
      if (!step) throw new GeneratorError(`Не вдалося розкласти ${a} × ${b}`);
      steps.push(step);
      labels.push(`${left} × ${right} = ${left * right}`);
      value = step.after;
    });
  });
  return { steps, labels, answer: product, prompt: `${a} × ${b}` };
}

/**
 * Ділення без остачі: ділене набирається на абакус, далі для кожної цифри частки віднімається
 * «цифра × дільник» у своєму розряді, доки абакус не спорожніє. Відповідь — частка.
 */
export function divideExample(dividend: number, divisor: number): Example {
  const quotient = dividend / divisor;
  if (!Number.isInteger(quotient)) throw new GeneratorError(`${dividend} не ділиться на ${divisor} без остачі`);
  const rods = String(dividend).length + 1;
  const first = buildStep(0, "+", dividend, rods)!;
  const steps: Step[] = [first];
  const labels: string[] = [`Набери ${dividend}`];
  let value = dividend;
  const qDigits = digitsOf(quotient);
  qDigits.forEach((digit, index) => {
    const place = 10 ** (qDigits.length - 1 - index);
    if (digit === 0) return;
    const step = buildStep(value, "-", digit * place * divisor, rods);
    if (!step) throw new GeneratorError(`Не вдалося розкласти ${dividend} : ${divisor}`);
    steps.push(step);
    labels.push(`у частці ${digit * place}: ${digit * place} × ${divisor} = ${digit * place * divisor}`);
    value = step.after;
  });
  return { steps, labels, answer: quotient, prompt: `${dividend} : ${divisor}` };
}

function generateFacts(config: DrillConfig, random: Random): Example[] {
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const examples: Example[] = [];
  let guard = 0;
  while (examples.length < config.exampleCount) {
    if (++guard > config.exampleCount * 200) throw new GeneratorError("Не вдалося скласти приклади з такими межами");
    let example: Example;
    if (config.kind === "multiply") {
      const { aDigits, bMin, bMax } = config.factors ?? { aDigits: 1, bMin: 2, bMax: 9 };
      const a = aDigits === 1 ? between(2, 9) : between(10 ** (aDigits - 1), 10 ** aDigits - 1);
      example = multiplyExample(a, between(bMin, bMax));
    } else {
      const { digits, divisorMin, divisorMax } = config.quotient ?? { digits: 1, divisorMin: 2, divisorMax: 9 };
      const q = digits === 1 ? between(2, 9) : between(10 ** (digits - 1), 10 ** digits - 1);
      const divisor = between(divisorMin, divisorMax);
      example = divideExample(q * divisor, divisor);
    }
    // Той самий приклад двічі поспіль не даємо.
    if (example.prompt === examples[examples.length - 1]?.prompt) continue;
    examples.push(example);
  }
  return examples;
}

/** Запис прикладу рядком: «3 + 4 − 2 = 5». */
export function formatExample(example: Example): string {
  if (example.prompt) return `${example.prompt} = ${example.answer}`;
  const parts = example.steps.map((step, index) => {
    if (index === 0) return String(step.operand);
    return `${step.operation === "+" ? "+" : "−"} ${step.operand}`;
  });
  return `${parts.join(" ")} = ${example.answer}`;
}
