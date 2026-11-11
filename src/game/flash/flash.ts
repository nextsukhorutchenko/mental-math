import { createRandom } from "../../core/generator/random";
import type { SaveData } from "../../storage/save";
import { withLoot } from "../rewards/rewards";

/**
 * Флеш-виклик: числа блимають по одному, їх треба додати в уяві.
 * Це необов'язковий режим: він нічого не відкриває й не блокує, зберігається лише особистий рекорд.
 */
export interface FlashLevel {
  number: number;
  digits: 1 | 2 | 3;
  /** Скільки чисел додати. */
  count: number;
  /** Скільки мілісекунд припадає на одне число. */
  intervalMs: number;
}

const level = (number: number, digits: 1 | 2 | 3, count: number, intervalMs: number): FlashLevel => ({
  number,
  digits,
  count,
  intervalMs,
});

export const FLASH_LEVELS: FlashLevel[] = [
  level(1, 1, 3, 2000),
  level(2, 1, 5, 1500),
  level(3, 1, 5, 1000),
  level(4, 1, 7, 1000),
  level(5, 2, 3, 1500),
  level(6, 2, 5, 1500),
  level(7, 2, 5, 1000),
  level(8, 2, 7, 800),
  level(9, 2, 10, 700),
  level(10, 3, 5, 1000),
  level(11, 3, 7, 700),
  level(12, 3, 10, 500),
  level(13, 2, 10, 400),
  level(14, 3, 10, 300),
  level(15, 3, 15, 200),
];

export const FLASH = {
  rounds: 3,
  /** Скільки раундів із трьох треба розв'язати правильно. */
  pass: 2,
  /** Швидше за цей інтервал показуємо попередження про блимання. */
  warnBelowMs: 500,
  /** Яку частку інтервалу число видно; решту часу екран порожній, щоб однакові числа розрізнялися. */
  visibleShare: 0.8,
} as const;

export const isFast = (flash: FlashLevel) => flash.intervalMs < FLASH.warnBelowMs;

/** Числа одного раунду: потрібної розрядності, без двох однакових поспіль. */
export function flashNumbers(flash: FlashLevel, seed: number): number[] {
  const random = createRandom(seed);
  const min = flash.digits === 1 ? 1 : 10 ** (flash.digits - 1);
  const max = 10 ** flash.digits - 1;
  const numbers: number[] = [];
  while (numbers.length < flash.count) {
    const next = min + Math.floor(random() * (max - min + 1));
    if (next !== numbers[numbers.length - 1]) numbers.push(next);
  }
  return numbers;
}

export const flashPassed = (correctRounds: number) => correctRounds >= FLASH.pass;

/** Новий рекорд дає кристал і сонячну панель; повторне проходження вже взятого рівня нічого не змінює. */
export const FLASH_LOOT = { crystal: 1, solar: 1 } as const;
export function creditFlash(save: SaveData, levelNumber: number, correctRounds: number): SaveData {
  if (!flashPassed(correctRounds) || levelNumber <= save.flashBest) return save;
  return { ...save, flashBest: levelNumber, inventory: withLoot(save.inventory, FLASH_LOOT) };
}
