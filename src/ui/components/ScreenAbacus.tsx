import { useEffect, useRef, useState } from "react";
import { type Abacus, fromNumber, toNumber } from "../../core/soroban/abacus";
import { AbacusView, touchBead } from "./AbacusView";

/** Скільки спиць потрібно, щоб уміщалося число (з запасом на перенос), але не менше трьох. */
export const rodsFor = (largest: number) => Math.max(3, String(Math.max(0, Math.floor(largest))).length + 1);

interface Props {
  rods: number;
  /** Що написати на кнопці відповіді. */
  submitLabel?: string;
  /** Без нього кнопки відповіді немає: абакус лише для рахунку, відповідь вводиться окремо. */
  onSubmit?: (value: number) => void;
  /** Кісточки зберігаються після хибної відповіді, щоб їх можна було виправити. */
  initial?: Abacus;
  onChange?: (abacus: Abacus) => void;
}

/**
 * Екранний абакус замість справжнього: дитина пересуває кісточки дотиком,
 * а відповідь застосунок зчитує з кісточок. Цифри під спицями приховані — число треба впізнати самій.
 */
export function ScreenAbacus({ rods, submitLabel = "Готово ✓", onSubmit, initial, onChange }: Props) {
  const [abacus, setAbacus] = useState<Abacus>(() => initial ?? fromNumber(0, rods));
  // Повідомляємо власника вже після оновлення, а не всередині setState.
  const report = useRef(onChange);
  report.current = onChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    report.current?.(abacus);
  }, [abacus]);

  return (
    <div className="screen-abacus">
      <AbacusView
        abacus={abacus}
        showDigits={false}
        onTouch={(rod, bead) => setAbacus((current) => touchBead(current, rod, bead))}
      />
      <div className="row">
        {onSubmit && (
          <button className="btn btn-big" onClick={() => onSubmit(toNumber(abacus))}>
            {submitLabel}
          </button>
        )}
        <button className="btn btn-quiet" onClick={() => setAbacus(fromNumber(0, rods))}>
          🧹 Скинути
        </button>
      </div>
    </div>
  );
}
