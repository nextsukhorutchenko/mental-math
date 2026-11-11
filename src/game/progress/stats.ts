import { TRACK_IDS } from "../curriculum/levels";
import type { ModeProgress, SaveData, SessionRecord } from "../../storage/save";
import { type Mastery, localDay, masteryOf } from "./progress";

export interface DayStat {
  day: string;
  sessions: number;
  examples: number;
  clean: number;
}

export interface WeekStats {
  /** Сім днів, найдавніший перший, сьогодні останній. */
  days: DayStat[];
  sessions: number;
  examples: number;
  clean: number;
  activeDays: number;
}

/** Активність за останні сім днів включно з сьогоднішнім (за місцевим часом). */
export function weekStats(history: readonly SessionRecord[], now: Date): WeekStats {
  const days: DayStat[] = [];
  for (let back = 6; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    days.push({ day: localDay(date), sessions: 0, examples: 0, clean: 0 });
  }
  const byDay = new Map(days.map((day) => [day.day, day]));
  for (const record of history) {
    const day = byDay.get(localDay(new Date(record.finishedAt)));
    if (!day) continue;
    day.sessions++;
    day.examples += record.total;
    day.clean += record.clean;
  }
  const sum = (pick: (day: DayStat) => number) => days.reduce((total, day) => total + pick(day), 0);
  return {
    days,
    sessions: sum((day) => day.sessions),
    examples: sum((day) => day.examples),
    clean: sum((day) => day.clean),
    activeDays: days.filter((day) => day.sessions > 0).length,
  };
}

export interface SkillRow {
  /** id рівня або прийому. */
  skill: string;
  physical: Mastery;
  mental: Mastery;
  /** Частка самостійних серед останніх застосувань на абакусі; null — ще не тренували. */
  recentAccuracy: number | null;
  recentCount: number;
}

function accuracy(progress: ModeProgress | undefined, window: number): { value: number | null; count: number } {
  const recent = (progress?.recent ?? []).slice(-window);
  if (recent.length === 0) return { value: null, count: 0 };
  return { value: recent.filter(Boolean).length / recent.length, count: recent.length };
}

/** Прийоми, які вже тренували, у порядку програми. */
export function skillRows(skills: SaveData["skills"]): SkillRow[] {
  return TRACK_IDS.filter((skill) => {
    const progress = skills[skill];
    return progress && progress.physical.total + progress.mental.total > 0;
  }).map((skill) => {
    const physical = masteryOf(skills[skill]?.physical, "physical");
    const { value, count } = accuracy(skills[skill]?.physical, physical.window);
    return {
      skill,
      physical,
      mental: masteryOf(skills[skill]?.mental, "mental"),
      recentAccuracy: value,
      recentCount: count,
    };
  });
}

/** Слабкі місця: прийоми з достатньою кількістю свіжих спроб і точністю нижче 90%. */
export function weakSpots(skills: SaveData["skills"], limit = 3): SkillRow[] {
  return skillRows(skills)
    .filter((row) => row.recentCount >= 10 && row.recentAccuracy !== null && row.recentAccuracy < 0.9)
    .sort((a, b) => a.recentAccuracy! - b.recentAccuracy!)
    .slice(0, limit);
}
