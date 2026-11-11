/** Будівельні блоки власного світу застосунку. Файл без залежностей: його читає і збереження, і гра. */
/** Матеріали: з них можна робити будь-яку форму. */
export const MATERIALS = ["grass", "wood", "stone", "sand", "ice", "brick", "gold", "glass", "crystal"] as const;
/** Готові предмети: здобуваються за окремі завдання й тренування. */
export const ITEMS = ["door", "window", "stairs", "lamp", "flower", "solar"] as const;
export const BLOCKS = [...MATERIALS, ...ITEMS] as const;
export type BlockId = (typeof BLOCKS)[number];

export const BLOCK_NAMES: Record<BlockId, string> = {
  grass: "трава",
  wood: "дерево",
  stone: "камінь",
  sand: "пісок",
  ice: "лід",
  brick: "цегла",
  gold: "золото",
  glass: "скло",
  crystal: "кристал",
  door: "двері",
  window: "вікно",
  stairs: "сходи",
  lamp: "ліхтар",
  flower: "квіти",
  solar: "сонячна панель",
};

/**
 * Форми деталей. Матеріал можна поставити кубом, половинкою, скатом, трикутником, колом,
 * циліндром чи конусом; сходи можна віддзеркалити; інші предмети мають одну форму.
 */
export const SHAPES = ["full", "half", "slope-r", "slope-l", "tri", "circle", "cyl", "cone", "mirror"] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_NAMES: Record<Shape, string> = {
  full: "куб",
  half: "половинка",
  "slope-r": "скат праворуч",
  "slope-l": "скат ліворуч",
  tri: "трикутник",
  circle: "коло",
  cyl: "циліндр",
  cone: "конус",
  mirror: "віддзеркалити",
};

const MATERIAL_SHAPES: Shape[] = ["full", "half", "slope-r", "slope-l", "tri", "circle", "cyl", "cone"];
export const isMaterial = (block: BlockId) => (MATERIALS as readonly string[]).includes(block);
export function shapesFor(block: BlockId): Shape[] {
  if (isMaterial(block)) return MATERIAL_SHAPES;
  return block === "stairs" ? ["full", "mirror"] : ["full"];
}

/** Деталь у клітинці: «wood» — куб, «wood/tri» — дерев'яний трикутник. */
export type Cell = string;
export const makeCell = (block: BlockId, shape: Shape): Cell => (shape === "full" ? block : `${block}/${shape}`);
export function parseCell(value: unknown): { block: BlockId; shape: Shape } | null {
  if (typeof value !== "string") return null;
  const [block, shape = "full", extra] = value.split("/");
  if (extra !== undefined || !isBlock(block) || !shapesFor(block).includes(shape as Shape)) return null;
  return { block, shape: shape as Shape };
}
export const isCell = (value: unknown): value is Cell => parseCell(value) !== null;

export type Inventory = Record<BlockId, number>;
/** Здобич за заняття: лише блоки, яких більше нуля. */
export type Loot = Partial<Record<BlockId, number>>;

export const ISLAND_COLS = 12;
export const ISLAND_ROWS = 8;
export type Island = (Cell | null)[];

export const isBlock = (value: unknown): value is BlockId => BLOCKS.includes(value as BlockId);

/** Стартовий набір, щоб острів можна було почати одразу. */
export const starterInventory = (): Inventory =>
  ({ ...Object.fromEntries(BLOCKS.map((block) => [block, 0])), grass: 12 }) as Inventory;
export const emptyIsland = (): Island => Array<Cell | null>(ISLAND_COLS * ISLAND_ROWS).fill(null);

/**
 * Ділянка для будівництва. «island» — острів згори, «house» — будова збоку (небо й земля),
 * де зручно ставити хатинки й вежі.
 */
export type PlotKind = "island" | "house" | "detail";
export const PLOT_KINDS: PlotKind[] = ["island", "house", "detail"];
/** «detail» — будова збоку з удвічі дрібнішими клітинками для гарних деталей. */
export const PLOT_SIZE: Record<PlotKind, { cols: number; rows: number }> = {
  island: { cols: ISLAND_COLS, rows: ISLAND_ROWS },
  house: { cols: 12, rows: 12 },
  detail: { cols: 24, rows: 20 },
};
export interface Plot {
  kind: PlotKind;
  cells: Island;
}
export const MAX_PLOTS = 8;
export const emptyPlot = (kind: PlotKind): Plot => ({
  kind,
  cells: Array<Cell | null>(PLOT_SIZE[kind].cols * PLOT_SIZE[kind].rows).fill(null),
});

/** Особливі нагороди, які показуємо окремим рядком у підсумку. */
export type Bonus = "accuracy" | "mastery" | "mental" | "week";
export const isBonus = (value: unknown): value is Bonus =>
  value === "accuracy" || value === "mastery" || value === "mental" || value === "week";
