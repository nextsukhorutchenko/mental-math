import { useMemo, useState } from "react";
import { type SkillId, describeSkill, explainSkill } from "../../core/rules/skills";
import {
  type LevelState,
  WORLDS,
  currentLevel,
  levelLabel,
  levelStates,
  recommendLesson,
} from "../../game/curriculum/curriculum";
import type { Mastery } from "../../game/progress/progress";
import { WEEK_GOAL } from "../../game/rewards/rewards";
import { type LessonSetup, mentalTryout } from "../../game/session/setup";
import type { SaveData } from "../../storage/save";
import { Companion } from "../components/Companion";

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
        <h2>{state.skill === "simple" ? "Прямі рухи" : describeSkill(state.skill)}</h2>
        <button className="btn btn-quiet" onClick={onClose} aria-label="Закрити">
          ✕
        </button>
      </div>
      <p className="lead">{explainSkill(state.skill)}</p>
      {locked ? (
        <p className="note">🔒 Рівень відкриється, коли попередній буде засвоєно на абакусі.</p>
      ) : (
        <>
          <p className="note">{masteryLine("🧮 На абакусі", state.physical)}</p>
          <p className="note">{masteryLine("🧠 Подумки", state.mental)}</p>
          <div className="row">
            <button className="btn btn-big" onClick={() => onStart(next.setup)}>
              {next.title}: {next.setup.exampleCount} прикладів по {next.setup.actionsPerExample}{" "}
              {next.setup.actionsPerExample <= 4 ? "дії" : "дій"} ▶
            </button>
            {state.physical.status !== "new" && next.stage !== "mental" && (
              <button className="btn" onClick={() => onStart(mentalTryout(next.setup))}>
                🧠 5 коротких подумки
              </button>
            )}
            <button className="btn btn-quiet" onClick={() => onCustomize(state.skill)}>
              Налаштувати самому
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  skills: SaveData["skills"];
  unlockAll: boolean;
  /** Скільки днів цього тижня вже були заняття. */
  weekDays: number;
  onStart: (setup: LessonSetup) => void;
  onCustomize: (skill: SkillId) => void;
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

export function MapScreen({ skills, unlockAll, weekDays, onStart, onCustomize }: Props) {
  const states = useMemo(() => levelStates(skills, unlockAll), [skills, unlockAll]);
  const byskill = useMemo(() => new Map(states.map((state) => [state.skill, state])), [states]);
  const current = currentLevel(states);
  const [selected, setSelected] = useState<SkillId | null>(null);
  const selectedState = selected ? byskill.get(selected) : undefined;

  return (
    <div className="map">
      <Companion event="greet" variant={new Date().getDate()} />
      <Campfire days={weekDays} />
      {WORLDS.map((world) => {
        const levels = world.levels.map((skill) => byskill.get(skill)!);
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
              </span>
            </header>
            <div className="tiles">
              {levels.map((level) => (
                <button
                  key={level.skill}
                  className={`tile tile-${level.status}${level.skill === current ? " tile-current" : ""}${level.skill === selected ? " tile-selected" : ""}`}
                  onClick={() => setSelected(level.skill)}
                  aria-label={`Рівень ${levelLabel(level.skill)}`}
                >
                  <span className="tile-label">{levelLabel(level.skill)}</span>
                  <span className="tile-icon">
                    {ICONS[level.status]}
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
