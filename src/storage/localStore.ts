import { type SaveData, emptySave, parseSave } from "./save";

export const SAVE_KEY = "mental-math:save";
/** Сюди відкладаємо дані, які не вдалося прочитати, щоб їх не затерти. */
export const CORRUPT_KEY = "mental-math:save-unreadable";
/** Попередній прогрес перед імпортом із файлу. */
export const BEFORE_IMPORT_KEY = "mental-math:save-before-import";

/** Мінімум від Storage, потрібний застосунку (щоб тестувати без браузера). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** localStorage може бути недоступний (приватний режим, заборона в налаштуваннях). */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface LoadResult {
  data: SaveData;
  /** Повідомлення для батьків, якщо щось пішло не так. */
  warning: string | null;
  /**
   * Збережені дані не прочитано й не відкладено окремо: автозбереження не повинно писати поверх них,
   * доки батьки не вивантажать їх, не відновлять копію або свідомо не почнуть з чистого аркуша.
   */
  locked: boolean;
  /** Вихідний текст зі сховища, якщо його вдалося дістати, — щоб його можна було вивантажити у файл. */
  raw: string | null;
}

/** Розбирає текст зі сховища; null — дані пошкоджені або не цього застосунку. */
export function parseStoredText(text: string | null): SaveData | null {
  if (text === null) return null;
  try {
    return parseSave(JSON.parse(text));
  } catch {
    return null;
  }
}

export function loadSave(store: KeyValueStore | null): LoadResult {
  if (!store) {
    return {
      data: emptySave(),
      warning: "Браузер не дозволяє зберігати дані: прогрес не збережеться.",
      locked: false,
      raw: null,
    };
  }
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    // Не знаємо, що там лежить, — тож і не перезаписуємо.
    return {
      data: emptySave(),
      warning: "Не вдалося прочитати збережений прогрес. Щоб його не затерти, нові зміни поки не зберігаються.",
      locked: true,
      raw: null,
    };
  }
  if (text === null) return { data: emptySave(), warning: null, locked: false, raw: null };
  const data = parseStoredText(text);
  if (data) return { data, warning: null, locked: false, raw: null };
  let kept = false;
  try {
    store.setItem(CORRUPT_KEY, text);
    kept = store.getItem(CORRUPT_KEY) === text;
  } catch {
    kept = false;
  }
  if (kept) {
    return {
      data: emptySave(),
      warning: "Збережений прогрес пошкоджено. Почато з чистого аркуша; відновіть дані з резервної копії.",
      locked: false,
      raw: text,
    };
  }
  // Відкласти не вдалося: оригінал лишається єдиною копією, писати поверх нього не можна.
  return {
    data: emptySave(),
    warning:
      "Збережений прогрес не вдалося прочитати. Щоб його не затерти, нові зміни поки не зберігаються: " +
      "вивантажте вихідні дані у файл або відновіть резервну копію.",
    locked: true,
    raw: text,
  };
}

/** Повертає false, якщо запис не вдався (немає місця, сховище заблоковане). */
export function writeSave(store: KeyValueStore | null, data: SaveData, key = SAVE_KEY): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
