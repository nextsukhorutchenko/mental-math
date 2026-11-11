import type { DrillConfig } from "../../core/generator/generator";
import { ALL_SKILLS, type SkillId, describeSkill, explainSkill, skillFamily } from "../../core/rules/skills";

/**
 * Каталог рівнів. Рівень — окрема сутність із власним видом вправ:
 *  formula  — один прийом соробану (ідентифікатор рівня збігається з ідентифікатором прийому);
 *  chain    — ланцюжки з особливими межами (лише 1–4, з п'ятіркою, багатоцифрові);
 *  multiply — множення; divide — ділення без остачі.
 * Прогрес рівня зберігається за його id — так само, як прогрес прийому.
 */
export type WorldId = "forest" | "caves" | "desert" | "snow" | "mine" | "volcano" | "sky";
export type LevelKind = "formula" | "chain" | "multiply" | "divide";
export type LevelId = string;

/** Частина налаштувань вправи, яку задає рівень; кількість прикладів і дій додає заняття. */
export type LevelDrill = Omit<DrillConfig, "exampleCount" | "actionsPerExample" | "seed">;

export interface Level {
  id: LevelId;
  world: WorldId;
  kind: LevelKind;
  /** Короткий напис на плитці карти. */
  label: string;
  title: string;
  explain: string;
  /** Прийом рівня (лише для formula). */
  skill?: SkillId;
  drill: LevelDrill;
}

export interface World {
  id: WorldId;
  title: string;
  subtitle: string;
  /** Назва розряду, який дають за повністю пройдений світ. */
  rank: string;
  levels: Level[];
}

const chainBase: LevelDrill = { allowedSkills: ALL_SKILLS, digits: 1, operations: "mixed" };

function formulaLevel(world: WorldId, skill: SkillId): Level {
  const index = ALL_SKILLS.indexOf(skill);
  return {
    id: skill,
    world,
    kind: "formula",
    skill,
    label: skill === "simple" ? "1–9" : skill.split(":")[1]!.replace("-", "−"),
    title: skill === "simple" ? "Прямі рухи: усі числа" : describeSkill(skill),
    explain: explainSkill(skill),
    drill: {
      ...chainBase,
      allowedSkills: ALL_SKILLS.slice(0, index + 1),
      focusSkills: skill === "simple" ? [] : [skill],
    },
  };
}

const family = (world: WorldId, name: "five" | "ten" | "mix") =>
  ALL_SKILLS.filter((skill) => skillFamily(skill) === name).map((skill) => formulaLevel(world, skill));

const chain = (world: WorldId, id: string, label: string, title: string, explain: string, drill: Partial<LevelDrill>): Level => ({
  id,
  world,
  kind: "chain",
  label,
  title,
  explain,
  drill: { ...chainBase, ...drill },
});

const multiply = (id: string, label: string, title: string, explain: string, aDigits: number, bMin: number, bMax: number): Level => ({
  id,
  world: "volcano",
  kind: "multiply",
  label,
  title,
  explain,
  drill: { ...chainBase, kind: "multiply", operations: "+", factors: { aDigits, bMin, bMax } },
});

const divide = (id: string, label: string, title: string, explain: string, digits: number, divisorMin: number, divisorMax: number): Level => ({
  id,
  world: "sky",
  kind: "divide",
  label,
  title,
  explain,
  drill: { ...chainBase, kind: "divide", operations: "-", quotient: { digits, divisorMin, divisorMax } },
});

const MULTIPLY_HOW =
  "Множ цифри першого числа зліва направо й одразу додавай кожен добуток на абакус у своєму розряді.";
const DIVIDE_HOW =
  "Набери ділене. Підбирай цифри частки зліва направо й щоразу віднімай «цифра × дільник», доки абакус не спорожніє.";

