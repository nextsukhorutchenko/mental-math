// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  drawnNumber,
  expectCleanText,
  openTab,
  ready,
  seed,
  setBeads,
  stored,
  typeAnswer,
  setupAppHarness,
} from "../testing/appHarness";
import { PETS } from "../game/companion/pets";
import { SKINS } from "../game/skins/skins";
import { App } from "./App";

/** Картки з абакусом, флеш-виклик і острів — усе, що поруч із заняттями. */

setupAppHarness();

describe("картки з абакусом", () => {
  it("«назви число»: число читається з кісточок, набір зараховується й дає траву та квіти", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Картки/);
    await user.click(screen.getByRole("button", { name: "Почати ▶" }));
    for (let card = 0; card < 10; card++) {
      expect(screen.getByText(`Картка ${card + 1} з 10`)).toBeTruthy();
      const svg = document.querySelector(".card-picture svg")!;
      // До відповіді цифри під спицями приховані.
      expect(svg.querySelector(".abacus-digit")).toBeNull();
      await typeAnswer(user, drawnNumber(svg));
      expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(screen.getByText("Правильно: 10 з 10")).toBeTruthy();
    const save = stored();
    expect(save.cardLog).toHaveLength(1);
    expect(save.cardLog[0]).toMatchObject({ kind: "read", total: 10, correct: 10 });
    // 12 стартової трави + 5 за десять карток, і квіти за набір із 10 карток.
    expect(save.inventory.grass).toBe(17);
    expect(save.inventory.flower).toBe(1);
    expectCleanText();
    await user.click(screen.getByRole("button", { name: "🗺 На карту" }));
    expect(screen.getByText("Розминка: картки").closest("li")!.className).toContain("daily-done");
  }, 60_000);

  it("розминка з плану дня стартує одразу, без екрана налаштувань", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(within(screen.getByText("Розминка: картки").closest("li")!).getByRole("button", { name: "Почати" }));
    expect(screen.queryByText("Картки з абакусом")).toBeNull();
    expect(screen.getByText(/^(Картка|Спроба) 1 з \d+$/)).toBeTruthy();
    expectCleanText();
  });

  it("хибна відповідь показує правильне число й цифри під кісточками", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Картки/);
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Почати ▶" }));
    const number = drawnNumber(document.querySelector(".card-picture svg")!);
    await typeAnswer(user, number === 9 ? 1 : number + 1);
    expect(screen.getByText(`Це ${number}`)).toBeTruthy();
    expect(document.querySelector(".card-picture .abacus-digit")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    for (let card = 1; card < 5; card++) {
      await typeAnswer(user, drawnNumber(document.querySelector(".card-picture svg")!));
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(screen.getByText("Правильно: 4 з 5")).toBeTruthy();
    expect(stored().cardLog[0]).toMatchObject({ total: 5, correct: 4, kind: "read" });
  }, 60_000);

  it("«набери число» на справжньому абакусі: картинка для звірки показує саме це число", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Картки/);
    await user.click(screen.getByRole("button", { name: "🧮 Набери число на абакусі" }));
    await user.click(screen.getByRole("button", { name: "трицифрові" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Почати ▶" }));
    for (let card = 0; card < 5; card++) {
      const number = Number(document.querySelector(".card-number")!.textContent);
      expect(number).toBeGreaterThanOrEqual(100);
      await user.click(screen.getByRole("button", { name: "Готово, покажи ▶" }));
      expect(drawnNumber(document.querySelector(".work-side svg")!)).toBe(number);
      await user.click(screen.getByRole("button", { name: card === 2 ? "Ні, інакше" : "Так ✓" }));
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(screen.getByText("Правильно: 4 з 5")).toBeTruthy();
  }, 60_000);

  it("«набери число» з екранним абакусом перевіряє кісточки сам, двоцифрові теж", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), screenAbacus: true });
    render(<App />);
    await openTab(user, /Картки/);
    await user.click(screen.getByRole("button", { name: "🧮 Набери число на абакусі" }));
    await user.click(screen.getByRole("button", { name: "двоцифрові" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Почати ▶" }));
    for (let card = 0; card < 5; card++) {
      const number = Number(document.querySelector(".card-number")!.textContent);
      expect(number).toBeGreaterThanOrEqual(10);
      if (card === 0) {
        await user.click(screen.getByRole("button", { name: "Перевір ✓" }));
        expect(screen.getByText(`Ти набрала 0, а треба ${number}`)).toBeTruthy();
      } else {
        await setBeads(user, number);
        await user.click(screen.getByRole("button", { name: "Перевір ✓" }));
        expect(screen.getByText("Чудово! ⭐")).toBeTruthy();
      }
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(screen.getByText("Правильно: 4 з 5")).toBeTruthy();
  }, 60_000);

  it("картки на пам'ять: картинки зникають самі, числа треба назвати по порядку", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      seed(ready());
      render(<App />);
      await openTab(user, /Картки/);
      await user.click(screen.getByRole("button", { name: "🧠 Запам'ятай кілька картинок" }));
      await user.click(screen.getByRole("button", { name: "5" }));
      await user.click(screen.getByRole("button", { name: "Почати ▶" }));
      for (let trial = 0; trial < 5; trial++) {
        if (trial === 0) await user.click(screen.getByRole("button", { name: "Старт ▶" }));
        const seen: number[] = [];
        for (let picture = 0; picture < 2; picture++) {
          expect(screen.getByText(`Картинка ${picture + 1} з 2`)).toBeTruthy();
          seen.push(drawnNumber(document.querySelector(".memory-picture svg")!));
          await act(() => vi.advanceTimersByTimeAsync(2000));
        }
        // Остання спроба — з навмисною помилкою в другому числі.
        const [firstSeen = 0, secondSeen = 0] = seen;
        const said = trial === 4 ? [firstSeen, secondSeen === 9 ? 1 : secondSeen + 1] : seen;
        for (const number of said) await typeAnswer(user, number);
        expect(screen.getByText(trial === 4 ? "Подивімося ще раз" : "Усе пригадала! ⭐")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Далі ▶" }));
      }
      expect(screen.getByText("Правильно: 4 з 5")).toBeTruthy();
      expect(stored().cardLog[0]).toMatchObject({ kind: "memory", total: 5, correct: 4 });
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);
});

describe("флеш-виклик", () => {
  it("три раунди першого рівня: числа блимають, сума зараховується, рекорд і приз зберігаються", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      seed(ready());
      render(<App />);
      await openTab(user, /Тренажер/);
      await user.click(screen.getByRole("button", { name: "Відкрити" }));
      // Другий рівень зачинено, доки не пройдено перший.
      const levels = [...document.querySelectorAll<HTMLButtonElement>(".flash-level")];
      expect(levels).toHaveLength(15);
      expect(levels[0]!.disabled).toBe(false);
      expect(levels[1]!.disabled).toBe(true);
      await user.click(levels[0]!);
      for (let round = 0; round < 3; round++) {
        await user.click(screen.getByRole("button", { name: "Старт ▶" }));
        const seen: number[] = [];
        let previous = "";
        for (let tick = 0; tick < 400 && !screen.queryByText("Яка сума?"); tick++) {
          const shown = document.querySelector(".flash-number")?.textContent?.trim() ?? "";
          if (shown && shown !== previous) seen.push(Number(shown));
          previous = shown;
          await act(() => vi.advanceTimersByTimeAsync(50));
        }
        expect(seen).toHaveLength(3);
        const sum = seen.reduce((total, number) => total + number, 0);
        // Другий раунд — навмисно хибний: два з трьох усе одно дають рівень.
        await typeAnswer(user, round === 1 ? sum + 1 : sum);
        expect(screen.getByText(round === 1 ? `Було ${sum}` : "Правильно! ⭐")).toBeTruthy();
        expect(screen.getByText(`${seen.join(" + ")} = ${sum}`)).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Далі ▶" }));
      }
      expect(screen.getByText("Рівень пройдено! ⭐")).toBeTruthy();
      expect(screen.getByText(/Правильних раундів: 2 з 3\..*новий рекорд/)).toBeTruthy();
      expect(stored().flashBest).toBe(1);
      expect(stored().inventory).toMatchObject({ crystal: 1, truck: 1 });
      await user.click(screen.getByRole("button", { name: "До рівнів" }));
      // Тепер відкрито другий рівень.
      expect(document.querySelectorAll<HTMLButtonElement>(".flash-level")[1]!.disabled).toBe(false);
      expectCleanText();
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);

  it("швидкі рівні показують попередження про блимання перед стартом", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), flashBest: 12 });
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "Відкрити" }));
    await user.click(document.querySelectorAll<HTMLButtonElement>(".flash-level")[12]!);
    expect(screen.getByText("⚠ Швидке блимання")).toBeTruthy();
    expect(screen.getByText(/світлочутлива епілепсія/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Вибрати інший рівень" }));
    expect(screen.getByText("⚡ Флеш-виклик")).toBeTruthy();
  });
});

