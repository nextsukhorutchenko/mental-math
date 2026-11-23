import { describe, expect, it } from "vitest";
import { type ModeProgress, type SaveData, emptyMode } from "../../storage/save";
import { recordUse } from "../progress/progress";
import { LEVELS, WORLDS, currentLevel, earnedRanks, levelStates, worldProgress } from "./curriculum";
import { PLACEMENT_STAGES, placementStart } from "./placement";

/**
 * Проходження карти: що вважається пройденим рівнем, як це видно в лічильнику світу,
 * що відкривається далі й коли дають розряд. Перевіряємо кожен рівень і кожен результат стартової перевірки.
 */

const THREE_DAYS = ["2026-11-09", "2026-11-10", "2026-11-11"];
function uses(count: number, clean: boolean, days: string[] = THREE_DAYS): ModeProgress {
  let progress = emptyMode();
  for (let i = 0; i < count; i++) progress = recordUse(progress, clean, days[i % days.length]!);
  return progress;
}
const mastered = () => uses(90, true);
const learning = () => uses(20, true);
const physical = (progress: ModeProgress) => ({ physical: progress, mental: emptyMode() });
const mentalOnly = (progress: ModeProgress) => ({ physical: emptyMode(), mental: progress });

const ids = LEVELS.map((level) => level.id);
const counters = (skills: SaveData["skills"], placement: string | null = null) => {
  const states = levelStates(skills, false, placement);
  return WORLDS.map((world) => worldProgress(world, states).passed);
};

describe("стан, який бачила дитина: стартову перевірку пройдено, у лісі «0 / 3»", () => {
  // Відтворення: перевірка поставила старт на «+1 через п'ятірку», прямі рухи засвоєно подумки, на абакусі — ні.
  const skills: SaveData["skills"] = { simple: mentalOnly(uses(40, true)) };
  const states = levelStates(skills, false, "five:+1");
  const forest = (id: string) => states.find((state) => state.id === id)!;

  it("рівні лісу пройдено, і лічильник світу показує 3 з 3", () => {
    for (const id of ["simple:low", "simple:five", "simple"]) {
      expect(forest(id), id).toMatchObject({ passed: true, credited: true, status: "open" });
    }
    expect(worldProgress(WORLDS[0]!, states)).toEqual({ passed: 3, total: 3 });
    // Засвоєння подумки видно окремо й нікуди не зникає.
    expect(forest("simple").mental.status).toBe("mastered");
  });

  it("за пройдений ліс дається розряд, а поточний рівень — перший у печерах", () => {
    expect(earnedRanks(states).map((rank) => rank.world.id)).toEqual(["forest"]);
    expect(currentLevel(states)).toBe("five:+1");
  });
});

describe("засвоєння заняттями, рівень за рівнем через усю карту", () => {
  it("кожен засвоєний рівень зараховується, відкриває наступний і додається до лічильника свого світу", () => {
    const skills: SaveData["skills"] = {};
    for (const [index, id] of ids.entries()) {
      // До засвоєння: рівень поточний, відкритий; лічильник світу його ще не рахує.
      let states = levelStates(skills, false);
      expect(currentLevel(states), `перед ${id}`).toBe(id);
      expect(states[index]!.status, id).toBe("open");
      if (index + 1 < ids.length) expect(states[index + 1]!.status, `після ${id}`).toBe("locked");

      // Займається, але ще не засвоїла: «у роботі», не пройдено.
      skills[id] = physical(learning());
      states = levelStates(skills, false);
      expect(states[index], id).toMatchObject({ status: "learning", passed: false });

      // Засвоїла на абакусі.
      skills[id] = physical(mastered());
      states = levelStates(skills, false);
      expect(states[index], id).toMatchObject({ status: "mastered", passed: true, credited: false });
      if (index + 1 < ids.length) expect(states[index + 1]!.status, `після ${id}`).toBe("open");

      // Лічильник кожного світу дорівнює кількості вже засвоєних у ньому рівнів.
      const done = new Set(ids.slice(0, index + 1));
      expect(counters(skills), `після ${id}`).toEqual(WORLDS.map((world) => world.levels.filter((level) => done.has(level.id)).length));

      // Розряд дається рівно тоді, коли засвоєно останній рівень світу.
      const finished = WORLDS.filter((world) => world.levels.every((level) => done.has(level.id))).map((world) => world.id);
      expect(earnedRanks(states).map((rank) => rank.world.id), `після ${id}`).toEqual(finished);
    }
    expect(currentLevel(levelStates(skills, false))).toBeNull();
    expect(earnedRanks(levelStates(skills, false))).toHaveLength(WORLDS.length);
  });

  it("засвоєння лише подумки не зараховує рівень: головний інструмент — абакус", () => {
    for (const id of ids) {
      const states = levelStates({ [id]: mentalOnly(uses(60, true)) }, true);
      expect(states.find((state) => state.id === id), id).toMatchObject({ passed: false, credited: false });
    }
  });

  it("свіжі помилки знімають засвоєння, і рівень знову не зараховано", () => {
    let progress = mastered();
    for (let i = 0; i < 5; i++) progress = recordUse(progress, false, "2026-11-12");
    const states = levelStates({ "simple:low": physical(progress) }, false);
    expect(states[0]).toMatchObject({ status: "learning", passed: false });
    expect(counters({ "simple:low": physical(progress) })[0]).toBe(0);
  });
});

