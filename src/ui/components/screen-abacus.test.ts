import { describe, expect, it } from "vitest";
import { fromNumber, toNumber } from "../../core/soroban/abacus";
import { touchBead } from "./AbacusView";
import { rodsFor } from "./ScreenAbacus";

describe("екранний абакус", () => {
  it("дотик рухає кісточки, як палець на справжньому соробані", () => {
    let abacus = fromNumber(0, 3);
    abacus = touchBead(abacus, 0, 2); // третя нижня кісточка тягне за собою дві верхні
    expect(toNumber(abacus)).toBe(3);
    abacus = touchBead(abacus, 0, "upper");
    expect(toNumber(abacus)).toBe(8);
    abacus = touchBead(abacus, 0, 1); // друга кісточка відсувається разом із третьою
    expect(toNumber(abacus)).toBe(6);
    abacus = touchBead(abacus, 1, 0);
    expect(toNumber(abacus)).toBe(16);
    abacus = touchBead(abacus, 0, 0);
    expect(toNumber(abacus)).toBe(15);
  });

  it("не змінює попереднього положення і не виходить за спиці", () => {
    const before = fromNumber(7, 2);
    touchBead(before, 0, "upper");
    expect(toNumber(before)).toBe(7);
    expect(touchBead(before, 5, 0)).toBe(before);
  });

  it("спиць вистачає на число з запасом на перенос", () => {
    expect(rodsFor(7)).toBe(3);
    expect(rodsFor(95)).toBe(3);
    expect(rodsFor(1482)).toBe(5);
  });
});
