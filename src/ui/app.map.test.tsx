// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LEVELS, WORLDS } from "../game/curriculum/levels";
import { PLACEMENT_STAGES, placementStart } from "../game/curriculum/placement";
import { recordUse } from "../game/progress/progress";
import { type ModeProgress, type SaveData, emptyMode } from "../storage/save";
import {
  expectCleanText,
  openTab,
  ready,
  seed,
  setupAppHarness,
  shownAnswer,
  stored,
  typeAnswer,
} from "../testing/appHarness";
import { App } from "./App";

/** Карта на екрані: позначки рівнів, лічильник «пройдено / усього» біля кожного світу, розряди й грамоти. */

setupAppHarness();

const THREE_DAYS = ["2026-11-09", "2026-11-10", "2026-11-11"];
function uses(count: number): ModeProgress {
  let progress = emptyMode();
  for (let i = 0; i < count; i++) progress = recordUse(progress, true, THREE_DAYS[i % 3]!);
  return progress;
}
const ids = LEVELS.map((level) => level.id);

/** Лічильники світів так, як їх видно на карті: «3 / 3». */
const shownCounters = () =>
  [...document.querySelectorAll(".world-count")].map((counter) => /(\d+) \/ (\d+)/.exec(counter.textContent ?? "")!.slice(1, 3).join("/"));
const tileOf = (label: string) => screen.getByRole("button", { name: new RegExp(`^Рівень ${label}(,|$)`) });

describe("стан зі скриншота: стартову перевірку пройдено, у лісі «0 / 3»", () => {
  const userState = (): SaveData => ({
    ...ready(),
    placement: "five:+1",
    skills: { simple: { physical: emptyMode(), mental: uses(40) } },
  });

  it("ліс показує 3 / 3, рівні позначено як зараховані, а прямі рухи — ще й засвоєні подумки", () => {
    seed(userState());
    render(<App />);
    const forest = screen.getByRole("heading", { name: "Ліс" }).closest("section")!;
    expect(within(forest).getByText(/3 \/ 3/)).toBeTruthy();
    for (const label of ["1–4", "5–9", "1–9"]) {
      const tile = within(forest).getByRole("button", { name: new RegExp(`^Рівень ${label}, зараховано$`) });
      expect(tile.className).toContain("tile-credited");
      expect(tile.textContent).toContain("✔");
      expect(tile.textContent).not.toContain("⏭");
    }
    expect(tileOf("1–9").textContent).toContain("🧠");
    // Дитина тепер у печерах.
    expect(screen.getByRole("button", { name: "Рівень +1, ти тут" })).toBeTruthy();
    expectCleanText();
  });

  it("за пройдений ліс одразу видно розряд, а грамота відкривається", async () => {
    const user = userEvent.setup();
    seed(userState());
    render(<App />);
    expect(screen.getByText(/7-й розряд — «Лісовий слідопит»/)).toBeTruthy();
    // Дату здобуття розряду записано, щоб грамота її показувала.
    expect(stored().rankDates.forest).toBeTruthy();
    const forest = screen.getByRole("heading", { name: "Ліс" }).closest("section")!;
    await user.click(within(forest).getByRole("button", { name: "🏅 Грамота" }));
    expect(screen.getByText("Грамота")).toBeTruthy();
    expect(screen.getByText(/успішно пройшла світ «Ліс»/)).toBeTruthy();
  });

  it("картка зарахованого рівня пояснює, чому він пройдений, і дає потренуватися", async () => {
    const user = userEvent.setup();
    seed(userState());
    render(<App />);
    await user.click(tileOf("5–9"));
    const card = screen.getByRole("dialog", { name: "Рівень" });
    expect(within(card).getByText(/Рівень зараховано/)).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: /прикладів/ }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    await typeAnswer(user, shownAnswer());
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });
});

describe("прохід карти: лічильники й позначки на екрані після кожного засвоєного рівня", () => {
  it("на кожному кроці лічильник кожного світу дорівнює кількості засвоєних у ньому рівнів", { timeout: 120_000 }, () => {
    const skills: SaveData["skills"] = {};
    for (let done = 0; done <= ids.length; done++) {
      if (done > 0) skills[ids[done - 1]!] = { physical: uses(90), mental: emptyMode() };
      seed({ ...ready(), skills: { ...skills } });
      render(<App />);
      const finished = new Set(ids.slice(0, done));
      const expected = WORLDS.map((world) => `${world.levels.filter((level) => finished.has(level.id)).length}/${world.levels.length}`);
      expect(shownCounters(), `засвоєно рівнів: ${done}`).toEqual(expected);
      // Засвоєні рівні мають зірку, поточний — відкритий, решта зачинені.
      const tiles = document.querySelectorAll<HTMLElement>(".tile");
      tiles.forEach((tile, index) => {
        const kind = index < done ? "tile-mastered" : index === done ? "tile-open" : "tile-locked";
        expect(tile.className, `${ids[index]} при ${done}`).toContain(kind);
        if (index < done) expect(tile.textContent, ids[index]).toContain("⭐");
      });
      expect(document.querySelectorAll(".tile-current")).toHaveLength(done < ids.length ? 1 : 0);
      cleanup();
    }
  });

  it("кожен результат стартової перевірки: зараховані рівні, лічильники й розряди", { timeout: 60_000 }, () => {
    for (let passed = 0; passed <= PLACEMENT_STAGES.length; passed++) {
      const start = placementStart(passed);
      const startIndex = ids.indexOf(start);
      seed({ ...ready(), placement: start });
      render(<App />);
      const before = new Set(ids.slice(0, startIndex));
      expect(shownCounters(), `етапів: ${passed}`).toEqual(
        WORLDS.map((world) => `${world.levels.filter((level) => before.has(level.id)).length}/${world.levels.length}`),
      );
      expect(document.querySelectorAll(".tile-credited")).toHaveLength(startIndex);
      expect(document.querySelectorAll(".tile-locked")).toHaveLength(ids.length - startIndex - 1);
      expect(stored().placement).toBe(start);
      const ranks = Object.keys(stored().rankDates).sort();
      expect(ranks, `етапів: ${passed}`).toEqual(PLACEMENT_STAGES.slice(0, passed).map((stage) => stage.world.id).sort());
      cleanup();
      window.localStorage.clear();
    }
  });
});

describe("засвоєння через справжні заняття", () => {
  it("коли рівень засвоєно, лічильник світу росте, а наступний рівень відкривається", async () => {
    const user = userEvent.setup();
    // До засвоєння «1–4» бракує небагато: ще одне заняття з 10 прикладів по 3 дії.
    seed({ ...ready(), skills: { "simple:low": { physical: uses(60), mental: emptyMode() } } });
    render(<App />);
    const forest = () => screen.getByRole("heading", { name: "Ліс" }).closest("section")!;
    expect(within(forest()).getByText(/0 \/ 3/)).toBeTruthy();
    await user.click(tileOf("1–4"));
    await user.click(within(screen.getByRole("dialog", { name: "Рівень" })).getByRole("button", { name: /прикладів/ }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    while (screen.queryByText(/^Приклад \d+ з \d+$/)) {
      await typeAnswer(user, shownAnswer());
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(screen.getByText("⭐ Формулу засвоєно на абакусі — кристали!")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "🗺 На карту" }));
    expect(within(forest()).getByText(/1 \/ 3/)).toBeTruthy();
    expect(tileOf("1–4").className).toContain("tile-mastered");
    expect(screen.getByRole("button", { name: "Рівень 5–9, ти тут" })).toBeTruthy();
    await openTab(user, /Для батьків/);
    expectCleanText();
  }, 60_000);
});
