import { useEffect, useState } from "react";
import { FLASH, FLASH_LEVELS, type FlashLevel, flashNumbers, flashPassed, isFast } from "../../game/flash/flash";
import { Keypad } from "../components/Keypad";
import { playSound } from "../sound";

/** Показ чисел за годинником кадрів: час рахуємо від початку раунду, а не складаємо затримки. */
function Flasher({ numbers, intervalMs, onDone }: { numbers: number[]; intervalMs: number; onDone: () => void }) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const index = Math.floor(elapsed / intervalMs);
      if (index >= numbers.length) {
        onDone();
        return;
      }
      const visible = elapsed - index * intervalMs < intervalMs * FLASH.visibleShare;
      setShown(visible ? index : null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // раунд запускається один раз для свого набору чисел
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numbers, intervalMs]);

  return (
    <div className="sequence">
      <div className="sequence-number flash-number">{shown === null ? " " : numbers[shown]}</div>
    </div>
  );
}

interface Props {
  best: number;
  /** Зараховує спробу рівня: скільки раундів із трьох розв'язано. */
  onResult: (level: number, correctRounds: number) => void;
  onExit: () => void;
}

type Phase = "pick" | "warn" | "ready" | "flash" | "answer" | "feedback" | "result";

export function FlashScreen({ best, onResult, onExit }: Props) {
  const [level, setLevel] = useState<FlashLevel | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [input, setInput] = useState("");
  const [lastRight, setLastRight] = useState(false);
  /** Чи цей результат — новий рекорд; запам'ятовуємо до того, як рекорд оновиться. */
  const [newRecord, setNewRecord] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  const sum = numbers.reduce((total, number) => total + number, 0);
  const startRound = (flash: FlashLevel) => {
    setNumbers(flashNumbers(flash, Math.floor(Math.random() * 2 ** 32)));
    setInput("");
    setPhase("ready");
  };
  const choose = (flash: FlashLevel) => {
    setLevel(flash);
    setRound(0);
    setCorrect(0);
    if (isFast(flash)) setPhase("warn");
    else startRound(flash);
  };
  const submit = () => {
    const right = Number(input) === sum;
    playSound(right ? "correct" : "retry");
    setLastRight(right);
    if (right) setCorrect(correct + 1);
    setPhase("feedback");
  };
  const next = () => {
    if (!level) return;
    if (round + 1 >= FLASH.rounds) {
      setNewRecord(flashPassed(correct) && level.number > best);
      onResult(level.number, correct);
      setPhase("result");
      return;
    }
    setRound(round + 1);
    startRound(level);
  };

  if (phase === "pick" || !level) {
    return (
      <section className="panel">
        <p className="eyebrow">Необов'язковий виклик</p>
        <h2>⚡ Флеш-виклик</h2>
        <p className="lead">Числа блимають по одному — додай їх на уявному абакусі.</p>
        <p className="note">
          Рівень — це три раунди; він пройдений, якщо правильних відповідей щонайменше {FLASH.pass}. Виклик нічого не
          відкриває на карті й не впливає на заняття — це гра на особистий рекорд.{" "}
          {best > 0 ? `Твій рекорд: рівень ${best}.` : "Рекорду ще немає."}
        </p>
        <div className="flash-levels">
          {FLASH_LEVELS.map((flash) => (
            <button
              key={flash.number}
              className={`flash-level${flash.number <= best ? " flash-done" : ""}`}
              disabled={flash.number > best + 1}
              onClick={() => choose(flash)}
            >
              <b>{flash.number}</b>
              <span>
                {flash.count} {flash.count <= 4 ? "числа" : "чисел"} · {flash.digits}-цифрові
              </span>
              <span>{flash.intervalMs >= 1000 ? `${flash.intervalMs / 1000} с` : `${flash.intervalMs} мс`}</span>
              {isFast(flash) && <span>⚠ швидко</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-quiet" onClick={onExit}>
          ◀ До тренажера
        </button>
      </section>
    );
  }

  if (phase === "warn") {
    return (
      <section className="panel">
        <h2>⚠ Швидке блимання</h2>
        <p className="lead">
          На цьому рівні числа змінюються кожні {level.intervalMs} мс. Не вмикайте його, якщо у дитини чи в когось поруч
          є світлочутлива епілепсія або швидке блимання викликає неприємні відчуття.
        </p>
        <div className="row">
          <button className="btn btn-big" onClick={() => startRound(level)}>
            Зрозуміло, продовжити
          </button>
          <button className="btn btn-quiet" onClick={() => setPhase("pick")}>
            Вибрати інший рівень
          </button>
        </div>
      </section>
    );
  }

  if (phase === "result") {
    const passed = flashPassed(correct);
    return (
      <section className="panel">
        <p className="eyebrow">Рівень {level.number}</p>
        <h2>{passed ? "Рівень пройдено! ⭐" : "Поки не вийшло"}</h2>
        <p className="lead">
          Правильних раундів: {correct} з {FLASH.rounds}.{" "}
          {newRecord && "Це новий рекорд — тримай кристал і машинку-монстра!"}
        </p>
        <div className="row">
          <button className="btn btn-big" onClick={() => setPhase("pick")}>
            До рівнів
          </button>
          <button className="btn btn-quiet" onClick={() => choose(level)}>
            Ще раз цей рівень
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="progress">
        <span>
          Рівень {level.number} · раунд {round + 1} з {FLASH.rounds}
        </span>
      </div>
      {phase === "ready" && (
        <div className="sequence">
          <p className="prompt">
            Зараз блимне {level.count} чисел. Дивись у середину екрана й додавай.
          </p>
          <button className="btn btn-big" autoFocus onClick={() => setPhase("flash")}>
            Старт ▶
          </button>
        </div>
      )}
      {phase === "flash" && <Flasher numbers={numbers} intervalMs={level.intervalMs} onDone={() => setPhase("answer")} />}
      {phase === "answer" && (
        <div className="work work-single">
          <div className="work-side">
            <p className="prompt">Яка сума?</p>
            <div className="answer" aria-live="polite">
              {input || "?"}
            </div>
            <Keypad value={input} maxLength={6} onChange={setInput} onSubmit={submit} />
          </div>
        </div>
      )}
      {phase === "feedback" && (
        <div className={`feedback ${lastRight ? "feedback-good" : "feedback-review"}`}>
          <p className="feedback-title">{lastRight ? "Правильно! ⭐" : `Було ${sum}`}</p>
          <p>{numbers.join(" + ")} = {sum}</p>
          <button className="btn btn-big" autoFocus onClick={next}>
            Далі ▶
          </button>
        </div>
      )}
    </section>
  );
}
