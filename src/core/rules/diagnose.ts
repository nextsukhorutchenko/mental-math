import type { SkillId } from "./skills";
import type { Step } from "./step";

/**
 * Розбір помилки: за хибною відповіддю шукаємо найімовірнішу причину.
 * Помилка на одному кроці зсуває кінцевий результат на сталу величину (решта кроків лише додає й віднімає),
 * тому достатньо порівняти різницю «відповідь − правильно» з типовими помилками кожного кроку.
 * Це здогад, а не доказ: кілька причин можуть давати ту саму різницю.
 */
export type ErrorKind = "formula" | "skipped" | "sign" | "shift" | "typo";

export interface Diagnosis {
  kind: ErrorKind;
  /** Номер дії в прикладі (з нуля); для описки не вказується. */
  stepIndex?: number;
  /** Прийом, у якому, ймовірно, сталася помилка. */
  skill?: SkillId;
  text: string;
}

const signed = (step: Step) => (step.operation === "+" ? step.operand : -step.operand);
const label = (step: Step, index: number) =>
  index === 0 && step.before === 0 ? `«${step.operand}»` : `«${step.operation === "+" ? "+" : "−"}${step.operand}»`;
const ordinal = (index: number) => `${index + 1}-ша дія`;
const RODS = ["одиницях", "десятках", "сотнях", "тисячах"];
const where = (rod: number) => (rod === 0 ? "" : ` на ${RODS[rod] ?? "старшій спиці"}`);

/** Типові помилки одного прийому: на скільки зсувається результат і як це пояснити. */
function formulaSlips(skill: SkillId, rod: number): { delta: number; what: string }[] {
  if (skill === "simple") return [];
  const [family, rest] = skill.split(":") as [string, string];
  const plus = rest[0] === "+";
  const n = Number(rest.slice(1));
  const unit = 10 ** rod;
  const at = where(rod);
  if (family === "five") {
    return plus
      ? [
          { delta: (5 - n) * unit, what: `присунула п'ятірку${at}, але не відсунула ${5 - n}` },
          { delta: -5 * unit, what: `відсунула ${5 - n}${at}, але забула присунути п'ятірку` },
        ]
      : [
          { delta: -(5 - n) * unit, what: `відсунула п'ятірку${at}, але не присунула ${5 - n}` },
          { delta: 5 * unit, what: `присунула ${5 - n}${at}, але забула відсунути п'ятірку` },
        ];
  }
  if (family === "ten") {
    return plus
      ? [
          { delta: -10 * unit, what: `забрала ${10 - n}${at}, але забула додати десяток зліва` },
          { delta: (10 - n) * unit, what: `додала десяток зліва, але не забрала ${10 - n}${at}` },
        ]
      : [
          { delta: 10 * unit, what: `додала ${10 - n}${at}, але забула забрати десяток зліва` },
          { delta: -(10 - n) * unit, what: `забрала десяток зліва, але не додала ${10 - n}${at}` },
        ];
  }
  return plus
    ? [
        { delta: -10 * unit, what: `забула додати десяток зліва${at}` },
        { delta: 5 * unit, what: `забула відсунути п'ятірку${at}` },
        { delta: -(n - 5) * unit, what: `забула присунути ${n - 5}${at}` },
      ]
    : [
        { delta: 10 * unit, what: `забула забрати десяток зліва${at}` },
        { delta: -5 * unit, what: `забула присунути п'ятірку${at}` },
        { delta: (n - 5) * unit, what: `забула відсунути ${n - 5}${at}` },
      ];
}

const sameDigits = (a: number, b: number) => {
  const sort = (value: number) => String(value).split("").sort().join("");
  return String(a).length > 1 && sort(a) === sort(b);
};

/**
 * Повертає до `limit` найімовірніших причин, найправдоподібніші першими:
 * помилка у формулі → пропущена дія → переплутаний знак → число не на тій спиці → описка.
 */
export function diagnose(steps: readonly Step[], answer: number, limit = 2): Diagnosis[] {
  const last = steps[steps.length - 1];
  if (!last || answer === last.after) return [];
  const delta = answer - last.after;
  const found: Diagnosis[] = [];

  steps.forEach((step, index) => {
    for (const { skill, rod } of step.skillRods) {
      for (const slip of formulaSlips(skill, rod)) {
        if (slip.delta !== delta) continue;
        found.push({
          kind: "formula",
          stepIndex: index,
          skill,
          text: `Схоже, у дії ${label(step, index)} (${ordinal(index)}) ти ${slip.what}.`,
        });
      }
    }
  });
  steps.forEach((step, index) => {
    if (-signed(step) === delta) {
      found.push({ kind: "skipped", stepIndex: index, text: `Схоже, дію ${label(step, index)} (${ordinal(index)}) пропущено.` });
    }
  });
  steps.forEach((step, index) => {
    if (index > 0 && -2 * signed(step) === delta) {
      found.push({
        kind: "sign",
        stepIndex: index,
        text: `Схоже, у дії ${label(step, index)} (${ordinal(index)}) переплутано плюс і мінус.`,
      });
    }
  });
  steps.forEach((step, index) => {
    if (9 * signed(step) === delta) {
      found.push({
        kind: "shift",
        stepIndex: index,
        text: `Схоже, число з дії ${label(step, index)} (${ordinal(index)}) набрано на спицю лівіше, ніж треба.`,
      });
    }
  });
  if (found.length === 0 && sameDigits(answer, last.after)) {
    found.push({ kind: "typo", text: "Схоже на описку: цифри ті самі, але в іншому порядку." });
  }
  return found.slice(0, limit);
}
