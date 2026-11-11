import {
  type Abacus,
  type BeadMove,
  DEFAULT_ROD_COUNT,
  applyMoveInPlace,
  fromNumber,
  toNumber,
} from "../soroban/abacus";
import { SIMPLE, type Sign, type SkillId, skillId } from "./skills";

/**
 * Один крок прикладу: що було на абакусі, що зробили, що стало,
 * які прийоми для цього потрібні і якими рухами кісточок це виконується.
 */
export interface Step {
  before: number;
  operation: Sign;
  operand: number;
  after: number;
  /** Унікальні прийоми, потрібні саме від цього положення кісточок. */
  requiredSkills: SkillId[];
  /** Рухи в порядку виконання; кожен перевірено на моделі абакуса. */
  beadMoves: BeadMove[];
}

class Overflow extends Error {}

interface Work {
  abacus: Abacus;
  skills: SkillId[];
  moves: BeadMove[];
}

function move(work: Work, rod: number, bead: BeadMove["bead"], direction: BeadMove["direction"], count: number): void {
  if (count === 0) return;
  const beadMove: BeadMove = { rod, bead, direction, count };
  applyMoveInPlace(work.abacus, beadMove);
  work.moves.push(beadMove);
}

function rodAt(work: Work, pos: number) {
  const rod = work.abacus[pos];
  if (!rod) throw new Overflow();
  return rod;
}

function canAddDirect(rod: { upper: boolean; lower: number }, n: number): boolean {
  return (n < 5 || !rod.upper) && rod.lower + (n % 5) <= 4;
}

function canSubDirect(rod: { upper: boolean; lower: number }, n: number): boolean {
  return (n < 5 || rod.upper) && rod.lower >= n % 5;
}

function addDirect(work: Work, pos: number, n: number): void {
  if (n >= 5) move(work, pos, "upper", "on", 1);
  move(work, pos, "lower", "on", n % 5);
}

function subDirect(work: Work, pos: number, n: number): void {
  move(work, pos, "lower", "off", n % 5);
  if (n >= 5) move(work, pos, "upper", "off", 1);
}

/** Додає цифру n (1–9) на спиці pos, за потреби з переносом на старшу спицю. */
function addOnRod(work: Work, pos: number, n: number): void {
  const rod = rodAt(work, pos);

  if (canAddDirect(rod, n)) {
    work.skills.push(SIMPLE);
    addDirect(work, pos, n);
    return;
  }

  if (n <= 4 && !rod.upper) {
    // Нижніх кісточок бракує, але п'ятірка вільна: +n = +5 −(5−n)
    work.skills.push(skillId("five", "+", n));
    move(work, pos, "upper", "on", 1);
    move(work, pos, "lower", "off", 5 - n);
    return;
  }

  // Сума на спиці ≥ 10: знімаємо доповнення до 10 і додаємо десяток.
  const complement = 10 - n;
  if (canSubDirect(rod, complement)) {
    work.skills.push(skillId("ten", "+", n));
    subDirect(work, pos, complement);
  } else {
    // Доповнення напряму не знімається: +n = +(n−5) −5 +10
    work.skills.push(skillId("mix", "+", n));
    move(work, pos, "lower", "on", n - 5);
    move(work, pos, "upper", "off", 1);
  }
  addOnRod(work, pos + 1, 1);
}

/** Віднімає цифру n (1–9) на спиці pos, за потреби з позикою зі старшої спиці. */
function subOnRod(work: Work, pos: number, n: number): void {
  const rod = rodAt(work, pos);

  if (canSubDirect(rod, n)) {
    work.skills.push(SIMPLE);
    subDirect(work, pos, n);
    return;
  }

  if (n <= 4 && rod.upper) {
    // Нижніх кісточок бракує, але п'ятірка стоїть: −n = −5 +(5−n)
    work.skills.push(skillId("five", "-", n));
    move(work, pos, "upper", "off", 1);
    move(work, pos, "lower", "on", 5 - n);
    return;
  }

  // Цифра на спиці менша за n: позичаємо десяток і додаємо доповнення до 10.
  const complement = 10 - n;
  const direct = canAddDirect(rod, complement);
  work.skills.push(skillId(direct ? "ten" : "mix", "-", n));
  subOnRod(work, pos + 1, 1);
  if (direct) {
    addDirect(work, pos, complement);
  } else {
    // Доповнення напряму не додається: −n = −10 +5 −(n−5)
    move(work, pos, "upper", "on", 1);
    move(work, pos, "lower", "off", n - 5);
  }
}

/**
 * Будує крок від конкретного числа на абакусі. Повертає null, якщо крок
 * неможливий: результат від'ємний або не вміщається на спицях.
 * Багатоцифрове число виконується зліва направо, від старшого розряду.
 */
export function buildStep(
  before: number,
  operation: Sign,
  operand: number,
  rodCount = DEFAULT_ROD_COUNT,
): Step | null {
  if (!Number.isInteger(operand) || operand < 1) return null;
  if (operation === "-" && operand > before) return null;
  const expected = operation === "+" ? before + operand : before - operand;
  if (expected >= 10 ** rodCount) return null;

  const work: Work = { abacus: fromNumber(before, rodCount), skills: [], moves: [] };
  const digits = String(operand).split("").map(Number);
  try {
    digits.forEach((digit, index) => {
      if (digit === 0) return;
      const pos = digits.length - 1 - index;
      if (operation === "+") addOnRod(work, pos, digit);
      else subOnRod(work, pos, digit);
    });
  } catch (error) {
    if (error instanceof Overflow) return null;
    throw error;
  }

  const after = toNumber(work.abacus);
  if (after !== expected) {
    throw new Error(`Рухи дали ${after}, а мало бути ${expected} (${before} ${operation} ${operand})`);
  }
  return {
    before,
    operation,
    operand,
    after,
    requiredSkills: [...new Set(work.skills)],
    beadMoves: work.moves,
  };
}
