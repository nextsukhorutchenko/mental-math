import type { Loot } from "../rewards/blocks";

/**
 * Картки з абакусом — місток до уявного рахунку.
 *  read   — на картці кісточки, треба назвати число;
 *  set    — на картці число, треба набрати його на своєму абакусі й звірити з картинкою;
 *  memory — кілька картинок поспіль, потім треба пригадати всі числа по порядку
 *           (тренує зорово-просторову пам'ять, на яку спирається уявний абакус).
 */
export type CardKind = "read" | "set" | "memory";

export interface CardSetup {
  kind: CardKind;
  digits: 1 | 2 | 3;
  /** Кількість карток; для memory — кількість спроб, у кожній по span картинок. */
  count: number;
  /** Скільки секунд показувати картинку; 0 — без обмеження (для memory завжди обмежено). */
  showSeconds: number;
  /** memory: скільки картинок треба втримати в пам'яті. */
  span?: number;
  /** set: набирати двома руками — ліва старші розряди, права одиниці. */
  twoHands?: boolean;
}

export const DEFAULT_CARDS: CardSetup = { kind: "read", digits: 1, count: 10, showSeconds: 0 };
export const CARD_LIMITS = { count: { min: 5, max: 50 }, seconds: [0, 3, 2, 1], span: [2, 3, 4] } as const;
export const DEFAULT_SPAN = 2;
/** Скільки секунд показувати кожну картинку в memory, якщо час не задано. */
export const MEMORY_SECONDS = 2;

export const cardSpan = (setup: CardSetup): number => (setup.kind === "memory" ? (setup.span ?? DEFAULT_SPAN) : 1);

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
