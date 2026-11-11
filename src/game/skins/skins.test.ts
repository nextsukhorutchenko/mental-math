import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../../storage/save";
import { DEFAULT_SKIN, SKINS, SKIN_COLS, SKIN_ROWS, isSkinId, skinById } from "./skins";

describe("збереження скіна", () => {
  it("старе збереження отримує Полин скін, вибраний — зберігається", () => {
    const { skin, ...old } = emptySave();
    void skin;
    expect(parseSave(old)!.skin).toBe(DEFAULT_SKIN);
    expect(parseSave({ ...emptySave(), skin: "frog" })!.skin).toBe("frog");
    expect(parseSave({ ...emptySave(), skin: "dragon" })!.skin).toBe(DEFAULT_SKIN);
  });
});

describe("скіни", () => {
  it("кожен скін — фігурка 16×34, де кожна клітинка має колір", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(17);
    for (const skin of SKINS) {
      expect(skin.sprite.rows, skin.id).toHaveLength(SKIN_ROWS);
      for (const row of skin.sprite.rows) {
        expect(row, skin.id).toHaveLength(SKIN_COLS);
        for (const cell of row) if (cell !== ".") expect(skin.sprite.colors[cell], `${skin.id}: ${cell}`).toBeTruthy();
      }
    }
  });

  it("назви й id не повторюються", () => {
    expect(new Set(SKINS.map((skin) => skin.id)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((skin) => skin.name)).size).toBe(SKINS.length);
  });

  it("незнайомий скін замінюється Полиним", () => {
    expect(skinById("nope").id).toBe(DEFAULT_SKIN);
    expect(isSkinId("tiger")).toBe(true);
    expect(isSkinId("nope")).toBe(false);
  });
});
