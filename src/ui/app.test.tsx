// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LEVELS } from "../game/curriculum/levels";
import { SAVE_KEY } from "../storage/localStore";
import { type SaveData, emptySave } from "../storage/save";
import {
  expectCleanText,
  lived,
  openTab,
  progressText,
  ready,
  seed,
  setBeads,
  shownAnswer,
  solveLesson,
  startLevel,
  stored,
  typeAnswer,
  setupAppHarness,
} from "../testing/appHarness";
import { child, playDay } from "../testing/simulate";
import { App } from "./App";

/**
 * Застосунок цілком, як його бачить дитина: читаємо приклад з екрана, рахуємо самі й натискаємо кнопки.
 * Відповідь беремо не з коду застосунку, а з того, що намальовано, — так перевіряється і показ, і перевірка.
 */

setupAppHarness();

describe("перший запуск", () => {
  it("питає про абакус, і відповідь «Є абакус» запам'ятовується", async () => {
    const user = userEvent.setup();
    render(<App />);
    const dialog = screen.getByRole("dialog", { name: "Чим будемо рахувати?" });
    await user.click(within(dialog).getByRole("button", { name: /Є абакус/ }));
    expect(screen.queryByRole("dialog", { name: "Чим будемо рахувати?" })).toBeNull();
    expect(stored().abacusAsked).toBe(true);
    expect(stored().screenAbacus).toBe(false);
    expectCleanText();
  });

  it("відповідь «Без абакуса» вмикає екранний абакус", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Без абакуса/ }));
    expect(stored().screenAbacus).toBe(true);
    expect(stored().abacusAsked).toBe(true);
  });

  it("закриття вікна клавішею Esc лишає справжній абакус і більше не питає", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored().abacusAsked).toBe(true);
    first.unmount();
    render(<App />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("новачку пропонують вступний урок і стартову перевірку, а план дня не порожній", () => {
    seed({ ...emptySave(), abacusAsked: true });
    render(<App />);
    expect(screen.getByRole("button", { name: "Відкрити урок ▶" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перевірити рівень" })).toBeTruthy();
    expect(screen.getByText("Заняття на сьогодні")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Почати" }).length).toBeGreaterThanOrEqual(2);
    expectCleanText();
  });
});

describe("урок із плану дня", () => {
  it("від карти до нагороди: усі приклади правильно", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    // Спершу пояснення теми.
    expect(screen.getByText("Тема заняття")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    const solved = await solveLesson(user);
    expect(solved).toBe(10);
    expect(screen.getByText("Тренування завершено")).toBeTruthy();
    expect(screen.getByText("Самостійно: 10 з 10")).toBeTruthy();
    expect(screen.getByText("💎 Кристал за уважне заняття")).toBeTruthy();
    expectCleanText();

    const save = stored();
    expect(save.active).toBeNull();
    expect(save.history).toHaveLength(1);
    expect(save.history[0]).toMatchObject({ total: 10, clean: 10, withHelp: 0, failed: 0, partial: false, level: "simple:low", planned: "level" });
    expect(save.inventory.wood).toBe(20);
    expect(save.inventory.crystal).toBe(1);
    expect(save.skills["simple:low"]!.physical.correct).toBe(30);

    await user.click(screen.getByRole("button", { name: "🗺 На карту" }));
    // Пункт плану позначено виконаним.
    expect(screen.getByText(/^Рівень /).closest("li")!.className).toContain("daily-done");
  }, 60_000);

  it("помилки: підказка після першої, розбір після другої, і це видно в підсумку", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    await solveLesson(user, [0, 4]);
    expect(screen.getByText("Самостійно: 8 з 10")).toBeTruthy();
    const record = stored().history[0]!;
    expect(record).toMatchObject({ total: 10, clean: 8, withHelp: 0, failed: 2 });
    // За розібрані приклади — трава, кристала за уважність немає лише нижче 80%.
    expect(stored().inventory.wood).toBe(16);
    expectCleanText();
  }, 60_000);

  it("правильна відповідь із другої спроби рахується як «з підказкою», а не як самостійна", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    const answer = shownAnswer();
    await typeAnswer(user, answer + 1);
    await typeAnswer(user, answer);
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    await solveLesson(user);
    expect(stored().history[0]).toMatchObject({ clean: 9, withHelp: 1, failed: 0 });
  }, 60_000);

  it("«Покажи рухи» показує демонстрацію, і приклад після неї вже не самостійний", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    const answer = shownAnswer();
    await user.click(screen.getByRole("button", { name: "👀 Покажи рухи" }));
    expect(screen.getByRole("button", { name: "Рух ▶" })).toBeTruthy();
    // Демонстрацію можна прогорнути до кінця.
    while (!(screen.getByRole("button", { name: "Рух ▶" }) as HTMLButtonElement).disabled) {
      await user.click(screen.getByRole("button", { name: "Рух ▶" }));
    }
    expect(screen.getByText(`На абакусі: ${answer}`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Зрозуміло, вводжу відповідь" }));
    await typeAnswer(user, answer);
    await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    await solveLesson(user);
    expect(stored().history[0]).toMatchObject({ clean: 9, withHelp: 1 });
  }, 60_000);

  it("перезавантаження посеред уроку: той самий приклад, нічого не загублено", async () => {
    const user = userEvent.setup();
    seed(ready());
    const first = render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    for (let index = 0; index < 3; index++) {
      await typeAnswer(user, shownAnswer());
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(progressText()).toBe("Приклад 4 з 10");
    const before = screen.getByLabelText("Приклад").textContent;
    first.unmount();

    render(<App />);
    expect(screen.getByText("Є незавершене тренування: приклад 4 з 10.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Продовжити ▶" }));
    expect(progressText()).toBe("Приклад 4 з 10");
    expect(screen.getByLabelText("Приклад").textContent).toBe(before);
    const solved = await solveLesson(user);
    expect(solved).toBe(7);
    expect(stored().history[0]).toMatchObject({ total: 10, clean: 10, partial: false });
  }, 60_000);

  it("перезавантаження одразу після відповіді, до «Далі», не губить приклад", async () => {
    const user = userEvent.setup();
    seed(ready());
    const first = render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    await typeAnswer(user, shownAnswer());
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
    first.unmount();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Продовжити ▶" }));
    // Екран «Правильно» відновлюється, і лічильник іде далі з другого прикладу.
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    expect(progressText()).toBe("Приклад 2 з 10");
  }, 60_000);

  it("вихід посеред уроку й нове заняття зараховують уже розв'язане як перерване", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    for (let index = 0; index < 2; index++) {
      await typeAnswer(user, shownAnswer());
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    await user.click(screen.getByRole("button", { name: "✕ Вийти" }));
    expect(screen.getByText("Є незавершене тренування: приклад 3 з 10.")).toBeTruthy();
    await startLevel(user);
    const save = stored();
    expect(save.history).toHaveLength(1);
    expect(save.history[0]).toMatchObject({ total: 2, clean: 2, partial: true });
    expect(save.active).not.toBeNull();
    expect(save.active!.index).toBe(0);
  }, 60_000);

  it("клавіатура комп'ютера працює так само, як кнопки на екрані", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    const answer = shownAnswer();
    await user.keyboard(`9{Backspace}${answer}{Enter}`);
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });

  it("порожню відповідь надіслати не можна", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await startLevel(user);
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect((screen.getByRole("button", { name: "OK" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Enter}");
    expect(progressText()).toBe("Приклад 1 з 10");
    expect(screen.queryByText(/Не зовсім/)).toBeNull();
  });
});

describe("екранний абакус", () => {
  it("відповідь зчитується з кісточок: увесь урок без цифрової клавіатури", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), screenAbacus: true });
    render(<App />);
    await user.click(within(screen.getByText(/^Рівень /).closest("li")!).getByRole("button", { name: "Почати" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
    let solved = 0;
    while (screen.queryByText(/^Приклад \d+ з \d+$/)) {
      await setBeads(user, shownAnswer());
      await user.click(screen.getByRole("button", { name: "Готово ✓" }));
      expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
      solved++;
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    expect(solved).toBe(10);
    expect(stored().history[0]).toMatchObject({ total: 10, clean: 10 });
  }, 60_000);

  it("після хибної відповіді кісточки лишаються на місці, щоб їх виправити", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), screenAbacus: true });
    render(<App />);
    await user.click(within(screen.getByText(/^Рівень /).closest("li")!).getByRole("button", { name: "Почати" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    const answer = shownAnswer();
    // Порожній абакус — це 0, а відповідь на рівні 1–4 може бути 0 лише зрідка; ставимо завідомо хибне.
    const wrong = answer === 4 ? 3 : answer + 1;
    await setBeads(user, wrong);
    await user.click(screen.getByRole("button", { name: "Готово ✓" }));
    expect(screen.getByText("Не зовсім. Перевір кісточки й виправ.")).toBeTruthy();
    const on = screen.getAllByRole("button", { pressed: true }).filter((bead) => /кісточка/.test(bead.getAttribute("aria-label") ?? ""));
    expect(on).toHaveLength(wrong >= 5 ? wrong - 4 : wrong);
    await user.click(screen.getByRole("button", { name: "🧹 Скинути" }));
    await setBeads(user, answer);
    await user.click(screen.getByRole("button", { name: "Готово ✓" }));
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });

  it("перемикач угорі змінює спосіб рахунку й запам'ятовується", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Є справжній абакус/ }));
    expect(stored().screenAbacus).toBe(true);
    await user.click(screen.getByRole("button", { name: /Абакуса нема/ }));
    expect(stored().screenAbacus).toBe(false);
  });
});

