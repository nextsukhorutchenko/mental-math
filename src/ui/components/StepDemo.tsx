import { useMemo, useState } from "react";
import { buildDemoFrames } from "../../core/rules/demo";
import type { Step } from "../../core/rules/step";
import { toNumber } from "../../core/soroban/abacus";
import { playSound } from "../sound";
import { AbacusView } from "./AbacusView";

function stepLabel(step: Step, index: number): string {
  if (index === 0 && step.before === 0) return `Набери ${step.operand}`;
  return `${step.operation === "+" ? "+" : "−"}${step.operand}`;
}

/** Покрокова демонстрація рухів кісточок для ланцюжка дій. */
export function StepDemo({ steps, labels }: { steps: readonly Step[]; labels?: readonly string[] }) {
  const frames = useMemo(() => buildDemoFrames(steps), [steps]);
  const [index, setIndex] = useState(0);
  const frame = frames[Math.min(index, frames.length - 1)];
  if (!frame) return null;
  const step = steps[frame.stepIndex];
  const last = index >= frames.length - 1;

  return (
    <div className="demo">
      <AbacusView abacus={frame.abacus} previous={frame.previous} />
      <div className="demo-text">
        <div className="demo-action">
          {step ? (labels?.[frame.stepIndex] ?? stepLabel(step, frame.stepIndex)) : "Старт"}
        </div>
        <p className="demo-caption">{frame.caption}</p>
        {frame.finger && <p className="demo-finger">☝ {frame.finger}</p>}
        <p className="demo-value">
          {frame.stepDone ? `На абакусі: ${toNumber(frame.abacus)}` : "…ще один рух"}
        </p>
        <div className="row">
          <button className="btn btn-quiet" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ◀ Назад
          </button>
          <span className="demo-count">
            {index} / {frames.length - 1}
          </span>
          <button
            className="btn"
            disabled={last}
            onClick={() => {
              playSound("tick");
              setIndex(index + 1);
            }}
          >
            Рух ▶
          </button>
        </div>
      </div>
    </div>
  );
}
