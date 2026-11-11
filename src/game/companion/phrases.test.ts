import { describe, expect, it } from "vitest";
import { type CompanionEvent, phrase } from "./phrases";

const EVENTS: CompanionEvent[] = ["greet", "ask", "correct", "corrected", "retry", "review", "finish", "island"];

describe("репліки супутника", () => {
  it("для кожної події є репліка за будь-якого номера", () => {
    for (const event of EVENTS) {
      for (const variant of [0, 1, 7, 123, -3, 2.9]) {
        expect(phrase(event, variant).text.length).toBeGreaterThan(3);
      }
    }
  });

  it("репліки чергуються, але для того самого номера не змінюються", () => {
    expect(phrase("correct", 0).text).not.toBe(phrase("correct", 1).text);
    expect(phrase("correct", 2)).toEqual(phrase("correct", 2));
  });

  it("за помилку не сварить і не квапить", () => {
    for (const event of ["retry", "review"] as const) {
      for (let variant = 0; variant < 5; variant++) {
        expect(phrase(event, variant).text).not.toMatch(/швидше|погано|неправильно/i);
      }
    }
  });
});
