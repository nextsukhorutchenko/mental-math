import { useState } from "react";
import { type Build, placeBlock, placedCount, removeBlock } from "../../game/island/island";
import { BLOCKS, BLOCK_NAMES, type BlockId, ISLAND_COLS } from "../../game/rewards/blocks";
import { Block } from "../components/Block";
import { Companion } from "../components/Companion";
import { playSound } from "../sound";

type Tool = BlockId | "pick";

interface Props {
  build: Build;
  onChange: (build: Build) => void;
}

/** Острів: клітинки на воді, куди доня ставить здобуті блоки як захоче. */
export function IslandScreen({ build, onChange }: Props) {
  const [tool, setTool] = useState<Tool>("grass");
  const total = BLOCKS.reduce((sum, block) => sum + build.inventory[block], 0);

  const tap = (index: number) => {
    const next = tool === "pick" ? removeBlock(build, index) : placeBlock(build, index, tool);
    if (next === build) return;
    playSound(tool === "pick" ? "remove" : "place");
    onChange(next);
  };

  return (
    <section className="panel">
      <h2>Мій острів</h2>
      <Companion event="island" variant={Math.floor(placedCount(build.island) / 12)} />
      <p className="note">
        Вибери блок і торкнися клітинки. Блоки здобуваються на заняттях; кирка забирає блок назад у запас.
      </p>

      <div className="toolbar" role="toolbar" aria-label="Блоки">
        {BLOCKS.map((block) => (
          <button
            key={block}
            className={`tool${tool === block ? " tool-active" : ""}`}
            disabled={build.inventory[block] === 0}
            onClick={() => setTool(block)}
            aria-pressed={tool === block}
            aria-label={`${BLOCK_NAMES[block]}: ${build.inventory[block]}`}
          >
            <Block id={block} size={34} />
            <b>{build.inventory[block]}</b>
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

      <div className="island" style={{ gridTemplateColumns: `repeat(${ISLAND_COLS}, 1fr)` }}>
        {build.island.map((cell, index) => (
          <button
            key={index}
            className={`cell${cell ? ` block block-${cell}` : ""}`}
            onClick={() => tap(index)}
            aria-label={cell ? BLOCK_NAMES[cell] : "вода"}
          />
        ))}
      </div>

      <p className="note">
        На острові {placedCount(build.island)} блоків, у запасі ще {total}.
        {tool !== "pick" && build.inventory[tool] === 0 && ` Блоки «${BLOCK_NAMES[tool]}» закінчилися — здобудь ще на заняттях.`}
      </p>
    </section>
  );
}
