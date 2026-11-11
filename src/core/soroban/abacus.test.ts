import { describe, expect, it } from "vitest";
import { applyMoves, fromNumber, rodDigit, toNumber } from "./abacus";

describe("модель абакуса", () => {
  it("набирає число й читає його назад", () => {
    for (let value = 0; value <= 9999; value++) {
      expect(toNumber(fromNumber(value))).toBe(value);
    }
  });

  it("розкладає цифру на верхню й нижні кісточки", () => {
    const [units, tens] = fromNumber(73);
    expect(units).toEqual({ upper: false, lower: 3 });
    expect(tens).toEqual({ upper: true, lower: 2 });
    expect(rodDigit(tens!)).toBe(7);
  });

  it("відхиляє від'ємні, дробові й завеликі числа", () => {
    expect(() => fromNumber(-1)).toThrow();
    expect(() => fromNumber(1.5)).toThrow();
    expect(() => fromNumber(100, 2)).toThrow();
  });

  it("не дозволяє фізично неможливі рухи", () => {
    const five = fromNumber(5);
    expect(() => applyMoves(five, [{ rod: 0, bead: "upper", direction: "on", count: 1 }])).toThrow();
    expect(() => applyMoves(five, [{ rod: 0, bead: "lower", direction: "off", count: 1 }])).toThrow();
    expect(() => applyMoves(fromNumber(3), [{ rod: 0, bead: "lower", direction: "on", count: 2 }])).toThrow();
  });

  it("не змінює вихідний абакус", () => {
    const start = fromNumber(2);
    const result = applyMoves(start, [{ rod: 0, bead: "lower", direction: "on", count: 2 }]);
    expect(toNumber(start)).toBe(2);
    expect(toNumber(result)).toBe(4);
  });
});