describe("острів", () => {
  /** З клавіатури: фокус на клітинку й Enter (мишу й дотик перевіряють наскрізні тести в браузері). */
  async function press(user: UserEvent, index: number): Promise<void> {
    document.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`)!.focus();
    await user.keyboard("{Enter}");
  }

  it("блок ставиться із запасу, кирка повертає його, а без запасу нічого не ставиться", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Острів/);
    expect(screen.getByRole("button", { name: "трава: 12" })).toBeTruthy();
    for (let cell = 0; cell < 12; cell++) await press(user, cell);
    expect(stored().inventory.grass).toBe(0);
    expect(stored().plots[0]!.cells.filter(Boolean)).toHaveLength(12);
    // Запас скінчився: тринадцятий блок не з'являється, запас не йде в мінус.
    await press(user, 20);
    expect(stored().inventory.grass).toBe(0);
    expect(stored().plots[0]!.cells[20]).toBeNull();
    expect(screen.getByText(/«трава» закінчилися/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Кирка: забрати деталь" }));
    await press(user, 0);
    await press(user, 0);
    expect(stored().inventory.grass).toBe(1);
    expect(stored().plots[0]!.cells[0]).toBeNull();
    expect(screen.getByText("Тут 11 деталей, на всіх ділянках 11, у запасі ще 1.")).toBeTruthy();
    expectCleanText();
  }, 60_000);

  it("завдання будівельника дає приз один раз; ділянка розбирається з поверненням блоків", async () => {
    const user = userEvent.setup();
    const base = ready();
    seed({ ...base, inventory: { ...base.inventory, door: 1 } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await openTab(user, /Острів/);
    await user.click(screen.getByRole("button", { name: "➕ Нова ділянка" }));
    await user.click(screen.getByRole("button", { name: /вид збоку/ }));
    expect(stored().plots.map((plot) => plot.kind)).toEqual(["island", "house"]);
    await user.click(screen.getByRole("button", { name: "двері: 1" }));
    await press(user, 5);
    // Завдання «Постав двері» виконано: два вікна в запасі.
    expect(screen.getByRole("status").textContent).toContain("Постав двері до хатинки");
    expect(stored().questsDone).toEqual(["door"]);
    expect(stored().inventory.window).toBe(2);
    // Забрати двері й поставити знову — вдруге приз не дається.
    await user.click(screen.getByRole("button", { name: "Кирка: забрати деталь" }));
    await press(user, 5);
    await user.click(screen.getByRole("button", { name: "двері: 1" }));
    await press(user, 6);
    expect(stored().inventory.window).toBe(2);

    await user.click(screen.getByRole("button", { name: "Розібрати цю ділянку" }));
    const save = stored();
    expect(save.plots.map((plot) => plot.kind)).toEqual(["island"]);
    expect(save.inventory.door).toBe(1);
    expectCleanText();
  }, 60_000);
});

describe("скін, супутник та ім'я", () => {
  it("кожен скін і кожного супутника можна вибрати, і вибір зберігається", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    for (const skin of SKINS) {
      await user.click(screen.getAllByRole("button", { name: "Вибрати скін" })[0]!);
      const dialog = screen.getByRole("dialog", { name: "Вибери скін" });
      expect(within(dialog).getAllByRole("button", { pressed: true })).toHaveLength(1);
      await user.click(within(dialog).getByRole("button", { name: new RegExp(`${skin.name}$`) }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(stored().skin).toBe(skin.id);
    }
    for (const pet of PETS) {
      await user.click(screen.getAllByRole("button", { name: "Вибрати супутника" })[0]!);
      const dialog = screen.getByRole("dialog", { name: "Вибери супутника" });
      await user.click(within(dialog).getByRole("button", { name: new RegExp(`${pet.name} ?${pet.species}$`) }));
      expect(stored().pet).toBe(pet.id);
      // Супутник вітається своїм іменем.
      expect(document.querySelector(".bubble")!.textContent!.length).toBeGreaterThan(3);
    }
    expectCleanText();
  }, 60_000);

  it("вікно вибору закривається хрестиком і клавішею Esc без зміни вибору", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Вибрати скін" })[0]!);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Закрити" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Вибрати супутника" })[0]!);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored()).toMatchObject({ skin: "polia", pet: "fox" });
  });

  it("ім'я змінюється з верхньої панелі; порожнє ім'я не приймається", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Ім'я: Поля. Змінити" }));
    const input = screen.getByRole("textbox", { name: "Ім'я" });
    await user.clear(input);
    await user.type(input, "  Зоряна  {Enter}");
    expect(stored().childName).toBe("Зоряна");
    await user.click(screen.getByRole("button", { name: "Ім'я: Зоряна. Змінити" }));
    await user.clear(screen.getByRole("textbox", { name: "Ім'я" }));
    await user.keyboard("{Enter}");
    expect(stored().childName).toBe("Зоряна");
    expectCleanText();
  });
});
