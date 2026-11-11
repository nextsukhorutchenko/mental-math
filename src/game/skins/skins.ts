/**
 * Скіни гравця: піксельні фігурки 16×34 у пропорціях блокового персонажа
 * (вушка 2 рядки, голова 8×8, тулуб 8×12, руки по 4 клітинки, ноги 8×12).
 * Перший скін — Полин власний, намальований вручну; решту генерує buildSkin з короткого опису.
 */

export interface Sprite {
  rows: string[];
  colors: Record<string, string>;
}

type Pair = readonly [main: string, shade: string];

export interface SkinSpec {
  id: string;
  name: string;
  skin: Pair;
  hair: Pair;
  eyes: string;
  /** long — волосся до плечей; short — коротке; hood — капюшон кольору topColor. */
  style: "long" | "short" | "hood";
  top: "none" | "cat" | "bear" | "frog" | "crown" | "bow" | "horns";
  topColor?: Pair;
  shirt: Pair;
  pattern: "plain" | "stripes" | "jacket" | "scarf" | "rune" | "abs" | "tie";
  accent: string;
  sleeves: Pair;
  hands?: "skin" | "sleeve" | "glove";
  pants: Pair;
  shoes: string;
  socks?: string;
}

export const SKIN_COLS = 16;
export const SKIN_ROWS = 34;

export function buildSkin(spec: SkinSpec): Sprite {
  const grid = Array.from({ length: SKIN_ROWS }, () => Array<string>(SKIN_COLS).fill("."));
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y]![x] = c;
  };
  const put = (points: [number, number][], c: string) => points.forEach(([x, y]) => (grid[y]![x] = c));

  // Обличчя.
  rect(4, 2, 11, 9, "S");
  put([[5, 6], [9, 6]], "L");
  put([[6, 6], [10, 6], [6, 7], [10, 7]], "E");
  put([[5, 7], [9, 7]], "K");
  put([[5, 8], [10, 8]], "C");
  put([[7, 9], [8, 9]], "m");

  // Тулуб, руки, ноги.
  rect(4, 10, 11, 21, "T");
  rect(4, 21, 11, 21, "t");
  rect(0, 10, 3, 21, "Q");
  rect(12, 10, 15, 21, "Q");
  rect(0, 10, 0, 21, "q");
  rect(15, 10, 15, 21, "q");
  const hands = spec.hands ?? "skin";
  if (hands !== "sleeve") {
    const c = hands === "glove" ? "G" : "S";
    rect(0, 19, 3, 21, c);
    rect(12, 19, 15, 21, c);
    if (hands === "skin") put([[0, 19], [0, 20], [0, 21], [15, 19], [15, 20], [15, 21]], "s");
  }
  rect(4, 22, 11, 29, "P");
  rect(8, 22, 8, 29, "p");
  if (spec.socks) rect(4, 28, 11, 29, "O");
  rect(4, 30, 11, 33, "B");

  // Візерунок одягу.
  switch (spec.pattern) {
    case "stripes":
      for (const y of [12, 15, 18]) {
        rect(4, y, 11, y, "A");
        rect(0, y, 3, y, "A");
        rect(12, y, 15, y, "A");
      }
      for (const y of [24, 27]) rect(4, y, 11, y, "A");
      break;
    case "jacket":
      rect(6, 11, 9, 20, "A");
      break;
    case "scarf":
      rect(4, 10, 11, 11, "A");
      rect(6, 12, 7, 15, "A");
      break;
    case "rune":
      put(
        [
          [6, 12], [7, 12], [8, 12], [9, 12], [6, 13], [9, 13], [6, 14], [7, 14],
          [8, 14], [9, 14], [7, 15], [8, 16], [7, 17], [8, 17], [1, 14], [14, 16],
        ],
        "A",
      );
      break;
    case "abs":
      rect(5, 13, 10, 13, "t");
      rect(5, 16, 10, 16, "t");
      rect(7, 12, 7, 20, "t");
      rect(4, 21, 11, 21, "P");
      break;
    case "tie":
      rect(6, 10, 9, 10, "A");
      rect(7, 11, 8, 17, "A");
      break;
    case "plain":
      break;
  }

  // Волосся поверх голови й плечей.
  rect(4, 2, 11, 4, "H");
  put([[5, 3], [9, 3], [7, 4]], "h");
  if (spec.style === "short") put([[4, 5], [11, 5]], "H");
  if (spec.style === "long") {
    rect(4, 5, 4, 15, "H");
    rect(11, 5, 11, 15, "H");
    put([[4, 7], [11, 9], [4, 12], [11, 13]], "h");
  }
  if (spec.style === "hood") {
    rect(4, 2, 11, 3, "X");
    rect(4, 4, 4, 10, "X");
    rect(11, 4, 11, 10, "X");
    rect(5, 10, 10, 10, "X");
    put([[5, 5], [10, 5], [5, 9]], "H");
  }

  // Вушка, корона, бантик…
  switch (spec.top) {
    case "cat":
      put([[4, 0], [5, 0], [10, 0], [11, 0], [4, 1], [11, 1]], "X");
      put([[5, 1], [10, 1]], "x");
      break;
    case "bear":
      put([[4, 0], [5, 0], [10, 0], [11, 0], [4, 1], [6, 1], [9, 1], [11, 1]], "X");
      put([[5, 1], [10, 1]], "x");
      break;
    case "frog":
      put([[4, 0], [5, 0], [6, 0], [9, 0], [10, 0], [11, 0], [4, 1], [11, 1]], "X");
      put([[5, 1], [10, 1]], "L");
      put([[6, 1], [9, 1]], "K");
      break;
    case "crown":
      put([[4, 0], [6, 0], [9, 0], [11, 0]], "X");
      rect(4, 1, 11, 1, "X");
      put([[7, 1], [8, 1]], "x");
      break;
    case "bow":
      put([[9, 0], [11, 0], [9, 1], [11, 1]], "X");
      put([[10, 1]], "x");
      break;
    case "horns":
      put([[4, 0], [4, 1], [5, 1], [11, 0], [11, 1], [10, 1]], "X");
      break;
    case "none":
      break;
  }

  const [topMain, topShade] = spec.topColor ?? spec.hair;
  return {
    rows: grid.map((row) => row.join("")),
    colors: {
      H: spec.hair[0],
      h: spec.hair[1],
      S: spec.skin[0],
      s: spec.skin[1],
      E: spec.eyes,
      L: "#ffffff",
      K: "#22303a",
      C: "#eba8a8",
      m: "#c98e86",
      X: topMain,
      x: topShade,
      T: spec.shirt[0],
      t: spec.shirt[1],
      A: spec.accent,
      Q: spec.sleeves[0],
      q: spec.sleeves[1],
      G: "#f4f4f4",
      P: spec.pants[0],
      p: spec.pants[1],
      O: spec.socks ?? spec.pants[0],
      B: spec.shoes,
    },
  };
}

