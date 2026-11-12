import type { DrillConfig } from "../../core/generator/generator";
import { ALL_SKILLS, type SkillId } from "../../core/rules/skills";
import { levelById } from "../curriculum/levels";

/** Фізичний абакус або уявний; прогрес у них рахується окремо. */
export type Mode = "physical" | "mental";

/**
 * Як подавати числа: весь приклад, по одному вручну, по одному із заданим темпом,
 * голосом застосунку (voice) або вголос дорослим, який читає з екрана (reader).
 */
export type Pacing = "all" | "manual" | "auto" | "voice" | "reader";
export const PACINGS: Pacing[] = ["all", "manual", "auto", "voice", "reader"];

/** Вибір батьків: тема, обсяг і спосіб тренування. */
export interface LessonSetup {
  topic: SkillId;
  exampleCount: number;
  actionsPerExample: number;
  digits: 1 | 2 | 3;
  operations: DrillConfig["operations"];
  mode: Mode;
  pacing: Pacing;
  /** Скільки секунд показувати кожне число при pacing = "auto". */
  secondsPerNumber: number;
  /** Повторення: кілька раніше засвоєних прийомів замість однієї теми. */
  review?: SkillId[];
  /** Рівень карти, з якого запущено заняття: він задає вид вправ і межі чисел. */
  level?: string;
  /** Пункт плану дня, з якого запущено заняття: так план знає, що виконано саме заплановане. */
  planned?: PlanTask;
}

/** Пункти плану дня, які виконуються заняттям (повторення впізнається за самим review). */
export type PlanTask = "level" | "mental";
export const PLAN_TASKS: PlanTask[] = ["level", "mental"];

export const DEFAULT_SETUP: LessonSetup = {
  topic: "five:+4",
  exampleCount: 10,
  actionsPerExample: 4,
  digits: 1,
  operations: "mixed",
  mode: "physical",
  pacing: "all",
  secondsPerNumber: 2,
};

export const SETUP_LIMITS = {
  examples: { min: 1, max: 100 },
  actions: { min: 2, max: 15 },
  seconds: { min: 0.5, max: 5, step: 0.5 },
} as const;

/** Коротка проба подумки після заняття на абакусі: та сама тема, мало коротких прикладів. */
export function mentalTryout(setup: LessonSetup): LessonSetup {
  const { planned: _planned, ...rest } = setup;
  return {
    ...rest,
    mode: "mental",
    pacing: "all",
    exampleCount: 5,
    actionsPerExample: Math.min(setup.actionsPerExample, 3),
  };
}

/** Дозволені прийоми — усе, що в програмі йде до вибраної теми, і сама тема. */
export function toDrillConfig(setup: LessonSetup): DrillConfig {
  const level = levelById(setup.level);
  if (level && !setup.review?.length) {
    return { ...level.drill, exampleCount: setup.exampleCount, actionsPerExample: setup.actionsPerExample };
  }
  const review = setup.review?.length ? setup.review : null;
  const last = Math.max(...[setup.topic, ...(review ?? [])].map((skill) => ALL_SKILLS.indexOf(skill)));
  return {
    allowedSkills: ALL_SKILLS.slice(0, last + 1),
    focusSkills: review ?? (setup.topic === "simple" ? [] : [setup.topic]),
    // У повторенні цільових прийомів кілька, тому їм дається більша частка дій.
    ...(review ? { focusShare: 0.6 } : {}),
    exampleCount: setup.exampleCount,
    actionsPerExample: setup.actionsPerExample,
    digits: setup.digits,
    operations: setup.operations,
  };
}