describe("тренажер", () => {
  it("нездійсненні налаштування дають зрозуміле повідомлення, а не зависання чи збій", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "➕ Лише додавання" }));
    await user.selectOptions(screen.getByRole("combobox"), "ten:-3");
    await user.click(screen.getByRole("button", { name: "трицифрові" }));
    const started = performance.now();
    await user.click(screen.getByRole("button", { name: "Почати ⛏" }));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(screen.getByText(/прийом на віднімання, а вибрано лише додавання/)).toBeTruthy();
    expect(stored().active).toBeNull();
    // Вибір батьків не губиться: його можна поправити.
    expect(stored().setup).toMatchObject({ topic: "ten:-3", operations: "+", digits: 3 });
  });

  it("власне тренування: множення проходить до кінця, і приклад показано одним записом", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "✖ Множення" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Почати ⛏" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect(screen.getByLabelText("Приклад").textContent).toMatch(/^\d+ × \d+$/);
    expect(await solveLesson(user)).toBe(5);
    expect(stored().history[0]).toMatchObject({ total: 5, clean: 5, level: "mul:table-low" });
  }, 60_000);

  it("ділення: відповідь — частка, а не те, що лишилося на абакусі", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), screenAbacus: true });
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "➗ Ділення" }));
    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Почати ⛏" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect(screen.getByLabelText("Приклад").textContent).toMatch(/^\d+ : \d+$/);
    // Навіть з екранним абакусом частку вводять цифрами.
    expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
    expect(await solveLesson(user)).toBe(5);
    expect(stored().history[0]).toMatchObject({ total: 5, clean: 5, level: "div:table" });
  }, 60_000);

  it("числа по одному, вручну: приклад сховано, доки його не показали весь", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), setup: { ...ready().setup, pacing: "manual", exampleCount: 1, actionsPerExample: 3 } });
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "Почати ⛏" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect(screen.queryByLabelText("Приклад")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Старт ▶" }));
    let value = 0;
    for (let index = 0; index < 3; index++) {
      const shown = screen.getByText(/^[+−]?\d+$/).textContent!;
      value += shown.startsWith("−") ? -Number(shown.slice(1)) : Number(shown.replace("+", ""));
      expect(screen.getByText(`Число ${index + 1} з 3`)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: index === 2 ? "Вводжу відповідь ▶" : "Наступне число ▶" }));
    }
    await typeAnswer(user, value);
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });

  it("диктант без українського голосу читає дорослий, і застосунок не падає без синтезу мовлення", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), setup: { ...ready().setup, pacing: "voice", exampleCount: 1, actionsPerExample: 3 } });
    render(<App />);
    await openTab(user, /Тренажер/);
    await user.click(screen.getByRole("button", { name: "Почати ⛏" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    expect(await screen.findByText(/немає українського голосу, тому диктант читає дорослий/)).toBeTruthy();
    const spoken = [...document.querySelectorAll(".dictation li")].map((item) => item.textContent!);
    expect(spoken).toHaveLength(3);
    const value = spoken.reduce((total, line, index) => {
      const number = Number(/\d+/.exec(line)![0]);
      return index > 0 && line.startsWith("мінус") ? total - number : total + number;
    }, 0);
    await user.click(screen.getByRole("button", { name: "Прочитано — до відповіді ▶" }));
    await typeAnswer(user, value);
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });
});