describe("стартова перевірка: кожен можливий результат", () => {
  for (let passedStages = 0; passedStages <= PLACEMENT_STAGES.length; passedStages++) {
    it(`пройдено етапів: ${passedStages}`, () => {
      const start = placementStart(passedStages);
      const startIndex = ids.indexOf(start);
      const states = levelStates({}, false, start);
      for (const [index, state] of states.entries()) {
        if (index < startIndex) {
          expect(state, state.id).toMatchObject({ passed: true, credited: true });
          expect(state.status, state.id).not.toBe("locked");
        } else {
          expect(state.passed, state.id).toBe(false);
        }
      }
      expect(currentLevel(states)).toBe(start);
      expect(states[startIndex]!.status).toBe("open");
      if (startIndex + 1 < ids.length) expect(states[startIndex + 1]!.status).toBe("locked");
      // Світи цілком до місця старту — пройдені й дають розряди; решта — ні.
      const before = new Set(ids.slice(0, startIndex));
      const whole = WORLDS.filter((world) => world.levels.every((level) => before.has(level.id))).map((world) => world.id);
      expect(earnedRanks(states).map((rank) => rank.world.id)).toEqual(whole);
      expect(whole).toEqual(PLACEMENT_STAGES.slice(0, passedStages).map((stage) => stage.world.id));
    });
  }

  it("зарахований рівень, який потім засвоїли заняттями, стає засвоєним ⭐", () => {
    const states = levelStates({ "simple:low": physical(mastered()) }, false, "five:+1");
    expect(states[0]).toMatchObject({ status: "mastered", passed: true, credited: false });
    expect(states[1]).toMatchObject({ passed: true, credited: true });
  });

  it("рівень, розпочатий до перевірки, теж зараховано, і після нього все відкривається як треба", () => {
    const states = levelStates({ "simple:five": physical(learning()) }, false, "five:+1");
    expect(states[1]).toMatchObject({ status: "learning", passed: true, credited: true });
    expect(currentLevel(states)).toBe("five:+1");
  });

  it("скинута перевірка повертає програму на початок", () => {
    const states = levelStates({}, false, null);
    expect(states.every((state) => !state.passed)).toBe(true);
    expect(currentLevel(states)).toBe("simple:low");
  });
});

describe("засвоєно складніший рівень, а простіші не тренували", () => {
  it("простіші рівні зараховано, і жоден із них не зачинений", () => {
    // Наприклад, програму доповнили новими рівнями вже після того, як дитина пройшла далі.
    const skills = { "five:+1": physical(mastered()) };
    const states = levelStates(skills, false);
    for (const state of states.slice(0, 3)) {
      expect(state, state.id).toMatchObject({ passed: true, credited: true });
      expect(state.status, state.id).not.toBe("locked");
    }
    expect(counters(skills)[0]).toBe(3);
    expect(currentLevel(states)).toBe("five:+2");
  });

  it("проба далекої теми в тренажері нічого не зараховує", () => {
    const skills = { "ten:+9": physical(learning()) };
    const states = levelStates(skills, false);
    expect(states.filter((state) => state.passed)).toEqual([]);
    expect(currentLevel(states)).toBe("simple:low");
  });

  it("прямі рухи, засвоєні попутно на рівнях «1–4» і «5–9», не перескакують «5–9»", () => {
    const skills = { "simple:low": physical(mastered()), simple: physical(mastered()) };
    const states = levelStates(skills, false);
    expect(states[1]).toMatchObject({ id: "simple:five", passed: false, status: "open" });
    expect(currentLevel(states)).toBe("simple:five");
    expect(counters(skills)[0]).toBe(2);
  });
});
