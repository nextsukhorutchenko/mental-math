import fox from "../../assets/pets/fox.webp";
import cat from "../../assets/pets/cat.webp";
import dog from "../../assets/pets/dog.webp";
import wolf from "../../assets/pets/wolf.webp";
import bear from "../../assets/pets/bear.webp";
import boar from "../../assets/pets/boar.webp";
import tiger from "../../assets/pets/tiger.webp";
import lion from "../../assets/pets/lion.webp";
import bison from "../../assets/pets/bison.webp";
import trex from "../../assets/pets/trex.webp";

export interface PetArtwork {
  src: string;
  width: number;
  height: number;
}

/** Прозорі Minecraft-супутники; статичні імпорти включають їх до офлайн-збірки Vite. */
export const PET_ARTWORK: Readonly<Partial<Record<string, PetArtwork>>> = {
  fox: { src: fox, width: 640, height: 383 },
  cat: { src: cat, width: 640, height: 409 },
  dog: { src: dog, width: 640, height: 383 },
  wolf: { src: wolf, width: 640, height: 382 },
  bear: { src: bear, width: 640, height: 382 },
  boar: { src: boar, width: 640, height: 297 },
  tiger: { src: tiger, width: 640, height: 382 },
  lion: { src: lion, width: 640, height: 382 },
  bison: { src: bison, width: 640, height: 383 },
  trex: { src: trex, width: 640, height: 388 },
};
