import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../../storage/save";
import { DEFAULT_PET, PETS, petById } from "./pets";
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

  it("представляється іменем вибраного супутника", () => {
    expect(phrase("greet", 0).text).toBe("Привіт! Я Рудик. Ходімо добувати блоки?");
    expect(phrase("greet", 0, "Рекс").text).toContain("Я Рекс.");
    expect(phrase("greet", 2, "Рекс").text).toBe("Я вже наточив кирку. Почнімо?");
    expect(phrase("greet", 2, "Яра", true).text).toBe("Я вже наточила кирку. Почнімо?");
    expect(phrase("greet", 3, "Яра", true).text).toMatch(/^Рада тебе бачити!/);
    expect(petById("dog")).toMatchObject({ name: "Яра", female: true });
  });

  it("кожен супутник — тварина з ім'ям, де кожна клітинка має колір", () => {
    expect(PETS.map((pet) => pet.id)).toEqual(
      expect.arrayContaining(["fox", "cat", "dog", "wolf", "bear", "boar", "tiger", "lion", "bison", "trex"]),
    );
    expect(new Set(PETS.map((pet) => pet.name)).size).toBe(PETS.length);
    for (const pet of PETS)
      for (const row of pet.rows) for (const cell of row) if (cell !== ".") expect(pet.colors[cell], `${pet.id} ${cell}`).toBeTruthy();
    expect(petById("unicorn").id).toBe(DEFAULT_PET);
    expect(parseSave({ ...emptySave(), pet: "trex" })!.pet).toBe("trex");
    expect(parseSave({ ...emptySave(), pet: "unicorn" })!.pet).toBe(DEFAULT_PET);
  });

  it("на острові говорить про вибрану ділянку", () => {
    expect(phrase("island", 1).text).toBe("Гарний острів росте!");
    expect(phrase("island", 1, "Яра", true, "house").text).toBe("Гарна будова росте!");
    expect(phrase("island", 1, "Яра", true, "detail").text).toBe("Гарна детальна будова росте!");
  });

  it("за помилку не сварить і не квапить", () => {
    for (const event of ["retry", "review"] as const) {
      for (let variant = 0; variant < 5; variant++) {
        expect(phrase(event, variant).text).not.toMatch(/швидше|погано|неправильно/i);
      }
    }
  });
});
