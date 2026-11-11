import { describeSkill } from "../../core/rules/skills";
import type { Mastery } from "../../game/progress/progress";
import { skillRows, weakSpots, weekStats } from "../../game/progress/stats";
import type { SaveData } from "../../storage/save";
import { BackupPanel } from "./BackupPanel";

const WEEKDAYS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
const skillName = (skill: string) => (skill === "simple" ? "Прямі рухи" : describeSkill(skill as never));
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function masteryCell(mastery: Mastery): string {
  if (mastery.status === "new") return "—";
  return `${mastery.correct} / ${mastery.needCorrect}${mastery.status === "mastered" ? " ⭐" : ""}`;
}

interface Props {
  save: SaveData;
  onReplace: (save: SaveData) => void;
  onExported: (at: string) => void;
  onUnlockAll: (value: boolean) => void;
}

export function ParentsScreen({ save, onReplace, onExported, onUnlockAll }: Props) {
  const week = weekStats(save.history, new Date());
  const rows = skillRows(save.skills);
  const weak = weakSpots(save.skills);
  const busiest = Math.max(1, ...week.days.map((day) => day.examples));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentCards = save.cardLog.filter((record) => Date.parse(record.finishedAt) >= weekAgo);
  const cardsTotal = recentCards.reduce((sum, record) => sum + record.total, 0);
  const cardsCorrect = recentCards.reduce((sum, record) => sum + record.correct, 0);

  return (
    <>
      <section className="panel">
        <h2>Останні 7 днів</h2>
        <div className="stats">
          <div className="stat">
            <b>{week.activeDays}</b> днів із заняттями
          </div>
          <div className="stat">
            <b>{week.examples}</b> прикладів у {week.sessions} заняттях
          </div>
          <div className="stat stat-good">
            <b>{week.examples === 0 ? "—" : percent(week.clean / week.examples)}</b> розв'язано самостійно
          </div>
        </div>
        <div className="week" aria-label="Приклади по днях">
          {week.days.map((day) => (
            <div key={day.day} className="week-day">
              <span className="week-value">{day.examples || ""}</span>
              <div className="week-bar" style={{ height: `${(day.examples / busiest) * 100}%` }} />
              <span>{WEEKDAYS[new Date(`${day.day}T12:00:00`).getDay()]}</span>
            </div>
          ))}
        </div>
        <p className="note">
          {cardsTotal === 0
            ? "Карток з абакусом за цей час не було."
            : `Картки з абакусом: ${cardsTotal} карток, правильно ${percent(cardsCorrect / cardsTotal)}.`}
        </p>
      </section>

      <section className="panel">
        <h2>Слабкі місця</h2>
        {weak.length === 0 ? (
          <p className="note">
            Поки немає прийомів, де з останніх спроб самостійно виходить менше 90%. Висновок робиться щонайменше
            з 10 застосувань.
          </p>
        ) : (
          <ul className="history">
            {weak.map((row) => (
              <li key={row.skill}>
                <b>{skillName(row.skill)}</b>
                <span>
                  самостійно {percent(row.recentAccuracy)} з останніх {row.recentCount} застосувань
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Прийоми</h2>
        {rows.length === 0 ? (
          <p className="note">Тут з'являться прийоми, які доня вже тренувала.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Прийом</th>
                  <th>🧮 На абакусі</th>
                  <th>Свіжа точність</th>
                  <th>🧠 Подумки</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.skill}>
                    <td>{skillName(row.skill)}</td>
                    <td>{masteryCell(row.physical)}</td>
                    <td>{percent(row.recentAccuracy)}</td>
                    <td>{masteryCell(row.mental)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">
          Число в колонках — самостійні застосування з потрібних для засвоєння. «Свіжа точність» — частка
          самостійних серед останніх 20 застосувань на абакусі.
        </p>
      </section>

      <section className="panel">
        <h2>Карта</h2>
        <label className="check">
          <input type="checkbox" checked={save.unlockAll} onChange={(event) => onUnlockAll(event.target.checked)} />
          <span>Відкрити всі рівні на карті, не чекаючи засвоєння попередніх</span>
        </label>
      </section>

      <BackupPanel save={save} onReplace={onReplace} onExported={onExported} />
    </>
  );
}
