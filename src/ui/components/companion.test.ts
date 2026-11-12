import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PET, PETS } from "../../game/companion/pets";
import { PlayerContext } from "../player";
import { Companion, PetSprite } from "./Companion";

describe("оновлені Minecraft-супутники", () => {
  it.each(PETS)("показує нове зображення: $name ($species)", (pet) => {
    const markup = renderToStaticMarkup(createElement(PetSprite, { id: pet.id }));
    expect(markup.includes("<image"), pet.id).toBe(true);
    expect(markup).toContain(`aria-label="${pet.species} ${pet.name}"`);
  });

  it("зберігає клас настрою та повертається до Рудика для невідомого id", () => {
    const markup = renderToStaticMarkup(createElement(PetSprite, { id: "missing", mood: "cheer" }));
    const original = renderToStaticMarkup(createElement(PetSprite, { id: DEFAULT_PET, mood: "cheer" }));
    expect(markup).toBe(original);
    expect(markup).toContain("fox-cheer");
    expect(markup.includes("<image")).toBe(true);
  });

  it("новий образ Яри використовує її ім'я й репліку в жіночому роді", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerContext.Provider, {
        value: { name: "Поля", skin: "polia", pet: "dog", screenAbacus: false },
        children: createElement(Companion, { event: "greet", variant: 2 }),
      }),
    );
    expect(markup).toContain("Чорна собака Яра");
    expect(markup).toContain("Я вже наточила кирку. Почнімо?");
  });
});
