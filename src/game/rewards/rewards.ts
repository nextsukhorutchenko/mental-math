import { type SkillFamily, type SkillId, skillFamily } from "../../core/rules/skills";
import { type Session, isClean } from "../session/session";
import { type BlockId, type Inventory, type Loot } from "./blocks";

/** Кожен світ дає свій матеріал. */
const WORLD_BLOCK: Record<SkillFamily, BlockId> = { simple: "wood", five: "stone", ten: "sand", mix: "ice" };

export function worldBlock(topic: SkillId): BlockId {
  return WORLD_BLOCK[skillFamily(topic)];
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
export function sessionLoot(session: Session, topic: SkillId, partial: boolean): { loot: Loot; accurate: boolean } {
  const loot: Loot = {};
  const block = worldBlock(topic);
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
