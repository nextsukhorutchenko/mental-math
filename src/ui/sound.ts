/**
 * Звуки синтезуються на льоту (Web Audio), тож файлів немає і офлайн вони працюють так само.
 * Якщо браузер не дає звук — застосунок мовчки працює без нього.
 */
export type SoundName = "correct" | "retry" | "review" | "finish" | "place" | "remove" | "tick";

interface Note {
  freq: number;
  /** Початок від запуску звуку, секунди. */
  at: number;
  length: number;
}

const SOUNDS: Record<SoundName, { wave: OscillatorType; volume: number; notes: Note[] }> = {
  correct: { wave: "square", volume: 0.05, notes: [{ freq: 660, at: 0, length: 0.09 }, { freq: 880, at: 0.09, length: 0.14 }] },
  retry: { wave: "triangle", volume: 0.08, notes: [{ freq: 300, at: 0, length: 0.12 }, { freq: 250, at: 0.12, length: 0.16 }] },
  review: { wave: "triangle", volume: 0.07, notes: [{ freq: 392, at: 0, length: 0.14 }, { freq: 330, at: 0.14, length: 0.2 }] },
  finish: {
    wave: "square",
    volume: 0.05,
    notes: [
      { freq: 523, at: 0, length: 0.1 },
      { freq: 659, at: 0.1, length: 0.1 },
      { freq: 784, at: 0.2, length: 0.1 },
      { freq: 1047, at: 0.3, length: 0.26 },
    ],
  },
  place: { wave: "square", volume: 0.04, notes: [{ freq: 220, at: 0, length: 0.05 }] },
  remove: { wave: "square", volume: 0.04, notes: [{ freq: 160, at: 0, length: 0.06 }] },
  tick: { wave: "triangle", volume: 0.06, notes: [{ freq: 520, at: 0, length: 0.04 }] },
};

let context: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    // Браузер запускає звук лише після дії користувача; наші звуки завжди йдуть після натискання.
    if (context.state === "suspended") void context.resume();
    const { wave, volume, notes } = SOUNDS[name];
    const now = context.currentTime;
    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = note.freq;
      gain.gain.setValueAtTime(volume, now + note.at);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + note.at);
      oscillator.stop(now + note.at + note.length + 0.02);
    }
  } catch {
    // Немає звуку — не біда.
  }
}
