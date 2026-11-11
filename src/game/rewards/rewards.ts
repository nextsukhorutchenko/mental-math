import { type SkillFamily, type SkillId, skillFamily } from "../../core/rules/skills";
import { type WorldId, levelById } from "../curriculum/levels";
import { type Session, isClean } from "../session/session";
import { type BlockId, type Inventory, type Loot } from "./blocks";

/** Кожен світ дає свій матеріал. */
const FAMILY_BLOCK: Record<SkillFamily, BlockId> = { simple: "wood", five: "stone", ten: "sand", mix: "ice" };
const WORLD_BLOCK: Record<WorldId, BlockId> = {
  forest: "wood",
  caves: "stone",
  desert: "sand",
  snow: "ice",
  mine: "brick",
  volcano: "gold",
  sky: "glass",
};

/** Матеріал за заняття: за світом рівня, а для вільного тренажера — за родиною прийому. */
export function worldBlock(topic: SkillId, level?: string): BlockId {
  const world = level ? levelById(level)?.world : undefined;
  return world ? WORLD_BLOCK[world] : FAMILY_BLOCK[skillFamily(topic)];
}

/** Скільки днів із заняттями на тиждень — гнучка ціль; пропущений день нічого не забирає. */
export const WEEK_GOAL = 4;

export const REWARDS = {
  /** Розв'язаний приклад. */
  solved: 1,
  /** Додатково за самостійність: з першої спроби без підказки. */
  independent: 1,
  /** Додатково за виправлену помилку: правильно з другої спроби без підказки. */
  corrected: 1,
  /** Трава за приклад, який уважно розібрали разом. */
  reviewed: 1,
  /** Трава за заняття, доведене до кінця. */
  finished: 2,
  /** Кристал за уважне заняття: щонайменше 5 прикладів і 80% самостійно. */
  accuracy: 1,
  /** Кристали за формулу, засвоєну на абакусі / подумки. */
  mastery: 5,
  mental: 3,
  /** Кристали за тижневу ціль. */
  week: 5,
} as const;

export function addLoot(target: Loot, block: BlockId, count: number): void {
  if (count > 0) target[block] = (target[block] ?? 0) + count;
}

export function withLoot(inventory: Inventory, loot: Loot): Inventory {
  const next = { ...inventory };
  for (const [block, count] of Object.entries(loot) as [BlockId, number][]) next[block] += count;
  return next;
}

/**
 * Здобич за приклади заняття. Швидкість не враховується зовсім:
 * нагороджуємо розв'язання, самостійність, виправлену помилку й уважний розбір.
 */
export function sessionLoot(
  session: Session,
  topic: SkillId,
  partial: boolean,
  level?: string,
): { loot: Loot; accurate: boolean } {
  const loot: Loot = {};
  const block = worldBlock(topic, level);
  let clean = 0;
  for (const result of session.results) {
    if (!result.solved) {
      addLoot(loot, "grass", REWARDS.reviewed);
      continue;
    }
    addLoot(loot, block, REWARDS.solved);
    if (isClean(result)) {
      clean++;
      addLoot(loot, block, REWARDS.independent);
    } else if (!result.hintUsed) {
      addLoot(loot, block, REWARDS.corrected);
    }
  }
  const total = session.results.length;
  const accurate = !partial && total >= 5 && clean / total >= 0.8;
  if (!partial) addLoot(loot, "grass", REWARDS.finished);
  if (accurate) addLoot(loot, "crystal", REWARDS.accuracy);
  return { loot, accurate };
}

/** Що з'ясовуємо про завершене заняття, щоб видати предмети за вид тренування. */
export interface TaskInfo {
  mode: "physical" | "mental";
  pacing?: string;
  levelKind?: string;
  /** Скільки чисел у прикладі. */
  actions: number;
  accurate: boolean;
}

/**
 * Предмети за різні види тренувань. Видаються лише за заняття, доведене до кінця,
 * щонайменше з MIN_TASK_EXAMPLES прикладів, щоб їх не можна було «нафармити» короткими спробами.
 */
export const MIN_TASK_EXAMPLES = 5;
export const TASK_REWARDS: { id: string; title: string; loot: Loot; applies: (info: TaskInfo) => boolean }[] = [
  { id: "mental", title: "Заняття подумки", loot: { window: 1 }, applies: (i) => i.mode === "mental" },
  {
    id: "dictation",
    title: "Диктант на слух",
    loot: { door: 1 },
    applies: (i) => i.pacing === "voice" || i.pacing === "reader",
  },
  { id: "tempo", title: "Числа з темпом", loot: { lamp: 1 }, applies: (i) => i.pacing === "auto" },
  {
    id: "facts",
    title: "Множення чи ділення",
    loot: { stairs: 2 },
    applies: (i) => i.levelKind === "multiply" || i.levelKind === "divide",
  },
  {
    id: "long",
    title: "Довгі ланцюжки: 5+ чисел у прикладі",
    loot: { truck: 1 },
    applies: (i) => i.actions >= 5 && i.levelKind !== "multiply" && i.levelKind !== "divide",
  },
  { id: "accurate", title: "Уважне заняття: 80% самостійно", loot: { flower: 2 }, applies: (i) => i.accurate },
];

/** Предмети за вид тренування; повертає здобич, яку додати до заняття. */
export function taskLoot(info: TaskInfo, examples: number, partial: boolean): Loot {
  const loot: Loot = {};
  if (partial || examples < MIN_TASK_EXAMPLES) return loot;
  for (const task of TASK_REWARDS)
    if (task.applies(info))
      for (const [block, count] of Object.entries(task.loot) as [BlockId, number][]) addLoot(loot, block, count);
  return loot;
}

/** Картки: набір із 10+ карток дає квіти, а з 20+ — ще й вікно. */
export const CARD_ITEMS = { flowerAt: 10, windowAt: 20 } as const;

/** Понеділок тижня за місцевим часом, РРРР-ММ-ДД. */
export function weekId(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

/** Скільки різних днів цього тижня були заняття (уроки чи картки). */
export function weekActiveDays(history: readonly { finishedAt: string }[], now: Date): number {
  const week = weekId(now);
  const days = new Set<string>();
  for (const record of history) {
    const at = new Date(record.finishedAt);
    if (weekId(at) === week) days.add(at.toDateString());
  }
  return days.size;
}