describe("розділи застосунку", () => {
  const TABS = [/Карта/, /Картки/, /Острів/, /Тренажер/, /Для батьків/];

  it("кожен розділ відкривається на порожньому збереженні без помилок", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    for (const tab of TABS) {
      await openTab(user, tab);
      expectCleanText();
      expect(document.querySelector("main")!.textContent!.length).toBeGreaterThan(50);
    }
  });

  it("кожен розділ відкривається на збереженні після 45 днів занять", async () => {
    const user = userEvent.setup();
    const save = lived(45);
    seed(save);
    render(<App />);
    for (const tab of TABS) {
      await openTab(user, tab);
      expectCleanText();
    }
    // Статистика для батьків показує справжні числа з історії.
    expect(screen.getByText(`Усього занять: ${save.history.length}. Останні:`)).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
  }, 60_000);

  it("кожен розділ відкривається, коли карту пройдено повністю, і грамота друкується з іменем", async () => {
    const user = userEvent.setup();
    const who = child(1, 2);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 420);
    let save: SaveData = { ...ready(), childName: "Соломія" };
    for (let day = 0; day < 420; day++) save = playDay(save, day, who, start).save;
    seed(save);
    render(<App />);
    for (const tab of TABS) {
      await openTab(user, tab);
      expectCleanText();
    }
    await openTab(user, /Карта/);
    expect(screen.getByText(/1-й розряд — «Небесний навігатор»/)).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "🏅 Грамота" })[0]!);
    expect(screen.getByText("Соломія")).toBeTruthy();
    expect(screen.getByText(/7-й розряд — «Лісовий слідопит»/)).toBeTruthy();
    expectCleanText();
    await user.click(screen.getByRole("button", { name: "Закрити" }));
    expect(screen.getByText(/все зроблено|Заняття на сьогодні/)).toBeTruthy();
  }, 120_000);

  it("картка кожного рівня відкривається й пропонує заняття", async () => {
    const user = userEvent.setup();
    seed({ ...ready(), unlockAll: true });
    render(<App />);
    const tiles = screen.getAllByRole("button", { name: /^Рівень / });
    expect(tiles).toHaveLength(LEVELS.length);
    for (const tile of tiles) {
      await user.click(tile);
      const card = screen.getByRole("dialog", { name: "Рівень" });
      expect(within(card).getByRole("button", { name: /прикладів/ })).toBeTruthy();
      expectCleanText();
    }
  }, 60_000);

  it("зачинений рівень не дає почати заняття", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Рівень 47×26" }));
    const card = screen.getByRole("dialog", { name: "Рівень" });
    expect(within(card).getByText(/Рівень відкриється, коли попередній буде засвоєно/)).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /прикладів/ })).toBeNull();
  });

  it("вступний урок гортається до кінця й більше не нав'язується", async () => {
    const user = userEvent.setup();
    seed({ ...emptySave(), abacusAsked: true });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Відкрити урок ▶" }));
    for (let page = 1; page <= 3; page++) {
      expect(screen.getByText(`Вступний урок · ${page} з 4`)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Далі ▶" }));
    }
    await user.click(screen.getByRole("button", { name: "Зрозуміло, до карти" }));
    expect(stored().introSeen).toBe(true);
    expect(screen.queryByRole("button", { name: "Відкрити урок ▶" })).toBeNull();
  });

  it("звук вимикається кнопкою, і без звукової системи застосунок працює", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Вимкнути звук" }));
    expect(stored().sound).toBe(false);
    expect(screen.getByRole("button", { name: "Увімкнути звук" })).toBeTruthy();
  });
});

