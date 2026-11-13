import { generateDrill } from "../core/generator/generator";
import { type Random, createRandom } from "../core/generator/random";
import { creditCards, generateCards } from "../game/cards/cards";
import { type DailyPart, dailyPlan } from "../game/curriculum/daily";
import { creditSession } from "../game/progress/progress";
import { currentExample, nextExample, startSession, submitAnswer } from "../game/session/session";
import { type LessonSetup, toDrillConfig } from "../game/session/setup";
import type { SaveData } from "../storage/save";

/**
 * Допоміжне для тестів: «дитина», яка проходить заняття так само, як це робить застосунок
 * (ті самі функції, що їх викликає App), лише без екрана.
 */
export interface Child {
  /** Частка прикладів, розв'язаних правильно з першої спроби. */
  accuracy: number;
  random: Random;
}

export const child = (accuracy: number, seed = 1): Child => ({ accuracy, random: createRandom(seed) });

/** Проходить заняття до кінця й зараховує його, як App.updateSession. */
export function playLesson(save: SaveData, setup: LessonSetup, now: Date, who: Child): SaveData {
  const seed = Math.floor(who.random() * 2 ** 31);
  const drill = generateDrill({ ...toDrillConfig(setup), seed });
  let session = startSession(drill);
  while (session.status !== "finished") {
    const example = currentExample(session)!;
    session = submitAnswer(session, who.random() < who.accuracy ? example.answer : example.answer + 1);
    // Друга спроба після помилки: половина виправляється.
    if (session.status === "answering") {
      session = submitAnswer(session, who.random() < 0.5 ? example.answer : example.answer + 2);
    }
    session = nextExample(session);
  }
  return creditSession(save, {
    id: `${now.getTime()}-${seed}`,
    finishedAt: now,
    topic: setup.topic,
    mode: setup.mode,
    partial: false,
    review: !!setup.review,
    level: setup.level,
    planned: setup.planned,
    pacing: setup.pacing,
    session,
  });
}

/** Виконує один пункт плану дня. */
export function playPart(save: SaveData, part: DailyPart, now: Date, who: Child): SaveData {
  if (part.id === "cards") {
    const cards = generateCards(part.cards, Math.floor(who.random() * 2 ** 31));
    return creditCards(save, {
      id: `cards-${now.getTime()}`,
      finishedAt: now,
      setup: part.cards,
      results: cards.map(() => who.random() < who.accuracy),
    });
  }
  return playLesson(save, part.lesson, now, who);
}

/** День номер `day` від початку занять, о п'ятій вечора за місцевим часом. */
export const dayAt = (day: number, start = new Date(2026, 0, 5)) =>
  new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, 17, 0, 0);

/** Проживає один день: усі невиконані пункти плану по черзі. Повертає план, яким він був уранці. */
export function playDay(save: SaveData, day: number, who: Child, start?: Date): { save: SaveData; plan: DailyPart[] } {
  const plan = dailyPlan(save, dayAt(day, start));
  let next = save;
  plan.forEach((part, index) => {
    if (part.done) return;
    // Кожне заняття трохи пізніше за попереднє — як у житті, і щоб id не збігалися.
    const at = new Date(dayAt(day, start).getTime() + index * 600_000);
    next = playPart(next, part, at, who);
  });
  return { save: next, plan };
}
