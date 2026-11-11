import { useEffect, useMemo, useState } from "react";
import { type Example, formatExample, generateDrill } from "../../core/generator/generator";
import { introSteps } from "../../core/rules/demo";
import { diagnose } from "../../core/rules/diagnose";
import { type SkillId, describeSkill, explainSkill } from "../../core/rules/skills";
import type { Step } from "../../core/rules/step";
import {
  type Session,
  currentExample,
  isClean,
  markHint,
  nextExample,
  submitAnswer,
  summarize,
} from "../../game/session/session";
import type { Bonus, Loot } from "../../game/rewards/blocks";
import { type LessonSetup, type Mode, toDrillConfig } from "../../game/session/setup";
import { LootList } from "../components/Block";
import { Companion } from "../components/Companion";
import { playSound } from "../sound";
import { levelById } from "../../game/curriculum/levels";
import { DictationPlayer } from "../components/DictationPlayer";
import { Keypad } from "../components/Keypad";
import { SequencePlayer } from "../components/SequencePlayer";
import { StepDemo } from "../components/StepDemo";

const stepText = (step: Step, index: number) =>
  index === 0 ? String(step.operand) : `${step.operation === "+" ? "+" : "−"}${step.operand}`;

export function ExampleColumn({ steps, prompt }: { steps: readonly Step[]; prompt?: string }) {
  // Множення й ділення записуються одним рядком, ланцюжки — стовпчиком.
  if (prompt) {
    return (
      <div className="example example-prompt" aria-label="Приклад">
        {prompt}
      </div>
    );
  }
  return (
    <div className="example" aria-label="Приклад">
      {steps.map((step, index) => (
        <div key={index} className="example-line">
          <span className="example-sign">{index === 0 ? "" : step.operation === "+" ? "+" : "−"}</span>
          <span>{step.operand}</span>
        </div>
      ))}
      <div className="example-rule" />
    </div>
  );
}

interface IntroProps {
  setup: LessonSetup;
  /** Seed заняття: зразок для вступу береться з іншого seed, щоб не підказати відповідь на перше завдання. */
  seed: number;
  onStart: () => void;
}

function Intro({ setup, seed, onStart }: IntroProps) {
  const { topic, mode } = setup;
  const level = levelById(setup.level);
  // Для формул показуємо найкоротший зразок прийому, для решти рівнів — окремий приклад того самого виду.
  const demo: Pick<Example, "steps" | "labels" | "prompt"> = useMemo(() => {
    if (!level || level.kind === "formula") return { steps: introSteps(topic) };
    const config = { ...toDrillConfig({ ...setup, exampleCount: 1 }), seed: (seed + 1) >>> 0 };
    return generateDrill(config).examples[0]!;
  }, [level, setup, seed, topic]);
  return (
    <section className="panel">
      <p className="eyebrow">{mode === "mental" ? "Рахуємо подумки" : "Тема заняття"}</p>
      <h2>{level?.title ?? (topic === "simple" ? "Прямі рухи" : describeSkill(topic))}</h2>
      <p className="lead">{level?.explain ?? explainSkill(topic)}</p>
      {demo.prompt && <p className="prompt">Наприклад: {demo.prompt}</p>}
      <StepDemo steps={demo.steps} labels={demo.labels} />
      <p className="note">
        {mode === "mental"
          ? "Цього разу абакус відклади. Уявляй його перед собою і пересувай кісточки подумки."
          : "Постав свій абакус перед собою і повтори ці рухи руками."}
      </p>
      <button className="btn btn-big" onClick={onStart}>
        До вправ ▶
      </button>
    </section>
  );
}

interface PracticeProps {
  session: Session;
  setup: LessonSetup;
  onChange: (session: Session) => void;
}

