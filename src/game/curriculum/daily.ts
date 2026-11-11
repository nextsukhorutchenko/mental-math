import { ALL_SKILLS, type SkillId, skillFamily } from "../../core/rules/skills";
import type { SaveData } from "../../storage/save";
import { type CardSetup, DEFAULT_CARDS } from "../cards/types";
import { localDay, masteryOf, overdueDays } from "../progress/progress";
import { DEFAULT_SETUP, type LessonSetup } from "../session/setup";
import { currentLevel, levelLabel, levelStates, recommendLesson } from "./curriculum";

/** Скільки прийомів повторюємо за одне заняття: більше — і на кожен припаде замало дій. */
export const REVIEW_LIMIT = 3;

/** Засвоєні на абакусі прийоми, які настав час повторити; найбільш прострочені — першими до ліміту. */
export function dueReviews(skills: SaveData["skills"], today: string, limit = REVIEW_LIMIT): SkillId[] {
  const due = ALL_SKILLS.filter(
    (skill) =>
      masteryOf(skills[skill]?.physical, "physical").status === "mastered" &&
      overdueDays(skills[skill]?.physical, today) >= 0,
  );
  const chosen = [...due]
    .sort((a, b) => overdueDays(skills[b]?.physical, today) - overdueDays(skills[a]?.physical, today))
    .slice(0, limit);
  // Назад у порядок програми: так зрозуміліше читати й легше добирати дозволені прийоми.
  return ALL_SKILLS.filter((skill) => chosen.includes(skill));
}

/** Заняття-повторення: мікс із кількох прийомів на фізичному абакусі. */
export function reviewSetup(skills: SkillId[]): LessonSetup {
  return {
    ...DEFAULT_SETUP,
    topic: skills[skills.length - 1] ?? "simple",
    review: skills,
    exampleCount: 10,
    actionsPerExample: 5,
  };
}

export type DailyPart =
  | { id: "cards"; title: string; detail: string; done: boolean; cards: CardSetup }
  | { id: "review" | "level"; title: string; detail: string; done: boolean; lesson: LessonSetup };

const actionsWord = (count: number) => (count <= 4 ? "дії" : "дій");

/**
 * План «Заняття на сьогодні»: розминка картками, повторення старого (якщо настав час) і поточний рівень.
 * Частина вважається зробленою, якщо сьогодні вже є відповідний запис.
 */
export function dailyPlan(save: SaveData, now: Date): DailyPart[] {
  const today = localDay(now);
  const isToday = (record: { finishedAt: string }) => localDay(new Date(record.finishedAt)) === today;
  const lessonsToday = save.history.filter(isToday);
  const parts: DailyPart[] = [];

  // Розминка: дні чергуються — читати кісточки чи набирати число. Двоцифрові — коли дійшли до десятків.
  const reachedTens = ALL_SKILLS.some(
    (skill) => (skillFamily(skill) === "ten" || skillFamily(skill) === "mix") && (save.skills[skill]?.physical.total ?? 0) > 0,
  );
  const kind = now.getDate() % 2 === 0 ? "read" : "set";
  const cards: CardSetup = { ...DEFAULT_CARDS, kind, digits: reachedTens ? 2 : 1 };
  parts.push({
    id: "cards",
    title: "Розминка: картки",
    detail: `${cards.count} карток — ${kind === "read" ? "назви число за кісточками" : "набери число на абакусі"}`,
    done: save.cardLog.some(isToday),
    cards,
  });

  const due = dueReviews(save.skills, today);
  const reviewedToday = lessonsToday.some((record) => record.review);
  if (due.length > 0 || reviewedToday) {
    const lesson = reviewSetup(due);
    parts.push({
      id: "review",
      title: "Повторення",
      detail:
        due.length > 0
          ? `${due.map(levelLabel).join(", ")} — ${lesson.exampleCount} прикладів по ${lesson.actionsPerExample} дій`
          : "на сьогодні все повторено",
      done: due.length === 0,
      lesson,
    });
  }

  const states = levelStates(save.skills, save.unlockAll);
  const current = currentLevel(states);
  const state = states.find((item) => item.skill === current) ?? states[states.length - 1]!;
  const next = recommendLesson(state);
  parts.push({
    id: "level",
    title: `Рівень ${levelLabel(state.skill)}: ${next.title.toLowerCase()}`,
    detail: `${next.setup.exampleCount} прикладів по ${next.setup.actionsPerExample} ${actionsWord(next.setup.actionsPerExample)}${next.setup.mode === "mental" ? ", подумки" : ""}`,
    done: lessonsToday.some((record) => !record.review && !record.partial),
    lesson: next.setup,
  });
  return parts;
}
