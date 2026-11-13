import { SIMPLE } from "../../core/rules/skills";
import type { SaveData } from "../../storage/save";
import { type Mastery, masteryOf } from "../progress/progress";
import { DEFAULT_SETUP, type LessonSetup } from "../session/setup";
import { LEVELS, LEVEL_IDS, type Level, type LevelId, WORLDS, type World, levelById } from "./levels";

export { WORLDS, LEVELS, type World, type Level, type LevelId };

/** Короткий напис на плитці рівня: «+4», «1–4», «47×6». */
export function levelLabel(id: LevelId): string {
  return levelById(id)?.label ?? id;
}

export interface LevelState {
  id: LevelId;
  level: Level;
  /** locked — ще зачинено; open — можна починати; learning — у роботі; mastered — засвоєно на абакусі. */
  status: "locked" | "open" | "learning" | "mastered";
  physical: Mastery;
  mental: Mastery;
  /** Рівень до місця, визначеного стартовою перевіркою: відкритий, але за нього не беремося. */
  skipped: boolean;
}

/**
 * Рівень відкривається, коли попередній засвоєно на фізичному абакусі.
 * Швидкість і ментальний рахунок проходження не блокують. Батьки можуть відкрити все вручну,
 * а стартова перевірка (placement) відкриває все до рівня, з якого дитина починає.
 */
export function levelStates(
  progress: SaveData["skills"],
  unlockAll: boolean,
  placement: LevelId | null = null,
): LevelState[] {
  const startIndex = Math.max(0, placement ? LEVEL_IDS.indexOf(placement) : 0);
  // Нові рівні, вставлені в програму перед уже засвоєними (наприклад, «1–4» для тих, хто вже на формулах),
  // не повертають дитину назад: незайманий рівень до останнього засвоєного вважається пропущеним.
  // Беремо саме засвоєні, а не розпочаті: проба формули у вільному тренажері нічого не пропускає.
  // Рівень «прямі рухи: усі числа» до уваги не беремо: прямі рухи тренуються вже на рівнях «1–4» і «5–9»,
  // тож він засвоюється попутно й не означає, що дитина пішла далі (інакше «5–9» пропускався б одразу після «1–4»).
  const lastMastered = LEVELS.reduce(
    (last, level, index) =>
      level.id !== SIMPLE && masteryOf(progress[level.id]?.physical, "physical").status === "mastered" ? index : last,
    -1,
  );
  let previousMastered = true;
  return LEVELS.map((level, index) => {
    const physical = masteryOf(progress[level.id]?.physical, "physical");
    const mental = masteryOf(progress[level.id]?.mental, "mental");
    const reachable = previousMastered || unlockAll || index <= startIndex || physical.status !== "new";
    previousMastered = physical.status === "mastered";
    const status =
      physical.status === "mastered" ? "mastered" : !reachable ? "locked" : physical.status === "new" ? "open" : "learning";
    const skipped =
      status !== "mastered" && (index < startIndex || (physical.status === "new" && index < lastMastered));
    return { id: level.id, level, status, physical, mental, skipped };
  });
}

/** Рівень, на якому дитина зараз: перший незасвоєний, не раніше місця зі стартової перевірки. */
export function currentLevel(states: readonly LevelState[]): LevelId | null {
  return states.find((state) => state.status !== "mastered" && !state.skipped)?.id ?? null;
}

/** Розряд — це повністю пройдений світ. Розряди рахуються від старшого номера до першого. */
export interface Rank {
  world: World;
  /** Номер розряду: 7 — за перший світ, 1 — за останній. */
  number: number;
  title: string;
}

export function rankFor(world: World): Rank {
  return { world, number: WORLDS.length - WORLDS.indexOf(world), title: world.rank };
}

/** Розряди за світи, у яких усі рівні засвоєно на абакусі. */
export function earnedRanks(states: readonly LevelState[]): Rank[] {
  const mastered = new Set(states.filter((state) => state.status === "mastered").map((state) => state.id));
  return WORLDS.filter((world) => world.levels.every((level) => mastered.has(level.id))).map(rankFor);
}

export interface Recommendation {
  stage: "intro" | "practice" | "mix" | "mental" | "review";
  title: string;
  setup: LessonSetup;
}

/** Обсяг заняття на кожному етапі: [прикладів, дій]. Множення й ділення дій у ланцюжку не мають. */
const VOLUME: Record<Level["kind"], Record<Recommendation["stage"], [number, number]>> = {
  formula: { intro: [10, 3], practice: [20, 4], mix: [20, 5], mental: [10, 3], review: [10, 5] },
  chain: { intro: [10, 3], practice: [15, 4], mix: [15, 5], mental: [8, 3], review: [10, 4] },
  multiply: { intro: [10, 2], practice: [15, 2], mix: [20, 2], mental: [10, 2], review: [10, 2] },
  divide: { intro: [10, 2], practice: [15, 2], mix: [20, 2], mental: [10, 2], review: [10, 2] },
};

/** Найменше повне заняття рівня цього виду за нормами програми (на будь-якому етапі). */
export function fullLessonSize(kind: Level["kind"]): number {
  return Math.min(...Object.values(VOLUME[kind]).map(([examples]) => examples));
}

const STAGE_TITLES: Record<Recommendation["stage"], string> = {
  intro: "Знайомство",
  practice: "Практика",
  mix: "Закріплення",
  mental: "Подумки",
  review: "Повторення",
};

/** Налаштування заняття для рівня: тема для формул — сам прийом, для решти — рівень. */
export function levelSetup(level: Level, exampleCount: number, actionsPerExample: number): LessonSetup {
  return {
    ...DEFAULT_SETUP,
    topic: level.skill ?? "simple",
    level: level.id,
    digits: Math.min(level.drill.digits, 3) as LessonSetup["digits"],
    exampleCount,
    actionsPerExample,
  };
}

/** Наступне заняття рівня за нормами програми: знайомство → практика → закріплення → подумки → повторення. */
export function recommendLesson(state: LevelState): Recommendation {
  const stage: Recommendation["stage"] =
    state.physical.status === "new"
      ? "intro"
      : state.physical.status !== "mastered"
        ? state.physical.correct < 60
          ? "practice"
          : "mix"
        : state.mental.status !== "mastered"
          ? "mental"
          : "review";
  const [examples, actions] = VOLUME[state.level.kind][stage];
  const setup = levelSetup(state.level, examples, actions);
  return { stage, title: STAGE_TITLES[stage], setup: stage === "mental" ? { ...setup, mode: "mental" } : setup };
}

/** Чи рахуються дії в ланцюжку для цього рівня (для множення й ділення — ні). */
export const hasActions = (level: Level) => level.kind === "formula" || level.kind === "chain";
