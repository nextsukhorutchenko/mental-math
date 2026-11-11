import type { Rank } from "../../game/curriculum/curriculum";

interface Props {
  rank: Rank;
  childName: string;
  /** Дата, коли розряд здобуто (ISO). */
  earnedAt: string | undefined;
  onClose: () => void;
}

/** Грамота за пройдений світ. Друкується засобами браузера: на папері лишається тільки вона. */
export function CertificateScreen({ rank, childName, earnedAt, onClose }: Props) {
  const date = new Date(earnedAt ?? Date.now()).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
  return (
    <section className="panel certificate-wrap">
      <div className="certificate">
        <p className="certificate-top">Ментальна математика</p>
        <h2>Грамота</h2>
        <p className="certificate-name">{childName.trim() || "______________________"}</p>
        <p className="certificate-text">
          успішно пройшла світ «{rank.world.title}» ({rank.world.subtitle.toLowerCase()}) і здобула
        </p>
        <p className="certificate-rank">
          {rank.number}-й розряд — «{rank.title}»
        </p>
        <p className="certificate-date">{date}</p>
      </div>
      <p className="note no-print">
        {childName.trim()
          ? "Ім'я береться з розділу «Для батьків»."
          : "Ім'я можна вписати від руки або вказати в розділі «Для батьків»."}{" "}
        Розряди застосунку власні, а не офіційні кю чи дан.
      </p>
      <div className="row no-print">
        <button className="btn btn-big" onClick={() => window.print()}>
          🖨 Надрукувати
        </button>
        <button className="btn btn-quiet" onClick={onClose}>
          Закрити
        </button>
      </div>
    </section>
  );
}
