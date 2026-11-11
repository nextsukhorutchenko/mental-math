import { ALL_SKILLS, type SkillFamily, type SkillId, skillFamily } from "../../core/rules/skills";
import type { SaveData } from "../../storage/save";
import { type Mastery, masteryOf } from "../progress/progress";
import { DEFAULT_SETUP, type LessonSetup } from "../session/setup";

/** Світ на карті — одна родина прийомів; рівень — один прийом. */
export interface World {
  id: "forest" | "caves" | "desert" | "snow";
  title: string;
  subtitle: string;
  family: SkillFamily;
  levels: SkillId[];
}

const world = (id: World["id"], title: string, subtitle: string, family: SkillFamily): World => ({
  id,
  title,
  subtitle,
  family,
  levels: ALL_SKILLS.filter((skill) => skillFamily(skill) === family),
});

export const WORLDS: World[] = [
  world("forest", "Ліс", "Прямі рухи без формул", "simple"),
  world("caves", "Печери", "Молодші друзі: через п'ятірку", "five"),
  world("desert", "Пустеля", "Старші друзі: через десяток", "ten"),
  world("snow", "Снігові гори", "Комбіновані формули", "mix"),
];

/** Короткий напис на плитці рівня: «+4», «−7» або «1–9» для прямих рухів. */
export function levelLabel(skill: SkillId): string {
  return skill === "simple" ? "1–9" : skill.split(":")[1]!.replace("-", "−");
}

export interface LevelState {
  skill: SkillId;
  /** locked — ще зачинено; open — можна починати; learning — у роботі; mastered — засвоєно на абакусі. */
  status: "locked" | "open" | "learning" | "mastered";
  physical: Mastery;
  mental: Mastery;
}

/**
 * Рівень відкривається, коли попередній засвоєно на фізичному абакусі.
 * Швидкість і ментальний рахунок проходження не блокують. Батьки можуть відкрити все вручну.
 */
export function levelStates(skills: SaveData["skills"], unlockAll: boolean): LevelState[] {
  let previousMastered = true;
  return ALL_SKILLS.map((skill) => {
    const physical = masteryOf(skills[skill]?.physical, "physical");
    const mental = masteryOf(skills[skill]?.mental, "mental");
    const reachable = previousMastered || unlockAll || physical.status !== "new";
    previousMastered = physical.status === "mastered";
    const status =
      physical.status === "mastered" ? "mastered" : !reachable ? "locked" : physical.status === "new" ? "open" : "learning";
    return { skill, status, physical, mental };
  });
}

/** Рівень, на якому дитина зараз: перший незасвоєний. */
export function currentLevel(states: readonly LevelState[]): SkillId | null {
  return states.find((state) => state.status !== "mastered")?.skill ?? null;
}

export interface Recommendation {
  stage: "intro" | "practice" | "mix" | "mental" | "review";
  title: string;
  setup: LessonSetup;
}

/** Наступне заняття рівня за нормами програми: знайомство → практика → мікс → подумки → повторення. */
export function recommendLesson(state: LevelState): Recommendation {
  const base: LessonSetup = { ...DEFAULT_SETUP, topic: state.skill };
  const lesson = (
    stage: Recommendation["stage"],
    title: string,
    exampleCount: number,
    actionsPerExample: number,
    mode: LessonSetup["mode"] = "physical",
  ): Recommendation => ({ stage, title, setup: { ...base, exampleCount, actionsPerExample, mode } });

  if (state.physical.status === "new") return lesson("intro", "Знайомство", 10, 3);
  if (state.physical.status !== "mastered") {
    return state.physical.correct < 60 ? lesson("practice", "Практика", 20, 4) : lesson("mix", "Закріплення", 20, 5);
  }
  if (state.mental.status !== "mastered") return lesson("mental", "Подумки", 10, 3, "mental");
  return lesson("review", "Повторення", 10, 5);
}
