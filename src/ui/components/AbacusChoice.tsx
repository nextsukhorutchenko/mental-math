import { useContext, useEffect, useState } from "react";
import { PlayerContext } from "../player";
import { Modal } from "./Modal";

/** Скільки секунд кнопка у верхній панелі світиться, щоб її помітили. */
export const ATTENTION_SECONDS = 7;

/**
 * Перемикач у верхній панелі біля аватара: «є абакус» чи «нема абакуса».
 * Від нього залежить, як ідуть заняття на абакусі. Після відкриття застосунку
 * кнопка кілька секунд блимає червоною рамкою, щоб її помітили.
 */
export function AbacusToggle() {
  const { screenAbacus, onScreenAbacus } = useContext(PlayerContext);
  const [attention, setAttention] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setAttention(false), ATTENTION_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!onScreenAbacus) return null;
  const label = screenAbacus ? "Абакуса нема — рахуємо на екрані" : "Є справжній абакус";
  return (
    <button
      className={`btn btn-quiet abacus-toggle${screenAbacus ? " abacus-toggle-screen" : ""}${attention ? " attention" : ""}`}
      aria-pressed={!screenAbacus}
      aria-label={`${label}. Натисни, щоб змінити`}
      title={`${label}. Натисни, щоб змінити`}
      onClick={() => {
        setAttention(false);
        onScreenAbacus(!screenAbacus);
      }}
    >
      <span aria-hidden="true">{screenAbacus ? "📱" : "🧮"}</span>
      <span className="abacus-toggle-text">{screenAbacus ? "Без абакуса" : "Є абакус"}</span>
    </button>
  );
}

/** Вибір, на чому рахувати «на абакусі»: на справжньому чи на екранному. Запам'ятовується для всіх занять. */
export function AbacusChoice() {
  const { screenAbacus, onScreenAbacus } = useContext(PlayerContext);
  if (!onScreenAbacus) return null;
  return (
    <div className="choice" role="radiogroup" aria-label="Який абакус">
      <button
        role="radio"
        aria-checked={!screenAbacus}
        className={`chip${screenAbacus ? "" : " chip-active"}`}
        onClick={() => onScreenAbacus(false)}
      >
        🧮 Мій справжній абакус
      </button>
      <button
        role="radio"
        aria-checked={screenAbacus}
        className={`chip${screenAbacus ? " chip-active" : ""}`}
        onClick={() => onScreenAbacus(true)}
      >
        📱 Абакус на екрані
      </button>
    </div>
  );
}

/**
 * Питання при першому вході: є вдома справжній абакус чи рахуємо на екранному.
 * Закриття без вибору лишає справжній абакус — основний шлях навчання.
 */
export function AbacusWelcome({ onPick }: { onPick: (screenAbacus: boolean) => void }) {
  return (
    <Modal title="Чим будемо рахувати?" onClose={() => onPick(false)}>
      <p className="lead">Скажи, чи є в тебе вдома абакус. Від цього залежить, як підуть заняття.</p>
      <div className="abacus-cards">
        <button className="abacus-card abacus-card-main" onClick={() => onPick(false)}>
          <span className="abacus-card-icon" aria-hidden="true">
            🧮
          </span>
          <b>Є абакус</b>
          <span>Рахую на справжньому соробані пальцями — так найкраще.</span>
        </button>
        <button className="abacus-card" onClick={() => onPick(true)}>
          <span className="abacus-card-icon" aria-hidden="true">
            📱
          </span>
          <b>Без абакуса</b>
          <span>Пересуваю кісточки на екрані дотиком.</span>
        </button>
      </div>
      <p className="note">Передумаєш — перемкни кнопкою «🧮 Є абакус» угорі екрана.</p>
    </Modal>
  );
}