export const WORLDS: World[] = [
  {
    id: "forest",
    title: "Ліс",
    subtitle: "Прямі рухи без формул",
    rank: "Лісовий слідопит",
    levels: [
      chain("forest", "simple:low", "1–4", "Прямі рухи: числа 1–4", "Працюємо лише нижніми кісточками: присувай великим пальцем, відсувай вказівним.", {
        allowedSkills: ["simple"],
        operandMax: 4,
        maxValue: 4,
      }),
      chain("forest", "simple:five", "5–9", "Прямі рухи: з п'ятіркою", "Додаємо верхню кісточку — п'ятірку. Числа 6–9 набираються щипком: п'ятірка й нижні кісточки разом.", {
        allowedSkills: ["simple"],
        maxValue: 9,
        focusOperandMin: 5,
      }),
      formulaLevel("forest", "simple"),
    ],
  },
  { id: "caves", title: "Печери", subtitle: "Молодші друзі: через п'ятірку", rank: "Печерний шукач", levels: family("caves", "five") },
  { id: "desert", title: "Пустеля", subtitle: "Старші друзі: через десяток", rank: "Пустельний мандрівник", levels: family("desert", "ten") },
  { id: "snow", title: "Снігові гори", subtitle: "Комбіновані формули", rank: "Гірський майстер", levels: family("snow", "mix") },
  {
    id: "mine",
    title: "Кристалічна шахта",
    subtitle: "Багатоцифрові числа",
    rank: "Хранитель кристалів",
    levels: [
      chain("mine", "digits:2", "10–99", "Двоцифрові ланцюжки", "Ті самі формули, але на двох спицях. Число набирай зліва направо: спершу десятки, потім одиниці.", { digits: 2 }),
      chain("mine", "digits:3", "100+", "Трицифрові ланцюжки", "Три спиці: сотні, десятки, одиниці. Не поспішай і стеж, на якій спиці працюєш.", { digits: 3 }),
      chain("mine", "digits:4", "1000+", "Чотирицифрові ланцюжки", "Чотири спиці. Розрядні цятки на планці допомагають не загубити тисячі.", { digits: 4 }),
    ],
  },
  {
    id: "volcano",
    title: "Вулкан",
    subtitle: "Множення",
    rank: "Володар вулкана",
    levels: [
      multiply("mul:table-low", "×2–5", "Таблиця множення на 2–5", "Спершу таблиця: добутки треба знати напам'ять, абакус лише показує результат.", 1, 2, 5),
      multiply("mul:table-high", "×6–9", "Таблиця множення на 6–9", "Друга половина таблиці множення.", 1, 6, 9),
      multiply("mul:2x1", "47×6", "Двоцифрове на одноцифрове", MULTIPLY_HOW, 2, 2, 9),
      multiply("mul:3x1", "247×6", "Трицифрове на одноцифрове", MULTIPLY_HOW, 3, 2, 9),
      multiply("mul:2x2", "47×26", "Двоцифрове на двоцифрове", `${MULTIPLY_HOW} Тут добутків чотири.`, 2, 11, 99),
    ],
  },
  {
    id: "sky",
    title: "Небесні острови",
    subtitle: "Ділення без остачі",
    rank: "Небесний навігатор",
    levels: [
      divide("div:table", "56:7", "Ділення за таблицею", "Ділення — це таблиця множення навпаки: шукаємо, на що помножити дільник.", 1, 2, 9),
      divide("div:2by1", "84:7", "Частка з двох цифр", DIVIDE_HOW, 2, 2, 9),
      divide("div:3by1", "861:7", "Частка з трьох цифр", DIVIDE_HOW, 3, 2, 9),
    ],
  },
];

export const LEVELS: Level[] = WORLDS.flatMap((world) => world.levels);
export const LEVEL_IDS: LevelId[] = LEVELS.map((level) => level.id);
const BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export const levelById = (id: LevelId | null | undefined): Level | undefined => (id ? BY_ID.get(id) : undefined);
export const worldOf = (id: LevelId): World | undefined => WORLDS.find((world) => world.levels.some((level) => level.id === id));

/** Усе, за чим ведеться прогрес: рівні плюс окремі прийоми (вони ж рівні-формули). */
export const TRACK_IDS: string[] = [...new Set([...LEVEL_IDS, ...ALL_SKILLS])];

/** Назва для статистики й історії. */
export function trackTitle(id: string): string {
  return levelById(id)?.title ?? id;
}
