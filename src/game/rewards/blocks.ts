/** Будівельні блоки власного світу застосунку. Файл без залежностей: його читає і збереження, і гра. */
export const BLOCKS = ["grass", "wood", "stone", "sand", "ice", "crystal"] as const;
export type BlockId = (typeof BLOCKS)[number];

export const BLOCK_NAMES: Record<BlockId, string> = {
  grass: "трава",
  wood: "дерево",
  stone: "камінь",
  sand: "пісок",
  ice: "лід",
  crystal: "кристал",
};

export type Inventory = Record<BlockId, number>;
/** Здобич за заняття: лише блоки, яких більше нуля. */
export type Loot = Partial<Record<BlockId, number>>;

export const ISLAND_COLS = 12;
export const ISLAND_ROWS = 8;
export type Island = (BlockId | null)[];

export const isBlock = (value: unknown): value is BlockId => BLOCKS.includes(value as BlockId);

/** Стартовий набір, щоб острів можна було почати одразу. */
export const starterInventory = (): Inventory => ({ grass: 12, wood: 0, stone: 0, sand: 0, ice: 0, crystal: 0 });
export const emptyIsland = (): Island => Array<BlockId | null>(ISLAND_COLS * ISLAND_ROWS).fill(null);

/** Особливі нагороди, які показуємо окремим рядком у підсумку. */
export type Bonus = "accuracy" | "mastery" | "mental" | "week";
export const isBonus = (value: unknown): value is Bonus =>
  value === "accuracy" || value === "mastery" || value === "mental" || value === "week";
