import { useContext, useState } from "react";
import { PETS, petById } from "../../game/companion/pets";
import { PET_ARTWORK } from "../../game/companion/artwork";
import { type CompanionEvent, type Mood, type PlaceKind, phrase } from "../../game/companion/phrases";
import { PlayerContext } from "../player";
import { Modal } from "./Modal";

/** Minecraft-супутник; старий спрайт лишається резервом, якщо зображення недоступне. */
export function PetSprite({ id, mood = "calm", className = "" }: { id: string; mood?: Mood; className?: string }) {
  const pet = petById(id);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const artwork = PET_ARTWORK[pet.id];
  const showArtwork = artwork && failedSource !== artwork.src;
  const width = Math.max(...pet.rows.map((row) => row.length));
  return (
    <svg
      className={`fox fox-${mood}${showArtwork ? " pet-artwork" : ""} ${className}`}
      viewBox={showArtwork ? `0 0 ${artwork.width} ${artwork.height}` : `0 0 ${width} ${pet.rows.length}`}
      role="img"
      aria-label={`${pet.species} ${pet.name}`}
      shapeRendering="crispEdges"
    >
      {showArtwork ? (
        <image
          href={artwork.src}
          width={artwork.width}
          height={artwork.height}
          onError={() => setFailedSource(artwork.src)}
        />
      ) : pet.rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." || !pet.colors[cell] ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={pet.colors[cell]} />
          ),
        ),
      )}
    </svg>
  );
}

/** Супутник із реплікою. variant обирає фразу зі списку для події; дотик до тварини відкриває вибір. */
export function Companion({ event, variant = 0, place }: { event: CompanionEvent; variant?: number; place?: PlaceKind }) {
  const { pet, onPickPet } = useContext(PlayerContext);
  const companion = petById(pet);
  const { text, mood } = phrase(event, variant, companion.name, companion.female, place);
  return (
    <div className="companion">
      {onPickPet ? (
        <button className="pet-button" onClick={onPickPet} aria-label="Вибрати супутника" title="Вибрати супутника">
          <PetSprite id={pet} mood={mood} />
        </button>
      ) : (
        <PetSprite id={pet} mood={mood} />
      )}
      <p className="bubble">{text}</p>
    </div>
  );
}

/** Вибір супутника: усі тварини з іменами, вибрана підсвічена. */
export function PetPicker({ onPick, onClose }: { onPick: (pet: string) => void; onClose: () => void }) {
  const { pet: current } = useContext(PlayerContext);
  return (
    <Modal title="Вибери супутника" onClose={onClose}>
      <div className="skin-grid pet-grid">
        {PETS.map((pet) => (
          <button
            key={pet.id}
            className={`skin-card pet-card${pet.id === current ? " skin-card-active" : ""}`}
            aria-pressed={pet.id === current}
            onClick={() => onPick(pet.id)}
          >
            <PetSprite id={pet.id} />
            <span>
              {pet.name}
              <small>{pet.species}</small>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
