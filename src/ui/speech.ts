/**
 * Озвучення чисел для диктанту на слух. Український голос є не на кожному пристрої,
 * тому спершу перевіряємо, чи він доступний; якщо ні — диктант читає дорослий з екрана.
 */
const synth = (): SpeechSynthesis | null => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

function ukrainianVoice(): SpeechSynthesisVoice | null {
  return synth()?.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("uk")) ?? null;
}

/** Список голосів завантажується не одразу, тому чекаємо на нього недовго. */
export function hasUkrainianVoice(): Promise<boolean> {
  const speech = synth();
  if (!speech) return Promise.resolve(false);
  if (ukrainianVoice()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = () => resolve(ukrainianVoice() !== null);
    speech.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 1200);
  });
}

/** Як вимовити число прикладу: перше — саме число, далі «плюс 4», «мінус 3». */
export function spokenNumber(sign: "+" | "-", operand: number, first: boolean): string {
  return first ? String(operand) : `${sign === "+" ? "плюс" : "мінус"} ${operand}`;
}

/** Вимовляє текст і повертає обіцянку, яка завершується після вимови (або якщо звук недоступний). */
export function speak(text: string): Promise<void> {
  const speech = synth();
  const voice = ukrainianVoice();
  if (!speech || !voice) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    // Деякі браузери не надсилають подію завершення — страхуємося таймером.
    const guard = window.setTimeout(resolve, 6000);
    const done = () => {
      window.clearTimeout(guard);
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;
    speech.speak(utterance);
  });
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
