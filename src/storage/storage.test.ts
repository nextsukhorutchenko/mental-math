import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, toDrillConfig } from "../game/session/setup";
import { CORRUPT_KEY, type KeyValueStore, SAVE_KEY, loadSave, writeSave } from "./localStore";
import { type SaveData, emptySave, parseExportText, parseSave, toExportText } from "./save";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const sample = (): SaveData => ({
  ...emptySave(),
  skills: {
    "five:+4": {
      physical: { correct: 3, total: 4, recent: [true, true, false, true], days: ["2026-11-11"] },
      mental: { correct: 0, total: 0, recent: [], days: [] },
    },
  },
  history: [
    {
      id: "s1",
      finishedAt: "2026-11-11T16:30:00.000Z",
      topic: "five:+4",
      mode: "physical",
      total: 5,
      clean: 3,
      withHelp: 1,
      failed: 1,
      partial: false,
      review: false,
      earned: { stone: 7, grass: 3 },
      bonuses: [],
    },
  ],
  active: {
    id: "a1",
    setup: DEFAULT_SETUP,
    config: { ...toDrillConfig(DEFAULT_SETUP), seed: 42 },
    started: true,
    index: 1,
    results: [{ answers: [5], solved: true, hintUsed: false }],
    current: { answers: [3], solved: false, hintUsed: true },
    status: "answering",
  },
});

describe("збереження в браузері", () => {
  it("записує й читає ті самі дані", () => {
    const store = memoryStore();
    expect(writeSave(store, sample())).toBe(true);
    expect(loadSave(store)).toEqual({ data: sample(), warning: null });
  });

  it("порожнє сховище — чистий аркуш без попереджень", () => {
    expect(loadSave(memoryStore())).toEqual({ data: emptySave(), warning: null });
  });

  it("пошкоджені дані відкладає, а не затирає", () => {
    const store = memoryStore({ [SAVE_KEY]: "{не json" });
    const result = loadSave(store);
    expect(result.data).toEqual(emptySave());
    expect(result.warning).toMatch(/пошкоджено/);
    expect(store.data.get(CORRUPT_KEY)).toBe("{не json");
  });

  it("повідомляє про невдалий запис і недоступне сховище", () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(writeSave(full, sample())).toBe(false);
    expect(writeSave(null, sample())).toBe(false);
    expect(loadSave(null).warning).toMatch(/не дозволяє/);
  });
});

describe("перевірка даних", () => {
  it("відхиляє чуже й стару версію", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave({ version: 2, skills: {}, history: [] })).toBeNull();
    expect(parseSave({ version: 1, skills: [], history: [] })).toBeNull();
  });

  it("викидає зіпсовані частини, решту зберігає", () => {
    const dirty = {
      ...sample(),
      skills: {
        "five:+4": { physical: { correct: 9, total: 4, recent: [], days: [] }, mental: null },
        "hack:+1": { physical: { correct: 1, total: 1, recent: [], days: [] } },
      },
      history: [sample().history[0], sample().history[0], { id: "bad" }, { ...sample().history[0], id: "s2", clean: 9 }],
      active: { ...sample().active, index: 3 },
      setup: { ...DEFAULT_SETUP, exampleCount: 5000 },
    };
    const parsed = parseSave(JSON.parse(JSON.stringify(dirty)))!;
    expect(parsed.skills["five:+4"]!.physical.total).toBe(0);
    expect(Object.keys(parsed.skills)).toEqual(["five:+4"]);
    expect(parsed.history.map((record) => record.id)).toEqual(["s1"]);
    expect(parsed.active).toBeNull();
    expect(parsed.setup).toEqual(DEFAULT_SETUP);
  });
});

describe("сумісність зі старими збереженнями", () => {
  it("налаштування без режиму й темпу отримують типові значення", () => {
    const { mode, pacing, secondsPerNumber, ...old } = { ...DEFAULT_SETUP, exampleCount: 7 };
    void [mode, pacing, secondsPerNumber];
    const parsed = parseSave({ ...emptySave(), setup: old })!;
    expect(parsed.setup).toEqual({ ...DEFAULT_SETUP, exampleCount: 7 });
  });

  it("зберігає ментальний режим і темп, а неможливий темп замінює типовим", () => {
    const setup = { ...DEFAULT_SETUP, mode: "mental", pacing: "auto", secondsPerNumber: 1.5 };
    expect(parseSave({ ...emptySave(), setup })!.setup).toEqual(setup);
    expect(parseSave({ ...emptySave(), setup: { ...setup, secondsPerNumber: 99 } })!.setup.secondsPerNumber).toBe(2);
  });
});

describe("тема тренажера", () => {
  it("множення чи ділення, вибране в тренажері, зберігається; невідомий рівень відкидається", () => {
    const setup = { ...DEFAULT_SETUP, topic: "simple" as const, level: "mul:2x1" };
    expect(parseSave({ ...emptySave(), setup })!.setup).toEqual(setup);
    expect(parseSave({ ...emptySave(), setup: { ...setup, level: "mul:9x9" } })!.setup.level).toBeUndefined();
  });
});

describe("ім'я для грамот", () => {
  it("за замовчуванням — Поля, і в нових, і в старих збереженнях без імені", () => {
    expect(emptySave().childName).toBe("Поля");
    expect(parseSave({ ...emptySave(), childName: "" })!.childName).toBe("Поля");
    expect(parseSave({ ...emptySave(), childName: "   " })!.childName).toBe("Поля");
    const { childName, ...old } = emptySave();
    void childName;
    expect(parseSave(old)!.childName).toBe("Поля");
    expect(parseSave({ ...emptySave(), childName: "Марійка" })!.childName).toBe("Марійка");
  });
});

describe("резервна копія у файлі", () => {
  const now = new Date("2026-11-12T10:00:00.000Z");

  it("експорт і імпорт повертають прогрес без незавершеного заняття", () => {
    const restored = parseExportText(toExportText(sample(), now))!;
    expect(restored.skills).toEqual(sample().skills);
    expect(restored.history).toEqual(sample().history);
    expect(restored.active).toBeNull();
    expect(restored.lastExportAt).toBe(now.toISOString());
  });

  it("не приймає сторонні файли", () => {
    expect(parseExportText("привіт")).toBeNull();
    expect(parseExportText(JSON.stringify({ app: "other", data: sample() }))).toBeNull();
    expect(parseExportText(JSON.stringify({ app: "mental-math-backup", data: { version: 1 } }))).toBeNull();
  });
});
