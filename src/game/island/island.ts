import type { BlockId, Inventory, Island } from "../rewards/blocks";

export interface Build {
  inventory: Inventory;
  island: Island;
}

/**
 * Ставить блок у клітинку. Якщо блоків цього виду немає або клітинки не існує — нічого не змінює.
 * Блок, що вже стояв у клітинці, повертається в інвентар.
 */
export function placeBlock(build: Build, index: number, block: BlockId): Build {
  if (index < 0 || index >= build.island.length) return build;
  const existing = build.island[index] ?? null;
  if (existing === block || build.inventory[block] < 1) return build;
  const inventory = { ...build.inventory, [block]: build.inventory[block] - 1 };
  if (existing) inventory[existing] += 1;
  const island = [...build.island];
  island[index] = block;
  return { inventory, island };
}

/** Забирає блок із клітинки назад в інвентар. */
export function removeBlock(build: Build, index: number): Build {
  const existing = build.island[index];
  if (!existing) return build;
  const island = [...build.island];
  island[index] = null;
  return { inventory: { ...build.inventory, [existing]: build.inventory[existing] + 1 }, island };
}

/** Скільки блоків стоїть на острові. */
export function placedCount(island: Island): number {
  return island.filter(Boolean).length;
}
