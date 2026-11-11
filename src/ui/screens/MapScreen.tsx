import { useMemo, useState } from "react";
import type { SkillId } from "../../core/rules/skills";
import {
  type LevelState,
  type Rank,
  WORLDS,
  currentLevel,
  hasActions,
  levelLabel,
  levelStates,
  recommendLesson,
} from "../../game/curriculum/curriculum";
import type { CardSetup } from "../../game/cards/types";
import type { DailyPart } from "../../game/curriculum/daily";
import type { Mastery } from "../../game/progress/progress";
import { WEEK_GOAL } from "../../game/rewards/rewards";
import { type LessonSetup, mentalTryout } from "../../game/session/setup";
import type { SaveData } from "../../storage/save";
import { Avatar, Hero } from "../components/Avatar";

const ICONS: Record<LevelState["status"], string> = { locked: "🔒", open: "", learning: "⛏", mastered: "⭐" };

function masteryLine(name: string, mastery: Mastery): string {
  if (mastery.status === "new") return `${name}: ще не починали`;
  const done = mastery.status === "mastered" ? " — засвоєно ⭐" : "";
  return (
    `${name}: ${mastery.correct} з ${mastery.needCorrect} самостійних застосувань, ` +
    `останні ${mastery.window}: ${mastery.recentClean} (треба ${mastery.needRecent}), ` +
    `днів: ${mastery.days} з ${mastery.needDays}${done}`
  );
}

interface CardProps {
  state: LevelState;
  onStart: (setup: LessonSetup) => void;
  onCustomize: (skill: SkillId) => void;
  onClose: () => void;
}

