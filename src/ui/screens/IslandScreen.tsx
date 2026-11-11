import { type PointerEvent, useRef, useState } from "react";
import {
  type World,
  addPlot,
  demolishPlot,
  editPlot,
  placeBlock,
  placedCount,
  removeBlock,
} from "../../game/island/island";
import { BLOCKS, BLOCK_NAMES, type BlockId, MAX_PLOTS, PLOT_SIZE, type PlotKind } from "../../game/rewards/blocks";
import { Block } from "../components/Block";
import { Hero } from "../components/Avatar";
import { playSound } from "../sound";

type Tool = BlockId | "pick";

const KIND_INFO: Record<PlotKind, { icon: string; name: string; hint: string }> = {
  island: { icon: "🏝", name: "Острів", hint: "вид згори: стежки, сад, озеро" },
  house: { icon: "🏠", name: "Будова", hint: "вид збоку: хатинка, вежа, міст" },
};

interface Props {
  world: World;
  onChange: (world: World) => void;
}

/** Острів: ділянки, куди доня ставить здобуті блоки як захоче. Блоки можна малювати, ведучи пальцем. */
export function IslandScreen({ world, onChange }: Props) {
  const [tool, setTool] = useState<Tool>("grass");
  const [active, setActive] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const current = Math.min(active, world.plots.length - 1);
  const plot = world.plots[current]!;
  const { cols } = PLOT_SIZE[plot.kind];
  const total = BLOCKS.reduce((sum, block) => sum + world.inventory[block], 0);
  const placed = world.plots.reduce((sum, p) => sum + placedCount(p.cells), 0);

  // Під час малювання пальцем зміни йдуть одна за одною швидше, ніж оновлюється екран.
  const latest = useRef(world);
  latest.current = world;
  const lastCell = useRef<number | null>(null);

  const paint = (index: number) => {
    const next = editPlot(latest.current, current, (build) =>
      tool === "pick" ? removeBlock(build, index) : placeBlock(build, index, tool),
    );
    if (next === latest.current) return;
    latest.current = next;
    playSound(tool === "pick" ? "remove" : "place");
    onChange(next);
  };

  const cellAt = (event: PointerEvent) => {
    const value = document.elementFromPoint(event.clientX, event.clientY)?.getAttribute("data-cell");
    return value == null ? null : Number(value);
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    const index = cellAt(event);
    if (index === null) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Без захоплення малювання все одно працює, поки палець над сіткою.
    }
    lastCell.current = index;
    paint(index);
  };
  const move = (event: PointerEvent) => {
    if (lastCell.current === null) return;
    const index = cellAt(event);
    if (index === null || index === lastCell.current) return;
    lastCell.current = index;
    paint(index);
  };
  const up = () => {
    lastCell.current = null;
  };

  const plotName = (index: number) => {
    const kind = world.plots[index]!.kind;
    const number = world.plots.slice(0, index + 1).filter((p) => p.kind === kind).length;
    return `${KIND_INFO[kind].icon} ${KIND_INFO[kind].name} ${number}`;
  };

  const create = (kind: PlotKind) => {
    const next = addPlot(world, kind);
    if (next === world) return;
    onChange(next);
    setActive(next.plots.length - 1);
    setChoosing(false);
  };

  const demolish = () => {
    const count = placedCount(plot.cells);
    const question = count
      ? `Розібрати «${plotName(current)}»? Усі ${count} блоків повернуться в запас.`
      : `Прибрати порожню ділянку «${plotName(current)}»?`;
    if (!window.confirm(question)) return;
    onChange(demolishPlot(world, current));
    setActive(Math.max(0, current - 1));
  };

  return (
    <section className="panel">
      <h2>Мій острів</h2>
      <Hero event="island" variant={Math.floor(placed / 12)} />
      <p className="note">
        Вибери блок і торкнися клітинки або веди пальцем, щоб будувати цілим рядом. Кирка забирає блоки назад у запас.
      </p>

      <div className="choice" role="tablist" aria-label="Ділянки">
        {world.plots.map((_, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={index === current}
            className={`chip${index === current ? " chip-active" : ""}`}
            onClick={() => setActive(index)}
          >
            {plotName(index)}
          </button>
        ))}
        {world.plots.length < MAX_PLOTS && (
          <button className="chip" onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>
            ➕ Нова ділянка
          </button>
        )}
      </div>

      {choosing && (
        <div className="plot-kinds">
          {(Object.keys(KIND_INFO) as PlotKind[]).map((kind) => (
            <button key={kind} className="btn btn-quiet" onClick={() => create(kind)}>
              {KIND_INFO[kind].icon} {KIND_INFO[kind].name}
              <span className="note"> — {KIND_INFO[kind].hint}</span>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar" role="toolbar" aria-label="Блоки">
        {BLOCKS.map((block) => (
          <button
            key={block}
            className={`tool${tool === block ? " tool-active" : ""}`}
            disabled={world.inventory[block] === 0}
            onClick={() => setTool(block)}
            aria-pressed={tool === block}
            aria-label={`${BLOCK_NAMES[block]}: ${world.inventory[block]}`}
          >
            <Block id={block} size={34} />
            <b>{world.inventory[block]}</b>
          </button>
        ))}
        <button
          className={`tool${tool === "pick" ? " tool-active" : ""}`}
          onClick={() => setTool("pick")}
          aria-pressed={tool === "pick"}
          aria-label="Кирка: забрати блок"
        >
          <span className="tool-pick">⛏</span>
          <b>забрати</b>
        </button>
      </div>

      <div
        className={`island island-${plot.kind}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {plot.cells.map((cell, index) => (
          <button
            key={index}
            data-cell={index}
            className={`cell${cell ? ` block block-${cell}` : ""}`}
            // Мишу й дотик обробляє малювання вище; click тут лише для клавіатури.
            onClick={(event) => event.detail === 0 && paint(index)}
            aria-label={cell ? BLOCK_NAMES[cell] : plot.kind === "house" ? "повітря" : "вода"}
          />
        ))}
      </div>

      <p className="note">
        Тут {placedCount(plot.cells)} блоків, на всіх ділянках {placed}, у запасі ще {total}.
        {tool !== "pick" && world.inventory[tool] === 0 && ` Блоки «${BLOCK_NAMES[tool]}» закінчилися — здобудь ще на заняттях.`}
      </p>
      {world.plots.length > 1 && (
        <button className="btn btn-quiet" onClick={demolish}>
          Розібрати цю ділянку
        </button>
      )}
    </section>
  );
}
