import { type ReactNode, useEffect } from "react";

/** Вікно поверх застосунку: закривається хрестиком, Esc або дотиком поза ним. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <section className="panel skin-picker" onClick={(event) => event.stopPropagation()}>
        <div className="skin-picker-head">
          <h2>{title}</h2>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
