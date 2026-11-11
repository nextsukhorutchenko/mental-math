/**
 * Модель соробану: на кожній спиці одна верхня кісточка (5) і чотири нижні (по 1).
 * Кісточка «on» — присунута до перекладини, тобто врахована в числі.
 */

export interface Rod {
  /** Чи присунута верхня кісточка (значення 5). */
  upper: boolean;
  /** Скільки нижніх кісточок присунуто (0–4). */
  lower: number;
}

/** Спиці від молодшого розряду: індекс 0 — одиниці, 1 — десятки і т. д. */
export type Abacus = Rod[];

export const DEFAULT_ROD_COUNT = 6;

export interface BeadMove {
  /** Номер спиці: 0 — одиниці. */
  rod: number;
  bead: "upper" | "lower";
  /** «on» — присунути до перекладини, «off» — відсунути. */
  direction: "on" | "off";
  /** Скільки кісточок рухається одним рухом (для верхньої завжди 1). */
  count: number;
}

export function rodDigit(rod: Rod): number {
  return (rod.upper ? 5 : 0) + rod.lower;
}

export function fromNumber(value: number, rodCount = DEFAULT_ROD_COUNT): Abacus {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Абакус показує лише цілі невід'ємні числа, отримано ${value}`);
  }
  if (value >= 10 ** rodCount) {
    throw new RangeError(`Число ${value} не вміщається на ${rodCount} спицях`);
  }
  const abacus: Abacus = [];
  let rest = value;
  for (let i = 0; i < rodCount; i++) {
    const digit = rest % 10;
    abacus.push({ upper: digit >= 5, lower: digit % 5 });
    rest = Math.floor(rest / 10);
  }
  return abacus;
}

export function toNumber(abacus: Abacus): number {
  let value = 0;
  for (let i = abacus.length - 1; i >= 0; i--) {
    value = value * 10 + rodDigit(abacus[i]!);
  }
  return value;
}

export function cloneAbacus(abacus: Abacus): Abacus {
  return abacus.map((rod) => ({ ...rod }));
}

/**
 * Виконує рух на місці. Кидає помилку, якщо рух фізично неможливий
 * (наприклад, присунути кісточку, яка вже присунута).
 */
export function applyMoveInPlace(abacus: Abacus, move: BeadMove): void {
  const rod = abacus[move.rod];
  if (!rod) {
    throw new RangeError(`Немає спиці з номером ${move.rod}`);
  }
  if (move.bead === "upper") {
    const wantOn = move.direction === "on";
    if (move.count !== 1 || rod.upper === wantOn) {
      throw new Error(`Неможливий рух верхньої кісточки на спиці ${move.rod}`);
    }
    rod.upper = wantOn;
    return;
  }
  const next = rod.lower + (move.direction === "on" ? move.count : -move.count);
  if (move.count < 1 || next < 0 || next > 4) {
    throw new Error(`Неможливий рух нижніх кісточок на спиці ${move.rod}`);
  }
  rod.lower = next;
}

export function applyMoves(abacus: Abacus, moves: readonly BeadMove[]): Abacus {
  const result = cloneAbacus(abacus);
  for (const move of moves) {
    applyMoveInPlace(result, move);
  }
  return result;
}
