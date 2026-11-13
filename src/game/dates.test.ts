import { afterEach, describe, expect, it } from "vitest";
import { type SaveData, emptySave } from "../storage/save";
import { child, playLesson, playPart } from "../testing/simulate";
import { dailyPlan } from "./curriculum/daily";
import { daysBetween, localDay } from "./progress/progress";
import { weekStats } from "./progress/stats";
import { weekActiveDays, weekId } from "./rewards/rewards";
import { HOLIDAY_IDS, activeHoliday, availableHolidays, chooseHoliday, seasonOf } from "./seasons/seasons";

/**
 * Дати: північ, перехід на літній і зимовий час, інші часові пояси, зміна року.
 * Усе, що залежить від «сьогодні», має рахуватися за місцевим календарем і не збиватися на межах.
 */

const ZONES = [
  "Europe/Kyiv",
  "UTC",
  "America/Los_Angeles",
  "Pacific/Auckland",
  "Asia/Kolkata",
  // Перехід на літній час опівночі: 00:00 цього дня не існує.
  "America/Havana",
  // Зсув на пів години замість години.
  "Australia/Lord_Howe",
  "Pacific/Kiritimati",
];

const ORIGINAL_ZONE = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_ZONE === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_ZONE;
});

const pad = (value: number) => String(value).padStart(2, "0");
/** Календарні дні двох років поспіль як [рік, місяць, день] — без Date, щоб не залежати від того, що перевіряємо. */
function calendar(): [number, number, number][] {
  const days: [number, number, number][] = [];
  for (const year of [2026, 2027, 2028]) {
    const leap = year % 4 === 0;
    [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].forEach((length, month) => {
      for (let day = 1; day <= length; day++) days.push([year, month, day]);
    });
  }
  return days;
}
const CALENDAR = calendar();
const text = ([year, month, day]: [number, number, number]) => `${year}-${pad(month + 1)}-${pad(day)}`;

