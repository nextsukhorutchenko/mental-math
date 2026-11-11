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

/** Основний колір матеріалу: так фарбуються фігури, якщо фарбу не вибрано. */
export const MATERIAL_COLORS: Record<(typeof MATERIALS)[number], string> = {
  grass: "#5cb531",
  wood: "#b9793a",
  stone: "#a3a6b0",
  sand: "#ecc86a",
  ice: "#9fdcf5",
  brick: "#b5482f",
  gold: "#f5c518",
  glass: "#cfeefc",
  crystal: "#b85cf0",
};

/** Фарби для деталей з матеріалів. */
export const PAINTS: { id: string; name: string; color: string }[] = [
  { id: "red", name: "червоний", color: "#e53935" },
  { id: "orange", name: "помаранчевий", color: "#fb8c00" },
  { id: "yellow", name: "жовтий", color: "#fdd835" },
  { id: "lime", name: "салатовий", color: "#8bc34a" },
  { id: "green", name: "зелений", color: "#2e7d32" },
  { id: "teal", name: "бірюзовий", color: "#26a69a" },
  { id: "sky", name: "блакитний", color: "#4fc3f7" },
  { id: "blue", name: "синій", color: "#1e5bd8" },
  { id: "purple", name: "фіолетовий", color: "#8e24aa" },
  { id: "pink", name: "рожевий", color: "#f06292" },
  { id: "brown", name: "коричневий", color: "#795548" },
  { id: "white", name: "білий", color: "#f5f5f5" },
  { id: "gray", name: "сірий", color: "#9e9e9e" },
  { id: "black", name: "чорний", color: "#2b2b2b" },
];
export const paintById = (id: string | undefined) => PAINTS.find((paint) => paint.id === id);

/**
 * Деталь у клітинці: «wood» — куб, «wood/tri» — дерев'яний трикутник,
 * «wood/tri/blue» — синій трикутник (фарба — лише для матеріалів).
 */
export type Cell = string;
export function makeCell(block: BlockId, shape: Shape, paint?: string): Cell {
  if (paint && isMaterial(block) && paintById(paint)) return `${block}/${shape}/${paint}`;
  return shape === "full" ? block : `${block}/${shape}`;
}
export function parseCell(value: unknown): { block: BlockId; shape: Shape; paint?: string } | null {
  if (typeof value !== "string") return null;
  const [block, shape = "full", paint, extra] = value.split("/");
  if (extra !== undefined || !isBlock(block) || !shapesFor(block).includes(shape as Shape)) return null;
  if (paint === undefined) return { block, shape: shape as Shape };
  if (!isMaterial(block) || !paintById(paint)) return null;
  return { block, shape: shape as Shape, paint };
}

/** Суцільний колір деталі: фарба, а для фігур без фарби — основний колір матеріалу. Куб без фарби має текстуру. */
export function solidColor(piece: { block: BlockId; shape: Shape; paint?: string }): string | null {
  const paint = paintById(piece.paint);
  if (paint) return paint.color;
  if (piece.shape !== "full" && isMaterial(piece.block)) return MATERIAL_COLORS[piece.block as (typeof MATERIALS)[number]];
  return null;
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