function Practice({ session, setup, onChange }: PracticeProps) {
  // Множення й ділення завжди показуються цілим записом: подавати їх по одному числу немає сенсу.
  const sequential = setup.pacing !== "all" && !currentExample(session)?.prompt;
  const mental = setup.mode === "mental";
  const [input, setInput] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  // Чи числа вже показано по одному (для показу всього прикладу — одразу так).
  const [shown, setShown] = useState(!sequential || session.current.answers.length > 0);
  const example = currentExample(session);
  if (!example) return null;
  const total = session.drill.examples.length;
  const answering = session.status === "answering";
  const retry = answering && session.current.answers.length > 0;
  const playing = answering && !showDemo && !shown;
  // Розбір останньої хибної відповіді: здогад про причину, не вирок.
  const lastAnswer = session.current.answers[session.current.answers.length - 1];
  const clues =
    lastAnswer === undefined || session.status === "solved" || example.prompt ? [] : diagnose(example.steps, lastAnswer);
  const clue = clues[0];

  const submit = () => {
    const answered = submitAnswer(session, Number(input));
    playSound(answered.status === "solved" ? "correct" : answered.status === "failed" ? "review" : "retry");
    onChange(answered);
    setInput("");
    setShowDemo(false);
  };
  const next = () => {
    onChange(nextExample(session));
    setInput("");
    setShowDemo(false);
  };
  const openDemo = () => {
    onChange(markHint(session));
    setShowDemo(true);
  };

  const prompt = retry
    ? mental
      ? "Не зовсім. Уяви абакус і порахуй ще раз."
      : "Не зовсім. Порахуй на абакусі ще раз."
    : mental
      ? "Уяви абакус, порахуй подумки та введи відповідь."
      : "Порахуй на своєму абакусі та введи відповідь.";

  return (
    <section className="panel">
      <div className="progress" aria-label={`Приклад ${session.index + 1} з ${total}`}>
        <span>
          Приклад {session.index + 1} з {total}
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
      </div>

      {answering && (
        <div className="choice mode">
          <button className={`chip${showDemo ? "" : " chip-active"}`} onClick={() => setShowDemo(false)}>
            {mental ? "🧠 Рахую подумки" : "🧮 Рахую на абакусі"}
          </button>
          <button className={`chip${showDemo ? " chip-active" : ""}`} onClick={openDemo}>
            👀 Покажи рухи
          </button>
        </div>
      )}

      {playing && (setup.pacing === "voice" || setup.pacing === "reader") ? (
        <DictationPlayer
          steps={example.steps}
          pacing={setup.pacing}
          secondsPerNumber={setup.secondsPerNumber}
          onDone={() => setShown(true)}
        />
      ) : playing ? (
        <SequencePlayer
          steps={example.steps}
          pacing={setup.pacing === "auto" ? "auto" : "manual"}
          secondsPerNumber={setup.secondsPerNumber}
          onDone={() => setShown(true)}
        />
      ) : (
        <div className={`work${sequential && answering && !showDemo ? " work-single" : ""}`}>
          {/* Коли числа йдуть по одному, стовпчик видно лише в підказці й розборі. */}
          {(!sequential || !answering || showDemo) && <ExampleColumn steps={example.steps} prompt={example.prompt} />}

          <div className="work-side">
            {answering && !showDemo && (
              <>
                <p className={`prompt${retry ? " prompt-retry" : ""}`}>{prompt}</p>
                {/* Після першої помилки лише вказуємо, яку дію перевірити; повний розбір — після другої. */}
                {retry && clue?.stepIndex !== undefined && (
                  <p className="clue">
                    💡 Перевір {clue.stepIndex + 1}-шу дію: {stepText(example.steps[clue.stepIndex]!, clue.stepIndex)}
                  </p>
                )}
                <Companion event={retry ? "retry" : "ask"} variant={session.index} />
                <div className="answer" aria-live="polite">
                  {input || "?"}
                </div>
                <Keypad value={input} onChange={setInput} onSubmit={submit} />
                {sequential && (
                  <button className="btn btn-quiet" onClick={() => setShown(false)}>
                    🔁 Показати числа ще раз
                  </button>
                )}
              </>
            )}

            {answering && showDemo && (
              <>
                <StepDemo key={session.index} steps={example.steps} labels={example.labels} />
                <button className="btn" onClick={() => setShowDemo(false)}>
                  Зрозуміло, вводжу відповідь
                </button>
              </>
            )}

            {session.status === "solved" && (
              <div className="feedback feedback-good">
                <p className="feedback-title">Правильно! ⭐</p>
                <Companion
                  event={session.current.answers.length > 1 ? "corrected" : "correct"}
                  variant={session.index}
                />
                <p>Відповідь: {example.answer}</p>
                <button className="btn btn-big" autoFocus onClick={next}>
                  Далі ▶
                </button>
              </div>
            )}

            {session.status === "failed" && (
              <div className="feedback feedback-review">
                <p className="feedback-title">Розберімо разом</p>
                <Companion event="review" variant={session.index} />
                {clues.map((item, index) => (
                  <p key={index} className="clue">
                    💡 {item.text}
                  </p>
                ))}
                <p>
                  Правильна відповідь: {example.answer}.{" "}
                  {mental ? "Простеж за рухами й уяви їх." : "Повтори рухи на своєму абакусі."}
                </p>
                <StepDemo key={session.index} steps={example.steps} labels={example.labels} />
                <button className="btn btn-big" onClick={next}>
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

interface SummaryProps {
  session: Session;
  topic: SkillId;
  mode: Mode;
  /** Прийоми, які повторювали (для заняття-повторення). */
  review?: SkillId[];
  /** Блоки й особливі нагороди за це заняття. */
  earned: Loot;
  bonuses: Bonus[];
  onRepeat: () => void;
  /** Коротка проба подумки після заняття на абакусі. */
  onMentalTry: () => void;
  onExit: () => void;
}

const BONUS_TEXT: Record<Bonus, string> = {
  accuracy: "💎 Кристал за уважне заняття",
  mastery: "⭐ Формулу засвоєно на абакусі — кристали!",
  mental: "🧠 Формулу засвоєно подумки — кристали!",
  week: "🔥 Тижневу ціль виконано — кристали!",
};

export function Summary(props: SummaryProps) {
  const { session, topic, mode, review, earned, bonuses, onRepeat, onMentalTry, onExit } = props;
  const summary = summarize(session);
  const focus = review ? undefined : summary.skills.find((tally) => tally.skill === topic);
  const reviewed = (review ?? []).map((skill) => summary.skills.find((tally) => tally.skill === skill)).filter((tally) => !!tally);
  return (
    <section className="panel">
      <Companion event="finish" variant={summary.clean} />
      <p className="eyebrow">
        {review ? "Повторення завершено" : mode === "mental" ? "Тренування подумки завершено" : "Тренування завершено"}
      </p>
      <h2>
        Самостійно: {summary.clean} з {summary.total}
      </h2>
      <div className="stats">
        <div className="stat stat-good">
          <b>{summary.clean}</b> самостійно з першої спроби
        </div>
        <div className="stat stat-help">
          <b>{summary.withHelp}</b> з підказкою або з другої спроби
        </div>
        <div className="stat stat-review">
          <b>{summary.failed}</b> розібрали разом
        </div>
      </div>
      <div className="earned">
        <b>Здобуто для острова:</b>
        <LootList loot={earned} />
        {bonuses.map((bonus) => (
          <p key={bonus} className="earned-bonus">
            {BONUS_TEXT[bonus]}
          </p>
        ))}
      </div>
      {focus && topic !== "simple" && (
        <p className="note">
          Формулу «{describeSkill(topic)}» застосовано {focus.total} разів, із них {focus.clean} — у прикладах,
          розв'язаних самостійно.
        </p>
      )}
      {reviewed.length > 0 && (
        <p className="note">
          Повторили:{" "}
          {reviewed
            .map((tally) => `${tally.skill === "simple" ? "прямі рухи" : describeSkill(tally.skill)} — ${tally.clean} з ${tally.total} самостійно`)
            .join("; ")}
          .
        </p>
      )}
      <ol className="review">
        {session.results.map((result, index) => (
          <li key={index}>
            <span>{isClean(result) ? "✅" : result.solved ? "🟡" : "❌"}</span>{" "}
            {formatExample(session.drill.examples[index]!)}
            {!result.solved && <em> (відповіді: {result.answers.join(", ")})</em>}
            {!isClean(result) &&
              result.answers[0] !== undefined &&
              !session.drill.examples[index]!.prompt &&
              diagnose(session.drill.examples[index]!.steps, result.answers[0])
                .slice(0, 1)
                .map((item) => (
                  <span key="clue" className="review-clue">
                    {item.text}
                  </span>
                ))}
          </li>
        ))}
      </ol>
      {mode === "physical" && (
        <p className="note">Застосунок перевіряє відповідь, але не бачить рухів рук — за ними стежте ви.</p>
      )}
      <div className="row">
        <button className="btn btn-big" onClick={onRepeat}>
          Ще таке саме
        </button>
        {mode === "physical" && !review && (
          <button className="btn" onClick={onMentalTry}>
            🧠 Спробувати 5 коротких подумки
          </button>
        )}
        <button className="btn btn-quiet" onClick={onExit}>
          🗺 На карту
        </button>
      </div>
    </section>
  );
}

interface Props {
  setup: LessonSetup;
  /** Чи пояснення теми вже переглянуто. */
  started: boolean;
  session: Session;
  onStart: () => void;
  onSession: (session: Session) => void;
}

/** Урок без власного стану: усе зберігається нагорі, щоб пережити перезавантаження. */
export function LessonScreen({ setup, started, session, onStart, onSession }: Props) {
  // Кожен новий екран уроку починається згори сторінки.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [started, session.index]);

  if (!started) return <Intro setup={setup} seed={session.drill.seed} onStart={onStart} />;
  return <Practice key={session.index} session={session} setup={setup} onChange={onSession} />;
}
