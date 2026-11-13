import { describe, expect, it } from "vitest";
import { createRandom } from "../core/generator/random";
import { levelStates } from "../game/curriculum/curriculum";
import { dailyPlan } from "../game/curriculum/daily";
import { claimQuests } from "../game/island/quests";
import { closeActive, restoreSession } from "../game/progress/progress";
import { skillRows, weakSpots, weekStats } from "../game/progress/stats";
import { weekActiveDays } from "../game/rewards/rewards";
import { DEFAULT_SETUP, toDrillConfig } from "../game/session/setup";
import { child, dayAt, playDay } from "../testing/simulate";
import { BEFORE_IMPORT_KEY, CORRUPT_KEY, type KeyValueStore, SAVE_KEY, loadSave, parseStoredText, writeSave } from "./localStore";
import {
  CARD_LOG_LIMIT,
  DAYS_LIMIT,
  HISTORY_LIMIT,
  RECENT_LIMIT,
  type SaveData,
  emptySave,
  parseExportText,
  parseSave,
  toExportText,
} from "./save";

/**
 * Стійкість збереження: прогрес дитини — найцінніше, що є в застосунку.
 * Перевіряємо, що жодні дані зі сховища чи файлу не валять застосунок і не псують прогрес.
 */

const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** Справжнє збереження: дитина 60 днів займалася за планом, є незавершене заняття. */
function livedSave(): SaveData {
  const who = child(0.85, 21);
  let save: SaveData = { ...emptySave(), abacusAsked: true };
  for (let day = 0; day < 60; day++) save = playDay(save, day, who).save;
  return {
    ...save,
    childName: "Марічка",
    birthday: "03-14",
    backdrop: { holiday: "christmas", until: "2026-01-07" },
    rankDates: { forest: "2026-02-01T10:00:00.000Z" },
    placement: "five:+1",
    flashBest: 4,
    lastExportAt: "2026-02-20T08:00:00.000Z",
    questsDone: ["door"],
    active: {
      id: "active-1",
      setup: { ...DEFAULT_SETUP, exampleCount: 6 },
      config: { ...toDrillConfig({ ...DEFAULT_SETUP, exampleCount: 6 }), seed: 99 },
      started: true,
      index: 2,
      results: [
        { answers: [5], solved: true, hintUsed: false },
        { answers: [1, 2], solved: false, hintUsed: true },
      ],
      current: { answers: [3], solved: false, hintUsed: false },
      status: "answering",
    },
  };
}

/** Усе, що застосунок робить зі збереженням одразу після запуску. Не має кидати винятків. */
function useLikeApp(save: SaveData, now: Date): void {
  const states = levelStates(save.skills, save.unlockAll, save.placement);
  expect(states.length).toBeGreaterThan(0);
  expect(dailyPlan(save, now).length).toBeGreaterThan(0);
  weekActiveDays([...save.history, ...save.cardLog], now);
  weekStats(save.history, now);
  skillRows(save.skills);
  weakSpots(save.skills);
  claimQuests(save);
  if (save.active) restoreSession(save.active);
  const closed = closeActive(save, now);
  expect(closed.active).toBeNull();
  for (const count of Object.values(closed.inventory)) expect(Number.isInteger(count) && count >= 0).toBe(true);
  toExportText(save, now);
}

const GARBAGE: unknown[] = [
  null,
  true,
  false,
  0,
  -1,
  1.5,
  1e308,
  -1e308,
  Number.MAX_SAFE_INTEGER,
  "",
  "x",
  "__proto__",
  "constructor",
  "2026-13-45",
  "9999-99-99",
  "not a date",
  "five:+4",
  "simple",
  "🧮".repeat(2000),
  [],
  [null],
  [[[[[[]]]]]],
  {},
  { length: 5 },
  { toString: "boom" },
  Array.from({ length: 5000 }, (_, index) => index),
];

type Path = (string | number)[];

