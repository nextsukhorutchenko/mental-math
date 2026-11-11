/**
 * Фон застосунку: пора року змінюється сама за місяцем, а святковий фон
 * вмикають за бажанням, коли свято близько.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

/** РРРР-ММ-ДД за місцевим часом (свій варіант: модуль читає збереження, тож не тягне прогрес). */
function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function seasonOf(date: Date): Season {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "autumn";
}

export const SEASON_TITLES: Record<Season, string> = {
  spring: "весна",
  summer: "літо",
  autumn: "осінь",
  winter: "зима",
};

export const HOLIDAY_IDS = ["halloween", "nicholas", "christmas", "newyear", "easter", "birthday"] as const;
export type HolidayId = (typeof HOLIDAY_IDS)[number];

/** День народження дитини у вигляді ММ-ДД. */
export type Birthday = string | null;
export const isBirthday = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{2}-\d{2}$/.test(value)) return false;
  const [month, day] = value.split("-").map(Number) as [number, number];
  const probe = new Date(2024, month - 1, day);
  return probe.getMonth() === month - 1 && probe.getDate() === day;
};

/**
 * Великдень за православною пасхалією (алгоритм Меєуса для юліанського календаря),
 * переведений у григоріанський: +13 днів, вірно для 1900–2099 років.
 */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return new Date(year, month - 1, day + 13);
}

interface HolidayInfo {
  icon: string;
  title: string;
  /** Дата свята в указаному році; null — дату не задано (день народження). */
  on: (year: number, birthday: Birthday) => Date | null;
  /** За скільки днів до свята фон можна ввімкнути і скільки днів він тримається після. */
  before: number;
  after: number;
}

export const HOLIDAYS: Record<HolidayId, HolidayInfo> = {
  halloween: { icon: "🎃", title: "Гелловін", on: (y) => new Date(y, 9, 31), before: 16, after: 2 },
  // 6 грудня; фон можна вмикати від 1 листопада, поки чекаємо подарунків.
  nicholas: { icon: "🎁", title: "День святого Миколая", on: (y) => new Date(y, 11, 6), before: 35, after: 3 },
  // 25 грудня; тримається до 7 січня, коли Різдво теж святкують у багатьох родинах.
  christmas: { icon: "🎄", title: "Різдво", on: (y) => new Date(y, 11, 25), before: 18, after: 13 },
  newyear: { icon: "🎆", title: "Новий рік", on: (y) => new Date(y, 0, 1), before: 17, after: 13 },
  easter: { icon: "🐣", title: "Великдень", on: orthodoxEaster, before: 14, after: 7 },
  birthday: {
    icon: "🎂",
    title: "День народження",
    on: (y, birthday) => {
      if (!isBirthday(birthday)) return null;
      const [month, day] = birthday.split("-").map(Number) as [number, number];
      return new Date(y, month - 1, day);
    },
    before: 7,
    after: 2,
  },
};

const shift = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Вікно свята, у яке потрапляє дата, або null. Перевіряємо сусідні роки: вікна переходять через Новий рік. */
function windowAt(id: HolidayId, date: Date, birthday: Birthday): { day: Date; end: Date } | null {
  const info = HOLIDAYS[id];
  const today = localDay(date);
  for (const year of [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]) {
    const day = info.on(year, birthday);
    if (!day) return null;
    const end = shift(day, info.after);
    if (localDay(shift(day, -info.before)) <= today && today <= localDay(end)) return { day, end };
  }
  return null;
}

/** Свята, фон яких зараз доречно запропонувати. */
export function availableHolidays(date: Date, birthday: Birthday = null): HolidayId[] {
  return HOLIDAY_IDS.filter((id) => windowAt(id, date, birthday) !== null);
}

export function greeting(id: HolidayId, date: Date, name = ""): string {
  switch (id) {
    case "halloween":
      return "Щасливого Гелловіну!";
    case "nicholas":
      return "З Днем святого Миколая!";
    case "christmas":
      return "Веселого Різдва!";
    case "easter":
      return "Зі світлим Великоднем!";
    case "birthday":
      return name ? `${name}, з днем народження!` : "З днем народження!";
    case "newyear": {
      // У другій половині року (і під час перегляду фону восени) — уже наступний рік.
      const year = date.getFullYear() + (date.getMonth() >= 6 ? 1 : 0);
      return `З Новим ${year} роком!`;
    }
  }
}

/** Вибраний святковий фон і останній день, коли він ще показується. */
export interface BackdropChoice {
  holiday: HolidayId;
  until: string;
}

/**
 * Вмикає святковий фон. У межах свята він тримається до кінця свята,
 * а поза ним (батьки лише дивляться, як він виглядає) — до кінця завтрашнього дня.
 */
export function chooseHoliday(id: HolidayId, date: Date, birthday: Birthday = null): BackdropChoice {
  const window = windowAt(id, date, birthday);
  return { holiday: id, until: localDay(window ? window.end : shift(date, 1)) };
}

export function activeHoliday(choice: BackdropChoice | null, date: Date): HolidayId | null {
  return choice && localDay(date) <= choice.until ? choice.holiday : null;
}
