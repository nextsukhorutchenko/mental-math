import { useEffect, useState } from "react";
import type { Step } from "../../core/rules/step";
import type { Pacing } from "../../game/session/setup";

interface Props {
  steps: readonly Step[];
  pacing: Exclude<Pacing, "all">;
  secondsPerNumber: number;
  onDone: () => void;
}

function label(step: Step, index: number): string {
  return index === 0 ? String(step.operand) : `${step.operation === "+" ? "+" : "−"}${step.operand}`;
}

/** Показує числа прикладу по одному: вручну або із заданим темпом і паузою. */
export function SequencePlayer({ steps, pacing, secondsPerNumber, onDone }: Props) {
  // −1 — ще не почали
  const [position, setPosition] = useState(-1);
  const [paused, setPaused] = useState(false);
  const auto = pacing === "auto";
  const last = position >= steps.length - 1;

  const advance = () => {
    if (last) onDone();
    else setPosition(position + 1);
  };

  useEffect(() => {
    if (!auto || position < 0 || paused) return;
    const timer = window.setTimeout(advance, secondsPerNumber * 1000);
    return () => window.clearTimeout(timer);
    // advance залежить лише від position
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, position, paused, secondsPerNumber]);

  if (position < 0) {
    return (
      <div className="sequence">
        <p className="prompt">
          Числа з'являтимуться по одному{auto ? `, кожне на ${secondsPerNumber} с` : ""}. Приготуйся!
        </p>
        <button className="btn btn-big" autoFocus onClick={() => setPosition(0)}>
          Старт ▶
        </button>
      </div>
    );
  }

  const step = steps[position]!;
  return (
    <div className="sequence">
      <p className="sequence-count">
        Число {position + 1} з {steps.length}
      </p>
      {/* key перезапускає анімацію, щоб два однакові числа поспіль було видно як два */}
      <div key={position} className="sequence-number" aria-live="assertive">
        {label(step, position)}
      </div>
      {auto ? (
        <div className="row">
          <button className="btn btn-quiet" onClick={() => setPaused(!paused)}>
            {paused ? "▶ Продовжити" : "⏸ Пауза"}
          </button>
          {paused && (
            <button className="btn btn-quiet" onClick={advance}>
              {last ? "До відповіді" : "Наступне число"}
            </button>
          )}
        </div>
      ) : (
        <button className="btn btn-big" autoFocus onClick={advance}>
          {last ? "Вводжу відповідь ▶" : "Наступне число ▶"}
        </button>
      )}
    </div>
  );
}
