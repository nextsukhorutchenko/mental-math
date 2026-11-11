import { useState } from "react";
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
  const mastery = masteryOf(skills[setup.topic]?.[setup.mode], setup.mode);

  return (
    <section className="panel">
      <div className="banner banner-resume">
        <span>⚡ Флеш-виклик: числа блимають — додай їх в уяві. Це необов’язкова гра на рекорд.</span>
        <button className="btn btn-quiet" onClick={onFlash}>
          Відкрити
        </button>
      </div>
      <h2>Тренажер</h2>
      <p className="note">Тут можна зібрати власне тренування: будь-яка тема, скільки завгодно прикладів і дій.</p>

      <label className="field">
        <span>Тема</span>
        <select value={setup.topic} onChange={(event) => set({ topic: event.target.value as SkillId })}>
          {FAMILIES.map((name) => (
            <optgroup key={name} label={familyTitle(name)}>
              {ALL_SKILLS.filter((id) => skillFamily(id) === name).map((id) => (
                <option key={id} value={id}>
                  {id === "simple" ? "Прямі рухи без формул" : describeSkill(id)}
                  {MARKS[masteryOf(skills[id]?.physical, "physical").status]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
      </div>

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

      <div className="field">
        <span>Дії</span>
        <Choice
          value={setup.operations}
          options={[
            { value: "mixed" as const, label: "+ і −" },
            { value: "+" as const, label: "лише +" },
            { value: "-" as const, label: "лише −" },
          ]}
          onChange={(operations) => set({ operations })}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <button className="btn btn-big" onClick={() => onStart(setup)}>
        Почати ⛏
      </button>
      {active && active.index > 0 && (
        <p className="note">Нове тренування закриє незавершене; уже розв'язані в ньому приклади буде зараховано.</p>
      )}
    </section>
  );
}