/** Полин скін з гри: кольори зняті з її скіна вручну. */
const POLIA: Sprite = {
  rows: [
    "....WW....WW....",
    "....WP....PW....",
    "....HHHHHHHH....",
    "....HHDHHHDH....",
    "....HDHHHHHH....",
    "....HSSHSSSH....",
    "....HLBSSLBH....",
    "....HKBSSKBH....",
    "....HCSSSSCH....",
    "....HSSmmSSH....",
    "SSSSHTTTTTTHSSSS",
    "SSSSHTTTTRTHSSSS",
    "SSSSDOTONTNDSSSS",
    "sSSsDKOKKNKDsSSs",
    "OoOoTOoONNNTGgGg",
    "OoOoTTOTTNTTGgGg",
    "WWWWTTTTTTTTWWWW",
    "OOOOTTTTTTTTGGGG",
    "OOOOkkkkkkkkGGGG",
    "OOOOkkkkkkkkGGGG",
    "oOOokkkkkkkkgGGg",
    "....kkkkkkkk....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....SSSSSSSS....",
    "....sSSssSSs....",
    "....SSSSSSSS....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....WWWWWWWW....",
    "....OOOOGGGG....",
    "....OOOOGGGG....",
    "....OOOOGGGG....",
    "....oOoOgGgG....",
  ],
  colors: {
    W: "#f4ece2", // вушка, шкарпетки, манжети
    P: "#f2a7b5", // рожеве у вушках
    H: "#6f5a4e", // волосся
    D: "#523f36", // тінь волосся
    S: "#f0d6c4", // шкіра
    s: "#dfbfac", // тінь шкіри
    L: "#ffffff", // відблиск в оці
    B: "#4f7695", // очі
    K: "#22303a", // зіниця
    C: "#eba8a8", // рум'янець
    m: "#c98e86", // рот
    T: "#fbf6ee", // футболка
    O: "#e8a12c", // помаранчевий котик і ліва лапка
    o: "#b8741c", // смужки
    N: "#7f6159", // коричневий котик
    R: "#ec8fa5", // сердечко
    G: "#8c7064", // права лапка
    g: "#6a534a", // тінь правої лапки
    k: "#24201e", // спідничка
  },
};

