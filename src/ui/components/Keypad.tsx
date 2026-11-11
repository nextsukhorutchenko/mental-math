import { useEffect } from "react";

interface Props {
  value: string;
  maxLength?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/** Велика цифрова клавіатура для планшета; працює і з фізичної клавіатури. */
export function Keypad({ value, maxLength = 5, disabled = false, onChange, onSubmit }: Props) {
  const press = (key: string) => {
    if (disabled) return;
    if (key === "back") onChange(value.slice(0, -1));
    else if (key === "ok") {
      if (value !== "") onSubmit();
    } else if (value.length < maxLength) onChange(value === "0" ? key : value + key);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") press("back");
      else if (event.key === "Enter") press("ok");
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        <button key={digit} className="key" disabled={disabled} onClick={() => press(digit)}>
          {digit}
        </button>
      ))}
      <button className="key key-back" disabled={disabled} onClick={() => press("back")} aria-label="Стерти">
        ⌫
      </button>
      <button className="key" disabled={disabled} onClick={() => press("0")}>
        0
      </button>
      <button className="key key-ok" disabled={disabled || value === ""} onClick={() => press("ok")}>
        OK
      </button>
    </div>
  );
}
