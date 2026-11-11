/** Детермінований генератор випадкових чисел (mulberry32): той самий seed — ті самі приклади. */
export type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) throw new Error("Немає з чого вибирати");
  return items[Math.floor(random() * items.length)]!;
}

export function sample<T>(random: Random, items: readonly T[], count: number): T[] {
  const copy = [...items];
  const result: T[] = [];
  while (copy.length > 0 && result.length < count) {
    const index = Math.floor(random() * copy.length);
    result.push(copy[index]!);
    copy[index] = copy[copy.length - 1]!;
    copy.pop();
  }
  return result;
}
