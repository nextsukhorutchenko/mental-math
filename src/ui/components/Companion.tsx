import { COMPANION_NAME, type CompanionEvent, type Mood, phrase } from "../../game/companion/phrases";

// Власний персонаж застосунку — блокове лисеня. O руде, W біле, K темне, E око.
const SPRITE = [
  "..OO........OO..",
  "..OKO......OKO..",
  "..OOOOOOOOOOOO..",
  "..OOOOOOOOOOOO..",
  "..OOEOOOOOOEOO..",
  "..OOEOOOOOOEOO..",
  "..OWWOOOOOOWWO..",
  "..WWWWWKKWWWWW..",
  "...WWWWWWWWWW...",
  "....WWWWWWWW....",
];

const COLORS: Record<string, string> = { O: "#e8792b", W: "#fff6e8", K: "#2b2118", E: "#2b2118" };

function Sprite({ mood }: { mood: Mood }) {
  const joyful = mood === "happy" || mood === "cheer";
  return (
    <svg className={`fox fox-${mood}`} viewBox="0 0 16 10" role="img" aria-label={COMPANION_NAME} shapeRendering="crispEdges">
      {SPRITE.flatMap((row, y) =>
        [...row].map((cell, x) => {
          if (cell === ".") return null;
          // Радісні очі — примружені: лишаємо тільки верхній піксель.
          const squint = cell === "E" && joyful && y === 5;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={squint ? COLORS.O : COLORS[cell]} />;
        }),
      )}
    </svg>
  );
}

/** Супутник із реплікою. variant обирає фразу зі списку для події. */
export function Companion({ event, variant = 0 }: { event: CompanionEvent; variant?: number }) {
  const { text, mood } = phrase(event, variant);
  return (
    <div className="companion">
      <Sprite mood={mood} />
      <p className="bubble">{text}</p>
    </div>
  );
}
