import type { CSSProperties } from "react";
import type { HolidayId, Season } from "../../game/seasons/seasons";

/**
 * Фон застосунку: піксельні дерева за порою року, листя чи сніжинки, що падають,
 * і святкові сцени. Лежить під усім вмістом і не реагує на дотики.
 * Для тих, хто вимкнув анімації, усе стоїть на місці (див. theme.css).
 */

type Palette = Record<string, string>;

function Sprite(props: { rows: string[]; colors: Palette; className?: string; style?: CSSProperties; lights?: string }) {
  const { rows, colors, className, style, lights = "" } = props;
  const width = Math.max(...rows.map((row) => row.length));
  return (
    <svg className={className} style={style} viewBox={`0 0 ${width} ${rows.length}`} shapeRendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." || !colors[cell] ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1.02}
              height={1.02}
              fill={colors[cell]}
              className={lights.includes(cell) ? "light" : undefined}
              style={lights.includes(cell) ? { animationDelay: `${((x * 7 + y * 3) % 10) / 5}s` } : undefined}
            />
          ),
        ),
      )}
    </svg>
  );
}

const LEAFY_TREE = [
  ".....LLLLLL.....",
  "...LLLLrLLLLL...",
  "..LLlLLLLLLlLL..",
  ".LLLLLLLLrLLLLL.",
  "LLrLLLlLLLLLLLLL",
  "LLLLLLLLLLLlLLrL",
  "LLLlLLLrLLLLLLLL",
  ".LLLLLLLLLLLlLL.",
  ".LLLrLLlLLLLLLL.",
  "..LLLLLLLLLrLL..",
  "...LLlLTTLLLL...",
  ".....LLTTLL.....",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  ".....TTTtTT.....",
  "....TTTTtTTT....",
];

const BARE_TREE = [
  "W.......WW....W.",
  "T..W....T....WT.",
  ".T.T...T.....T..",
  ".T..T..T....T...",
  "..T.T..T...T.WW.",
  "..TT...T..T..T..",
  "...T...T.T..T...",
  "WW.T..TT.T.T....",
  ".T.TT.TTTT......",
  "..TTT..TTT......",
  "....TT.TT.......",
  ".....TTTT.......",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  "......TTtT......",
  ".....TTTtTT.....",
  "...WWTTTtTTWW...",
];

const FIR_TREE = [
  ".........Y..........",
  "........YYY.........",
  ".........Y..........",
  ".........G..........",
  "........GGG.........",
  ".......GgGrG........",
  "......GGGGGGG.......",
  ".......GbGGG........",
  "......GGGGGyGG......",
  ".....GyGGgGGGGG.....",
  "....GGGGGGGGrGGG....",
  "......GGrGGGG.......",
  ".....GGGGGGbGGG.....",
  "....GGbGGGGGGGGG....",
  "...GGGGGGyGGGGgGG...",
  "..GGgGGGGGGGGrGGGG..",
  ".....GGGGGGGGGG.....",
  "....GGyGGGGGGrGGG...",
  "...GGGGGGgGGGGGGGG..",
  "..GGGGrGGGGGbGGGGGG.",
  ".GGbGGGGGGGGGGGGyGGG",
  "GGGGGGGGGyGGGGGGGGGG",
  ".........TT.........",
  ".........TT.........",
  ".......PPPPPP.......",
  ".......PpPPpP.......",
];

const NICHOLAS = [
  "..Y......MM.......",
  ".Y.Y....MYYM......",
  ".Y.Y...MMYYMM.....",
  "..YY...MYYYYM.....",
  "...Y...MMYYMM.....",
  "...Y...YYYYYY.....",
  "...Y...SSSSSS.....",
  "...Y...SKSSKS.....",
  "...Y..WSSSSSSW....",
  "...Y..WWWmmWWW....",
  "...Y.RWWWWWWWWR...",
  "...SRRRWWWWWWRRR..",
  "...SRRRRWWWWRRRRR.",
  "...Y.RRRRWWRRRRRS.",
  "...Y.RRYRRRRRYRR..",
  "...Y.RRYRRRRRYRR..",
  "...Y.RRYRRRRRYRR..",
  "...Y.RRYRRRRRYRR..",
  "...Y.RRYRRRRRYRR..",
  "...Y.RRYYYYYYYRR..",
  "...Y.RRRRRRRRRRR..",
  "...Y.RRRRRRRRRRR..",
  "...Y.rRRRRRRRRRr..",
  "...Y..BB....BB....",
];

