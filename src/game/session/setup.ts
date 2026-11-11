import type { DrillConfig } from "../../core/generator/generator";
import { ALL_SKILLS, type SkillId } from "../../core/rules/skills";

/** Фізичний абакус або уявний; прогрес у них рахується окремо. */
export type Mode = "physical" | "mental";

/** Як показувати числа: весь приклад, по одному вручну або по одному із заданим темпом. */
export type Pacing = "all" | "manual" | "auto";

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
}

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
  return {
    ...setup,
    mode: "mental",
    pacing: "all",
    exampleCount: 5,
    actionsPerExample: Math.min(setup.actionsPerExample, 3),
  };
}

/** Дозволені прийоми — усе, що в програмі йде до вибраної теми, і сама тема. */
export function toDrillConfig(setup: LessonSetup): DrillConfig {
  const allowed = ALL_SKILLS.slice(0, ALL_SKILLS.indexOf(setup.topic) + 1);
  return {
    allowedSkills: allowed,
    focusSkills: setup.topic === "simple" ? [] : [setup.topic],
    exampleCount: setup.exampleCount,
    actionsPerExample: setup.actionsPerExample,
    digits: setup.digits,
    operations: setup.operations,
  };
}
