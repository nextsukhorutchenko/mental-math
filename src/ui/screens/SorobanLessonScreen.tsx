import { Fragment, useEffect, useMemo, useState } from "react";
import { buildStep } from "../../core/rules/step";
import { fromNumber } from "../../core/soroban/abacus";
import { AbacusView } from "../components/AbacusView";
import { Hero } from "../components/Avatar";
import { StepDemo } from "../components/StepDemo";

/** Ланцюжок для показу пальців: +2 великим, +5 вказівним, −1 вказівним, −5 вказівним. */
function fingerSteps() {
  const steps = [];
  let value = 0;
  for (const [sign, operand] of [["+", 2], ["+", 5], ["-", 1], ["-", 5]] as const) {
    const step = buildStep(value, sign, operand)!;
    steps.push(step);
    value = step.after;
  }
  return steps;
}

/** Числа для читання з поясненням, з чого вони складаються. */
const READING: [number, string][] = [
  [3, "3 нижні кісточки = 3"],
  [5, "лише п'ятірка = 5"],
  [7, "п'ятірка + 2 нижні = 7"],
  [42, "4 десятки + 2 одиниці = 42"],
];

/** Вступний урок: будова соробану, значення кісточок і правила двох пальців. */
export function SorobanLessonScreen({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const steps = useMemo(fingerSteps, []);
  const pinch = useMemo(() => [buildStep(0, "+", 7)!], []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const pages = [
    <>
      <h2>Це соробан</h2>
      <Hero event="greet" variant={0} />
      <div className="lesson-row">
        <AbacusView abacus={fromNumber(0, 4)} showDigits={false} />
        <ul className="lesson-list">
          <li>
            <b>Рамка і спиці.</b> Кожна спиця — це розряд: праворуч одиниці, лівіше десятки, сотні, тисячі.
          </li>
          <li>
            <b>Планка</b> ділить спицю на дві частини. Рахуються лише кісточки, присунуті до планки.
          </li>
          <li>
            <b>Верхня кісточка</b> — «небесна». Вона одна на спиці й коштує <b>5</b>.
          </li>
          <li>
            <b>Нижні кісточки</b> — «земні». Їх чотири, кожна коштує <b>1</b>.
          </li>
          <li>
            <b>Цятки на планці</b> позначають спицю одиниць і кожну третю від неї — так легше не загубити розряд.
          </li>
        </ul>
      </div>
      <p className="note">Коли жодна кісточка не торкається планки, на соробані нуль.</p>
    </>,
    <>
      <h2>Як читати число</h2>
      <p className="lead">На кожній спиці додаємо п'ятірку (якщо присунута) і нижні кісточки біля планки.</p>
      <div className="memory-row">
        {READING.map(([number, caption]) => (
          <div key={number} className="memory-item">
            <AbacusView abacus={fromNumber(number, 2)} />
            <span>{caption}</span>
          </div>
        ))}
      </div>
      <p className="note">Набери ці числа на своєму абакусі й порівняй із картинками.</p>
    </>,
    <>
      <h2>Два пальці</h2>
      <ul className="lesson-list">
        <li>
          <b>Великий палець</b> робить лише одне: присуває нижні кісточки <b>вгору</b> до планки.
        </li>
        <li>
          <b>Вказівний палець</b> робить усе інше: відсуває нижні кісточки вниз і рухає верхню кісточку в обидва боки.
        </li>
        <li>Інші пальці зібрані в кулачок і кісточок не торкаються.</li>
      </ul>
      <StepDemo steps={steps} />
      <p className="note">Повтори кожен рух на своєму абакусі саме тим пальцем, який названо під картинкою.</p>
    </>,
    <>
      <h2>Щипок і порядок на столі</h2>
      <ul className="lesson-list">
        <li>
          <b>Числа 6–9 набираються щипком:</b> вказівний опускає п'ятірку, а великий одночасно піднімає нижні кісточки.
        </li>
        <li>
          <b>Ліва рука</b> притримує рамку, права рахує. Абакус лежить рівно перед тобою.
        </li>
        <li>
          <b>Число набирається зліва направо:</b> спершу старший розряд, потім молодші.
        </li>
        <li>
          <b>Щоб очистити абакус,</b> нахили його до себе, щоб нижні кісточки з'їхали вниз, поклади і проведи вказівним
          пальцем уздовж планки зліва направо — верхні кісточки відійдуть угору.
        </li>
      </ul>
      <StepDemo steps={pinch} />
      <p className="note">
        Для батьків: застосунок рухів не бачить. Перші тижні стежте за пальцями — перевчатися потім значно важче.
      </p>
    </>,
  ];

  const last = page === pages.length - 1;
  return (
    <section className="panel">
      <p className="eyebrow">
        Вступний урок · {page + 1} з {pages.length}
      </p>
      {/* key: кожна сторінка — окреме дерево, щоб демонстрації не ділили стан між сторінками */}
      <Fragment key={page}>{pages[page]}</Fragment>
      <div className="row">
        {page > 0 && (
          <button className="btn btn-quiet" onClick={() => setPage(page - 1)}>
            ◀ Назад
          </button>
        )}
        <button className="btn btn-big" onClick={() => (last ? onDone() : setPage(page + 1))}>
          {last ? "Зрозуміло, до карти" : "Далі ▶"}
        </button>
      </div>
    </section>
  );
}
