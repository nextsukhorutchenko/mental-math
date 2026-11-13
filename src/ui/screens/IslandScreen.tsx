import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import {
  type World,
  addPlot,
  demolishPlot,
  editPlot,
  placeBlock,
  placedCount,
  removeBlock,
} from "../../game/island/island";
import { QUESTS, type Quest, questProgress } from "../../game/island/quests";
import {
  BLOCKS,
  BLOCK_NAMES,
  type BlockId,
  type Cell,
  ITEMS,
  MATERIALS,
  MAX_PLOTS,
  PAINTS,
  PLOT_SIZE,
  type PlotKind,
  SHAPE_NAMES,
  type Shape,
  isMaterial,
  makeCell,
  paintById,
  parseCell,
  shapesFor,
  solidColor,
} from "../../game/rewards/blocks";
import { CARD_ITEMS, MIN_TASK_EXAMPLES, TASK_REWARDS } from "../../game/rewards/rewards";
import { FLASH_LOOT } from "../../game/flash/flash";
import { Block, LootList } from "../components/Block";
import { Hero } from "../components/Avatar";
import { playSound } from "../sound";

type Tool = BlockId | "pick";

const KIND_INFO: Record<PlotKind, { icon: string; name: string; hint: string }> = {
  island: { icon: "🏝", name: "Острів", hint: "вид згори: стежки, сад, озеро" },
  house: { icon: "🏠", name: "Будова", hint: "вид збоку: хатинка, вежа, міст" },
  detail: { icon: "🔍", name: "Детальна будова", hint: "дрібні клітинки для гарних деталей" },
};

/** Деталь у клітинці: форма з CSS; фігури й пофарбовані деталі — одного кольору, куб без фарби — з текстурою. */
function Piece({ cell }: { cell: Cell }) {
  const piece = parseCell(cell);
  if (!piece) return null;
  const color = solidColor(piece);
  return color ? (
    <span className={`piece solid shape-${piece.shape}`} style={{ "--solid": color } as CSSProperties} />
  ) : (
    <span className={`piece block block-${piece.block} shape-${piece.shape}`} />
  );
}

interface Props {
  world: World;
  questsDone: string[];
  onChange: (world: World) => void;
}

