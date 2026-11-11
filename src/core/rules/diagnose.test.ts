import { describe, expect, it } from "vitest";
import { diagnose } from "./diagnose";
import type { Sign } from "./skills";
import { type Step, buildStep } from "./step";

/** Ланцюжок дій від нуля: chain(1, 4, -2) → 1 + 4 − 2. */
function chain(...numbers: number[]): Step[] {
  let value = 0;
  return numbers.map((number) => {
    const sign: Sign = number >= 0 ? "+" : "-";
    const step = buildStep(value, sign, Math.abs(number))!;
    value = step.after;
    return step;
  });
}

describe("розбір помилок", () => {
  it("правильна відповідь не розбирається", () => {
    expect(diagnose(chain(1, 4), 5)).toEqual([]);
  });

  it("формула через 5: додала п'ятірку, але не забрала доповнення", () => {
    // 1 + 4 = 5; якщо зробити +5 і не відсунути 1 — вийде 6
    const [first] = diagnose(chain(1, 4), 6);
    expect(first).toMatchObject({ kind: "formula", stepIndex: 1, skill: "five:+4" });
    expect(first!.text).toBe("Схоже, у дії «+4» (2-ша дія) ти присунула п'ятірку, але не відсунула 1.");
  });

  it("формула через 10: забутий десяток", () => {
    // 6 + 9 = 15; без десятка — 5
    expect(diagnose(chain(6, 9), 5)[0]).toMatchObject({ kind: "formula", stepIndex: 1, skill: "ten:+9" });
    // 15 − 9 = 6; забрала десяток, але не додала 1 — вийде 5
    expect(diagnose(chain(8, 7, -9), 5)[0]).toMatchObject({ kind: "formula", stepIndex: 2, skill: "ten:-9" });
  });

  it("комбінована формула: забута п'ятірка", () => {
    // 5 + 6 = 11; +1, не відсунула 5, +10 → 16
    expect(diagnose(chain(5, 6), 16)[0]).toMatchObject({ kind: "formula", skill: "mix:+6" });
  });

  it("помилка на десятках у двоцифрових числах", () => {
    // 10 + 40 = 50 через п'ятірку на десятках; не відсунула 1 десяток → 60
    const [first] = diagnose(chain(10, 40), 60);
    expect(first).toMatchObject({ kind: "formula", skill: "five:+4" });
    expect(first!.text).toContain("на десятках");
  });

  it("помилка всередині ланцюжка знаходиться за різницею", () => {
    // 2 + 2 + 4 − 3 = 5; у «+4» не відсунула 1 → 6
    expect(diagnose(chain(2, 2, 4, -3), 6)[0]).toMatchObject({ kind: "formula", stepIndex: 2, skill: "five:+4" });
  });

  it("пропущена дія і переплутаний знак", () => {
    // 2 + 6 − 1 = 7
    expect(diagnose(chain(2, 6, -1), 8)[0]).toMatchObject({ kind: "skipped", stepIndex: 2 });
    expect(diagnose(chain(2, 6, -1), 1)[0]).toMatchObject({ kind: "skipped", stepIndex: 1 });
    expect(diagnose(chain(2, 6, -1), 9)[0]).toMatchObject({ kind: "sign", stepIndex: 2 });
  });

  it("число на сусідній спиці й описка", () => {
    // 12 + 3 = 15; трійка на десятках → 42
    expect(diagnose(chain(12, 3), 42)[0]).toMatchObject({ kind: "shift", stepIndex: 1 });
    // 12 + 35 = 47 → 74
    expect(diagnose(chain(12, 35), 74)[0]).toMatchObject({ kind: "typo" });
  });

  it("незрозумілу помилку не вигадує і дає не більше двох причин", () => {
    expect(diagnose(chain(2, 6, -1), 3)).toEqual([]);
    expect(diagnose(chain(1, 1, 1, 1), 3).length).toBeLessThanOrEqual(2);
  });

  it("кроки пам'ятають, на якій спиці застосовано прийом", () => {
    expect(buildStep(49, "+", 1)!.skillRods).toEqual([
      { skill: "ten:+1", rod: 0 },
      { skill: "five:+1", rod: 1 },
    ]);
  });
});
