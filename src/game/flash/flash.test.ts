import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../../storage/save";
import { FLASH_LEVELS, creditFlash, flashNumbers, flashPassed, isFast } from "./flash";

describe("флеш-виклик", () => {
  it("рівні йдуть підряд і стають складнішими до сотень мілісекунд", () => {
    expect(FLASH_LEVELS.map((level) => level.number)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(FLASH_LEVELS[0]).toMatchObject({ digits: 1, count: 3, intervalMs: 2000 });
    expect(FLASH_LEVELS[14]).toMatchObject({ digits: 3, count: 15, intervalMs: 200 });
  });

  it("попередження про блимання лише для швидких рівнів", () => {
    expect(FLASH_LEVELS.filter(isFast).map((level) => level.number)).toEqual([13, 14, 15]);
  });

  it("числа потрібної розрядності, без повторів поспіль, повторювані за seed", () => {
    for (const level of FLASH_LEVELS) {
      const numbers = flashNumbers(level, 7);
      expect(numbers).toHaveLength(level.count);
      numbers.forEach((number, index) => {
        expect(String(number)).toHaveLength(level.digits);
        expect(number).not.toBe(numbers[index - 1]);
      });
      expect(flashNumbers(level, 7)).toEqual(numbers);
    }
  });

  it("рівень пройдено від двох правильних раундів із трьох", () => {
    expect([1, 2, 3].map(flashPassed)).toEqual([false, true, true]);
  });

  it("кристал дається лише за новий рекорд", () => {
    const first = creditFlash(emptySave(), 3, 2);
    expect(first).toMatchObject({ flashBest: 3, inventory: { crystal: 1 } });
    expect(creditFlash(first, 3, 3)).toBe(first);
    expect(creditFlash(first, 2, 3)).toBe(first);
    expect(creditFlash(first, 5, 1)).toBe(first);
    expect(creditFlash(first, 5, 3)).toMatchObject({ flashBest: 5, inventory: { crystal: 2 } });
    expect(parseSave(JSON.parse(JSON.stringify(first)))!.flashBest).toBe(3);
  });
});
