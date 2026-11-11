import { type ChangeEvent, useRef, useState } from "react";
import { describeSkill } from "../../core/rules/skills";
import { localDay } from "../../game/progress/progress";
import { BEFORE_IMPORT_KEY, browserStore, writeSave } from "../../storage/localStore";
import { type SaveData, parseExportText, toExportText } from "../../storage/save";

interface Props {
  save: SaveData;
  onReplace: (save: SaveData) => void;
  onExported: (at: string) => void;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Історія занять і резервна копія — частина для батьків. */
export function BackupPanel({ save, onReplace, onExported }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recent = save.history.slice(-5).reverse();

  const exportFile = () => {
    const now = new Date();
    download(`mental-math-${localDay(now)}.json`, toExportText(save, now));
    onExported(now.toISOString());
    setMessage("Файл резервної копії збережено. Тримайте його поза цим браузером.");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const imported = parseExportText(await file.text());
    if (!imported) {
      setMessage("Цей файл не схожий на резервну копію застосунку. Прогрес не змінено.");
      return;
    }
    const question =
      `У файлі ${imported.history.length} занять, зараз у застосунку ${save.history.length}.\n` +
      "Замінити поточний прогрес даними з файлу?";
    if (!window.confirm(question)) return;
    const kept = writeSave(browserStore(), save, BEFORE_IMPORT_KEY);
    onReplace(imported);
    setMessage(
      kept
        ? "Прогрес відновлено з файлу. Попередні дані відкладено в цьому браузері про всяк випадок."
        : "Прогрес відновлено з файлу.",
    );
  };

  return (
    <section className="panel">
      <h2>Історія та резервна копія</h2>

      {recent.length === 0 ? (
        <p className="note">Занять ще не було.</p>
      ) : (
        <>
          <p className="note">Усього занять: {save.history.length}. Останні:</p>
          <ul className="history">
            {recent.map((record) => (
              <li key={record.id}>
                <span>{formatDate(record.finishedAt)}</span>
                <span>
                  {record.mode === "mental" ? "🧠" : "🧮"}{" "}
                  {record.review ? "Повторення" : record.topic === "simple" ? "Прямі рухи" : describeSkill(record.topic)}
                </span>
                <b>
                  {record.clean} з {record.total}
                </b>
                {record.partial && <em>перервано</em>}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="note">
        Прогрес зберігається лише в цьому браузері на цьому пристрої і не синхронізується. Браузер може його
        видалити, тому час від часу зберігайте резервну копію у файл.
        {save.lastExportAt
          ? ` Остання копія: ${formatDate(save.lastExportAt)}.`
          : save.history.length > 0 && " Копії ще не було."}
      </p>

      <div className="row">
        <button className="btn btn-quiet" onClick={exportFile}>
          ⬇ Зберегти копію у файл
        </button>
        <button className="btn btn-quiet" onClick={() => fileInput.current?.click()}>
          ⬆ Відновити з файлу
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
      </div>
      {message && <p className="banner">{message}</p>}
    </section>
  );
}
