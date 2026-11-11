import {
  type BlockId,
  type Cell,
  type Inventory,
  isCell,
  parseCell,
  type Island,
  MAX_PLOTS,
  type Plot,
  type PlotKind,
  emptyPlot,
} from "../rewards/blocks";

export interface Build {
  inventory: Inventory;
  island: Island;
}

/** Матеріал деталі в клітинці (будь-якої форми). */
export const blockOf = (cell: Cell): BlockId => parseCell(cell)!.block;

/**
 * Ставить деталь у клітинку. Деталь будь-якої форми коштує один блок свого матеріалу.
 * Якщо блоків немає або клітинки не існує — нічого не змінює. Деталь, що стояла в клітинці,
 * повертається в запас; змінити форму того самого матеріалу можна безкоштовно.
 */
export function placeBlock(build: Build, index: number, cell: Cell): Build {
  if (index < 0 || index >= build.island.length || !isCell(cell)) return build;
  const existing = build.island[index] ?? null;
  if (existing === cell) return build;
  const block = blockOf(cell);
  const reshape = existing !== null && blockOf(existing) === block;
  if (!reshape && build.inventory[block] < 1) return build;
  const inventory = { ...build.inventory };
  if (!reshape) {
    inventory[block] -= 1;
    if (existing) inventory[blockOf(existing)] += 1;
  }
  const island = [...build.island];
  island[index] = cell;
  return { inventory, island };
}

/** Забирає деталь із клітинки назад у запас. */
export function removeBlock(build: Build, index: number): Build {
  const existing = build.island[index];
  if (!existing) return build;
  const block = blockOf(existing);
  const island = [...build.island];
  island[index] = null;
  return { inventory: { ...build.inventory, [block]: build.inventory[block] + 1 }, island };
}

/** Скільки блоків стоїть на острові. */
export function placedCount(island: Island): number {
  return island.filter(Boolean).length;
}

export interface World {
  inventory: Inventory;
  plots: Plot[];
}

/** Додає порожню ділянку, якщо ще не досягнуто межі. */
export function addPlot(world: World, kind: PlotKind): World {
  if (world.plots.length >= MAX_PLOTS) return world;
  return { ...world, plots: [...world.plots, emptyPlot(kind)] };
}

/** Розбирає ділянку: усі її блоки повертаються в запас. Остання ділянка лишається завжди. */
export function demolishPlot(world: World, index: number): World {
  if (world.plots.length <= 1 || !world.plots[index]) return world;
  const inventory = { ...world.inventory };
  for (const cell of world.plots[index].cells) if (cell) inventory[blockOf(cell)] += 1;
  return { inventory, plots: world.plots.filter((_, i) => i !== index) };
}

/** Застосовує зміну однієї ділянки (поставити чи забрати блок) до всього світу. */
export function editPlot(world: World, index: number, edit: (build: Build) => Build): World {
  const plot = world.plots[index];
  if (!plot) return world;
  const before = { inventory: world.inventory, island: plot.cells };
  const after = edit(before);
  if (after === before) return world;
  const plots = [...world.plots];
  plots[index] = { ...plot, cells: after.island };
  return { inventory: after.inventory, plots };
}
