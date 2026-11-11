import { type BlockId, type Inventory, type Loot, type Plot, type Shape, isMaterial, parseCell } from "../rewards/blocks";
import { withLoot } from "../rewards/rewards";

/**
 * Завдання будівельника: прості цілі, що підказують, що цікавого збудувати,
 * і дають за це приз. Кожне завдання нагороджує один раз.
 */

interface Piece {
  block: BlockId;
  shape: Shape;
  plot: Plot;
}

function pieces(plots: Plot[]): Piece[] {
  return plots.flatMap((plot) =>
    plot.cells.flatMap((cell) => {
      const piece = cell ? parseCell(cell) : null;
      return piece ? [{ ...piece, plot }] : [];
    }),
  );
}

export interface Quest {
  id: string;
  icon: string;
  title: string;
  goal: number;
  reward: Loot;
  progress: (pieces: Piece[]) => number;
}

const count = (test: (piece: Piece) => boolean) => (list: Piece[]) => list.filter(test).length;

export const QUESTS: Quest[] = [
  { id: "door", icon: "🚪", title: "Постав двері до хатинки", goal: 1, reward: { window: 2 }, progress: count((p) => p.block === "door") },
  { id: "windows", icon: "🪟", title: "Зроби два вікна", goal: 2, reward: { lamp: 1 }, progress: count((p) => p.block === "window") },
  {
    id: "roof",
    icon: "🔺",
    title: "Накрий дах скатами чи трикутниками",
    goal: 4,
    reward: { brick: 6 },
    progress: count((p) => p.shape === "slope-r" || p.shape === "slope-l" || p.shape === "tri"),
  },
  { id: "stairs", icon: "🪜", title: "Збудуй сходи на 3 сходинки", goal: 3, reward: { flower: 3 }, progress: count((p) => p.block === "stairs") },
  { id: "columns", icon: "🏛", title: "Постав 4 колони-циліндри", goal: 4, reward: { gold: 3 }, progress: count((p) => p.shape === "cyl") },
  { id: "towers", icon: "🏰", title: "Вежа з конусом на даху: 2 конуси", goal: 2, reward: { crystal: 2 }, progress: count((p) => p.shape === "cone") },
  { id: "circles", icon: "⚪", title: "Зроби круглі вікна чи кулі: 3 кола", goal: 3, reward: { glass: 4 }, progress: count((p) => p.shape === "circle") },
  { id: "street", icon: "💡", title: "Освіти вулицю двома ліхтарями", goal: 2, reward: { truck: 1 }, progress: count((p) => p.block === "lamp") },
  { id: "garden", icon: "🌸", title: "Посади клумбу з 5 квітів", goal: 5, reward: { grass: 10 }, progress: count((p) => p.block === "flower") },
  {
    id: "trucks",
    icon: "🛻",
    title: "Гараж для машинок-монстрів: 3 машинки",
    goal: 3,
    reward: { crystal: 3 },
    progress: count((p) => p.block === "truck"),
  },
  {
    id: "materials",
    icon: "🎨",
    title: "Будуй з 6 різних матеріалів",
    goal: 6,
    reward: { crystal: 3 },
    progress: (list) => new Set(list.filter((p) => isMaterial(p.block)).map((p) => p.block)).size,
  },
  {
    id: "detail",
    icon: "🔍",
    title: "Детальна будова: 40 деталей",
    goal: 40,
    reward: { stairs: 3, door: 1 },
    progress: count((p) => p.plot.kind === "detail"),
  },
];

export function questProgress(plots: Plot[]): Record<string, number> {
  const list = pieces(plots);
  return Object.fromEntries(QUESTS.map((quest) => [quest.id, Math.min(quest.goal, quest.progress(list))]));
}

/** Видає призи за щойно виконані завдання. Повертає ті самі дані, якщо нічого не змінилося. */
export function claimQuests<T extends { plots: Plot[]; inventory: Inventory; questsDone: string[] }>(data: T): T {
  const progress = questProgress(data.plots);
  const fresh = QUESTS.filter((quest) => !data.questsDone.includes(quest.id) && progress[quest.id]! >= quest.goal);
  if (fresh.length === 0) return data;
  let inventory = data.inventory;
  for (const quest of fresh) inventory = withLoot(inventory, quest.reward);
  return { ...data, inventory, questsDone: [...data.questsDone, ...fresh.map((quest) => quest.id)] };
}
