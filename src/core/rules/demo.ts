import { type Abacus, type BeadMove, applyMoves, fromNumber } from "../soroban/abacus";
import { SIMPLE, type Sign, type SkillId } from "./skills";
import { type Step, buildStep } from "./step";

/** Один кадр покрокової демонстрації: положення кісточок і підпис до руху. */
export interface DemoFrame {
  abacus: Abacus;
  /** Положення до цього руху — щоб підсвітити кісточки, які зрушили. */
  previous: Abacus | null;
  /** Номер дії в прикладі; −1 для стартового кадру. */
  stepIndex: number;
  caption: string;
  /** Чи це останній рух дії (число на абакусі вже відповідає результату дії). */
  stepDone: boolean;
  /** Яким пальцем виконується рух; для стартового кадру — null. */
  finger: string | null;
}

/**
 * Правило двох пальців: великий лише присуває нижні кісточки вгору до планки,
 * усе інше — вказівний (відсуває нижні, рухає верхню в обидва боки).
 */
export function fingerFor(move: BeadMove): string {
  return move.bead === "lower" && move.direction === "on" ? "великим пальцем" : "вказівним пальцем";
}

const ROD_NAMES = ["одиницях", "десятках", "сотнях", "тисячах"];

function rodName(rod: number): string {
  return ROD_NAMES[rod] ?? `спиці №${rod + 1}`;
}

export function describeMove(move: BeadMove): string {
  const verb = move.direction === "on" ? "Присунь" : "Відсунь";
  const sign = move.direction === "on" ? "+" : "−";
  const unit = 10 ** move.rod;
  if (move.bead === "upper") {
    return `${verb} верхню кісточку на ${rodName(move.rod)} (${sign}${5 * unit})`;
  }
  const beads = move.count === 1 ? "1 нижню кісточку" : `${move.count} нижні кісточки`;
  return `${verb} ${beads} на ${rodName(move.rod)} (${sign}${move.count * unit})`;
}

/** Скільки спиць потрібно, щоб показати всі числа прикладу (не менше двох). */
export function rodsFor(steps: readonly Step[]): number {
  const max = Math.max(0, ...steps.flatMap((step) => [step.before, step.after]));
  return Math.max(2, String(max).length);
}

export function buildDemoFrames(steps: readonly Step[], rodCount = rodsFor(steps)): DemoFrame[] {
  const first = steps[0];
  if (!first) return [];
  let abacus = fromNumber(first.before, rodCount);
  const frames: DemoFrame[] = [
    {
      abacus,
      previous: null,
      stepIndex: -1,
      caption: first.before === 0 ? "Почни з порожнього абакуса" : `На абакусі ${first.before}`,
      stepDone: true,
      finger: null,
    },
  ];
  steps.forEach((step, stepIndex) => {
    step.beadMoves.forEach((move, moveIndex) => {
      const previous = abacus;
      abacus = applyMoves(abacus, [move]);
      frames.push({
        abacus,
        previous,
        stepIndex,
        caption: describeMove(move),
        stepDone: moveIndex === step.beadMoves.length - 1,
        finger: fingerFor(move),
      });
    });
  });
  return frames;
}

/** Короткий приклад для пояснення прийому: набрати число і зробити один крок із цим прийомом. */
export function introSteps(skill: SkillId): Step[] {
  if (skill === SIMPLE) {
    return [buildStep(0, "+", 2)!, buildStep(2, "+", 6)!, buildStep(8, "-", 3)!];
  }
  const rest = skill.split(":")[1]!;
  const sign = rest[0] as Sign;
  const operand = Number(rest.slice(1));
  for (let before = 1; before <= 99; before++) {
    const step = buildStep(before, sign, operand);
    if (!step || step.requiredSkills[0] !== skill) continue;
    if (step.requiredSkills.every((id) => id === skill || id === SIMPLE)) {
      return [buildStep(0, "+", before)!, step];
    }
  }
  throw new Error(`Не знайдено прикладу для прийому ${skill}`);
}
