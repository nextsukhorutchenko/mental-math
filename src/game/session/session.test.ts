import { describe, expect, it } from "vitest";
import { generateDrill } from "../../core/generator/generator";
import { SIMPLE } from "../../core/rules/skills";
import { currentExample, markHint, nextExample, startSession, submitAnswer, summarize } from "./session";

const drill = generateDrill({
  allowedSkills: [SIMPLE, "five:+4"],
  focusSkills: ["five:+4"],
  exampleCount: 3,
  actionsPerExample: 3,
  digits: 1,
  operations: "mixed",
  seed: 1,
});
const answer = (index: number) => drill.examples[index]!.answer;

describe("заняття", () => {
  it("правильна відповідь з першої спроби зараховується як самостійна", () => {
    let session = submitAnswer(startSession(drill), answer(0));
    expect(session.status).toBe("solved");
    session = nextExample(session);
    expect(session.index).toBe(1);
    expect(session.status).toBe("answering");
    expect(summarize(session)).toMatchObject({ total: 1, clean: 1, withHelp: 0, failed: 0 });
  });

  it("дає другу спробу, а після двох помилок показує розбір", () => {
    let session = submitAnswer(startSession(drill), answer(0) + 1);
    expect(session.status).toBe("answering");
    session = submitAnswer(session, answer(0) + 2);
    expect(session.status).toBe("failed");
    // Після розбору відповіді вже не приймаються.
    expect(submitAnswer(session, answer(0))).toBe(session);
    expect(summarize(nextExample(session))).toMatchObject({ clean: 0, withHelp: 0, failed: 1 });
  });

  it("відповідь із другої спроби або з підказкою не є самостійною", () => {
    let session = submitAnswer(startSession(drill), answer(0) + 1);
    session = nextExample(submitAnswer(session, answer(0)));
    session = nextExample(submitAnswer(markHint(session), answer(1)));
    expect(summarize(session)).toMatchObject({ total: 2, clean: 0, withHelp: 2, failed: 0 });
  });

  it("не переходить далі без відповіді і завершується після останнього прикладу", () => {
    let session = startSession(drill);
    expect(nextExample(session)).toBe(session);
    for (let i = 0; i < 3; i++) session = nextExample(submitAnswer(session, answer(i)));
    expect(session.status).toBe("finished");
    expect(currentExample(session)).toBeUndefined();
    expect(nextExample(session)).toBe(session);
  });

  it("рахує застосування прийомів окремо для самостійних прикладів", () => {
    let session = nextExample(submitAnswer(startSession(drill), answer(0)));
    session = nextExample(submitAnswer(markHint(session), answer(1)));
    const focus = summarize(session).skills.find((tally) => tally.skill === "five:+4")!;
    const uses = (index: number) =>
      drill.examples[index]!.steps.filter((step) => step.requiredSkills.includes("five:+4")).length;
    expect(focus.total).toBe(uses(0) + uses(1));
    expect(focus.clean).toBe(uses(0));
  });
});
