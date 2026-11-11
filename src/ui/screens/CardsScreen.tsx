import { useEffect, useMemo, useState } from "react";
import { cardRods, generateCards } from "../../game/cards/cards";
import { CARD_LIMITS, type CardSetup } from "../../game/cards/types";
import type { Loot } from "../../game/rewards/blocks";
import { fromNumber } from "../../core/soroban/abacus";
import { AbacusView } from "../components/AbacusView";
import { LootList } from "../components/Block";
import { Companion } from "../components/Companion";
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
          ]}
          onChange={(kind) => set({ kind })}
        />
      </div>
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
      <div className="field">
        <span>Кількість карток</span>
        <Choice
          value={setup.count}
          options={[5, 10, 20, 30].map((count) => ({ value: count, label: String(count) }))}
          onChange={(count) => set({ count })}
        />
      </div>
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
            {!revealed ? (
              <>
                <p className="prompt">Набери це число на своєму абакусі.</p>
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
  return { setup, cards: generateCards(setup, seed), seed };
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
        <Companion event="finish" variant={correct} />
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

  return (
    <Play
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