/** Санта: руки в червоних рукавах з білими манжетами й рукавицями опущені вздовж тулуба. */
const SANTA = [
  "................WWW...",
  "..............RRWWW...",
  "...........RRRRR......",
  ".........RRRRRRR......",
  "........RRRRRRRR......",
  ".......WWWWWWWWWW.....",
  ".......SSSSSSSSSS.....",
  ".......SSKKSSKKSS.....",
  ".......WSSSCCSSSW.....",
  ".......WWWmmmmWWW.....",
  "......WWWWWWWWWWWW....",
  "....RRRWWWWWWWWWWRRR..",
  "...RRRRRWWWWWWWWRRRRR.",
  "..RRRRRRRWWWWWWRRRRRRR",
  "..RRR.RRRRWWWWRRRR.RRR",
  "..RRR.RRRRRWWRRRRR.RRR",
  "..RRR.KKKKKYYKKKKK.RRR",
  "..WWW.KKKKKYYKKKKK.WWW",
  "..GGG.RRRRRWWRRRRR.GGG",
  "..GGG.RRRRRWWRRRRR.GGG",
  "......WWWWWWWWWWWW....",
  ".......RRRR..RRRR.....",
  ".......RRRR..RRRR.....",
  "......KKKKK..KKKKK....",
];

const GIFT = ["..Y.Y.", "...Y..", "AAAYAA", "AAAYAA", "YYYYYY", "AAAYAA", "AAAYAA"];
const LEAF = ["..LL.", ".LLlL", "LLlL.", "LlLL.", "S...."];
const SNOWFLAKE = ["...W...", ".W.W.W.", "..WWW..", "WWWWWWW", "..WWW..", ".W.W.W.", "...W..."];
const PETAL = [".P.", "PpP", ".P."];

const TRUNK = { T: "#7a4a22", t: "#5c3517" };
const TREE_COLORS: Record<Season, Palette> = {
  autumn: { ...TRUNK, L: "#f2c230", l: "#e88a1e", r: "#c8452a" },
  winter: { ...TRUNK, W: "#ffffff" },
  spring: { ...TRUNK, L: "#f7b8d2", l: "#ffffff", r: "#7cc55a" },
  summer: { ...TRUNK, L: "#4caf3a", l: "#2f8a24", r: "#6fcf4a" },
};
const FIR_COLORS: Palette = {
  G: "#2f7d3a",
  g: "#1f5a28",
  Y: "#ffd84a",
  y: "#ffd84a",
  r: "#ff4f4f",
  b: "#5ab8ff",
  T: "#7a4a22",
  P: "#c8452a",
  p: "#ffd84a",
};
const FIGURE_COLORS: Palette = {
  Y: "#e8b923",
  M: "#fbf6ee",
  S: "#f0d6c4",
  K: "#2b2118",
  W: "#ffffff",
  m: "#c98e86",
  R: "#c8302a",
  r: "#8f1f1a",
  B: "#3b2a1e",
  C: "#eba8a8",
  G: "#2f7d3a",
};

/** Писанки: однаковий візерунок у різних кольорах. */
const EGG = [
  "..XXXX..",
  ".XXXXXX.",
  "XXAXXAXX",
  "YYYYYYYY",
  "XAXAXAXA",
  "AXAXAXAX",
  "YYYYYYYY",
  "XXXAAXXX",
  ".XXXXXX.",
  "..XXXX..",
];
const EGG_COLORS: Palette[] = [
  { X: "#d9482b", Y: "#ffd84a", A: "#ffffff" },
  { X: "#3f7fd9", Y: "#ffffff", A: "#ffd84a" },
  { X: "#3d9a4a", Y: "#ffd84a", A: "#ffffff" },
  { X: "#b85cf0", Y: "#ffffff", A: "#ffd84a" },
];