const LIGHT: Pair = ["#f6dcc8", "#e2c0a8"];
const PALE: Pair = ["#fbeee4", "#ead6c6"];

/** Скіни на вибір: власні піксельні образи за мотивами улюблених скінів. */
export const SKIN_SPECS: SkinSpec[] = [
  {
    id: "tiger", name: "Тигриця", skin: LIGHT, hair: ["#f07a1a", "#c95b0c"], eyes: "#3d8a3d", style: "long",
    top: "none", shirt: ["#2b2118", "#1a140f"], pattern: "stripes", accent: "#f07a1a",
    sleeves: LIGHT, pants: ["#2b2118", "#1a140f"], shoes: "#1a140f",
  },
  {
    id: "white-queen", name: "Біла королева", skin: PALE, hair: ["#f4f4f4", "#cfcfcf"], eyes: "#c8302a",
    style: "long", top: "crown", topColor: ["#1e1e1e", "#c8302a"], shirt: ["#1e1e1e", "#111111"],
    pattern: "jacket", accent: "#f4f4f4", sleeves: ["#1e1e1e", "#111111"], pants: ["#8a8a8a", "#5a5a5a"],
    shoes: "#f4f4f4",
  },
  {
    id: "blue-wave", name: "Синя хвиля", skin: PALE, hair: ["#1e4a6e", "#163852"], eyes: "#163852", style: "long",
    top: "none", shirt: ["#f2f2f2", "#d4d4d4"], pattern: "plain", accent: "#1e4a6e",
    sleeves: ["#f2f2f2", "#d4d4d4"], hands: "sleeve", pants: ["#ececec", "#cfcfcf"], shoes: "#bdbdbd",
  },
  {
    id: "choco", name: "Шоколадка", skin: PALE, hair: ["#5a3426", "#3e2219"], eyes: "#3e2219", style: "long",
    top: "bow", topColor: ["#c8302a", "#8f1f1a"], shirt: ["#7a4a32", "#5a3424"], pattern: "scarf",
    accent: "#b8323a", sleeves: ["#7a4a32", "#5a3424"], pants: ["#3a2a24", "#2a1d18"], socks: "#f4ece2",
    shoes: "#4a2a1a",
  },
  {
    id: "bear", name: "Ведмежа", skin: PALE, hair: ["#3e2a24", "#2a1c18"], eyes: "#2a1c18", style: "hood",
    top: "bear", topColor: ["#9a9a9a", "#d8d8d8"], shirt: ["#9a9a9a", "#7a7a7a"], pattern: "jacket",
    accent: "#3a2a2a", sleeves: ["#9a9a9a", "#7a7a7a"], pants: ["#1e1e1e", "#111111"], shoes: "#111111",
  },
  {
    id: "marshmallow", name: "Зефірка", skin: PALE, hair: ["#b8a08a", "#9c8672"], eyes: "#7a6450", style: "long",
    top: "bow", topColor: ["#f2a7b5", "#e07a92"], shirt: ["#f6eee8", "#e2d6cc"], pattern: "scarf",
    accent: "#f2a7b5", sleeves: ["#f6eee8", "#e2d6cc"], hands: "sleeve", pants: ["#a8907a", "#8a7462"],
    socks: "#f6eee8", shoes: "#a8907a",
  },
  {
    id: "galaxy", name: "Галактика", skin: PALE, hair: ["#5a2a7a", "#3a1a5a"], eyes: "#e05aa8", style: "long",
    top: "none", shirt: ["#e8e4ff", "#c8c0f0"], pattern: "jacket", accent: "#4a5ad8",
    sleeves: ["#e8e4ff", "#c8c0f0"], hands: "sleeve", pants: ["#f2c8dc", "#dca8c0"], shoes: "#ffffff",
  },
  {
    id: "frog", name: "Жабка", skin: PALE, hair: ["#9a6a44", "#7a5030"], eyes: "#5aa83a", style: "hood",
    top: "frog", topColor: ["#a8c08a", "#8aa86c"], shirt: ["#e8eed8", "#cdd6b8"], pattern: "plain",
    accent: "#a8c08a", sleeves: ["#a8c08a", "#8aa86c"], hands: "sleeve", pants: ["#f2efe2", "#d8d4c4"],
    socks: "#a8c08a", shoes: "#f2efe2",
  },
  {
    id: "pink-punk", name: "Рожева зірочка", skin: PALE, hair: ["#f2c0c8", "#d89aa6"], eyes: "#d86a8a",
    style: "long", top: "bow", topColor: ["#1e1e1e", "#3a3a3a"], shirt: ["#1e1e1e", "#111111"],
    pattern: "jacket", accent: "#f4f4f4", sleeves: ["#1e1e1e", "#111111"], hands: "sleeve",
    pants: ["#8a8a8a", "#5a5a5a"], socks: "#f4f4f4", shoes: "#1e1e1e",
  },
  {
    id: "turquoise", name: "Бірюза", skin: LIGHT, hair: ["#4fd6d0", "#2fa8a4"], eyes: "#2fa8a4", style: "long",
    top: "none", shirt: ["#c8c8d0", "#a8a8b4"], pattern: "tie", accent: "#2fa8a4",
    sleeves: ["#1e2a44", "#141c30"], pants: ["#1e2a44", "#141c30"], shoes: "#2fa8a4",
  },
  {
    id: "night-star", name: "Нічна зірка", skin: PALE, hair: ["#1a1a2a", "#0e0e1a"], eyes: "#7a8cff",
    style: "short", top: "horns", topColor: ["#7a8cff", "#4a5ad8"], shirt: ["#1a1a2a", "#0e0e1a"],
    pattern: "rune", accent: "#8a5ad8", sleeves: ["#1a1a2a", "#0e0e1a"], hands: "sleeve",
    pants: ["#1a1a2a", "#0e0e1a"], shoes: "#8a5ad8",
  },
  {
    id: "strongman", name: "Силач", skin: ["#f0c08a", "#d49a62"], hair: ["#3a2a1e", "#22180f"], eyes: "#6a3aa8",
    style: "short", top: "none", shirt: ["#f0c08a", "#d49a62"], pattern: "abs", accent: "#f0c08a",
    sleeves: ["#f0c08a", "#d49a62"], hands: "glove", pants: ["#8a2ab8", "#6a1a90"], shoes: "#f4f4f4",
  },
  {
    id: "sorceress", name: "Чарівниця", skin: LIGHT, hair: ["#9a6a44", "#7a5030"], eyes: "#6a3aa8", style: "long",
    top: "crown", topColor: ["#5a2a9a", "#8ad8ff"], shirt: ["#4a2a9a", "#341c70"], pattern: "jacket",
    accent: "#8ad8ff", sleeves: ["#4a2a9a", "#341c70"], hands: "sleeve", pants: ["#4a2a9a", "#341c70"],
    shoes: "#1e1440",
  },
  {
    id: "pastel", name: "Пастелька", skin: PALE, hair: ["#b8b0e0", "#9a90c8"], eyes: "#7a6ad8", style: "long",
    top: "bow", topColor: ["#ffd84a", "#e8b923"], shirt: ["#f2d6e0", "#dcb8c6"], pattern: "scarf",
    accent: "#ffd84a", sleeves: ["#f2d6e0", "#dcb8c6"], pants: ["#f2d6e0", "#dcb8c6"], socks: "#ffffff",
    shoes: "#dcb8c6",
  },
  {
    id: "shadow", name: "Тінь", skin: PALE, hair: ["#141820", "#0a0c10"], eyes: "#3ad8c8", style: "hood",
    top: "cat", topColor: ["#1a2030", "#3ad8c8"], shirt: ["#1a2030", "#10141e"], pattern: "rune",
    accent: "#3ad8c8", sleeves: ["#e8dcb0", "#c8bc90"], hands: "sleeve", pants: ["#10141e", "#0a0c12"],
    shoes: "#e8dcb0",
  },
  {
    id: "emerald", name: "Смарагд", skin: ["#2a8a7a", "#1e6a5e"], hair: ["#2a8a7a", "#1e6a5e"], eyes: "#8affd8",
    style: "short", top: "none", shirt: ["#2a8a7a", "#1e6a5e"], pattern: "rune", accent: "#8affd8",
    sleeves: ["#2a8a7a", "#1e6a5e"], pants: ["#1e6a5e", "#155048"], shoes: "#155048",
  },
];

export const DEFAULT_SKIN = "polia";

export interface Skin {
  id: string;
  name: string;
  sprite: Sprite;
}

export const SKINS: Skin[] = [
  { id: DEFAULT_SKIN, name: "Мій скін", sprite: POLIA },
  ...SKIN_SPECS.map((spec) => ({ id: spec.id, name: spec.name, sprite: buildSkin(spec) })),
];

export const isSkinId = (value: unknown): value is string => SKINS.some((skin) => skin.id === value);
export const skinById = (id: string): Skin => SKINS.find((skin) => skin.id === id) ?? SKINS[0]!;
