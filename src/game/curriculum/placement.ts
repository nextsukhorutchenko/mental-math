import { type DrillConfig, generateDrill } from "../../core/generator/generator";
import { ALL_SKILLS, type SkillId } from "../../core/rules/skills";
import { type LevelId, WORLDS, type World } from "./levels";

/**
 * Стартова перевірка: по одному короткому етапу на кожен світ із формулами, від простого до складного.
 * Етап пройдено, якщо правильно розв'язано щонайменше PASS із EXAMPLES прикладів з однієї спроби.
 * Перший непройдений етап і є місцем, з якого починати. Хто пройшов усі чотири, починає з багатоцифрових чисел.
 */
export const PLACEMENT = { examples: 4, pass: 3, actions: 4 } as const;

export interface PlacementStage {
  world: World;
  title: string;
  /** Перший рівень цього світу — з нього починають, якщо етап не пройдено. */
  start: LevelId;
}

/** Світи, де рівень — це прийом додавання й віднімання. */
const FORMULA_WORLDS = WORLDS.filter((world) => world.levels.some((level) => level.kind === "formula"));

export const PLACEMENT_STAGES: PlacementStage[] = FORMULA_WORLDS.map((world) => ({
  world,
  title: `${world.title}: ${world.subtitle.toLowerCase()}`,
  start: world.levels[0]!.id,
}));

const stageSkills = (stage: PlacementStage): SkillId[] =>
  stage.world.levels.flatMap((level) => (level.skill ? [level.skill] : []));

/** Приклади етапу: дозволено все до кінця цього світу, а в центрі уваги — його прийоми. */
export function stageConfig(stage: PlacementStage): DrillConfig {
  const skills = stageSkills(stage);
  const last = ALL_SKILLS.indexOf(skills[skills.length - 1]!);
  const focus = skills.filter((skill) => skill !== "simple");
  return {
    allowedSkills: ALL_SKILLS.slice(0, last + 1),
    focusSkills: focus,
    focusShare: 0.6,
    exampleCount: PLACEMENT.examples,
    actionsPerExample: PLACEMENT.actions,
    digits: 1,
    operations: "mixed",
  };
}

export const stageDrill = (stage: PlacementStage, seed?: number) => generateDrill({ ...stageConfig(stage), seed });

export const stagePassed = (correct: number) => correct >= PLACEMENT.pass;

/** Рівень, з якого починати, за кількістю пройдених поспіль етапів. */
export function placementStart(passedStages: number): LevelId {
  const stage = PLACEMENT_STAGES[passedStages];
  if (stage) return stage.start;
  // Усі формули знайомі — далі йде перший світ після них.
  const next = WORLDS[WORLDS.indexOf(FORMULA_WORLDS[FORMULA_WORLDS.length - 1]!) + 1];
  return (next ?? WORLDS[WORLDS.length - 1]!).levels[0]!.id;
}