/** Усі шляхи до вузлів JSON-дерева (обмежено, щоб великі масиви не забивали вибірку). */
function paths(value: unknown, base: Path = [], out: Path[] = []): Path[] {
  out.push(base);
  if (Array.isArray(value)) {
    value.slice(0, 4).forEach((item, index) => paths(item, [...base, index], out));
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) paths(item, [...base, key], out);
  }
  return out;
}

function setAt(root: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const copy = roundTrip(root) as Record<string | number, unknown>;
  let node = copy;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
  const last = path[path.length - 1]!;
  // Видалення: з масиву елемент вирізаємо («дірок» у JSON не буває), з об'єкта — прибираємо ключ.
  if (value !== undefined) node[last] = value;
  else if (Array.isArray(node)) node.splice(Number(last), 1);
  else delete node[last];
  return copy;
}

describe("перезавантаження сторінки", () => {
  it("справжнє збереження після 60 днів занять читається назад без жодної зміни", () => {
    const save = livedSave();
    expect(parseSave(roundTrip(save))).toEqual(save);
    // І вдруге теж: перевірка даних не «дрейфує» від запуску до запуску.
    expect(parseSave(roundTrip(parseSave(roundTrip(save))))).toEqual(save);
  });

  it("запис і читання через сховище дають ті самі дані", () => {
    const data = new Map<string, string>();
    const store: KeyValueStore = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
    const save = livedSave();
    expect(writeSave(store, save)).toBe(true);
    const loaded = loadSave(store);
    expect(loaded.warning).toBeNull();
    expect(loaded.locked).toBe(false);
    expect(loaded.data).toEqual(save);
  });
});

