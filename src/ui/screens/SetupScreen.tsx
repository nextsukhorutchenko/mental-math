import { useState } from "react";
import { AbacusChoice } from "../components/AbacusChoice";
import { LEVELS, levelById } from "../../game/curriculum/levels";
import { masteryOf } from "../../game/progress/progress";
import { type LessonSetup, SETUP_LIMITS } from "../../game/session/setup";
import type { ActiveSession, SaveData } from "../../storage/save";
import {
  ALL_SKILLS,
  type SkillFamily,
  type SkillId,
  describeSkill,
  familyTitle,
  skillFamily,
} from "../../core/rules/skills";

const MARKS = { new: "", learning: " •", mastered: " ✓" } as const;

/** Рівні множення й ділення: у тренажері вони — окремі теми з готовими межами чисел. */
const FACT_GROUPS = [
  { kind: "multiply", title: "Множення" },
  { kind: "divide", title: "Ділення" },
] as const;
const isFactLevel = (id: string | undefined) => {
  const kind = levelById(id)?.kind;
  return kind === "multiply" || kind === "divide";
};

/** Вид тренування — перший і найпомітніший вибір у тренажері. */
type TrainerKind = "chain" | "multiply" | "divide";
/** «Що тренуємо» — єдиний вибір виду: додавання й віднімання (разом чи окремо), множення або ділення. */
type ActionChoice = LessonSetup["operations"] | "multiply" | "divide";
const ACTIONS: { value: ActionChoice; label: string }[] = [
  { value: "mixed", label: "➕➖ Додавання й віднімання" },
  { value: "+", label: "➕ Лише додавання" },
  { value: "-", label: "➖ Лише віднімання" },
  { value: "multiply", label: "✖ Множення" },
  { value: "divide", label: "➗ Ділення" },
];
const firstLevelOf = (kind: "multiply" | "divide") => LEVELS.find((level) => level.kind === kind)!.id;

const FAMILIES: SkillFamily[] = ["simple", "five", "ten", "mix"];
const COUNT_PRESETS = [5, 10, 20, 30, 50];

function Stepper(props: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const { value, min, max, step = 1, onChange } = props;
  // Округлюємо до кроку, щоб не накопичувати похибку на дробових значеннях.
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next / step) * step));
  return (
    <div className="stepper">
      <button className="btn btn-quiet" onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || min))}
      />
      <button className="btn btn-quiet" onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

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

interface Props {
  initial: LessonSetup;
  skills: SaveData["skills"];
  /** Незавершене заняття, яке можна продовжити. */
  active: ActiveSession | null;
  error: string | null;
  onStart: (setup: LessonSetup) => void;
  onFlash: () => void;
}

