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
import { levelById } from "../curriculum/levels";
import { type Session, isClean, skillUses, summarize } from "../session/session";

/** Правила засвоєння прийому; фізичний і ментальний режими оцінюються окремо. */
export const MASTERY: Record<Mode, { minCorrect: number; window: number; minCleanInWindow: number; minDays: number }> = {
  physical: { minCorrect: 80, window: 20, minCleanInWindow: 18, minDays: 3 },
  mental: { minCorrect: 30, window: 15, minCleanInWindow: 13, minDays: 1 },
};

export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Через скільки днів повторювати засвоєний прийом: після кожного вдалого повторення інтервал росте. */
export const REVIEW_INTERVALS = [3, 7, 21] as const;
/** Скільки застосувань за заняття вважаємо справжньою практикою прийому. */
export const REVIEW_MIN_USES = 3;

export function daysBetween(from: string, to: string): number {
  const day = (text: string) => {
    const [year, month, date] = text.split("-").map(Number);
    return new Date(year!, month! - 1, date!).getTime();
  };
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/** День останньої справжньої практики прийому (або останній день із самостійними застосуваннями). */
export function lastPractice(progress: ModeProgress | undefined): string | null {
  return progress?.reviewed ?? progress?.days[progress.days.length - 1] ?? null;
}

/** Скільки днів минуло понад інтервал повторення; від'ємне — ще рано. */
export function overdueDays(progress: ModeProgress | undefined, today: string): number {
  const last = lastPractice(progress);
  if (!last) return -Infinity;
  const stage = Math.min(progress?.stage ?? 0, REVIEW_INTERVALS.length - 1);
  return daysBetween(last, today) - REVIEW_INTERVALS[stage]!;
}

export function recordUse(progress: ModeProgress, clean: boolean, day: string): ModeProgress {
  return {
    ...progress,
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
  /** Заняття було повторенням раніше засвоєних прийомів. */
  review?: boolean;
  /** Рівень карти, з якого запущено заняття. */
  level?: string;
  session: Session;
}

/** Тижнева ціль: видається один раз на тиждень, коли набралося потрібно днів із заняттями чи картками. */
export function weekGoal(save: SaveData, now: Date): { paid: boolean; weekGoalsPaid: string[] } {
  const week = weekId(now);
  const reached = weekActiveDays([...save.history, ...save.cardLog], now) >= WEEK_GOAL;
  if (save.weekGoalsPaid.includes(week) || !reached) return { paid: false, weekGoalsPaid: save.weekGoalsPaid };
  return { paid: true, weekGoalsPaid: [...save.weekGoalsPaid, week] };
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
  const counts = new Map<string, { uses: number; clean: number }>();
  for (const use of skillUses(credit.session)) {
    const current = skills[use.skill] ?? { physical: emptyMode(), mental: emptyMode() };
    skills[use.skill] = { ...current, [credit.mode]: recordUse(current[credit.mode], use.clean, day) };
    const count = counts.get(use.skill) ?? { uses: 0, clean: 0 };
    count.uses++;
    if (use.clean) count.clean++;
    counts.set(use.skill, count);
  }
  // Рівень, який не є окремим прийомом (1–4, багатоцифрові, множення, ділення), веде власний лік:
  // кожна дія прикладу — одне застосування рівня.
  const level = levelById(credit.level);
  if (level && level.kind !== "formula") {
    credit.session.results.forEach((result, index) => {
      const clean = isClean(result);
      const steps = credit.session.drill.examples[index]?.steps.length ?? 0;
      for (let i = 0; i < steps; i++) {
        const current = skills[level.id] ?? { physical: emptyMode(), mental: emptyMode() };
        skills[level.id] = { ...current, [credit.mode]: recordUse(current[credit.mode], clean, day) };
        const count = counts.get(level.id) ?? { uses: 0, clean: 0 };
        count.uses++;
        if (clean) count.clean++;
        counts.set(level.id, count);
      }
    });
  }
  const touched = new Set(counts.keys());

  // Повторення: якщо засвоєний прийом настав час повторити і його справді потренували,
  // вдале повторення подовжує інтервал, невдале повертає до найкоротшого.
  for (const [skill, count] of counts) {
    if (count.uses < REVIEW_MIN_USES) continue;
    const before = save.skills[skill]?.[credit.mode];
    let stage = before?.stage ?? 0;
    if (masteryOf(before, credit.mode).status === "mastered" && overdueDays(before, day) >= 0) {
      stage = count.clean / count.uses >= 0.8 ? Math.min(stage + 1, REVIEW_INTERVALS.length - 1) : 0;
    }
    const current = skills[skill]!;
    skills[skill] = { ...current, [credit.mode]: { ...current[credit.mode], reviewed: day, stage } };
  }

  // Нагороди нараховуються тим самим записом, що й прогрес, тому теж не дублюються.
  const { loot, accurate } = sessionLoot(credit.session, credit.topic, credit.partial, credit.level);
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
    review: credit.review === true,
    ...(credit.level ? { level: credit.level } : {}),
    earned: loot,
    bonuses,
  };
  const next: SaveData = { ...save, skills, history: [...save.history, record].slice(-HISTORY_LIMIT) };

  const week = weekGoal(next, credit.finishedAt);
  if (week.paid) {
    bonuses.push("week");
    addLoot(loot, "crystal", REWARDS.week);
  }
  return { ...next, inventory: withLoot(save.inventory, loot), weekGoalsPaid: week.weekGoalsPaid };
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
        review: !!active.setup.review,
        level: active.setup.level,
        session,
      })
    : save;
  return { ...credited, active: null };
}
