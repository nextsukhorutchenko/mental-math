import type { DrillConfig } from "../core/generator/generator";
import { ALL_SKILLS, type SkillId } from "../core/rules/skills";
import type { ExampleResult } from "../game/session/session";
import {
  BLOCKS,
  type Bonus,
  ISLAND_COLS,
  ISLAND_ROWS,
  type Inventory,
  type Island,
  type Loot,
  emptyIsland,
  isBlock,
  isBonus,
  starterInventory,
} from "../game/rewards/blocks";
import { DEFAULT_SETUP, type LessonSetup, type Mode, SETUP_LIMITS } from "../game/session/setup";

export type { Mode };

export interface ModeProgress {
  /** Застосувань прийому в прикладах, розв'язаних самостійно з першої спроби. */
  correct: number;
  total: number;
  /** Останні застосування (true — самостійно), найновіші в кінці. */
  recent: boolean[];
  /** Дні (РРРР-ММ-ДД), коли були самостійні застосування. */
  days: string[];
}

export type SkillProgress = Record<Mode, ModeProgress>;

export interface SessionRecord {
  id: string;
  finishedAt: string;
  topic: SkillId;
  mode: Mode;
  total: number;
  clean: number;
  withHelp: number;
  failed: number;
  /** Заняття перервали до кінця; зараховано лише розв'язані приклади. */
  partial: boolean;
  /** Блоки, здобуті за це заняття. */
  earned: Loot;
  /** Особливі нагороди цього заняття. */
  bonuses: Bonus[];
}

/** Незавершене заняття. Приклади не зберігаються: вони відтворюються з config.seed. */
export interface ActiveSession {
  id: string;
  setup: LessonSetup;
  config: DrillConfig & { seed: number };
  started: boolean;
  index: number;
  results: ExampleResult[];
  current: ExampleResult;
  status: "answering" | "solved" | "failed";
}

export interface SaveData {
  version: 1;
  skills: Partial<Record<SkillId, SkillProgress>>;
  history: SessionRecord[];
  active: ActiveSession | null;
  setup: LessonSetup;
  lastExportAt: string | null;
  /** Батьки відкрили всі рівні карти вручну. */
  unlockAll: boolean;
  /** Здобуті блоки, ще не поставлені на острів. */
  inventory: Inventory;
  /** Клітинки острова рядок за рядком. */
  island: Island;
  /** Тижні (понеділок, РРРР-ММ-ДД), за які вже видано нагороду за тижневу ціль. */
  weekGoalsPaid: string[];
  /** Чи ввімкнено звуки. */
  sound: boolean;
}

export const RECENT_LIMIT = 30;
export const DAYS_LIMIT = 60;
export const HISTORY_LIMIT = 1000;

export const emptyMode = (): ModeProgress => ({ correct: 0, total: 0, recent: [], days: [] });

export function emptySave(): SaveData {
  return {
    version: 1,
    skills: {},
    history: [],
    active: null,
    setup: DEFAULT_SETUP,
    lastExportAt: null,
    unlockAll: false,
    inventory: starterInventory(),
    island: emptyIsland(),
    weekGoalsPaid: [],
    sound: true,
  };
}

// ── Перевірка даних із диска чи файлу: довіряти їм не можна ──

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isSkill = (value: unknown): value is SkillId => ALL_SKILLS.includes(value as SkillId);
const isMode = (value: unknown): value is Mode => value === "physical" || value === "mental";
const isDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

function parseSetup(value: unknown): LessonSetup | null {
  if (!isObj(value) || !isSkill(value.topic)) return null;
  const { exampleCount, actionsPerExample, digits, operations } = value;
  const { examples, actions } = SETUP_LIMITS;
  if (!isCount(exampleCount) || exampleCount < examples.min || exampleCount > examples.max) return null;
  if (!isCount(actionsPerExample) || actionsPerExample < actions.min || actionsPerExample > actions.max) return null;
  if (digits !== 1 && digits !== 2 && digits !== 3) return null;
  if (operations !== "+" && operations !== "-" && operations !== "mixed") return null;
  // Режим і темп з'явилися пізніше: у старих збереженнях їх немає, тому беремо типові.
  const { pacing, secondsPerNumber } = value;
  const { seconds } = SETUP_LIMITS;
  const validSeconds =
    typeof secondsPerNumber === "number" && secondsPerNumber >= seconds.min && secondsPerNumber <= seconds.max;
  return {
    topic: value.topic,
    exampleCount,
    actionsPerExample,
    digits,
    operations,
    mode: isMode(value.mode) ? value.mode : DEFAULT_SETUP.mode,
    pacing: pacing === "all" || pacing === "manual" || pacing === "auto" ? pacing : DEFAULT_SETUP.pacing,
    secondsPerNumber: validSeconds ? secondsPerNumber : DEFAULT_SETUP.secondsPerNumber,
  };
}

function parseMode(value: unknown): ModeProgress {
  if (!isObj(value) || !isCount(value.correct) || !isCount(value.total) || value.correct > value.total) {
    return emptyMode();
  }
  const recent = Array.isArray(value.recent) ? value.recent.filter((item) => typeof item === "boolean") : [];
  const days = Array.isArray(value.days)
    ? value.days.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item))
    : [];
  return {
    correct: value.correct,
    total: value.total,
    recent: recent.slice(-RECENT_LIMIT),
    days: [...new Set(days)].slice(-DAYS_LIMIT),
  };
}

