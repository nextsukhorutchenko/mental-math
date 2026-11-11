/** Репліки супутника Рудика. Він хвалить зусилля й уважність, а не швидкість. */
export type CompanionEvent = "greet" | "ask" | "correct" | "corrected" | "retry" | "review" | "finish" | "island";
export type Mood = "calm" | "happy" | "cheer" | "think";

export const COMPANION_NAME = "Рудик";

const PHRASES: Record<CompanionEvent, string[]> = {
  greet: [
    "Привіт! Я {name}. Ходімо добувати блоки?",
    "З поверненням! Який рівень сьогодні?",
    "Я вже {наточив|наточила} кирку. Почнімо?",
    "{Радий|Рада} тебе бачити! Острів чекає на нові блоки.",
  ],
  ask: ["Не поспішай, рахуй уважно.", "Я поруч. Рух за рухом!", "Спокійно, кісточка за кісточкою.", "У тебе вийде."],
  correct: ["Точно в ціль!", "Гарна робота!", "Ти дуже уважна!", "Так тримати!", "Кожен рух на місці!"],
  corrected: ["Оце так! Ти сама знайшла помилку.", "Виправити помилку — це сила!", "Друга спроба — і вийшло. Молодець!"],
  retry: ["Майже! Спробуй ще раз, не поспішай.", "Перевір кожен рух — я вірю в тебе.", "Буває. Порахуймо ще раз спокійно."],
  review: ["Нічого страшного. Подивімося рухи разом.", "Помилки допомагають вчитися. Розберімо!", "Цей приклад хитрий. Зараз розберемося."],
  finish: ["Заняття завершено! Блоки вже в запасі.", "Ти сьогодні добре попрацювала!", "Ура! Ходімо будувати?"],
  island: ["Що збудуємо сьогодні?", "Гарний острів росте!", "Може, збудуємо мені хатинку?"],
};

const MOODS: Record<CompanionEvent, Mood> = {
  greet: "happy",
  ask: "calm",
  correct: "cheer",
  corrected: "cheer",
  retry: "think",
  review: "think",
  finish: "cheer",
  island: "happy",
};

/**
 * Репліка для події. variant — будь-яке число (номер прикладу, день), щоб фрази чергувалися, але не блимали.
 * name — ім'я вибраного супутника; female — він говорить про себе в жіночому роді
 * (у фразах це записано як {чоловічий|жіночий}).
 */
export function phrase(
  event: CompanionEvent,
  variant: number,
  name = COMPANION_NAME,
  female = false,
): { text: string; mood: Mood } {
  const list = PHRASES[event];
  const index = ((Math.trunc(variant) % list.length) + list.length) % list.length;
  const text = list[index]!
    .replace("{name}", name)
    .replace(/\{([^|}]+)\|([^}]+)\}/g, (_, male: string, fem: string) => (female ? fem : male));
  return { text, mood: MOODS[event] };
}
