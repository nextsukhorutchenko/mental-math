import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PET_ARTWORK } from "../game/companion/artwork";
import { PETS } from "../game/companion/pets";
import { SKIN_ARTWORK } from "../game/skins/artwork";
import { SKINS } from "../game/skins/skins";

/** Цілісність картинок: кожен скін і супутник має свій файл, зайвих файлів немає, розміри записано правильно. */

/** Розмір картинки WebP із заголовка файлу. */
function webpSize(path: string): { width: number; height: number } {
  const data = readFileSync(path);
  expect(data.toString("ascii", 0, 4), path).toBe("RIFF");
  expect(data.toString("ascii", 8, 12), path).toBe("WEBP");
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const bits = data.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}

/** Розмір PNG з блока IHDR. */
function pngSize(path: string): { width: number; height: number } {
  const data = readFileSync(path);
  expect(data.toString("latin1", 1, 4), path).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

const webpIn = (dir: string) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".webp"))
    .map((name) => name.replace(".webp", ""))
    .sort();

describe.each([
  { title: "скіни", dir: "src/assets/skins", ids: SKINS.map((skin) => skin.id), artwork: SKIN_ARTWORK },
  { title: "супутники", dir: "src/assets/pets", ids: PETS.map((pet) => pet.id), artwork: PET_ARTWORK },
])("$title", ({ dir, ids, artwork }) => {
  it("кожен має картинку, і немає картинок без господаря", () => {
    expect(Object.keys(artwork).sort()).toEqual([...ids].sort());
    expect(webpIn(dir)).toEqual([...ids].sort());
  });

  it("записані розміри збігаються зі справжніми, і файл не порожній", () => {
    for (const id of ids) {
      const path = join(dir, `${id}.webp`);
      const actual = webpSize(path);
      expect({ width: artwork[id]!.width, height: artwork[id]!.height }, id).toEqual(actual);
      expect(statSync(path).size, id).toBeGreaterThan(2000);
    }
  });

  it("картинки легкі: застосунок кешується цілком і має швидко відкриватися на телефоні", () => {
    const sizes = ids.map((id) => statSync(join(dir, `${id}.webp`)).size);
    for (const [index, size] of sizes.entries()) expect(size, ids[index]).toBeLessThan(80_000);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(800_000);
  });
});

describe("кадр обличчя для значка", () => {
  it("лежить у межах картинки й квадратний", () => {
    for (const [id, art] of Object.entries(SKIN_ARTWORK)) {
      const [x, y, width, height] = art!.headViewBox.split(" ").map(Number) as [number, number, number, number];
      expect(width, id).toBe(height);
      expect(x >= 0 && y >= 0 && x + width <= art!.width && y + height <= art!.height, id).toBe(true);
    }
  });
});

describe("іконки застосунку й маніфест", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; type: string }[];
  };

  it("кожна іконка з маніфесту існує й має заявлений розмір", () => {
    expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(["192x192", "512x512"]);
    for (const icon of manifest.icons) {
      const { width, height } = pngSize(join("public", icon.src));
      expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
      expect(icon.type).toBe("image/png");
    }
  });

  it("маніфест придатний для встановлення на домашній екран і працює з підпапки", () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe("standalone");
    // Відносні шляхи: на GitHub Pages застосунок живе в підпапці.
    expect(manifest.start_url).toBe(".");
    expect(manifest.scope).toBe(".");
    for (const icon of manifest.icons) expect(icon.src.startsWith("/")).toBe(false);
  });

  it("сторінка посилається на наявні файли відносними шляхами", () => {
    const html = readFileSync("index.html", "utf8");
    const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]!).filter((link) => !link.startsWith("/src/"));
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      expect(link.startsWith("/") || link.startsWith("http"), link).toBe(false);
      expect(statSync(join("public", link)).size, link).toBeGreaterThan(0);
    }
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
    expect(html).toContain('<html lang="uk">');
  });
});