function parseLoot(value: unknown): Loot {
  const loot: Loot = {};
  if (!isObj(value)) return loot;
  for (const block of BLOCKS) {
    const count = value[block];
    if (isCount(count) && count > 0) loot[block] = count;
  }
  return loot;
}

/** Інвентар зі старого збереження без блоків отримує стартовий набір. */
function parseInventory(value: unknown): Inventory {
  if (!isObj(value)) return starterInventory();
  return { ...starterInventory(), grass: 0, ...parseLoot(value) };
}

function parseIsland(value: unknown): Island {
  if (!Array.isArray(value) || value.length !== ISLAND_COLS * ISLAND_ROWS) return emptyIsland();
  return value.map((cell) => (isBlock(cell) ? cell : null));
}

function parseRecord(value: unknown): SessionRecord | null {
  if (!isObj(value) || typeof value.id !== "string" || !isDate(value.finishedAt)) return null;
  if (!isSkill(value.topic) || !isMode(value.mode)) return null;
  const { total, clean, withHelp, failed } = value;
  if (!isCount(total) || !isCount(clean) || !isCount(withHelp) || !isCount(failed)) return null;
  if (clean + withHelp + failed !== total) return null;
  return {
    id: value.id,
    finishedAt: value.finishedAt,
    topic: value.topic,
    mode: value.mode,
    total,
    clean,
    withHelp,
    failed,
    partial: value.partial === true,
    earned: parseLoot(value.earned),
    bonuses: Array.isArray(value.bonuses) ? value.bonuses.filter(isBonus) : [],
  };
}

function parseResult(value: unknown): ExampleResult | null {
  if (!isObj(value) || !Array.isArray(value.answers) || !value.answers.every(isCount)) return null;
  if (typeof value.solved !== "boolean" || typeof value.hintUsed !== "boolean") return null;
  return { answers: value.answers, solved: value.solved, hintUsed: value.hintUsed };
}

function parseActive(value: unknown): ActiveSession | null {
  if (!isObj(value) || typeof value.id !== "string" || !isObj(value.config)) return null;
  const setup = parseSetup(value.setup);
  const current = parseResult(value.current);
  const config = value.config;
  if (!setup || !current || !isCount(config.seed)) return null;
  if (!Array.isArray(config.allowedSkills) || !config.allowedSkills.every(isSkill)) return null;
  if (!Array.isArray(config.focusSkills) || !config.focusSkills.every(isSkill)) return null;
  if (!isCount(value.index) || !Array.isArray(value.results)) return null;
  const results = value.results.map(parseResult);
  if (results.some((result) => result === null) || results.length !== value.index) return null;
  const { status } = value;
  if (status !== "answering" && status !== "solved" && status !== "failed") return null;
  return {
    id: value.id,
    setup,
    // Обсяг і числа беремо з перевірених налаштувань, а не з файлу.
    config: {
      allowedSkills: config.allowedSkills,
      focusSkills: config.focusSkills,
      exampleCount: setup.exampleCount,
      actionsPerExample: setup.actionsPerExample,
      digits: setup.digits,
      operations: setup.operations,
      seed: config.seed,
    },
    started: value.started === true,
    index: value.index,
    results: results as ExampleResult[],
    current,
    status,
  };
}

/** Повертає перевірені дані або null, якщо це взагалі не наше збереження. */
export function parseSave(value: unknown): SaveData | null {
  if (!isObj(value) || value.version !== 1 || !isObj(value.skills) || !Array.isArray(value.history)) return null;
  const skills: SaveData["skills"] = {};
  for (const [key, progress] of Object.entries(value.skills)) {
    if (!isSkill(key) || !isObj(progress)) continue;
    skills[key] = { physical: parseMode(progress.physical), mental: parseMode(progress.mental) };
  }
  const seen = new Set<string>();
  const history = value.history
    .map(parseRecord)
    .filter((record): record is SessionRecord => {
      if (!record || seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    })
    .slice(-HISTORY_LIMIT);
  return {
    version: 1,
    skills,
    history,
    active: parseActive(value.active),
    setup: parseSetup(value.setup) ?? DEFAULT_SETUP,
    lastExportAt: isDate(value.lastExportAt) ? value.lastExportAt : null,
    unlockAll: value.unlockAll === true,
    inventory: parseInventory(value.inventory),
    island: parseIsland(value.island),
    weekGoalsPaid: Array.isArray(value.weekGoalsPaid)
      ? value.weekGoalsPaid.filter((week): week is string => typeof week === "string").slice(-DAYS_LIMIT)
      : [],
    // У старих збереженнях налаштування немає — звук увімкнено.
    sound: value.sound !== false,
  };
}

// ── Резервна копія у файлі ──

const EXPORT_MARK = "mental-math-backup";

export function toExportText(save: SaveData, now: Date): string {
  // Незавершене заняття у файл не йде: копія описує зарахований прогрес.
  const data: SaveData = { ...save, active: null, lastExportAt: now.toISOString() };
  return JSON.stringify({ app: EXPORT_MARK, exportedAt: now.toISOString(), data }, null, 2);
}

export function parseExportText(text: string): SaveData | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObj(parsed) || parsed.app !== EXPORT_MARK) return null;
    return parseSave(parsed.data);
  } catch {
    return null;
  }
}