describe("пошкоджені дані", () => {
  const save = livedSave();
  const base = roundTrip(save);
  const all = paths(base);
  const now = dayAt(61);

  it("будь-яке одне зіпсоване поле не валить застосунок і не псує решту прогресу", { timeout: 120_000 }, () => {
    const random = createRandom(2026);
    let rejected = 0;
    let accepted = 0;
    for (let round = 0; round < 1500; round++) {
      const path = all[Math.floor(random() * all.length)]!;
      const junk = round % 9 === 0 ? undefined : GARBAGE[Math.floor(random() * GARBAGE.length)];
      const broken = setAt(base, path, junk);
      const label = `поле ${path.join(".") || "(корінь)"} = ${JSON.stringify(junk)?.slice(0, 40)}`;
      let parsed: SaveData | null;
      try {
        parsed = parseSave(broken);
      } catch (problem) {
        throw new Error(`parseSave кинув виняток: ${label}: ${String(problem)}`, { cause: problem });
      }
      if (parsed === null) {
        rejected++;
        continue;
      }
      accepted++;
      try {
        // Те, що прийнято, — уже чисті дані: повторна перевірка їх не змінює.
        expect(parseSave(roundTrip(parsed))).toEqual(parsed);
        useLikeApp(parsed, now);
      } catch (problem) {
        throw new Error(`${label}: ${String(problem)}`, { cause: problem });
      }
      // Зіпсоване поле не зачіпає сусідні розділи: історія чи прогрес лишаються, якщо зіпсовано не їх.
      if (path[0] !== "history" && path.length > 0) expect(parsed.history, label).toEqual(save.history);
      if (path[0] !== "skills" && path.length > 0) expect(parsed.skills, label).toEqual(save.skills);
      if (path[0] !== "inventory" && path.length > 0) expect(parsed.inventory, label).toEqual(save.inventory);
    }
    expect(accepted).toBeGreaterThan(1100);
    // Відмова цілком — лише коли зламано сам каркас (версію, skills, history).
    expect(rejected).toBeLessThan(150);
  });

  it("кілька зіпсованих полів одразу теж не валять застосунок", { timeout: 120_000 }, () => {
    const random = createRandom(77);
    for (let round = 0; round < 300; round++) {
      let broken = base;
      for (let hit = 0; hit < 6; hit++) {
        const candidates = paths(broken);
        const path = candidates[Math.floor(random() * candidates.length)]!;
        if (path.length === 0) continue;
        broken = setAt(broken, path, GARBAGE[Math.floor(random() * GARBAGE.length)]);
      }
      const parsed = parseSave(broken);
      if (!parsed) continue;
      expect(parseSave(roundTrip(parsed))).toEqual(parsed);
      useLikeApp(parsed, now);
    }
  });

  it("не JSON, чужий JSON і порожнеча в сховищі — це null, а не виняток", () => {
    for (const text of ["", " ", "{", "[]", "null", "42", '"рядок"', "{\"version\":1}", "undefined", "NaN", "\u0000", "<html></html>"]) {
      expect(parseStoredText(text)).toBeNull();
      expect(parseExportText(text)).toBeNull();
    }
    expect(parseStoredText(null)).toBeNull();
  });

  it("значення, яких не буває в JSON (NaN, Infinity, undefined, функції), теж відкидаються без винятків", () => {
    const weird: unknown[] = [Number.NaN, Infinity, -Infinity, undefined, () => 1, Symbol("x"), new Date(), new Map(), 10n];
    for (const junk of weird) {
      for (const path of [["flashBest"], ["setup", "exampleCount"], ["inventory", "grass"], ["history", 0, "total"], ["skills", "simple", "physical", "correct"]] as Path[]) {
        const broken = setAt(base, path, null) as Record<string, unknown>;
        // Ставимо значення напряму, без JSON, щоб воно не перетворилося дорогою.
        let node: Record<string | number, unknown> = broken;
        for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>;
        node[path[path.length - 1]!] = junk;
        const parsed = parseSave(broken)!;
        expect(parsed).not.toBeNull();
        useLikeApp(parsed, now);
        expect(JSON.stringify(parsed)).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

describe("ліміти", () => {
  it("історія, журнал карток, останні застосування й дні обрізаються, і лишається найновіше", () => {
    const record = (index: number) => ({
      id: `r${index}`,
      finishedAt: new Date(2026, 0, 1, 0, index).toISOString(),
      topic: "simple",
      mode: "physical",
      total: 1,
      clean: 1,
      withHelp: 0,
      failed: 0,
      partial: false,
      review: false,
      earned: {},
      bonuses: [],
    });
    const card = (index: number) => ({ id: `c${index}`, finishedAt: new Date(2026, 0, 1, 0, index).toISOString(), kind: "read", digits: 1, total: 5, correct: 5, earned: {}, week: false });
    const days = Array.from({ length: 200 }, (_, index) => `2026-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 28)).padStart(2, "0")}`);
    const big = {
      ...emptySave(),
      history: Array.from({ length: 5000 }, (_, index) => record(index)),
      cardLog: Array.from({ length: 2000 }, (_, index) => card(index)),
      weekGoalsPaid: Array.from({ length: 500 }, (_, index) => `week-${index}`),
      skills: { simple: { physical: { correct: 900, total: 1000, recent: Array.from({ length: 500 }, (_, i) => i % 2 === 0), days }, mental: null } },
      questsDone: Array.from({ length: 1000 }, (_, index) => `q${index}`),
      childName: "Я".repeat(500),
      flashBest: 100000,
    };
    const parsed = parseSave(roundTrip(big))!;
    expect(parsed.history).toHaveLength(HISTORY_LIMIT);
    expect(parsed.history[HISTORY_LIMIT - 1]!.id).toBe("r4999");
    expect(parsed.cardLog).toHaveLength(CARD_LOG_LIMIT);
    expect(parsed.cardLog[CARD_LOG_LIMIT - 1]!.id).toBe("c1999");
    expect(parsed.weekGoalsPaid).toHaveLength(DAYS_LIMIT);
    expect(parsed.weekGoalsPaid[DAYS_LIMIT - 1]).toBe("week-499");
    expect(parsed.skills.simple!.physical.recent).toHaveLength(RECENT_LIMIT);
    expect(parsed.skills.simple!.physical.days.length).toBeLessThanOrEqual(DAYS_LIMIT);
    expect(parsed.questsDone.length).toBeLessThanOrEqual(100);
    expect(parsed.childName).toHaveLength(40);
    expect(parsed.flashBest).toBe(99);
  });

  it("найбільше можливе збереження вміщається в сховище браузера (5 МБ) із запасом", () => {
    const who = child(1, 4);
    let save: SaveData = { ...emptySave(), abacusAsked: true };
    for (let day = 0; day < 30; day++) save = playDay(save, day, who).save;
    // Розтягуємо історію до ліміту тими самими записами з різними id.
    const history = Array.from({ length: HISTORY_LIMIT }, (_, index) => ({ ...save.history[index % save.history.length]!, id: `h${index}` }));
    const cardLog = Array.from({ length: CARD_LOG_LIMIT }, (_, index) => ({ ...save.cardLog[index % save.cardLog.length]!, id: `c${index}` }));
    const full = parseSave(roundTrip({ ...save, history, cardLog }))!;
    expect(full.history).toHaveLength(HISTORY_LIMIT);
    // localStorage рахує UTF-16: два байти на символ.
    expect(JSON.stringify(full).length * 2).toBeLessThan(2_500_000);
  });
});

describe("старі збереження", () => {
  /** Перша версія застосунку (11.11.2026): один острів, шість блоків, без карток, імені, скіна. */
  const firstVersion = () => ({
    version: 1,
    skills: {
      simple: { physical: { correct: 90, total: 95, recent: Array(30).fill(true), days: ["2026-11-11", "2026-11-12", "2026-11-13"] }, mental: { correct: 0, total: 0, recent: [], days: [] } },
      "five:+4": { physical: { correct: 12, total: 15, recent: [true, false, true], days: ["2026-11-13"] }, mental: { correct: 0, total: 0, recent: [], days: [] } },
    },
    history: [
      { id: "old-1", finishedAt: "2026-11-11T10:00:00.000Z", topic: "simple", mode: "physical", total: 10, clean: 8, withHelp: 1, failed: 1, partial: false, earned: { wood: 17, grass: 3 }, bonuses: ["accuracy"] },
    ],
    active: null,
    setup: { topic: "five:+4", exampleCount: 10, actionsPerExample: 4, digits: 1, operations: "mixed" },
    lastExportAt: null,
    unlockAll: false,
    inventory: { grass: 5, wood: 17, stone: 0, sand: 0, ice: 0, crystal: 2 },
    island: [...Array(95).fill(null), "wood"],
    weekGoalsPaid: ["2026-11-09"],
    sound: false,
  });

  it("перша версія: прогрес, історія, запас і острів переносяться повністю", () => {
    const parsed = parseSave(firstVersion())!;
    expect(parsed.skills.simple!.physical.correct).toBe(90);
    expect(parsed.skills["five:+4"]!.physical.total).toBe(15);
    expect(parsed.history).toHaveLength(1);
    expect(parsed.history[0]!.earned).toEqual({ wood: 17, grass: 3 });
    expect(parsed.history[0]!.review).toBe(false);
    expect(parsed.inventory.wood).toBe(17);
    expect(parsed.inventory.grass).toBe(5);
    expect(parsed.inventory.crystal).toBe(2);
    // Нові блоки з'являються з нулем, а не з undefined.
    expect(parsed.inventory.truck).toBe(0);
    expect(parsed.plots).toHaveLength(1);
    expect(parsed.plots[0]!.kind).toBe("island");
    expect(parsed.plots[0]!.cells[95]).toBe("wood");
    expect(parsed.sound).toBe(false);
    expect(parsed.weekGoalsPaid).toEqual(["2026-11-09"]);
    expect(parsed.setup.mode).toBe("physical");
    // Хто вже займався, того про абакус не питаємо.
    expect(parsed.abacusAsked).toBe(true);
    useLikeApp(parsed, new Date(2026, 10, 14, 12));
  });

  it("сонячна панель зі старих збережень стає машинкою — у запасі, на острові й у здобичі", () => {
    const old = {
      ...firstVersion(),
      inventory: { grass: 1, solar: 3, truck: 2 },
      plots: [{ kind: "island", cells: ["solar", ...Array(95).fill(null)] }],
      history: [{ ...firstVersion().history[0], earned: { solar: 1 } }],
    };
    const parsed = parseSave(roundTrip(old))!;
    expect(parsed.inventory.truck).toBe(5);
    expect(parsed.plots[0]!.cells[0]).toBe("truck");
    expect(parsed.history[0]!.earned).toEqual({ truck: 1 });
  });

  it("збереження з майбутньої версії не читається й не затирається", () => {
    const data = new Map<string, string>([[SAVE_KEY, JSON.stringify({ ...firstVersion(), version: 2 })]]);
    const store: KeyValueStore = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
    const loaded = loadSave(store);
    expect(loaded.warning).not.toBeNull();
    // Оригінал відкладено окремо, тож його можна повернути.
    expect(data.get(CORRUPT_KEY)).toBe(JSON.stringify({ ...firstVersion(), version: 2 }));
  });
});

describe("резервна копія", () => {
  it("експорт → імпорт повертає той самий прогрес (без незавершеного заняття)", () => {
    const save = livedSave();
    const now = new Date(2026, 2, 1, 9);
    const restored = parseExportText(toExportText(save, now))!;
    expect(restored).toEqual({ ...save, active: null, lastExportAt: now.toISOString() });
  });

  it("пошкоджений чи обрізаний файл копії відхиляється цілком", () => {
    const text = toExportText(livedSave(), new Date(2026, 2, 1));
    for (const cut of [1, 10, text.length / 2, text.length - 1]) expect(parseExportText(text.slice(0, cut))).toBeNull();
    expect(parseExportText(text.replace("mental-math-backup", "other-app"))).toBeNull();
    expect(parseExportText(JSON.stringify({ app: "mental-math-backup" }))).toBeNull();
    expect(parseExportText(JSON.stringify({ app: "mental-math-backup", data: { version: 1 } }))).toBeNull();
  });

  it("файл копії з дописаним сміттям у полях усе одно дає придатне збереження", () => {
    const text = toExportText(livedSave(), new Date(2026, 2, 1));
    const parsed = JSON.parse(text) as { data: Record<string, unknown> };
    parsed.data.inventory = { grass: -5, wood: "багато", gold: 1.5, crystal: 3 };
    parsed.data.plots = [{ kind: "castle", cells: [] }, { kind: "island", cells: ["dragon"] }];
    const restored = parseExportText(JSON.stringify(parsed))!;
    expect(restored.inventory.grass).toBe(0);
    expect(restored.inventory.wood).toBe(0);
    expect(restored.inventory.gold).toBe(0);
    expect(restored.inventory.crystal).toBe(3);
    expect(restored.plots).toHaveLength(1);
    expect(restored.plots[0]!.cells.every((cell) => cell === null)).toBe(true);
  });
});

describe("сховище браузера", () => {
  it("переповнене сховище: запис повертає false, попередні дані лишаються цілими", () => {
    const data = new Map<string, string>();
    let full = false;
    const store: KeyValueStore = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        if (full) throw new DOMException("quota", "QuotaExceededError");
        data.set(key, value);
      },
    };
    const first = livedSave();
    expect(writeSave(store, first)).toBe(true);
    full = true;
    expect(writeSave(store, { ...first, childName: "Нове" })).toBe(false);
    expect(loadSave(store).data).toEqual(first);
  });

  it("копія перед імпортом пишеться під окремим ключем і не чіпає основне збереження", () => {
    const data = new Map<string, string>();
    const store: KeyValueStore = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
    const save = livedSave();
    writeSave(store, save);
    expect(writeSave(store, emptySave(), BEFORE_IMPORT_KEY)).toBe(true);
    expect(loadSave(store).data).toEqual(save);
  });
});
