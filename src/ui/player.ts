import { createContext } from "react";
import { DEFAULT_PET } from "../game/companion/pets";
import { DEFAULT_SKIN } from "../game/skins/skins";

/** Гравець: ім'я, скін, супутник і дії, щоб їх змінити (задаються в App). */
export interface Player {
  name: string;
  skin: string;
  pet: string;
  onPickSkin?: () => void;
  onPickPet?: () => void;
  onRename?: (name: string) => void;
}

export const PlayerContext = createContext<Player>({ name: "Поля", skin: DEFAULT_SKIN, pet: DEFAULT_PET });