/** Кошик із паскою й писанками. */
const BASKET = [
  "......WWWW......",
  ".....WyWWrW.....",
  "....WWWWWWWW....",
  "....PPPPPPPP....",
  "..XXPPPPPPPPZZ..",
  ".XXXPPPPPPPPZZZ.",
  "BBBBBBBBBBBBBBBB",
  "BbBbBbBbBbBbBbBb",
  ".BbBbBbBbBbBbBb.",
  "..BBBBBBBBBBBB..",
];
const BASKET_COLORS: Palette = {
  W: "#fffaf0",
  y: "#ffd84a",
  r: "#ff6fae",
  P: "#c98a3c",
  X: "#d9482b",
  Z: "#3f7fd9",
  B: "#a36a2c",
  b: "#7a4a22",
};

const BUNNY = [
  "..W.....W...",
  ".WPW...WPW..",
  ".WPW...WPW..",
  ".WPW...WPW..",
  "..WWWWWWW...",
  ".WWWWWWWWW..",
  ".WWKWWWKWW..",
  ".WWWWPWWWW..",
  "..WWWWWWW...",
  ".WWWWWWWWW..",
  "WWWWWWWWWWW.",
  "WWWWWWWWWWWW",
  ".WWW...WWW..",
];
const BUNNY_COLORS: Palette = { W: "#ffffff", P: "#f7a8c4", K: "#2b2118" };

/** Торт зі свічками: полум'я мерехтить. */
const CAKE = [
  "...F....F....F...",
  "...c....c....c...",
  "...c....c....c...",
  "..WWWWWWWWWWWWW..",
  ".WWPWWPWWWPWWPWW.",
  ".RRRRRRRRRRRRRRR.",
  ".RRRRyRRRRRyRRRR.",
  ".WWWWWWWWWWWWWWW.",
  ".RRRRRRRRRRRRRRR.",
  ".RRyRRRRRyRRRRyR.",
  "GGGGGGGGGGGGGGGGG",
];
const CAKE_COLORS: Palette = {
  F: "#ffb02e",
  c: "#5ab8ff",
  W: "#fffaf0",
  P: "#ff8ac0",
  R: "#ff6fae",
  y: "#ffd84a",
  G: "#d6d0c4",
};

const BALLOON = [
  "..XXX..",
  ".XXXXX.",
  "XXLXXXX",
  "XLXXXXX",
  "XXXXXXX",
  ".XXXXX.",
  "..XXX..",
  "...X...",
  "...S...",
  "....S..",
  "...S...",
  "..S....",
  "...S...",
];
const BALLOON_TINTS = ["#ff4f4f", "#ffd84a", "#5ab8ff", "#7cdc5a", "#b85cf0", "#ff8ac0"];

/** Ліхтар-гарбуз зі світлим обличчям. */
const PUMPKIN = [
  ".....gg.....",
  "......g.....",
  "..OOOoOOOO..",
  ".OOOOoOOOOO.",
  "OOFFOoOOFFOO",
  "OOFFOoOOFFOO",
  "OOOOOFFOOOOO",
  "OOFOFOFOFFOO",
  "OOFFFFFFFFOO",
  ".OOOOOOOOOO.",
  "..OOOOOOOO..",
];
const PUMPKIN_COLORS: Palette = { O: "#f07a1a", o: "#c95b0c", g: "#3d9a4a", F: "#ffe066" };

/** Добрий привид: усміхається й рум'яніє. */
const GHOST = [
  "...WWWW...",
  "..WWWWWW..",
  ".WWWWWWWW.",
  ".WKWWWWKW.",
  ".WKWWWWKW.",
  ".CWWmmWWC.",
  "WWWWWWWWWW",
  "WWWWWWWWWW",
  "WWWWWWWWWW",
  "WW.WWW.WWW",
  "W...W...W.",
];
const GHOST_COLORS: Palette = { W: "#f6f3ff", K: "#2b2118", C: "#f7a8c4", m: "#c98e86" };

const BAT = ["X.........X", "XX..X.X..XX", "XXXXXXXXXXX", ".XXX.X.XXX.", "..X.....X.."];

/** Детерміновані позиції частинок: однакові при кожному показі, без випадковості в рендері. */
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: -((i * 1.7) % 14),
  duration: 9 + ((i * 5) % 8),
  size: 14 + ((i * 7) % 4) * 5,
  sway: 20 + ((i * 13) % 30),
  tint: i % 3,
}));

