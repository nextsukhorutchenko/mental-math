/**
 * Каталог прийомів (формул) соробану.
 *
 *  simple     — прямий рух кісточок без формул
 *  five:+4    — «молодші друзі»: +4 = +5 −1
 *  ten:+9     — «старші друзі»:  +9 = −1 +10
 *  mix:+6     — комбінована:     +6 = +1 −5 +10
 */

export type SkillFamily = "simple" | "five" | "ten" | "mix";
export type Sign = "+" | "-";
export type SkillId = "simple" | `${"five" | "ten" | "mix"}:${Sign}${number}`;

export const SIMPLE: SkillId = "simple";

export function skillId(family: Exclude<SkillFamily, "simple">, sign: Sign, operand: number): SkillId {
  return `${family}:${sign}${operand}`;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function family(name: Exclude<SkillFamily, "simple">, sign: Sign, operands: number[]): SkillId[] {
  return operands.map((n) => skillId(name, sign, n));
}

export const FIVE_SKILLS: SkillId[] = [...family("five", "+", range(1, 4)), ...family("five", "-", range(1, 4))];
export const TEN_SKILLS: SkillId[] = [...family("ten", "+", range(1, 9)), ...family("ten", "-", range(1, 9))];
export const MIX_SKILLS: SkillId[] = [...family("mix", "+", range(6, 9)), ...family("mix", "-", range(6, 9))];

/** Усі прийоми в порядку вивчення: 1 простий + 8 + 18 + 8 формул. */
export const ALL_SKILLS: SkillId[] = [SIMPLE, ...FIVE_SKILLS, ...TEN_SKILLS, ...MIX_SKILLS];

export function skillFamily(id: SkillId): SkillFamily {
  return id === "simple" ? "simple" : (id.split(":")[0] as SkillFamily);
}

const FAMILY_TITLES: Record<SkillFamily, string> = {
  simple: "Прості дії",
  five: "Молодші друзі (через 5)",
  ten: "Старші друзі (через 10)",
  mix: "Комбіновані формули",
};

export function familyTitle(name: SkillFamily): string {
  return FAMILY_TITLES[name];
}

/** Пояснення прийому простими словами для дитини. */
export function explainSkill(id: SkillId): string {
  if (id === "simple") return "Просто присувай кісточки, щоб додати, і відсувай, щоб відняти.";
  const [name, rest] = id.split(":") as [string, string];
  const plus = rest[0] === "+";
  const n = Number(rest.slice(1));
  if (name === "five") {
    return plus
      ? `Коли нижніх кісточок не вистачає, щоб додати ${n}: присунь п'ятірку і відсунь ${5 - n}.`
      : `Коли нижніх кісточок не вистачає, щоб відняти ${n}: відсунь п'ятірку і присунь ${5 - n}.`;
  }
  if (name === "ten") {
    return plus
      ? `Коли на спиці немає місця, щоб додати ${n}: забери ${10 - n} і додай один десяток зліва.`
      : `Коли на спиці замало, щоб відняти ${n}: забери один десяток зліва і додай ${10 - n}.`;
  }
  return plus
    ? `Щоб додати ${n}: присунь ${n - 5}, відсунь п'ятірку і додай один десяток зліва.`
    : `Щоб відняти ${n}: забери один десяток зліва, присунь п'ятірку і відсунь ${n - 5}.`;
}

/** Людський опис формули, наприклад «+4 = +5 −1». */
export function describeSkill(id: SkillId): string {
  if (id === "simple") return "прямий рух";
  const [name, rest] = id.split(":") as [string, string];
  const sign = rest[0] as Sign;
  const n = Number(rest.slice(1));
  const opposite = sign === "+" ? "−" : "+";
  const same = sign === "+" ? "+" : "−";
  const shown = `${same}${n}`;
  if (name === "five") return `${shown} = ${same}5 ${opposite}${5 - n}`;
  if (name === "ten") {
    return sign === "+" ? `${shown} = −${10 - n} +10` : `${shown} = −10 +${10 - n}`;
  }
  return sign === "+" ? `${shown} = +${n - 5} −5 +10` : `${shown} = −10 +5 −${n - 5}`;
}
