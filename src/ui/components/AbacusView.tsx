import type { KeyboardEvent, PointerEvent } from "react";
import { type Abacus, cloneAbacus, rodDigit } from "../../core/soroban/abacus";

const ROD_GAP = 64;
const SLOT = 30;
const BEAD_W = 46;
const BEAD_H = 24;
const PAD = 16;
const BEAM_Y = PAD + SLOT * 2;
const BEAM_H = 8;
const LOWER_Y = BEAM_Y + BEAM_H + 3;
const FRAME_H = LOWER_Y + SLOT * 5 + PAD - 6;

interface Props {
  abacus: Abacus;
  /** Попереднє положення: кісточки, що зрушили, підсвічуються. */
  previous?: Abacus | null;
  showDigits?: boolean;
  /**
   * Якщо задано, кісточки рухаються дотиком — абакус замінює справжній.
   * Передається лише, якої кісточки торкнулися: власник застосовує touchBead до найсвіжішого положення,
   * щоб два швидкі дотики поспіль не затирали один одного.
   */
  onTouch?: (rod: number, bead: "upper" | number) => void;
}

/**
 * Дотик до кісточки — як рух пальцем на справжньому соробані:
 * верхня присувається чи відсувається, нижня тягне за собою сусідні.
 */
export function touchBead(abacus: Abacus, rod: number, bead: "upper" | number): Abacus {
  const next = cloneAbacus(abacus);
  const target = next[rod];
  if (!target) return abacus;
  if (bead === "upper") target.upper = !target.upper;
  else target.lower = bead < target.lower ? bead : bead + 1;
  return next;
}

function Bead(props: {
  x: number;
  y: number;
  on: boolean;
  moved: boolean;
  label?: string;
  onPress?: () => void;
}) {
  const { x, y, on, moved, label, onPress } = props;
  const className = `bead${on ? " bead-on" : ""}${moved ? " bead-moved" : ""}`;
  return (
    <g
      className={className}
      style={{ transform: `translate(${x - BEAD_W / 2}px, ${y}px)` }}
      {...(onPress
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": label,
            "aria-pressed": on,
            onPointerDown: (event: PointerEvent) => {
              event.preventDefault();
              onPress();
            },
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPress();
              }
            },
          }
        : {})}
    >
      <rect width={BEAD_W} height={BEAD_H} rx={5} />
      <rect className="bead-shine" x={5} y={4} width={BEAD_W - 10} height={5} rx={2} />
      {/* Невидима ширша зона дотику, щоб у кісточку легко влучити пальцем. */}
      {onPress && <rect className="bead-hit" x={-8} y={-3} width={BEAD_W + 16} height={BEAD_H + 6} />}
    </g>
  );
}

const PLACES = ["одиниці", "десятки", "сотні", "тисячі", "десятки тисяч", "сотні тисяч", "мільйони"];

/** Абакус: спиця 0 (одиниці) — праворуч. Для демонстрації, підказок або, з onChange, як робочий інструмент. */
export function AbacusView({ abacus, previous, showDigits = true, onTouch }: Props) {
  const width = abacus.length * ROD_GAP + PAD * 2;
  const height = FRAME_H + (showDigits ? 30 : 0);
  const press = (rod: number, bead: "upper" | number) => onTouch && (() => onTouch(rod, bead));
  return (
    <svg
      className={`abacus${onTouch ? " abacus-interactive" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      role={onTouch ? "group" : "img"}
      aria-label={onTouch ? "Абакус: торкайся кісточок, щоб їх рухати" : "Абакус"}
    >
      <rect className="abacus-frame" x={3} y={3} width={width - 6} height={FRAME_H - 6} rx={8} />
      {abacus.map((rod, index) => {
        const x = width - PAD - ROD_GAP / 2 - index * ROD_GAP;
        const before = previous?.[index];
        const place = PLACES[index] ?? `${index + 1}-й розряд`;
        return (
          <g key={index}>
            <rect className="abacus-rod" x={x - 2} y={PAD - 4} width={4} height={FRAME_H - PAD * 2 + 8} />
            <Bead
              x={x}
              y={PAD + (rod.upper ? SLOT : 0) + 2}
              on={rod.upper}
              moved={!!before && before.upper !== rod.upper}
              label={`${place}: верхня кісточка`}
              onPress={press(index, "upper")}
            />
            {[0, 1, 2, 3].map((bead) => {
              const on = bead < rod.lower;
              const wasOn = before ? bead < before.lower : on;
              return (
                <Bead
                  key={bead}
                  x={x}
                  y={LOWER_Y + (bead + (on ? 0 : 1)) * SLOT}
                  on={on}
                  moved={on !== wasOn}
                  label={`${place}: нижня кісточка ${bead + 1}`}
                  onPress={press(index, bead)}
                />
              );
            })}
            {showDigits && (
              <text className="abacus-digit" x={x} y={FRAME_H + 22} textAnchor="middle">
                {rodDigit(rod)}
              </text>
            )}
          </g>
        );
      })}
      <rect className="abacus-beam" x={3} y={BEAM_Y} width={width - 6} height={BEAM_H} />
      {/* Розрядні цятки: спиця одиниць і кожна третя від неї. */}
      {abacus.map((_, index) =>
        index % 3 === 0 ? (
          <circle
            key={index}
            className="abacus-dot"
            cx={width - PAD - ROD_GAP / 2 - index * ROD_GAP}
            cy={BEAM_Y + BEAM_H / 2}
            r={2.5}
          />
        ) : null,
      )}
    </svg>
  );
}