describe("стартова перевірка", () => {
  it("усі відповіді правильні — старт із багатоцифрових чисел; попередні рівні відкрито", async () => {
    const user = userEvent.setup();
    seed({ ...emptySave(), abacusAsked: true, introSeen: true });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Перевірити рівень" }));
    await user.click(screen.getByRole("button", { name: "Почати перевірку ▶" }));
    for (let example = 0; example < 16; example++) await typeAnswer(user, shownAnswer());
    expect(screen.getByText("Починаємо з рівня «Двоцифрові ланцюжки»")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Застосувати" }));
    expect(stored().placement).toBe("digits:2");
    // Прогрес перевірка не змінює.
    expect(stored().history).toEqual([]);
    expect(stored().skills).toEqual({});
    expect(screen.getByRole("button", { name: "Рівень 10–99, ти тут" })).toBeTruthy();
  }, 60_000);

  it("усі відповіді хибні — починаємо з самого початку", async () => {
    const user = userEvent.setup();
    seed({ ...emptySave(), abacusAsked: true, introSeen: true });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Перевірити рівень" }));
    await user.click(screen.getByRole("button", { name: "Почати перевірку ▶" }));
    for (let example = 0; example < 4; example++) await typeAnswer(user, shownAnswer() + 1);
    expect(screen.getByText(/Найкраще почати з самого початку/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Застосувати" }));
    expect(stored().placement).toBe("simple:low");
  });
});

describe("збереження в браузері", () => {
  it("пошкоджене збереження: попередження, чистий аркуш, а оригінал відкладено", () => {
    window.localStorage.setItem(SAVE_KEY, "{не json");
    render(<App />);
    expect(screen.getByText(/Збережений прогрес пошкоджено/)).toBeTruthy();
    expect(window.localStorage.getItem("mental-math:save-unreadable")).toBe("{не json");
  });

  it("сховище не приймає запис: батьки бачать попередження, заняття триває", async () => {
    const user = userEvent.setup();
    seed(ready());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    render(<App />);
    expect(screen.getByText(/Не вдалося зберегти прогрес у браузері/)).toBeTruthy();
    await user.click(within(screen.getByText(/^Рівень /).closest("li")!).getByRole("button", { name: "Почати" }));
    await user.click(screen.getByRole("button", { name: "До вправ ▶" }));
    await typeAnswer(user, shownAnswer());
    expect(screen.getByText("Правильно! ⭐")).toBeTruthy();
  });

  it("сховище взагалі недоступне: застосунок відкривається й попереджає", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(<App />);
    expect(screen.getByText(/Не вдалося прочитати збережений прогрес/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Відновити з копії" })).toBeTruthy();
  });

  it("зміни з іншої вкладки підхоплюються, а не затираються", async () => {
    seed(ready());
    render(<App />);
    const other = { ...lived(5), childName: "Інша вкладка" };
    const text = JSON.stringify(other);
    window.localStorage.setItem(SAVE_KEY, text);
    window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY, newValue: text }));
    expect(await screen.findByRole("button", { name: "Ім'я: Інша вкладка. Змінити" })).toBeTruthy();
    expect(stored().history).toHaveLength(other.history.length);
  });
});

describe("резервна копія", () => {
  it("експорт віддає файл, з якого прогрес відновлюється повністю", async () => {
    const user = userEvent.setup();
    const save = lived(10);
    seed(save);
    let exported = "";
    const NativeBlob = Blob;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((text) => (exported = text));
      return "blob:test";
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const first = render(<App />);
    await openTab(user, /Для батьків/);
    await user.click(screen.getByRole("button", { name: "⬇ Зберегти копію у файл" }));
    expect(screen.getByText(/Файл резервної копії збережено/)).toBeTruthy();
    await vi.waitFor(() => expect(exported).not.toBe(""));
    expect(stored().lastExportAt).not.toBeNull();
    first.unmount();

    // Інший пристрій: чистий застосунок, відновлюємо з файлу.
    window.localStorage.clear();
    seed(ready());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await openTab(user, /Для батьків/);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File([new NativeBlob([exported])], "backup.json", { type: "application/json" }));
    expect(await screen.findByText(/Прогрес відновлено з файлу/)).toBeTruthy();
    const restored = stored();
    expect(restored.history).toEqual(save.history);
    expect(restored.skills).toEqual(save.skills);
    expect(restored.inventory).toEqual(save.inventory);
    // Попередній прогрес цього пристрою відкладено, а не знищено.
    expect(window.localStorage.getItem("mental-math:save-before-import")).not.toBeNull();
  }, 60_000);

  it("сторонній файл і відмова в підтвердженні не змінюють прогрес", async () => {
    const user = userEvent.setup();
    const save = lived(6);
    seed(save);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await openTab(user, /Для батьків/);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(["це не копія"], "photo.json", { type: "application/json" }));
    expect(await screen.findByText(/не схожий на резервну копію застосунку. Прогрес не змінено/)).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
    expect(stored().history).toEqual(save.history);

    const empty = JSON.stringify({ app: "mental-math-backup", exportedAt: new Date().toISOString(), data: emptySave() });
    await user.upload(input, new File([empty], "empty.json", { type: "application/json" }));
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    // У питанні чесно сказано, скільки занять у файлі й скільки зараз.
    expect(confirm.mock.calls[0]![0]).toContain(`У файлі 0 занять, зараз у застосунку ${save.history.length}`);
    expect(stored().history).toEqual(save.history);
  }, 60_000);
});

describe("налаштування батьків", () => {
  it("ім'я, відкриття всіх рівнів і день народження зберігаються", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Для батьків/);
    const name = screen.getByPlaceholderText("Ім'я дитини");
    await user.clear(name);
    await user.type(name, "Орися");
    await user.click(screen.getByRole("checkbox"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Місяць" }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: "День" }), "31");
    const save = stored();
    expect(save.childName).toBe("Орися");
    expect(save.unlockAll).toBe(true);
    // 31 лютого не буває: день притискається до останнього дня місяця.
    expect(save.birthday).toBe("02-29");
    expectCleanText();
  });

  it("порожнє ім'я не ламає грамоту й верхню панель", async () => {
    const user = userEvent.setup();
    seed(ready());
    render(<App />);
    await openTab(user, /Для батьків/);
    await user.clear(screen.getByPlaceholderText("Ім'я дитини"));
    expect(screen.getByRole("button", { name: "Ім'я: Поля. Змінити" })).toBeTruthy();
    expectCleanText();
  });
});
