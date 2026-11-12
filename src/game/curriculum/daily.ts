import { ALL_SKILLS, type SkillId, skillFamily } from "../../core/rules/skills";
import type { SaveData, SessionRecord } from "../../storage/save";
import { type CardSetup, DEFAULT_CARDS } from "../cards/types";
import { localDay, masteryOf, overdueDays } from "../progress/progress";
import { DEFAULT_SETUP, type LessonSetup, type PlanTask } from "../session/setup";
import { type LevelState, currentLevel, fullLessonSize, hasActions, levelLabel, levelStates, recommendLesson } from "./curriculum";

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
  | { id: "review" | PlanTask; title: string; detail: string; done: boolean; lesson: LessonSetup };

const actionsWord = (count: number) => (count <= 4 ? "дії" : "дій");

/** Скільки прикладів подумки щодня: коротко, щоб план лишався посильним. */
export const DAILY_MENTAL_EXAMPLES = 5;

/**
 * Чи закриває запис пункт плану: заняття, запущене з цього пункту, або власноруч обране
 * таке саме — той самий рівень і режим, не перерване й повного обсягу. Обсяг звіряємо з найменшим
 * повним заняттям рівня: після заняття рекомендація може перейти на наступний етап із більшим обсягом.
 */
function fulfils(record: SessionRecord, task: PlanTask, state: LevelState, lesson: LessonSetup): boolean {
  if (record.partial || record.review) return false;
  if (record.planned === task) return true;
  const enough = Math.min(lesson.exampleCount, fullLessonSize(state.level.kind));
  return record.level === lesson.level && record.mode === lesson.mode && record.total >= enough;
}

const describeLesson = (state: LevelState, setup: LessonSetup) =>
  `${setup.exampleCount} прикладів${hasActions(state.level) ? ` по ${setup.actionsPerExample} ${actionsWord(setup.actionsPerExample)}` : ""}`;

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
  // Три види розминки по колу: упізнати кісточки, запам'ятати кілька картинок, набрати число руками.
  const kind = (["read", "memory", "set"] as const)[now.getDate() % 3]!;
  const digits = reachedTens ? 2 : 1;
  const cards: CardSetup =
    kind === "memory"
      ? { kind, digits: 1, count: 5, showSeconds: 2, span: reachedTens ? 3 : 2 }
      : { ...DEFAULT_CARDS, kind, digits, ...(kind === "set" && digits > 1 ? { twoHands: true } : {}) };
  const what =
    kind === "read"
      ? `${cards.count} карток — назви число за кісточками`
      : kind === "set"
        ? `${cards.count} карток — набери число на абакусі${cards.twoHands ? " двома руками" : ""}`
        : `${cards.count} спроб — запам'ятай ${cards.span} картинки з абакусом`;
  parts.push({
    id: "cards",
    title: "Розминка: картки",
    detail: what,
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

  const states = levelStates(save.skills, save.unlockAll, save.placement);
  const current = currentLevel(states);
  const state = states.find((item) => item.id === current) ?? states[states.length - 1]!;
  const next = recommendLesson(state);
  const levelLesson: LessonSetup = { ...next.setup, planned: "level" };
  parts.push({
    id: "level",
    title: `Рівень ${state.level.label}: ${next.title.toLowerCase()}`,
    detail: `${describeLesson(state, levelLesson)}${levelLesson.mode === "mental" ? ", подумки" : ""}`,
    done: lessonsToday.some((record) => fulfils(record, "level", state, levelLesson)),
    lesson: levelLesson,
  });

  // Рахунок подумки: після засвоєння на абакусі програма йде далі, тож уявний абакус тренуємо окремим пунктом —
  // на найновішому рівні, який уже засвоєно руками, але ще не подумки.
  const mentalState = [...states]
    .reverse()
    .find((item) => item.status === "mastered" && item.mental.status !== "mastered");
  if (mentalState && levelLesson.mode !== "mental") {
    const recommended = recommendLesson(mentalState).setup;
    const lesson: LessonSetup = {
      ...recommended,
      mode: "mental",
      exampleCount: Math.min(recommended.exampleCount, DAILY_MENTAL_EXAMPLES),
      planned: "mental",
    };
    parts.push({
      id: "mental",
      title: `Подумки: рівень ${mentalState.level.label}`,
      detail: `${describeLesson(mentalState, lesson)} — абакус відкласти`,
      done: lessonsToday.some((record) => fulfils(record, "mental", mentalState, lesson)),
      lesson,
    });
  }
  return parts;
}
