import type { Drill, Example } from "../../core/generator/generator";
import type { SkillId } from "../../core/rules/skills";

/** Скільки разів можна ввести відповідь, перш ніж застосунок покаже розбір. */
export const MAX_ATTEMPTS = 2;

export interface ExampleResult {
  /** Усі введені відповіді по порядку. */
  answers: number[];
  solved: boolean;
  /** Чи дивилася дитина демонстрацію рухів до правильної відповіді. */
  hintUsed: boolean;
}

export type SessionStatus = "answering" | "solved" | "failed" | "finished";

export interface Session {
  drill: Drill;
  index: number;
  results: ExampleResult[];
  current: ExampleResult;
  status: SessionStatus;
}

const emptyResult = (): ExampleResult => ({ answers: [], solved: false, hintUsed: false });

export function startSession(drill: Drill): Session {
  return { drill, index: 0, results: [], current: emptyResult(), status: "answering" };
}

export function currentExample(session: Session): Example | undefined {
  return session.drill.examples[session.index];
}

export function submitAnswer(session: Session, answer: number): Session {
  const example = currentExample(session);
  if (session.status !== "answering" || !example) return session;
  const answers = [...session.current.answers, answer];
  if (answer === example.answer) {
    return { ...session, status: "solved", current: { ...session.current, answers, solved: true } };
  }
  const status = answers.length >= MAX_ATTEMPTS ? "failed" : "answering";
  return { ...session, status, current: { ...session.current, answers } };
}

/** Позначає, що для поточного прикладу відкривали демонстрацію рухів. */
export function markHint(session: Session): Session {
  if (session.status !== "answering" || session.current.hintUsed) return session;
  return { ...session, current: { ...session.current, hintUsed: true } };
}

export function nextExample(session: Session): Session {
  if (session.status !== "solved" && session.status !== "failed") return session;
  const results = [...session.results, session.current];
  const index = session.index + 1;
  const status = index >= session.drill.examples.length ? "finished" : "answering";
  return { ...session, results, index, current: emptyResult(), status };
}

/** Самостійно й з першої спроби. */
export function isClean(result: ExampleResult): boolean {
  return result.solved && result.answers.length === 1 && !result.hintUsed;
}

export interface SkillUse {
  skill: SkillId;
  /** Приклад із цим застосуванням розв'язано самостійно з першої спроби. */
  clean: boolean;
}

/** Усі застосування прийомів у вже завершених прикладах, у порядку виконання. */
export function skillUses(session: Session): SkillUse[] {
  return session.results.flatMap((result, index) => {
    const clean = isClean(result);
    const steps = session.drill.examples[index]?.steps ?? [];
    return steps.flatMap((step) => step.requiredSkills.map((skill) => ({ skill, clean })));
  });
}

export interface SkillTally {
  skill: SkillId;
  /** Застосувань у прикладах, розв'язаних самостійно з першої спроби. */
  clean: number;
  total: number;
}

export interface SessionSummary {
  total: number;
  clean: number;
  /** Розв'язано, але з підказкою або з другої спроби. */
  withHelp: number;
  failed: number;
  skills: SkillTally[];
}

export function summarize(session: Session): SessionSummary {
  const tallies = new Map<SkillId, SkillTally>();
  let clean = 0;
  let withHelp = 0;
  let failed = 0;
  session.results.forEach((result, index) => {
    const cleanResult = isClean(result);
    if (cleanResult) clean++;
    else if (result.solved) withHelp++;
    else failed++;
    for (const step of session.drill.examples[index]?.steps ?? []) {
      for (const skill of step.requiredSkills) {
        const tally = tallies.get(skill) ?? { skill, clean: 0, total: 0 };
        tally.total++;
        if (cleanResult) tally.clean++;
        tallies.set(skill, tally);
      }
    }
  });
  return { total: session.results.length, clean, withHelp, failed, skills: [...tallies.values()] };
}
