import { describe, expect, it } from "vitest";
import { activeHoliday, availableHolidays, chooseHoliday, greeting, seasonOf } from "./seasons";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("пори року", () => {
  it("змінюються за місяцем", () => {
    expect(seasonOf(day(2026, 11, 12))).toBe("autumn");
    expect(seasonOf(day(2026, 12, 1))).toBe("winter");
    expect(seasonOf(day(2027, 2, 28))).toBe("winter");
    expect(seasonOf(day(2027, 3, 1))).toBe("spring");
    expect(seasonOf(day(2027, 7, 15))).toBe("summer");
    expect(seasonOf(day(2027, 9, 1))).toBe("autumn");
  });
});

describe("свята", () => {
  it("пропонують фон, коли свято близько", () => {
    expect(availableHolidays(day(2026, 10, 31))).toEqual([]);
    expect(availableHolidays(day(2026, 11, 12))).toEqual(["nicholas"]);
    expect(availableHolidays(day(2026, 12, 8))).toEqual(["nicholas", "christmas"]);
    expect(availableHolidays(day(2026, 12, 20))).toEqual(["christmas", "newyear"]);
    expect(availableHolidays(day(2027, 1, 5))).toEqual(["christmas", "newyear"]);
    expect(availableHolidays(day(2027, 1, 10))).toEqual(["newyear"]);
    expect(availableHolidays(day(2027, 1, 20))).toEqual([]);
  });

  it("новорічне привітання — з наступним роком у грудні", () => {
    expect(greeting("newyear", day(2026, 12, 28))).toBe("З Новим 2027 роком!");
    expect(greeting("newyear", day(2027, 1, 3))).toBe("З Новим 2027 роком!");
    expect(greeting("newyear", day(2026, 11, 12))).toBe("З Новим 2027 роком!");
  });

  it("вибраний фон тримається до кінця свята, навіть через Новий рік", () => {
    const choice = chooseHoliday("newyear", day(2026, 12, 20));
    expect(choice).toEqual({ holiday: "newyear", until: "2027-01-14" });
    expect(activeHoliday(choice, day(2027, 1, 14))).toBe("newyear");
    expect(activeHoliday(choice, day(2027, 1, 15))).toBeNull();
    expect(chooseHoliday("nicholas", day(2026, 11, 12)).until).toBe("2026-12-09");
  });

  it("поза святом фон можна лише переглянути до завтра", () => {
    const preview = chooseHoliday("christmas", day(2026, 11, 12));
    expect(preview.until).toBe("2026-11-13");
    expect(activeHoliday(preview, day(2026, 11, 14))).toBeNull();
    expect(activeHoliday(null, day(2026, 11, 12))).toBeNull();
  });
});
