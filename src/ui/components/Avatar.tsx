import { useContext, useEffect, useRef, useState } from "react";
import type { CompanionEvent, PlaceKind } from "../../game/companion/phrases";
import { SKINS, skinById } from "../../game/skins/skins";
import { SKIN_ARTWORK } from "../../game/skins/artwork";
import { PlayerContext } from "../player";
import { Companion } from "./Companion";
import { Modal } from "./Modal";

export { type Player, PlayerContext } from "../player";

interface Props {
  /** full — увесь персонаж; head — лише голова з вушками (для значків). */
  variant?: "full" | "head";
  /** Радіє: підстрибує один раз (не для тих, хто вимкнув анімації). */
  cheer?: boolean;
  className?: string;
  /** Інший скін замість вибраного — для попереднього перегляду у виборі. */
  skin?: string;
}

/** Піксельний аватар гравця за вибраним скіном. */
export function Avatar({ variant = "full", cheer = false, className = "", skin }: Props) {
  const player = useContext(PlayerContext);
  const { id, name, sprite } = skinById(skin ?? player.skin);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const artwork = SKIN_ARTWORK[id];
  const showArtwork = artwork && failedSource !== artwork.src;
  // Один файл для фігурки й значка: обличчя кадрується без повторного завантаження.
  const viewBox = showArtwork
    ? variant === "head" ? artwork.headViewBox : `0 0 ${artwork.width} ${artwork.height}`
    : variant === "head" ? "3 0 10 10" : "0 0 16 34";
  return (
    <svg
      className={`avatar avatar-${variant}${showArtwork ? " avatar-artwork" : ""}${cheer ? " avatar-cheer" : ""} ${className}`}
      viewBox={viewBox}
      role="img"
      aria-label={skin ? `Скін «${name}»` : `Аватар: ${player.name}`}
      shapeRendering="crispEdges"
    >
      {showArtwork ? (
        <image
          href={artwork.src}
          width={artwork.width}
          height={artwork.height}
          onError={() => setFailedSource(artwork.src)}
        />
      ) : sprite.rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={sprite.colors[cell]} />,
        ),
      )}
    </svg>
  );
}

/** Значок гравця у верхній панелі: голова відкриває вибір скіна, ім'я можна змінити дотиком. */
export function PlayerBadge() {
  const { name, onPickSkin, onRename } = useContext(PlayerContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const save = () => {
    onRename?.(draft.trim().slice(0, 40) || name);
    setEditing(false);
  };

  return (
    <div className="player">
      <button className="player-face" onClick={onPickSkin} aria-label="Вибрати скін" title="Вибрати скін">
        <Avatar variant="head" />
      </button>
      {editing ? (
        <form
          className="player-rename"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <input
            ref={input}
            className="text-input"
            value={draft}
            maxLength={40}
            aria-label="Ім'я"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
          />
        </form>
      ) : (
        <button
          className="player-name"
          title="Змінити ім'я"
          aria-label={`Ім'я: ${name}. Змінити`}
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
        >
          {name} ✎
        </button>
      )}
    </div>
  );
}

/** Вибір скіна: сітка фігурок, вибраний підсвічено. */
export function SkinPicker({ onPick, onClose }: { onPick: (skin: string) => void; onClose: () => void }) {
  const { skin: current } = useContext(PlayerContext);
  return (
    <Modal title="Вибери скін" onClose={onClose}>
        <div className="skin-grid">
          {SKINS.map((skin) => (
            <button
              key={skin.id}
              className={`skin-card${skin.id === current ? " skin-card-active" : ""}`}
              aria-pressed={skin.id === current}
              onClick={() => onPick(skin.id)}
            >
              <Avatar skin={skin.id} />
              <span>{skin.name}</span>
            </button>
          ))}
        </div>
    </Modal>
  );
}

/**
 * Сцена «доня і Рудик»: аватар стоїть поруч із супутником, який говорить репліку.
 * Використовується в ключових моментах (привітання, острів, підсумок), а не під час рахунку,
 * щоб не відволікати від прикладу. Дотик до аватара відкриває вибір скіна.
 */
export function Hero(props: { event: CompanionEvent; variant?: number; cheer?: boolean; place?: PlaceKind }) {
  const { event, variant = 0, cheer = false, place } = props;
  const { onPickSkin } = useContext(PlayerContext);
  return (
    <div className="hero">
      {onPickSkin ? (
        <button className="hero-avatar" onClick={onPickSkin} aria-label="Вибрати скін" title="Вибрати скін">
          <Avatar cheer={cheer} />
        </button>
      ) : (
        <Avatar cheer={cheer} />
      )}
      <Companion event={event} variant={variant} place={place} />
    </div>
  );
}
