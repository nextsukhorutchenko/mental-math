/** РРРР-ММ-ДД за місцевим часом (свій варіант: модуль читає збереження, тож не тягне прогрес). */
function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Фон застосунку: пора року змінюється сама за місяцем, а святковий фон
 * вмикають за бажанням, коли свято близько.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

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

export const HOLIDAY_IDS = ["nicholas", "christmas", "newyear"] as const;
export type HolidayId = (typeof HOLIDAY_IDS)[number];

/** Місяць рахується від 0, як у Date. Вікно може переходити через Новий рік. */
type MonthDay = readonly [month: number, day: number];

export const HOLIDAYS: Record<HolidayId, { icon: string; title: string; from: MonthDay; to: MonthDay }> = {
  // 6 грудня; фон можна вмикати весь листопад, поки чекаємо подарунків.
  nicholas: { icon: "🎁", title: "День святого Миколая", from: [10, 1], to: [11, 9] },
  // 25 грудня; вікно тягнеться до 7 січня, коли Різдво теж святкують у багатьох родинах.
  christmas: { icon: "🎄", title: "Різдво", from: [11, 7], to: [0, 7] },
  newyear: { icon: "🎆", title: "Новий рік", from: [11, 15], to: [0, 14] },
};

const key = ([month, day]: MonthDay) => month * 100 + day;

function inWindow(date: Date, id: HolidayId): boolean {
  const today = key([date.getMonth(), date.getDate()]);
  const from = key(HOLIDAYS[id].from);
  const to = key(HOLIDAYS[id].to);
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/** Свята, фон яких зараз доречно запропонувати. */
export function availableHolidays(date: Date): HolidayId[] {
  return HOLIDAY_IDS.filter((id) => inWindow(date, id));
}

export function greeting(id: HolidayId, date: Date): string {
  if (id === "nicholas") return "З Днем святого Миколая!";
  if (id === "christmas") return "Веселого Різдва!";
  // У другій половині року (і під час перегляду фону восени) — уже наступний рік.
  const year = date.getFullYear() + (date.getMonth() >= 6 ? 1 : 0);
  return `З Новим ${year} роком!`;
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
export function chooseHoliday(id: HolidayId, date: Date): BackdropChoice {
  if (!inWindow(date, id)) {
    const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return { holiday: id, until: localDay(tomorrow) };
  }
  const [month, day] = HOLIDAYS[id].to;
  let end = new Date(date.getFullYear(), month, day);
  if (localDay(end) < localDay(date)) end = new Date(date.getFullYear() + 1, month, day);
  return { holiday: id, until: localDay(end) };
}

export function activeHoliday(choice: BackdropChoice | null, date: Date): HolidayId | null {
  return choice && localDay(date) <= choice.until ? choice.holiday : null;
}