export function SetupScreen({ initial, skills, active, error, onStart, onFlash }: Props) {
  const [setup, setSetup] = useState(initial);
  const set = (patch: Partial<LessonSetup>) => setSetup({ ...setup, ...patch });
  // Для множення й ділення тема — це рівень; для додавання й віднімання — прийом.
  const fact = isFactLevel(setup.level);
  const kind: TrainerKind = fact ? (levelById(setup.level)!.kind as TrainerKind) : "chain";
  const topicValue = fact ? setup.level! : setup.topic;
  const mastery = masteryOf(skills[topicValue]?.[setup.mode], setup.mode);
  // Остання вибрана тема кожного виду, щоб перемикання туди-назад її не губило.
  const [lastFact, setLastFact] = useState<Record<"multiply" | "divide", string>>(() => ({
    multiply: kind === "multiply" ? setup.level! : firstLevelOf("multiply"),
    divide: kind === "divide" ? setup.level! : firstLevelOf("divide"),
  }));
  const chooseTopic = (value: string) => {
    const level = levelById(value);
    if (level && (level.kind === "multiply" || level.kind === "divide")) {
      setLastFact({ ...lastFact, [level.kind]: value });
      set({ level: value, pacing: "all" });
    } else set({ topic: value as SkillId, level: undefined });
  };
  const chooseKind = (next: TrainerKind) => {
    if (next === "chain") set({ level: undefined });
    else set({ level: lastFact[next], pacing: "all" });
  };
  const actionValue: ActionChoice = kind === "chain" ? setup.operations : kind;
  const chooseAction = (next: ActionChoice) => {
    if (next === "multiply" || next === "divide") chooseKind(next);
    else set({ operations: next, level: undefined });
  };
  /** Рівень зберігаємо лише для множення й ділення, щоб формули йшли звичним шляхом. */
  const start = () => {
    const { level, ...rest } = setup;
    onStart(fact ? setup : rest);
  };

  return (
    <section className="panel">
      <div className="banner banner-resume">
        <span>⚡ Флеш-виклик: числа блимають — додай їх в уяві. Це необов’язкова гра на рекорд.</span>
        <button className="btn btn-quiet" onClick={onFlash}>
          Відкрити
        </button>
      </div>
      <h2>Тренажер</h2>
      <p className="note">
        Тут можна зібрати власне тренування: будь-яка тема, від формул додавання й віднімання до множення й ділення.
      </p>

      <div className="field">
        <span>Що тренуємо</span>
        <Choice value={actionValue} options={ACTIONS} onChange={chooseAction} />
      </div>

      <label className="field">
        <span>Тема</span>
        <select value={topicValue} onChange={(event) => chooseTopic(event.target.value)}>
          {kind === "chain" && FAMILIES.map((name) => (
            <optgroup key={name} label={familyTitle(name)}>
              {ALL_SKILLS.filter((id) => skillFamily(id) === name).map((id) => (
                <option key={id} value={id}>
                  {id === "simple" ? "Прямі рухи без формул" : describeSkill(id)}
                  {MARKS[masteryOf(skills[id]?.physical, "physical").status]}
                </option>
              ))}
            </optgroup>
          ))}
          {FACT_GROUPS.filter((group) => group.kind === kind).map((group) => (
            <optgroup key={group.kind} label={group.title}>
              {LEVELS.filter((level) => level.kind === group.kind).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.title} ({level.label})
                  {MARKS[masteryOf(skills[level.id]?.physical, "physical").status]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {fact && <span className="note">{levelById(setup.level)!.explain}</span>}
        <span className="note">
          {mastery.status === "new"
            ? `Цю тему ще не тренували ${setup.mode === "mental" ? "подумки" : "на абакусі"}.`
            : `${mastery.status === "mastered" ? "Засвоєно ✓. " : ""}${setup.mode === "mental" ? "Подумки" : "На абакусі"}:${mastery.correct} з ${mastery.needCorrect} самостійних застосувань · останні ${mastery.window}: ${mastery.recentClean} (треба ${mastery.needRecent}) · днів: ${mastery.days} з ${mastery.needDays}`}
        </span>
      </label>

      <div className="field">
        <span>Режим</span>
        <Choice
          value={setup.mode}
          options={[
            { value: "physical" as const, label: "🧮 На абакусі" },
            { value: "mental" as const, label: "🧠 Подумки" },
          ]}
          onChange={(mode) => set({ mode })}
        />
        {setup.mode === "physical" && <AbacusChoice />}
      </div>

      {!fact && (
      <div className="field">
        <span>Показ чисел</span>
        <Choice
          value={setup.pacing}
          options={[
            { value: "all" as const, label: "весь приклад" },
            { value: "manual" as const, label: "по одному, вручну" },
            { value: "auto" as const, label: "по одному, з темпом" },
            { value: "voice" as const, label: "🔊 диктант: голос застосунку" },
            { value: "reader" as const, label: "🗣 диктант: читає дорослий" },
          ]}
          onChange={(pacing) => set({ pacing })}
        />
        {(setup.pacing === "voice" || setup.pacing === "reader") && (
          <span className="note">
            Диктант на слух: дитина не бачить чисел. Голос застосунку працює лише там, де є український голос;
            якщо його немає, числа з екрана читає дорослий.
          </span>
        )}
        {setup.pacing === "voice" && (
          <>
            <span className="note">Пауза між числами, секунд:</span>
            <Stepper
              value={setup.secondsPerNumber}
              min={SETUP_LIMITS.seconds.min}
              max={SETUP_LIMITS.seconds.max}
              step={SETUP_LIMITS.seconds.step}
              onChange={(secondsPerNumber) => set({ secondsPerNumber })}
            />
          </>
        )}
        {setup.pacing === "auto" && (
          <>
            <span className="note">Секунд на кожне число (є пауза):</span>
            <Stepper
              value={setup.secondsPerNumber}
              min={SETUP_LIMITS.seconds.min}
              max={SETUP_LIMITS.seconds.max}
              step={SETUP_LIMITS.seconds.step}
              onChange={(secondsPerNumber) => set({ secondsPerNumber })}
            />
          </>
        )}
      </div>
      )}

      <div className="field">
        <span>Кількість прикладів</span>
        <Choice
          value={setup.exampleCount}
          options={COUNT_PRESETS.map((count) => ({ value: count, label: String(count) }))}
          onChange={(exampleCount) => set({ exampleCount })}
        />
        <Stepper
          value={setup.exampleCount}
          min={SETUP_LIMITS.examples.min}
          max={SETUP_LIMITS.examples.max}
          onChange={(exampleCount) => set({ exampleCount })}
        />
      </div>

      {fact ? (
        <p className="note">
          Приклад показується одним записом, наприклад «47 × 6». Межі чисел задає вибрана тема; кнопка «Покажи рухи»
          розкладає приклад на кроки для абакуса.
        </p>
      ) : (
      <>
      <div className="field">
        <span>Кількість дій у прикладі</span>
        <Stepper
          value={setup.actionsPerExample}
          min={SETUP_LIMITS.actions.min}
          max={SETUP_LIMITS.actions.max}
          onChange={(actionsPerExample) => set({ actionsPerExample })}
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
      </>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn btn-big" onClick={start}>
        Почати ⛏
      </button>
      {active && active.index > 0 && (
        <p className="note">Нове тренування закриє незавершене; уже розв'язані в ньому приклади буде зараховано.</p>
      )}
    </section>
  );
}