/** Острів: ділянки, куди доня ставить здобуті блоки як захоче. Блоки можна малювати, ведучи пальцем. */
export function IslandScreen({ world, questsDone, onChange }: Props) {
  const [tool, setTool] = useState<Tool>("grass");
  const [shape, setShape] = useState<Shape>("full");
  /** Фарба для деталей з матеріалів; undefined — колір самого матеріалу. */
  const [color, setColor] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const current = Math.min(active, world.plots.length - 1);
  const plot = world.plots[current]!;
  const { cols } = PLOT_SIZE[plot.kind];
  const total = BLOCKS.reduce((sum, block) => sum + world.inventory[block], 0);
  const placed = world.plots.reduce((sum, p) => sum + placedCount(p.cells), 0);
  const shapes = tool === "pick" ? [] : shapesFor(tool);
  const activeShape = shapes.includes(shape) ? shape : "full";
  const progress = questProgress(world.plots);

  // Свято, коли завдання щойно виконано: приз уже в запасі.
  const [cheer, setCheer] = useState<Quest | null>(null);
  const doneBefore = useRef(questsDone);
  useEffect(() => {
    const fresh = questsDone.find((id) => !doneBefore.current.includes(id));
    doneBefore.current = questsDone;
    if (fresh) {
      setCheer(QUESTS.find((quest) => quest.id === fresh) ?? null);
      playSound("finish");
    }
  }, [questsDone]);

  // Під час малювання пальцем зміни йдуть одна за одною швидше, ніж оновлюється екран.
  const latest = useRef(world);
  latest.current = world;
  const lastCell = useRef<number | null>(null);

  const paint = (index: number) => {
    const next = editPlot(latest.current, current, (build) =>
      tool === "pick" ? removeBlock(build, index) : placeBlock(build, index, makeCell(tool, activeShape, color)),
    );
    if (next === latest.current) return;
    latest.current = next;
    playSound(tool === "pick" ? "remove" : "place");
    onChange(next);
  };

  const cellAt = (event: PointerEvent) => {
    const value = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-cell]")
      ?.getAttribute("data-cell");
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
      ? `Розібрати «${plotName(current)}»? Усі ${count} деталей повернуться в запас.`
      : `Прибрати порожню ділянку «${plotName(current)}»?`;
    if (!window.confirm(question)) return;
    onChange(demolishPlot(world, current));
    setActive(Math.max(0, current - 1));
  };

  const toolButton = (block: BlockId) => (
    <button
      key={block}
      className={`tool${tool === block ? " tool-active" : ""}`}
      disabled={world.inventory[block] === 0}
      onClick={() => setTool(block)}
      aria-pressed={tool === block}
      aria-label={`${BLOCK_NAMES[block]}: ${world.inventory[block]}`}
      title={BLOCK_NAMES[block]}
    >
      <Block id={block} size={34} />
      <b>{world.inventory[block]}</b>
    </button>
  );

  return (
    <section className="panel">
      <h2>Мій острів</h2>
      <Hero event="island" variant={Math.floor(placed / 12)} place={plot.kind} />
      <p className="note">
        Вибери блок і форму, а тоді торкнися клітинки або веди пальцем. Будь-яка форма коштує один блок; змінити
        форму вже поставленої деталі можна безкоштовно. Кирка забирає деталь назад у запас.
      </p>

      {cheer && (
        <div className="banner banner-resume quest-cheer" role="status">
          <span>
            🎉 Завдання «{cheer.title}» виконано! Приз уже в запасі:
          </span>
          <LootList loot={cheer.reward} />
          <button className="btn btn-quiet" onClick={() => setCheer(null)}>
            Ура!
          </button>
        </div>
      )}

      <div className="choice">
        {/* Список вкладок містить лише вкладки; кнопка нової ділянки стоїть поруч, а не всередині нього. */}
        <div role="tablist" aria-label="Ділянки" style={{ display: "contents" }}>
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
        </div>
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

      <div className="toolbar" role="toolbar" aria-label="Матеріали">
        {MATERIALS.map(toolButton)}
        <button
          className={`tool${tool === "pick" ? " tool-active" : ""}`}
          onClick={() => setTool("pick")}
          aria-pressed={tool === "pick"}
          aria-label="Кирка: забрати деталь"
        >
          <span className="tool-pick">⛏</span>
          <b>забрати</b>
        </button>
      </div>
      <div className="toolbar" role="toolbar" aria-label="Предмети">
        {ITEMS.map(toolButton)}
      </div>

      {shapes.length > 1 && (
        <div className="shapes" role="radiogroup" aria-label="Форма">
          {shapes.map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={activeShape === option}
              className={`shape-chip${activeShape === option ? " shape-chip-active" : ""}`}
              onClick={() => setShape(option)}
              title={SHAPE_NAMES[option]}
            >
              <span className="shape-preview">
                <Piece cell={makeCell(tool as BlockId, option, color)} />
              </span>
              <small>{SHAPE_NAMES[option]}</small>
            </button>
          ))}
        </div>
      )}

      {tool !== "pick" && isMaterial(tool) && (
        <div className="paints" role="radiogroup" aria-label="Колір">
          <button
            role="radio"
            aria-checked={color === undefined}
            className={`paint paint-own${color === undefined ? " paint-active" : ""}`}
            onClick={() => setColor(undefined)}
            title="Колір матеріалу"
          >
            <span className="shape-preview">
              <Piece cell={makeCell(tool, "circle")} />
            </span>
            <small>як {BLOCK_NAMES[tool]}</small>
          </button>
          {PAINTS.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={color === option.id}
              aria-label={option.name}
              title={option.name}
              className={`paint${color === option.id ? " paint-active" : ""}`}
              style={{ "--solid": option.color } as CSSProperties}
              onClick={() => setColor(option.id)}
            />
          ))}
        </div>
      )}

      <div
        className={`island island-${plot.kind}`}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {plot.cells.map((cell, index) => {
          const piece = cell ? parseCell(cell) : null;
          return (
            <button
              key={index}
              data-cell={index}
              className={`cell${piece ? " filled" : ""}`}
              // Мишу й дотик обробляє малювання вище; click тут лише для клавіатури.
              onClick={(event) => event.detail === 0 && paint(index)}
              aria-label={
                piece
                  ? `${BLOCK_NAMES[piece.block]}${piece.shape === "full" ? "" : `, ${SHAPE_NAMES[piece.shape]}`}${
                      piece.paint ? `, ${paintById(piece.paint)!.name}` : ""
                    }`
                  : plot.kind === "island"
                    ? "вода"
                    : "повітря"
              }
            >
              {cell && <Piece cell={cell} />}
            </button>
          );
        })}
      </div>

      <p className="note">
        Тут {placedCount(plot.cells)} деталей, на всіх ділянках {placed}, у запасі ще {total}.
        {tool !== "pick" &&
          world.inventory[tool] === 0 &&
          ` «${BLOCK_NAMES[tool]}» закінчилися — подивись нижче, за що їх дають.`}
      </p>
      {world.plots.length > 1 && (
        <button className="btn btn-quiet" onClick={demolish}>
          Розібрати цю ділянку
        </button>
      )}

      <h3>Завдання будівельника</h3>
      <ul className="quests">
        {QUESTS.map((quest) => {
          const done = questsDone.includes(quest.id);
          const value = done ? quest.goal : progress[quest.id]!;
          return (
            <li key={quest.id} className={done ? "quest-done" : undefined}>
              <span className="quest-icon">{done ? "✅" : quest.icon}</span>
              <span className="quest-text">
                <b>{quest.title}</b>
                <span className="quest-bar" aria-hidden="true">
                  <i style={{ width: `${(value / quest.goal) * 100}%` }} />
                </span>
                <small>
                  {value} з {quest.goal}
                  {done ? " · приз отримано" : " · приз:"}
                </small>
              </span>
              {!done && <LootList loot={quest.reward} />}
            </li>
          );
        })}
      </ul>

      <details className="reward-guide">
        <summary>Звідки беруться блоки й предмети</summary>
        <ul>
          <li>Кожен розв'язаний приклад дає матеріал світу: ліс — дерево, печери — камінь, пустеля — пісок і так далі.</li>
          <li>
            За заняття в тренажері чи на карті, доведене до кінця (від {MIN_TASK_EXAMPLES} прикладів), — ще й предмети:
          </li>
          {TASK_REWARDS.map((task) => (
            <li key={task.id} className="reward-row">
              <span>{task.title}</span>
              <LootList loot={task.loot} />
            </li>
          ))}
          <li className="reward-row">
            <span>Картки з абакусом: {CARD_ITEMS.flowerAt}+ карток / {CARD_ITEMS.windowAt}+ карток</span>
            <LootList loot={{ flower: 1, window: 1 }} />
          </li>
          <li className="reward-row">
            <span>Флеш-виклик: новий рекорд</span>
            <LootList loot={FLASH_LOOT} />
          </li>
          <li>А ще — призи за завдання будівельника вище.</li>
        </ul>
      </details>
    </section>
  );
}
