import { createContext, useContext } from "react";
import type { CompanionEvent } from "../../game/companion/phrases";
import { Companion } from "./Companion";

/** Ім'я гравця для підписів аватара; задається в App з налаштувань батьків. */
export const PlayerContext = createContext("Поля");

/**
 * Аватар доні з гри: піксельний спрайт 16×34 у пропорціях блокового персонажа
 * (голова 8×8, тулуб 8×12, ноги 4×12, руки по 4 клітинки).
 * Кольори зняті з її скіна; ліва рука й лапка помаранчеві, права — коричневі, як в оригіналі.
 */
const SPRITE = [
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
];

const COLORS: Record<string, string> = {
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
};

interface Props {
  /** full — увесь персонаж; head — лише голова з вушками (для значків). */
  variant?: "full" | "head";
  /** Радіє: підстрибує один раз (не для тих, хто вимкнув анімації). */
  cheer?: boolean;
  className?: string;
}

export function Avatar({ variant = "full", cheer = false, className = "" }: Props) {
  const name = useContext(PlayerContext);
  const viewBox = variant === "head" ? "3 0 10 10" : "0 0 16 34";
  return (
    <svg
      className={`avatar avatar-${variant}${cheer ? " avatar-cheer" : ""} ${className}`}
      viewBox={viewBox}
      role="img"
      aria-label={`Аватар: ${name}`}
      shapeRendering="crispEdges"
    >
      {SPRITE.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[cell]} />,
        ),
      )}
    </svg>
  );
}

/** Значок гравця для верхньої панелі: голова аватара та ім'я. */
export function PlayerBadge() {
  const name = useContext(PlayerContext);
  return (
    <div className="player" title={name}>
      <span className="player-face">
        <Avatar variant="head" />
      </span>
      <span className="player-name">{name}</span>
    </div>
  );
}

/**
 * Сцена «доня і Рудик»: аватар стоїть поруч із супутником, який говорить репліку.
 * Використовується в ключових моментах (привітання, острів, підсумок), а не під час рахунку,
 * щоб не відволікати від прикладу.
 */
export function Hero({ event, variant = 0, cheer = false }: { event: CompanionEvent; variant?: number; cheer?: boolean }) {
  return (
    <div className="hero">
      <Avatar cheer={cheer} />
      <Companion event={event} variant={variant} />
    </div>
  );
}