describe.each(ZONES)("календар у часовому поясі %s", (zone) => {
  const enter = () => {
    process.env.TZ = zone;
  };

  it("день за місцевим часом правильний о будь-якій годині, зокрема в ніч переведення годинника", () => {
    enter();
    for (const date of CALENDAR) {
      for (const [hour, minute] of [[0, 0], [0, 30], [1, 59], [2, 30], [3, 0], [12, 0], [23, 59]]) {
        const moment = new Date(date[0], date[1], date[2], hour, minute, 59);
        // Неіснуючий час (стрибок уперед) зсувається, але лишається тим самим днем.
        expect(localDay(moment), `${text(date)} ${hour}:${minute}`).toBe(text(date));
      }
    }
  });

  it("між сусідніми днями завжди рівно один день, між далекими — календарна різниця", () => {
    enter();
    for (let index = 1; index < CALENDAR.length; index++) {
      expect(daysBetween(text(CALENDAR[index - 1]!), text(CALENDAR[index]!))).toBe(1);
    }
    for (const [from, to] of [[0, 400], [10, 11], [59, 60], [80, 300], [300, 80], [364, 366], [0, CALENDAR.length - 1]] as const) {
      expect(daysBetween(text(CALENDAR[from]!), text(CALENDAR[to]!))).toBe(to - from);
    }
  });

  it("тиждень починається в понеділок, і всі сім днів мають той самий тиждень — і через Новий рік теж", () => {
    enter();
    // 5 січня 2026 — понеділок.
    const first = CALENDAR.findIndex((date) => text(date) === "2026-01-05");
    for (let index = first; index + 7 <= CALENDAR.length; index += 7) {
      const monday = text(CALENDAR[index]!);
      for (let offset = 0; offset < 7; offset++) {
        const [year, month, day] = CALENDAR[index + offset]!;
        for (const hour of [0, 12, 23]) {
          expect(weekId(new Date(year, month, day, hour, 30)), `${text(CALENDAR[index + offset]!)} ${hour}:30`).toBe(monday);
        }
      }
    }
  });

  it("тижнева статистика — це сім різних днів поспіль, що закінчуються сьогодні", () => {
    enter();
    for (let index = 6; index < CALENDAR.length; index += 3) {
      const [year, month, day] = CALENDAR[index]!;
      const stats = weekStats([], new Date(year, month, day, 23, 59));
      expect(stats.days.map((item) => item.day)).toEqual(CALENDAR.slice(index - 6, index + 1).map(text));
    }
  });

  it("заняття о 23:59 — це сьогодні, о 00:01 — уже завтра: план дня, тиждень і статистика згодні", () => {
    enter();
    // Ніч переведення годинника в більшості поясів і звичайна ніч.
    for (const [year, month, day] of [[2026, 2, 28], [2026, 9, 24], [2026, 5, 10], [2026, 11, 31], [2027, 2, 13]] as const) {
      const late = new Date(year, month, day, 23, 59, 30);
      const early = new Date(year, month, day + 1, 0, 1, 0);
      const who = child(1, 3);
      let save: SaveData = { ...emptySave(), abacusAsked: true };
      const plan = dailyPlan(save, late);
      for (const part of plan) save = playPart(save, part, late, who);

      expect(dailyPlan(save, late).every((part) => part.done), `${year}-${month + 1}-${day}: увечері все зроблено`).toBe(true);
      const morning = dailyPlan(save, early);
      expect(morning.find((part) => part.id === "cards")!.done, "зранку картки ще не зроблено").toBe(false);
      expect(morning.find((part) => part.id === "level")!.done, "зранку рівень ще не зроблено").toBe(false);

      const events = [...save.history, ...save.cardLog];
      expect(weekStats(save.history, late).days[6]!.sessions).toBe(save.history.length);
      expect(weekStats(save.history, early).days[6]!.sessions).toBe(0);
      expect(weekStats(save.history, early).days[5]!.sessions).toBe(save.history.length);
      expect(weekActiveDays(events, late)).toBe(1);

      // Заняття наступного дня — це вже другий день практики, а не той самий.
      const level = plan.find((part) => part.id === "level")!;
      if (level.id !== "cards") save = playLesson(save, level.lesson, early, who);
      const days = Object.values(save.skills).flatMap((progress) => progress!.physical.days);
      expect(new Set(days).size).toBe(2);
    }
  });

  it("пора року й святкові фони не миготять у межах одного дня", () => {
    enter();
    for (let index = 0; index < CALENDAR.length; index++) {
      const [year, month, day] = CALENDAR[index]!;
      const start = new Date(year, month, day, 0, 0, 1);
      const end = new Date(year, month, day, 23, 59, 59);
      expect(seasonOf(start)).toBe(seasonOf(end));
      expect(availableHolidays(start, "02-29")).toEqual(availableHolidays(end, "02-29"));
      for (const holiday of HOLIDAY_IDS) {
        const choice = chooseHoliday(holiday, start, "07-15");
        // Щойно ввімкнений фон діє щонайменше до кінця сьогоднішнього дня і колись закінчується.
        expect(activeHoliday(choice, end), `${holiday} ${text(CALENDAR[index]!)}`).toBe(holiday);
        expect(choice.until >= text(CALENDAR[index]!)).toBe(true);
        expect(activeHoliday(choice, new Date(year, month, day + 60))).toBeNull();
      }
    }
  });
});

describe("переведений назад годинник", () => {
  it("заняття «в минулому» після занять «у майбутньому» зараховуються й не валять план", () => {
    const who = child(1, 9);
    let save: SaveData = { ...emptySave(), abacusAsked: true };
    const moments = [new Date(2026, 5, 10, 18), new Date(2026, 5, 11, 18), new Date(2026, 5, 3, 18), new Date(2025, 0, 1, 9), new Date(2026, 5, 12, 18)];
    for (const moment of moments) {
      for (const part of dailyPlan(save, moment)) if (!part.done) save = playPart(save, part, moment, who);
      expect(dailyPlan(save, moment).length).toBeGreaterThanOrEqual(2);
    }
    expect(save.history.length).toBeGreaterThanOrEqual(moments.length);
    const first = Object.values(save.skills)[0]!.physical;
    expect(first.days).toHaveLength(5);
    expect(first.correct).toBeLessThanOrEqual(first.total);
  });

  it("день народження 29 лютого не ламає фон у невисокосний рік", () => {
    for (const year of [2026, 2027, 2028]) {
      for (let month = 0; month < 12; month++) {
        expect(() => availableHolidays(new Date(year, month, 28), "02-29")).not.toThrow();
        expect(() => chooseHoliday("birthday", new Date(year, month, 28), "02-29")).not.toThrow();
      }
    }
  });
});
