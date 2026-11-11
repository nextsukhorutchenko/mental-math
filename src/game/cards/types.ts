import type { Loot } from "../rewards/blocks";

/**
 * Картки з абакусом — місток до уявного рахунку.
 *  read — на картці кісточки, треба назвати число;
 *  set  — на картці число, треба набрати його на своєму абакусі й звірити з картинкою.
 */
export type CardKind = "read" | "set";

export interface CardSetup {
  kind: CardKind;
  digits: 1 | 2 | 3;
  count: number;
  /** Скільки секунд показувати картинку в режимі read; 0 — без обмеження. */
  showSeconds: number;
}

export const DEFAULT_CARDS: CardSetup = { kind: "read", digits: 1, count: 10, showSeconds: 0 };
export const CARD_LIMITS = { count: { min: 5, max: 50 }, seconds: [0, 3, 2, 1] } as const;

/** Запис про завершений набір карток. */
export interface CardRecord {
  id: string;
  finishedAt: string;
  kind: CardKind;
  digits: number;
  total: number;
  correct: number;
  earned: Loot;
  /** Цим набором закрито тижневу ціль. */
  week: boolean;
}
