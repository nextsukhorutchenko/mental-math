import { generateDrill } from "../../core/generator/generator";
import type { SkillId } from "../../core/rules/skills";
import {
  type ActiveSession,
  DAYS_LIMIT,
  HISTORY_LIMIT,
  type Mode,
  type ModeProgress,
  RECENT_LIMIT,
  type SaveData,
  type SessionRecord,
  emptyMode,
} from "../../storage/save";
import type { Bonus } from "../rewards/blocks";
import { REWARDS, WEEK_GOAL, addLoot, sessionLoot, weekActiveDays, weekId, withLoot } from "../rewards/rewards";
import { type Session, skillUses, summarize } from "../session/session";

/** Правила засвоєння прийому; фізичний і ментальний режими оцінюються окремо. */
export const MASTERY: Record<Mode, { minCorrect: number; window: number; minCleanInWindow: number; minDays: number }> = {
  physical: { minCorrect: 80, window: 20, minCleanInWindow: 18, minDays: 3 },
  mental: { minCorrect: 30, window: 15, minCleanInWindow: 13, minDays: 1 },
};

export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function recordUse(progress: ModeProgress, clean: boolean, day: string): ModeProgress {
  return {
    correct: progress.correct + (clean ? 1 : 0),
    total: progress.total + 1,
    recent: [...progress.recent, clean].slice(-RECENT_LIMIT),
    days: clean && !progress.days.includes(day) ? [...progress.days, day].slice(-DAYS_LIMIT) : progress.days,
  };
}

export interface Mastery {
  status: "new" | "learning" | "mastered";
  correct: number;
  needCorrect: number;
  /** Самостійних серед останніх window застосувань. */
  recentClean: number;
  window: number;
  needRecent: number;
  days: number;
  needDays: number;
}

export function masteryOf(progress: ModeProgress | undefined, mode: Mode): Mastery {
  const rules = MASTERY[mode];
  const p = progress ?? emptyMode();
  const recent = p.recent.slice(-rules.window);
  const recentClean = recent.filter(Boolean).length;
  const mastered =
    p.correct >= rules.minCorrect &&
    recent.length >= rules.window &&
    recentClean >= rules.minCleanInWindow &&
    p.days.length >= rules.minDays;
  return {
    status: p.total === 0 ? "new" : mastered ? "mastered" : "learning",
    correct: p.correct,
    needCorrect: rules.minCorrect,
    recentClean,
    window: rules.window,
    needRecent: rules.minCleanInWindow,
    days: p.days.length,
    needDays: rules.minDays,
  };
}

export interface Credit {
  id: string;
  finishedAt: Date;
  topic: SkillId;
  mode: Mode;
  partial: boolean;
  session: Session;
}

/**
 * Зараховує завершені приклади заняття: статистика прийомів і запис в історії.
 * Повторний виклик із тим самим id нічого не змінює — це захист від подвійного
 * натискання й перезавантаження сторінки.
 */
export function creditSession(save: SaveData, credit: Credit): SaveData {
  if (credit.session.results.length === 0) return save;
  if (save.history.some((record) => record.id === credit.id)) return save;

  const day = localDay(credit.finishedAt);
  const skills = { ...save.skills };
  const touched = new Set<SkillId>();
  for (const use of skillUses(credit.session)) {
    const current = skills[use.skill] ?? { physical: emptyMode(), mental: emptyMode() };
    skills[use.skill] = { ...current, [credit.mode]: recordUse(current[credit.mode], use.clean, day) };
    touched.add(use.skill);
  }

  // Нагороди нараховуються тим самим записом, що й прогрес, тому теж не дублюються.
  const { loot, accurate } = sessionLoot(credit.session, credit.topic, credit.partial);
  const bonuses: Bonus[] = accurate ? ["accuracy"] : [];
  const newlyMastered = [...touched].filter(
    (skill) =>
      masteryOf(save.skills[skill]?.[credit.mode], credit.mode).status !== "mastered" &&
      masteryOf(skills[skill]?.[credit.mode], credit.mode).status === "mastered",
  ).length;
  if (newlyMastered > 0) {
    const bonus = credit.mode === "physical" ? "mastery" : "mental";
    bonuses.push(bonus);
    addLoot(loot, "crystal", REWARDS[bonus] * newlyMastered);
  }

  const { total, clean, withHelp, failed } = summarize(credit.session);
  const record: SessionRecord = {
    id: credit.id,
    finishedAt: credit.finishedAt.toISOString(),
    topic: credit.topic,
    mode: credit.mode,
    total,
    clean,
    withHelp,
    failed,
    partial: credit.partial,
    earned: loot,
    bonuses,
  };
  const history = [...save.history, record].slice(-HISTORY_LIMIT);

  // Тижнева ціль: видається один раз на тиждень, коли набралося потрібно днів із заняттями.
  const week = weekId(credit.finishedAt);
  let weekGoalsPaid = save.weekGoalsPaid;
  if (!weekGoalsPaid.includes(week) && weekActiveDays(history, credit.finishedAt) >= WEEK_GOAL) {
    weekGoalsPaid = [...weekGoalsPaid, week];
    bonuses.push("week");
    addLoot(loot, "crystal", REWARDS.week);
  }

  return { ...save, skills, history, inventory: withLoot(save.inventory, loot), weekGoalsPaid };
}

/** Відтворює незавершене заняття: ті самі приклади з того самого seed. */
export function restoreSession(active: ActiveSession): Session | null {
  try {
    const drill = generateDrill(active.config);
    if (active.index >= drill.examples.length) return null;
    return { drill, index: active.index, results: active.results, current: active.current, status: active.status };
  } catch {
    return null;
  }
}

/** Закриває незавершене заняття, зарахувавши вже розв'язані приклади. */
export function closeActive(save: SaveData, now: Date): SaveData {
  const active = save.active;
  if (!active) return save;
  const session = restoreSession(active);
  const credited = session
    ? creditSession(save, {
        id: active.id,
        finishedAt: now,
        topic: active.setup.topic,
        mode: active.setup.mode,
        partial: true,
        session,
      })
    : save;
  return { ...credited, active: null };
}