const CONFETTI = ["#ff4f4f", "#ffd84a", "#5ab8ff", "#7cdc5a", "#b85cf0", "#ff8ac0"];

function Falling({ kind }: { kind: "leaf" | "snow" | "petal" | "confetti" }) {
  const leafTints = [
    { L: "#f2c230", l: "#e88a1e", S: "#7a4a22" },
    { L: "#e88a1e", l: "#c8452a", S: "#7a4a22" },
    { L: "#c8452a", l: "#8f1f1a", S: "#5c3517" },
  ];
  return (
    <div className="fall">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="fall-item"
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--sway": `${p.sway}px`,
              // Де частинка застигає, якщо анімації вимкнено.
              "--rest": `${(i * 29 + 8) % 80}vh`,
            } as CSSProperties
          }
        >
          {kind === "leaf" && <Sprite rows={LEAF} colors={leafTints[p.tint]!} style={{ width: p.size }} className="fall-spin" />}
          {kind === "snow" && (
            <Sprite rows={SNOWFLAKE} colors={{ W: "#ffffff" }} style={{ width: p.size * 0.8 }} className="fall-spin" />
          )}
          {kind === "petal" && <Sprite rows={PETAL} colors={{ P: "#f7b8d2", p: "#ffffff" }} style={{ width: p.size * 0.6 }} />}
          {kind === "confetti" && (
            <Sprite
              rows={["XX", "XX", "XX"]}
              colors={{ X: CONFETTI[i % CONFETTI.length]! }}
              style={{ width: p.size * 0.45 }}
              className="fall-spin"
            />
          )}
        </span>
      ))}
    </div>
  );
}

const BURSTS = [
  { left: 14, top: 14, color: "#ffd84a", delay: 0 },
  { left: 82, top: 10, color: "#ff6fae", delay: 1.1 },
  { left: 30, top: 30, color: "#5ab8ff", delay: 2.2 },
  { left: 68, top: 26, color: "#7cff6b", delay: 0.6 },
  { left: 50, top: 8, color: "#ff8a3d", delay: 1.7 },
];

function Fireworks() {
  return (
    <div className="fireworks">
      {BURSTS.map((burst, i) => (
        <div
          key={i}
          className="burst"
          style={{ left: `${burst.left}%`, top: `${burst.top}%`, color: burst.color, animationDelay: `${burst.delay}s` }}
        >
          {Array.from({ length: 12 }, (_, j) => (
            <i key={j} style={{ "--a": `${j * 30}deg`, animationDelay: `${burst.delay}s` } as CSSProperties} />
          ))}
        </div>
      ))}
    </div>
  );
}

const STARS = Array.from({ length: 26 }, (_, i) => ({ left: (i * 41 + 7) % 100, top: (i * 23 + 5) % 45 }));

/** Кульки повільно здіймаються вгору, кожна у своєму місці й темпі. */
function Balloons() {
  return (
    <div className="balloons">
      {BALLOON_TINTS.concat(BALLOON_TINTS).map((tint, i) => (
        <span
          key={i}
          className="rise"
          style={
            {
              left: `${(i * 23 + 4) % 96}%`,
              animationDelay: `${-((i * 2.3) % 16)}s`,
              animationDuration: `${14 + ((i * 3) % 7)}s`,
              "--rest": `${10 + ((i * 31) % 60)}vh`,
            } as CSSProperties
          }
        >
          <Sprite rows={BALLOON} colors={{ X: tint, L: "#ffffff", S: "#6b5a48" }} style={{ width: 34 + (i % 3) * 8 }} />
        </span>
      ))}
    </div>
  );
}

/** Кажани пролітають небом. */
function Bats() {
  return (
    <div className="bats">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="fly"
          style={
            { top: `${8 + i * 9}%`, animationDelay: `${-i * 4.5}s`, "--rest": `${15 + i * 22}vw` } as CSSProperties
          }
        >
          <Sprite rows={BAT} colors={{ X: "#241733" }} style={{ width: 44 - i * 6 }} />
        </span>
      ))}
    </div>
  );
}

