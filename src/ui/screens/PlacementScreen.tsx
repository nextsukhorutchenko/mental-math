import { useEffect, useMemo, useState } from "react";
import { levelById } from "../../game/curriculum/levels";
import {
  PLACEMENT,
  PLACEMENT_STAGES,
  placementStart,
  stageDrill,
  stagePassed,
} from "../../game/curriculum/placement";
import { Keypad } from "../components/Keypad";
import { ExampleColumn } from "./LessonScreen";

interface Props {
  /** Застосувати результат: рівень, з якого починати. */
  onApply: (start: string) => void;
  onCancel: () => void;
}

/**
 * Стартова перевірка рівня: кілька прикладів на кожен світ, одна спроба, без підказок.
 * Прогрес і нагороди не нараховуються — це лише спосіб вибрати місце старту.
 */
export function PlacementScreen({ onApply, onCancel }: Props) {
  const [started, setStarted] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [input, setInput] = useState("");
  /** Кількість пройдених поспіль етапів; null — перевірка ще триває. */
  const [passed, setPassed] = useState<number | null>(null);

  const stage = PLACEMENT_STAGES[stageIndex]!;
  const drill = useMemo(() => stageDrill(stage), [stage]);
  const example = drill.examples[exampleIndex]!;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [started, stageIndex, passed]);

  const submit = () => {
    const total = correct + (Number(input) === example.answer ? 1 : 0);
    setInput("");
    if (exampleIndex + 1 < drill.examples.length) {
      setCorrect(total);
      setExampleIndex(exampleIndex + 1);
      return;
    }
    // Етап завершено: або йдемо далі, або зупиняємося на ньому.
    if (!stagePassed(total)) setPassed(stageIndex);
    else if (stageIndex + 1 >= PLACEMENT_STAGES.length) setPassed(PLACEMENT_STAGES.length);
    else {
      setStageIndex(stageIndex + 1);
      setExampleIndex(0);
      setCorrect(0);
    }
  };

  if (!started) {
    return (
      <section className="panel">
        <p className="eyebrow">Для батьків</p>
        <h2>Стартова перевірка рівня</h2>
        <p className="lead">
          Якщо доня вже вміє рахувати на абакусі, перевірка допоможе не починати з самого початку.
        </p>
        <p className="note">
          Буде до {PLACEMENT_STAGES.length} коротких етапів по {PLACEMENT.examples} приклади — від прямих рухів до
          комбінованих формул. На кожен приклад одна спроба, без підказок і без оцінки швидкості. Перевірка
          зупиняється на першому етапі, де правильних менше ніж {PLACEMENT.pass}. Рахувати можна на своєму абакусі.
        </p>
        <div className="row">
          <button className="btn btn-big" onClick={() => setStarted(true)}>
            Почати перевірку ▶
          </button>
          <button className="btn btn-quiet" onClick={onCancel}>
            Скасувати
          </button>
        </div>
      </section>
    );
  }

  if (passed !== null) {
    const start = placementStart(passed);
    const all = passed >= PLACEMENT_STAGES.length;
    return (
      <section className="panel">
        <p className="eyebrow">Перевірку завершено</p>
        <h2>
          Починаємо з рівня «{levelById(start)?.title ?? start}»
        </h2>
        <p className="lead">
          {passed === 0
            ? "Найкраще почати з самого початку — з прямих рухів."
            : all
              ? "Пройдено всі етапи. Карта відкриється повністю, а заняття почнуться з останнього рівня."
              : `Пройдено етапів: ${passed} з ${PLACEMENT_STAGES.length}. Усі рівні до цього місця відкриються на карті.`}
        </p>
        <p className="note">
          Це орієнтир за кількома прикладами, а не іспит. Пропущені рівні лишаться відкритими — до них можна
          повернутися, якщо якась формула виявиться незнайомою.
        </p>
        <div className="row">
          <button className="btn btn-big" onClick={() => onApply(start)}>
            Застосувати
          </button>
          <button className="btn btn-quiet" onClick={onCancel}>
            Не змінювати
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="progress">
        <span>
          Етап {stageIndex + 1} з {PLACEMENT_STAGES.length} — {stage.title}. Приклад {exampleIndex + 1} з{" "}
          {drill.examples.length}
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(exampleIndex / drill.examples.length) * 100}%` }} />
        </div>
      </div>
      <div className="work">
        <ExampleColumn steps={example.steps} />
        <div className="work-side">
          <p className="prompt">Порахуй і введи відповідь. Спроба одна.</p>
          <div className="answer" aria-live="polite">
            {input || "?"}
          </div>
          <Keypad key={`${stageIndex}-${exampleIndex}`} value={input} onChange={setInput} onSubmit={submit} />
        </div>
      </div>
    </section>
  );
}
