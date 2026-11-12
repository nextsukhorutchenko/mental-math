import skin0 from "../../assets/skins/polia.webp";
import skin1 from "../../assets/skins/tiger.webp";
import skin2 from "../../assets/skins/white-queen.webp";
import skin3 from "../../assets/skins/blue-wave.webp";
import skin4 from "../../assets/skins/choco.webp";
import skin5 from "../../assets/skins/bear.webp";
import skin6 from "../../assets/skins/marshmallow.webp";
import skin7 from "../../assets/skins/galaxy.webp";
import skin8 from "../../assets/skins/frog.webp";
import skin9 from "../../assets/skins/pink-punk.webp";
import skin10 from "../../assets/skins/turquoise.webp";
import skin11 from "../../assets/skins/night-star.webp";
import skin12 from "../../assets/skins/strongman.webp";
import skin13 from "../../assets/skins/sorceress.webp";
import skin14 from "../../assets/skins/pastel.webp";
import skin15 from "../../assets/skins/shadow.webp";
import skin16 from "../../assets/skins/emerald.webp";

export interface SkinArtwork {
  src: string;
  width: number;
  height: number;
  /** Square crop in image pixels: ears/crown, hair and face, without the body. */
  headViewBox: string;
}

/** Generated Minecraft-style cutouts. Static imports include them in Vite's versioned offline build. */
export const SKIN_ARTWORK: Readonly<Partial<Record<string, SkinArtwork>>> = {
  "polia": { src: skin0, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "tiger": { src: skin1, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "white-queen": { src: skin2, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "blue-wave": { src: skin3, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "choco": { src: skin4, width: 361, height: 768, headViewBox: "43 12 274 274" },
  "bear": { src: skin5, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "marshmallow": { src: skin6, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "galaxy": { src: skin7, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "frog": { src: skin8, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "pink-punk": { src: skin9, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "turquoise": { src: skin10, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "night-star": { src: skin11, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "strongman": { src: skin12, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "sorceress": { src: skin13, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "pastel": { src: skin14, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "shadow": { src: skin15, width: 384, height: 768, headViewBox: "46 12 292 292" },
  "emerald": { src: skin16, width: 384, height: 768, headViewBox: "46 12 292 292" },
};
