import { useEffect, useRef, useState } from "react";
import type { Step } from "../../core/rules/step";
import { hasUkrainianVoice, speak, spokenNumber, stopSpeaking } from "../speech";

interface Props {
  steps: readonly Step[];
  /** voice — числа вимовляє застосунок; reader — їх читає вголос дорослий. */
  pacing: "voice" | "reader";
  /** Пауза між числами для голосу застосунку, секунди. */
  secondsPerNumber: number;
  onDone: () => void;
}

const text = (step: Step, index: number) =>
  index === 0 ? String(step.operand) : `${step.operation === "+" ? "плюс" : "мінус"} ${step.operand}`;

/** Диктант на слух: дитина не бачить чисел, а чує їх і рахує на абакусі або в уяві. */
export function DictationPlayer({ steps, pacing, secondsPerNumber, onDone }: Props) {
  /** null — ще перевіряємо, чи є український голос. */
  const [voice, setVoice] = useState<boolean | null>(pacing === "reader" ? false : null);
  const [position, setPosition] = useState(-1);
  const cancelled = useRef(false);

  useEffect(() => {
    if (pacing === "voice") void hasUkrainianVoice().then(setVoice);
    return () => {
      cancelled.current = true;
      stopSpeaking();
    };
  }, [pacing]);

  const dictate = async () => {
    cancelled.current = false;
    for (let index = 0; index < steps.length; index++) {
      if (cancelled.current) return;
      setPosition(index);
      const step = steps[index]!;
      await speak(spokenNumber(step.operation, step.operand, index === 0));
      await new Promise((resolve) => window.setTimeout(resolve, secondsPerNumber * 1000));
    }
    if (!cancelled.current) onDone();
  };

  if (voice === null) {
    return (
      <div className="sequence">
        <p className="prompt">Шукаю український голос…</p>
      </div>
    );
  }

  if (!voice) {
    return (
      <div className="sequence">
        <p className="prompt">
          {pacing === "voice"
            ? "На цьому пристрої немає українського голосу, тому диктант читає дорослий."
            : "Диктант читає дорослий."}{" "}
          Дитина не дивиться на екран і рахує на слух.
        </p>
        <ol className="dictation">
          {steps.map((step, index) => (
            <li key={index}>{text(step, index)}</li>
          ))}
        </ol>
        <button className="btn btn-big" autoFocus onClick={onDone}>
          Прочитано — до відповіді ▶
        </button>
      </div>
    );
  }

  return (
    <div className="sequence">
      {position < 0 ? (
        <>
          <p className="prompt">Числа прозвучать по одному. Слухай уважно й рахуй.</p>
          <button className="btn btn-big" autoFocus onClick={() => void dictate()}>
            Старт 🔊
          </button>
        </>
      ) : (
        <>
          <p className="sequence-count">
            Число {position + 1} з {steps.length}
          </p>
          <div className="sequence-number" aria-hidden="true">
            🔊
          </div>
        </>
      )}
    </div>
  );
}
