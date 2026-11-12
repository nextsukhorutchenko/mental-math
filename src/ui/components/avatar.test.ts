import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_SKIN, SKINS, skinById } from "../../game/skins/skins";
import { Avatar } from "./Avatar";

describe("оновлені Minecraft-аватари", () => {
  it("показує нове зображення для кожного збереженого скіна", () => {
    for (const skin of SKINS) {
      const markup = renderToStaticMarkup(createElement(Avatar, { skin: skin.id }));
      expect(markup.includes("<image"), skin.id).toBe(true);
      expect(markup, skin.id).toContain(`Скін «${skin.name}»`);
    }
  });

  it("для маленького значка кадрує голову, а для сцени показує всю фігуру", () => {
    const full = renderToStaticMarkup(createElement(Avatar, { skin: "frog" }));
    const head = renderToStaticMarkup(createElement(Avatar, { skin: "frog", variant: "head" }));
    const viewBox = (markup: string) => markup.match(/viewBox="([^"]+)"/)?.[1];
    expect(full.includes("<image")).toBe(true);
    expect(head.includes("<image")).toBe(true);
    expect(viewBox(head)).not.toBe(viewBox(full));
    const [, , width, height] = viewBox(head)!.split(" ").map(Number);
    expect(width).toBe(height);
  });

  it("невідомий старий id отримує типовий скін, а анімація й доступна назва зберігаються", () => {
    expect(skinById("missing").id).toBe(DEFAULT_SKIN);
    const markup = renderToStaticMarkup(createElement(Avatar, { skin: "missing", cheer: true }));
    expect(markup.includes("<image")).toBe(true);
    expect(markup).toContain("avatar-cheer");
    expect(markup).toContain("role=\"img\"");
    expect(markup).toContain("Мій скін");
  });
});