export function Backdrop({ season, holiday }: { season: Season; holiday: HolidayId | null }) {
  const winter = holiday === "nicholas" || holiday === "christmas" || holiday === "newyear";
  if (holiday === "easter") {
    return (
      <div className="backdrop" aria-hidden="true">
        <Sprite rows={LEAFY_TREE} colors={TREE_COLORS.spring} className="scene scene-left scene-tree" />
        <Sprite rows={BUNNY} colors={BUNNY_COLORS} className="scene scene-right scene-bunny" />
        <Sprite rows={BASKET} colors={BASKET_COLORS} className="scene scene-basket" />
        <div className="eggs">
          {EGG_COLORS.map((colors, i) => (
            <Sprite key={i} rows={EGG} colors={colors} />
          ))}
        </div>
        <Falling kind="petal" />
      </div>
    );
  }
  if (holiday === "birthday") {
    return (
      <div className="backdrop" aria-hidden="true">
        <Sprite rows={LEAFY_TREE} colors={TREE_COLORS.summer} className="scene scene-left scene-tree scene-small" />
        <Sprite rows={CAKE} colors={CAKE_COLORS} lights="F" className="scene scene-right scene-cake" />
        <Balloons />
        <Falling kind="confetti" />
      </div>
    );
  }
  if (holiday === "halloween") {
    return (
      <div className="backdrop" aria-hidden="true">
        <i className="moon" />
        <Bats />
        <Sprite rows={BARE_TREE} colors={{ ...TRUNK, T: "#3a2a3f", t: "#2a1d2e" }} className="scene scene-left scene-tree" />
        <Sprite rows={GHOST} colors={GHOST_COLORS} className="scene scene-right scene-ghost" />
        <div className="pumpkins">
          <Sprite rows={PUMPKIN} colors={PUMPKIN_COLORS} lights="F" />
          <Sprite rows={PUMPKIN} colors={PUMPKIN_COLORS} lights="F" />
          <Sprite rows={PUMPKIN} colors={PUMPKIN_COLORS} lights="F" />
        </div>
        <Falling kind="leaf" />
      </div>
    );
  }
  return (
    <div className="backdrop" aria-hidden="true">
      {winter && (
        <div className="stars">
          {STARS.map((star, i) => (
            <i key={i} style={{ left: `${star.left}%`, top: `${star.top}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
          ))}
        </div>
      )}
      {holiday === "newyear" && <Fireworks />}

      {holiday === "christmas" || holiday === "newyear" ? (
        <>
          <Sprite rows={FIR_TREE} colors={FIR_COLORS} lights="ryb" className="scene scene-left scene-fir" />
          {holiday === "christmas" ? (
            <Sprite rows={SANTA} colors={FIGURE_COLORS} className="scene scene-right scene-figure" />
          ) : (
            <Sprite rows={FIR_TREE} colors={FIR_COLORS} lights="ryb" className="scene scene-right scene-fir scene-small" />
          )}
        </>
      ) : holiday === "nicholas" ? (
        <>
          <Sprite rows={BARE_TREE} colors={TREE_COLORS.winter} className="scene scene-left scene-tree" />
          <Sprite rows={NICHOLAS} colors={FIGURE_COLORS} className="scene scene-right scene-figure" />
        </>
      ) : (
        <>
          <Sprite
            rows={season === "winter" ? BARE_TREE : LEAFY_TREE}
            colors={TREE_COLORS[season]}
            className="scene scene-left scene-tree"
          />
          <Sprite
            rows={season === "winter" ? BARE_TREE : LEAFY_TREE}
            colors={TREE_COLORS[season]}
            className="scene scene-right scene-tree scene-small"
          />
        </>
      )}

      {(holiday === "christmas" || holiday === "nicholas") && (
        <div className={`gifts gifts-${holiday}`}>
          <Sprite rows={GIFT} colors={{ A: "#d9482b", Y: "#ffd84a" }} />
          <Sprite rows={GIFT} colors={{ A: "#3f7fd9", Y: "#ffffff" }} />
          <Sprite rows={GIFT} colors={{ A: "#3d9a4a", Y: "#ffd84a" }} />
        </div>
      )}

      {season === "autumn" && !holiday && <Falling kind="leaf" />}
      {(winter || season === "winter") && <Falling kind="snow" />}
      {season === "spring" && !holiday && <Falling kind="petal" />}
    </div>
  );
}
