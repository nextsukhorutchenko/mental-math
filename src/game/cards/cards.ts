import { createRandom } from "../../core/generator/random";
import { CARD_LOG_LIMIT, type SaveData } from "../../storage/save";
import { weekGoal } from "../progress/progress";
import type { Loot } from "../rewards/blocks";
import { REWARDS, addLoot, withLoot } from "../rewards/rewards";
import type { CardRecord, CardSetup } from "./types";

/** Одна трава за кожні дві правильні картки; у картках на пам'ять — за кожну правильну спробу. */
export const CARDS_PER_GRASS = 2;

/** Скільки спиць малювати для числа: на одну більше, ніж цифр, щоб було видно порожній розряд. */
export function cardRods(digits: number): number {
  return digits + 1;
}

/**
 * Числа для карток. Одноцифрові йдуть перемішаними колами 1–9, щоб кожна цифра траплялася порівну;
 * більші — випадкові, без двох однакових поспіль.
 */
export function generateCards(setup: Pick<CardSetup, "digits" | "count">, seed: number): number[] {
  const random = createRandom(seed);
  const min = setup.digits === 1 ? 1 : 10 ** (setup.digits - 1);
  const max = 10 ** setup.digits - 1;
  const cards: number[] = [];
  let pool: number[] = [];
  while (cards.length < setup.count) {
    let next: number;
    if (setup.digits === 1) {
      if (pool.length === 0) pool = Array.from({ length: 9 }, (_, i) => i + 1);
      const index = Math.floor(random() * pool.length);
      next = pool[index]!;
      if (next === cards[cards.length - 1] && pool.length > 1) continue;
      pool.splice(index, 1);
    } else {
      next = min + Math.floor(random() * (max - min + 1));
      if (next === cards[cards.length - 1]) continue;
    }
    cards.push(next);
  }
  return cards;
}

export interface CardCredit {
  id: string;
  finishedAt: Date;
  setup: CardSetup;
  /** Результат кожної картки по порядку. */
  results: boolean[];
}

/** Зараховує набір карток: запис у журналі, трава в інвентар, тижнева ціль. Повтор із тим самим id нічого не змінює. */
export function creditCards(save: SaveData, credit: CardCredit): SaveData {
  if (credit.results.length === 0) return save;
  if (save.cardLog.some((record) => record.id === credit.id)) return save;

  const correct = credit.results.filter(Boolean).length;
  const loot: Loot = {};
  addLoot(loot, "grass", credit.setup.kind === "memory" ? correct : Math.floor(correct / CARDS_PER_GRASS));
  const record: CardRecord = {
    id: credit.id,
    finishedAt: credit.finishedAt.toISOString(),
    kind: credit.setup.kind,
    digits: credit.setup.digits,
    total: credit.results.length,
    correct,
    earned: loot,
    week: false,
  };
  const next: SaveData = { ...save, cardLog: [...save.cardLog, record].slice(-CARD_LOG_LIMIT) };
  const week = weekGoal(next, credit.finishedAt);
  if (week.paid) {
    record.week = true;
    addLoot(loot, "crystal", REWARDS.week);
  }
  return { ...next, inventory: withLoot(save.inventory, loot), weekGoalsPaid: week.weekGoalsPaid };
}
