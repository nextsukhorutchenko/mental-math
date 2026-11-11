import { BLOCKS, BLOCK_NAMES, type BlockId, type Loot } from "../../game/rewards/blocks";

/** Квадратний блок власного світу; малюнок повністю в CSS. */
export function Block({ id, size = 28 }: { id: BlockId; size?: number }) {
  return <span className={`block block-${id}`} style={{ width: size, height: size }} role="img" aria-label={BLOCK_NAMES[id]} />;
}

/** Рядок «блок × кількість» для здобичі чи інвентаря. */
export function LootList({ loot }: { loot: Loot }) {
  const items = BLOCKS.filter((block) => (loot[block] ?? 0) > 0);
  if (items.length === 0) return null;
  return (
    <ul className="loot">
      {items.map((block) => (
        <li key={block}>
          <Block id={block} />
          <b>+{loot[block]}</b>
          <span>{BLOCK_NAMES[block]}</span>
        </li>
      ))}
    </ul>
  );
}