/** Картка рівня: що це за прийом, як просувається засвоєння і яке заняття наступне. */
function LevelCard({ state, onStart, onCustomize, onClose }: CardProps) {
  const next = recommendLesson(state);
  const locked = state.status === "locked";
  return (
    <div className="sheet" role="dialog" aria-label="Рівень">
      <div className="sheet-head">
        <h2>{state.level.title}</h2>
        <button className="btn btn-quiet" onClick={onClose} aria-label="Закрити">
          ✕
        </button>
      </div>
      <p className="lead">{state.level.explain}</p>
      {locked ? (
        <p className="note">🔒 Рівень відкриється, коли попередній буде засвоєно на абакусі.</p>
      ) : (
        <>
          <p className="note">{masteryLine("🧮 На абакусі", state.physical)}</p>
          <p className="note">{masteryLine("🧠 Подумки", state.mental)}</p>
          <div className="row">
            <button className="btn btn-big" onClick={() => onStart(next.setup)}>
              {next.title}: {next.setup.exampleCount} прикладів
              {hasActions(state.level) &&
                ` по ${next.setup.actionsPerExample} ${next.setup.actionsPerExample <= 4 ? "дії" : "дій"}`}{" "}
              ▶
            </button>
            {state.physical.status !== "new" && next.stage !== "mental" && (
              <button className="btn" onClick={() => onStart(mentalTryout(next.setup))}>
                🧠 5 коротких подумки
              </button>
            )}
            {state.level.skill && (
              <button className="btn btn-quiet" onClick={() => onCustomize(state.level.skill!)}>
                Налаштувати самому
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  skills: SaveData["skills"];
  unlockAll: boolean;
  /** Рівень зі стартової перевірки. */
  placement: string | null;
  /** Чи пройдено вступний урок про соробан. */
  introSeen: boolean;
  onLesson: () => void;
  /** Здобуті розряди (повністю пройдені світи). */
  ranks: Rank[];
  onCertificate: (world: string) => void;
  /** Пропозиція пройти стартову перевірку (для тих, хто ще не займався). */
  onPlacement: (() => void) | null;
  /** Скільки днів цього тижня вже були заняття. */
  weekDays: number;
  /** План «Заняття на сьогодні». */
  plan: DailyPart[];
  onStart: (setup: LessonSetup) => void;
  onCards: (setup: CardSetup) => void;
  onCustomize: (skill: SkillId) => void;
}

/** Заняття на сьогодні: розминка, повторення старого й поточний рівень — по одній кнопці на частину. */
function Daily({ plan, onStart, onCards }: Pick<Props, "plan" | "onStart" | "onCards">) {
  const allDone = plan.every((part) => part.done);
  const next = plan.find((part) => !part.done);
  return (
    <section className="daily">
      <h2>{allDone ? "На сьогодні все зроблено! 🎉" : "Заняття на сьогодні"}</h2>
      <ol className="daily-list">
        {plan.map((part) => (
          <li key={part.id} className={`daily-part${part.done ? " daily-done" : ""}`}>
            <span className="daily-mark">{part.done ? "✅" : part === next ? "▶" : "•"}</span>
            <div className="daily-text">
              <b>{part.title}</b>
              <span>{part.detail}</span>
            </div>
            <button
              className={`btn${part === next ? "" : " btn-quiet"}`}
              onClick={() => (part.id === "cards" ? onCards(part.cards) : onStart(part.lesson))}
            >
              {part.done ? "Ще раз" : "Почати"}
            </button>
          </li>
        ))}
      </ol>
      {allDone && <p className="note">Можна будувати острів або потренуватися ще — за бажанням.</p>}
    </section>
  );
}

/** Вогнище показує накопичену активність тижня; пропущений день його не гасить. */
function Campfire({ days }: { days: number }) {
  const done = days >= WEEK_GOAL;
  return (
    <div className={`campfire${done ? " campfire-done" : ""}`}>
      <div className="campfire-logs" aria-hidden="true">
        {Array.from({ length: WEEK_GOAL }, (_, index) => (
          <span key={index} className={index < days ? "log log-lit" : "log"}>
            {index < days ? "🔥" : ""}
          </span>
        ))}
      </div>
      <span>
        {done
          ? `Вогнище палає: цього тижня вже ${days} ${days <= 4 ? "дні" : "днів"} із заняттями!`
          : `Вогнище тижня: ${days} з ${WEEK_GOAL} днів із заняттями`}
      </span>
    </div>
  );
}

export function MapScreen(props: Props) {
  const { skills, unlockAll, placement, onPlacement, weekDays, plan, onStart, onCards, onCustomize } = props;
  const { introSeen, onLesson, ranks, onCertificate } = props;
  const topRank = ranks[ranks.length - 1];
  const states = useMemo(() => levelStates(skills, unlockAll, placement), [skills, unlockAll, placement]);
  const byskill = useMemo(() => new Map(states.map((state) => [state.id, state])), [states]);
  const current = currentLevel(states);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedState = selected ? byskill.get(selected) : undefined;

  return (
    <div className="map">
      <Hero event="greet" variant={new Date().getDate()} />
      <Campfire days={weekDays} />
      <div className="campfire rank-strip">
        <span>
          🏅{" "}
          {topRank
            ? `${topRank.number}-й розряд — «${topRank.title}»`
            : "Розряду ще немає: перший дають за повністю пройдений Ліс"}
        </span>
        {introSeen && (
          <button className="btn btn-quiet" onClick={onLesson}>
            📖 Урок про соробан
          </button>
        )}
      </div>
      {!introSeen && (
        <div className="banner banner-resume">
          <span>Спершу познайомся із соробаном: як він збудований і якими пальцями рухати кісточки.</span>
          <button className="btn" onClick={onLesson}>
            Відкрити урок ▶
          </button>
        </div>
      )}
      {onPlacement && (
        <div className="banner banner-resume">
          <span>Доня вже вміє рахувати на абакусі? Коротка перевірка підкаже, з якого рівня почати.</span>
          <button className="btn btn-quiet" onClick={onPlacement}>
            Перевірити рівень
          </button>
        </div>
      )}
      <Daily plan={plan} onStart={onStart} onCards={onCards} />
      {WORLDS.map((world) => {
        const levels = world.levels.map((level) => byskill.get(level.id)!);
        const done = levels.filter((level) => level.status === "mastered").length;
        return (
          <section key={world.id} className={`world world-${world.id}`}>
            <header className="world-head">
              <div>
                <h2>{world.title}</h2>
                <p>{world.subtitle}</p>
              </div>
              <span className="world-count">
                {done} / {levels.length} ⭐
                {ranks.some((rank) => rank.world.id === world.id) && (
                  <button className="btn btn-quiet world-cert" onClick={() => onCertificate(world.id)}>
                    🏅 Грамота
                  </button>
                )}
              </span>
            </header>
            <div className="tiles">
              {levels.map((level) => (
                <button
                  key={level.id}
                  className={`tile tile-${level.status}${level.id === current ? " tile-current" : ""}${level.id === selected ? " tile-selected" : ""}`}
                  onClick={() => setSelected(level.id)}
                  aria-label={`Рівень ${levelLabel(level.id)}${level.id === current ? ", ти тут" : ""}`}
                >
                  {level.id === current && (
                    <span className="tile-you" aria-hidden="true">
                      <Avatar variant="head" />
                    </span>
                  )}
                  <span className="tile-label">{levelLabel(level.id)}</span>
                  <span className="tile-icon">
                    {level.skipped ? "⏭" : ICONS[level.status]}
                    {level.mental.status === "mastered" ? "🧠" : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {selectedState && (
        <LevelCard
          state={selectedState}
          onStart={onStart}
          onCustomize={onCustomize}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
