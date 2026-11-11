import { useContext, useEffect, useMemo, useState } from "react";
import { PlayerContext } from "../player";
import { ScreenAbacus } from "../components/ScreenAbacus";
import { AbacusChoice } from "../components/AbacusChoice";
import { cardRods, generateCards } from "../../game/cards/cards";
import { CARD_LIMITS, type CardSetup, DEFAULT_SPAN, MEMORY_SECONDS, cardSpan } from "../../game/cards/types";
import type { Loot } from "../../game/rewards/blocks";
import { fromNumber } from "../../core/soroban/abacus";
import { AbacusView } from "../components/AbacusView";
import { LootList } from "../components/Block";
import { Hero } from "../components/Avatar";
import { Keypad } from "../components/Keypad";
import { playSound } from "../sound";

function Choice<T extends string | number>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="choice">
      {props.options.map((option) => (
        <button
          key={option.value}
          className={`chip${option.value === props.value ? " chip-active" : ""}`}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Setup({ initial, onStart }: { initial: CardSetup; onStart: (setup: CardSetup) => void }) {
  const [setup, setSetup] = useState(initial);
  const set = (patch: Partial<CardSetup>) => setSetup({ ...setup, ...patch });
  return (
    <section className="panel">
      <h2>Картки з абакусом</h2>
      <p className="note">
        Картки вчать миттєво впізнавати число за кісточками — з цього починається рахунок на уявному абакусі.
      </p>
      <div className="field">
        <span>Що робимо</span>
        <Choice
          value={setup.kind}
          options={[
            { value: "read" as const, label: "👀 Назви число за кісточками" },
            { value: "set" as const, label: "🧮 Набери число на абакусі" },
            { value: "memory" as const, label: "🧠 Запам'ятай кілька картинок" },
          ]}
          onChange={(kind) => set({ kind, ...(kind === "memory" && setup.showSeconds === 0 ? { showSeconds: MEMORY_SECONDS } : {}) })}
        />
        {setup.kind === "memory" && (
          <span className="note">
            Картинки з'являються по одній і зникають. Потім треба назвати всі числа по порядку — так тренується
            зорова пам'ять, на яку спирається уявний абакус.
          </span>
        )}
      </div>
      {setup.kind === "memory" && (
        <div className="field">
          <span>Скільки картинок запам'ятати</span>
          <Choice
            value={setup.span ?? DEFAULT_SPAN}
            options={CARD_LIMITS.span.map((span) => ({ value: span, label: String(span) }))}
            onChange={(span) => set({ span })}
          />
        </div>
      )}
      <div className="field">
        <span>Числа</span>
        <Choice
          value={setup.digits}
          options={[
            { value: 1 as const, label: "одноцифрові" },
            { value: 2 as const, label: "двоцифрові" },
            { value: 3 as const, label: "трицифрові" },
          ]}
          onChange={(digits) => set({ digits })}
        />
      </div>
      {setup.kind === "set" && <AbacusChoice />}
      {setup.kind === "set" && setup.digits > 1 && (
        <div className="field">
          <span>Руки</span>
          <Choice
            value={setup.twoHands ? "two" : "one"}
            options={[
              { value: "one", label: "як зручно" },
              { value: "two", label: "🙌 двома руками" },
            ]}
            onChange={(hands) => set({ twoHands: hands === "two" })}
          />
          <span className="note">
            Двома руками: ліва набирає старші розряди, права — одиниці, по змозі одночасно. Це вправа на
            узгодженість рук; за руками стежте ви, застосунок їх не бачить.
          </span>
        </div>
      )}
      <div className="field">
        <span>{setup.kind === "memory" ? "Кількість спроб" : "Кількість карток"}</span>
        <Choice
          value={setup.count}
          options={[5, 10, 20, 30].map((count) => ({ value: count, label: String(count) }))}
          onChange={(count) => set({ count })}
        />
      </div>
      {setup.kind === "memory" && (
        <div className="field">
          <span>Скільки показувати кожну картинку</span>
          <Choice
            value={setup.showSeconds || MEMORY_SECONDS}
            options={[3, 2, 1].map((seconds) => ({ value: seconds, label: `${seconds} с` }))}
            onChange={(showSeconds) => set({ showSeconds })}
          />
        </div>
      )}
      {setup.kind === "read" && (
        <div className="field">
          <span>Скільки показувати кісточки</span>
          <Choice
            value={setup.showSeconds}
            options={CARD_LIMITS.seconds.map((seconds) => ({
              value: seconds,
              label: seconds === 0 ? "без обмеження" : `${seconds} с`,
            }))}
            onChange={(showSeconds) => set({ showSeconds })}
          />
          <span className="note">
            З обмеженням кісточки зникають, і число треба втримати в уяві. Це необов'язковий виклик.
          </span>
        </div>
      )}
      <button className="btn btn-big" onClick={() => onStart(setup)}>
        Почати ▶
      </button>
    </section>
  );
}

interface PlayProps {
  setup: CardSetup;
  cards: number[];
  onDone: (results: boolean[]) => void;
}

function Play({ setup, cards, onDone }: PlayProps) {
  // Без справжнього абакуса число набирають на екранному, і застосунок звіряє його сам.
  const { screenAbacus } = useContext(PlayerContext);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [input, setInput] = useState("");
  /** null — ще відповідаємо; інакше результат поточної картки. */
  const [answered, setAnswered] = useState<boolean | null>(null);
  /** Режим «набери»: чи вже показали картинку для звірки. */
  const [revealed, setRevealed] = useState(false);
  /** Режим «назви» з обмеженням часу: чи кісточки ще видно. */
  const [visible, setVisible] = useState(true);

  const card = cards[index]!;
  const abacus = useMemo(() => fromNumber(card, cardRods(setup.digits)), [card, setup.digits]);
  const timed = setup.kind === "read" && setup.showSeconds > 0;

  useEffect(() => {
    if (!timed || !visible || answered !== null) return;
    const timer = window.setTimeout(() => setVisible(false), setup.showSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [timed, visible, answered, index, setup.showSeconds]);

  const answer = (correct: boolean) => {
    playSound(correct ? "correct" : "retry");
    setAnswered(correct);
  };

  const next = () => {
    const all = [...results, answered === true];
    if (index + 1 >= cards.length) {
      onDone(all);
      return;
    }
    setResults(all);
    setIndex(index + 1);
    setInput("");
    setAnswered(null);
    setRevealed(false);
    setVisible(true);
  };

  return (
    <section className="panel">
      <div className="progress" aria-label={`Картка ${index + 1} з ${cards.length}`}>
        <span>
          Картка {index + 1} з {cards.length}
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
      </div>

      {setup.kind === "read" ? (
        <div className="work">
          <div className="card-picture">
            {answered === null && !visible ? (
              <button className="card-hidden" onClick={() => setVisible(true)}>
                Кісточки сховалися.
                <br />
                Показати ще раз
              </button>
            ) : (
              <AbacusView abacus={abacus} showDigits={answered !== null} />
            )}
          </div>
          <div className="work-side">
            {answered === null ? (
              <>
                <p className="prompt">Яке число на абакусі?</p>
                <div className="answer" aria-live="polite">
                  {input || "?"}
                </div>
                <Keypad value={input} maxLength={setup.digits + 1} onChange={setInput} onSubmit={() => answer(Number(input) === card)} />
              </>
            ) : (
              <div className={`feedback ${answered ? "feedback-good" : "feedback-review"}`}>
                <p className="feedback-title">{answered ? "Правильно! ⭐" : `Це ${card}`}</p>
                {!answered && <p>Ти відповіла {input}. Подивись на кісточки ще раз: цифри підписано знизу.</p>}
                <button className="btn btn-big" autoFocus onClick={next}>
                  Далі ▶
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="work">
          <div className="example card-number">{card}</div>
          <div className="work-side">
            {screenAbacus && answered === null ? (
              <>
                <p className="prompt">Набери це число на абакусі: торкайся кісточок.</p>
                <ScreenAbacus
                  key={index}
                  rods={cardRods(setup.digits)}
                  submitLabel="Перевір ✓"
                  onSubmit={(value) => {
                    setInput(String(value));
                    answer(value === card);
                  }}
                />
              </>
            ) : screenAbacus ? (
              <div className={`feedback ${answered ? "feedback-good" : "feedback-review"}`}>
                <p className="feedback-title">{answered ? "Чудово! ⭐" : `Ти набрала ${input}, а треба ${card}`}</p>
                {!answered && <AbacusView abacus={abacus} />}
                <button className="btn btn-big" autoFocus onClick={next}>
                  Далі ▶
                </button>
              </div>
            ) : !revealed ? (
              <>
                <p className="prompt">
                  {setup.twoHands
                    ? "Набери це число двома руками: ліва — старші розряди, права — одиниці."
                    : "Набери це число на своєму абакусі."}
                </p>
                <button className="btn btn-big" autoFocus onClick={() => setRevealed(true)}>
                  Готово, покажи ▶
                </button>
              </>
            ) : answered === null ? (
              <>
                <AbacusView abacus={abacus} />
                <p className="prompt">У тебе так само?</p>
                <div className="row">
                  <button className="btn btn-big" onClick={() => answer(true)}>
                    Так ✓
                  </button>
                  <button className="btn btn-quiet" onClick={() => answer(false)}>
                    Ні, інакше
                  </button>
                </div>
              </>
            ) : (
              <div className={`feedback ${answered ? "feedback-good" : "feedback-review"}`}>
                <p className="feedback-title">{answered ? "Чудово! ⭐" : "Виправ на абакусі"}</p>
                {!answered && <AbacusView abacus={abacus} />}
                <button className="btn btn-big" autoFocus onClick={next}>
                  Далі ▶
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Картки на пам'ять: кілька картинок по черзі, потім пригадати всі числа по порядку. */
function MemoryPlay({ setup, cards, onDone }: PlayProps) {
  const span = cardSpan(setup);
  const seconds = setup.showSeconds || MEMORY_SECONDS;
  const trials = cards.length / span;
  const [trial, setTrial] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  /** −1 — чекаємо на «Старт»; 0..span−1 — показ картинок; span — пригадування. */
  const [position, setPosition] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);
  const [input, setInput] = useState("");

  const numbers = cards.slice(trial * span, trial * span + span);
  const showing = position >= 0 && position < span;
  const recalled = answers.length === span;
  const correct = recalled && answers.every((answer, index) => answer === numbers[index]);

  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => setPosition((current) => current + 1), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [showing, position, seconds]);

  const submit = () => {
    const all = [...answers, Number(input)];
    setAnswers(all);
    setInput("");
    if (all.length === span) playSound(all.every((answer, index) => answer === numbers[index]) ? "correct" : "retry");
  };

  const next = () => {
    const all = [...results, correct];
    if (trial + 1 >= trials) {
      onDone(all);
      return;
    }
    setResults(all);
    setTrial(trial + 1);
    setAnswers([]);
    setPosition(0);
  };

  return (
    <section className="panel">
      <div className="progress" aria-label={`Спроба ${trial + 1} з ${trials}`}>
        <span>
          Спроба {trial + 1} з {trials}
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(trial / trials) * 100}%` }} />
        </div>
      </div>

      {position < 0 ? (
        <div className="sequence">
          <p className="prompt">
            Зараз з'явиться {span} {span <= 4 ? "картинки" : "картинок"} з абакусом, кожна на {seconds} с. Запам'ятай
            числа по порядку.
          </p>
          <button className="btn btn-big" autoFocus onClick={() => setPosition(0)}>
            Старт ▶
          </button>
        </div>
      ) : showing ? (
        <div className="sequence">
          <p className="sequence-count">
            Картинка {position + 1} з {span}
          </p>
          {/* key перезапускає анімацію, щоб було видно зміну картинки */}
          <div key={position} className="memory-picture">
            <AbacusView abacus={fromNumber(numbers[position]!, cardRods(setup.digits))} showDigits={false} />
          </div>
        </div>
      ) : !recalled ? (
        <div className="work work-single">
          <div className="work-side">
            <p className="prompt">
              Яке число було {answers.length + 1}-м? {answers.length > 0 && `Уже названо: ${answers.join(", ")}.`}
            </p>
            <div className="answer" aria-live="polite">
              {input || "?"}
            </div>
            <Keypad value={input} maxLength={setup.digits + 1} onChange={setInput} onSubmit={submit} />
          </div>
        </div>
      ) : (
        <div className={`feedback ${correct ? "feedback-good" : "feedback-review"}`}>
          <p className="feedback-title">{correct ? "Усе пригадала! ⭐" : "Подивімося ще раз"}</p>
          <div className="memory-row">
            {numbers.map((number, index) => (
              <div key={index} className={`memory-item${answers[index] === number ? "" : " memory-miss"}`}>
                <AbacusView abacus={fromNumber(number, cardRods(setup.digits))} />
                <span>
                  {answers[index] === number ? `✅ ${number}` : `❌ було ${number}, названо ${answers[index]}`}
                </span>
              </div>
            ))}
          </div>
          <button className="btn btn-big" autoFocus onClick={next}>
            Далі ▶
          </button>
        </div>
      )}
    </section>
  );
}

interface Props {
  /** Останні налаштування або набір із плану дня. */
  initial: CardSetup;
  /** Почати одразу, без екрана налаштувань (запуск із плану дня). */
  autostart: boolean;
  /** Зараховує набір і повертає здобуті блоки. */
  onFinish: (setup: CardSetup, results: boolean[]) => Loot;
  onExit: () => void;
}

interface Running {
  setup: CardSetup;
  cards: number[];
  seed: number;
}

const begin = (setup: CardSetup): Running => {
  const seed = Math.floor(Math.random() * 2 ** 32);
  return { setup, cards: generateCards({ digits: setup.digits, count: setup.count * cardSpan(setup) }, seed), seed };
};

export function CardsScreen({ initial, autostart, onFinish, onExit }: Props) {
  const [running, setRunning] = useState<Running | null>(() => (autostart ? begin(initial) : null));
  const [done, setDone] = useState<{ results: boolean[]; earned: Loot } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [running, done]);

  if (!running) return <Setup initial={initial} onStart={(setup) => setRunning(begin(setup))} />;

  if (done) {
    const correct = done.results.filter(Boolean).length;
    return (
      <section className="panel">
        <Hero event="finish" variant={correct} cheer />
        <p className="eyebrow">Картки завершено</p>
        <h2>
          Правильно: {correct} з {done.results.length}
        </h2>
        <div className="earned">
          <b>Здобуто для острова:</b>
          <LootList loot={done.earned} />
          {Object.keys(done.earned).length === 0 && <span>Цього разу без блоків — наступного вийде!</span>}
        </div>
        {running.setup.kind === "set" && (
          <p className="note">У цьому режимі застосунок вірить на слово: звіряйте абакус із картинкою разом.</p>
        )}
        <div className="row">
          <button
            className="btn btn-big"
            onClick={() => {
              setDone(null);
              setRunning(begin(running.setup));
            }}
          >
            Ще раз
          </button>
          <button className="btn btn-quiet" onClick={onExit}>
            🗺 На карту
          </button>
        </div>
      </section>
    );
  }

  const Game = running.setup.kind === "memory" ? MemoryPlay : Play;
  return (
    <Game
      key={running.seed}
      setup={running.setup}
      cards={running.cards}
      onDone={(results) => {
        playSound("finish");
        setDone({ results, earned: onFinish(running.setup, results) });
      }}
    />
  );
}
