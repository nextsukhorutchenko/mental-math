import { useEffect, useMemo, useState } from "react";
import { GeneratorError, generateDrill } from "../core/generator/generator";
import { creditCards } from "../game/cards/cards";
import { levelById } from "../game/curriculum/levels";
import { type CardSetup, DEFAULT_CARDS } from "../game/cards/types";
import { earnedRanks, levelStates } from "../game/curriculum/curriculum";
import { dailyPlan } from "../game/curriculum/daily";
import { creditFlash } from "../game/flash/flash";
import { closeActive, creditSession, restoreSession } from "../game/progress/progress";
import type { Bonus, Loot } from "../game/rewards/blocks";
import { weekActiveDays } from "../game/rewards/rewards";
import type { Session } from "../game/session/session";
import { type LessonSetup, mentalTryout, toDrillConfig } from "../game/session/setup";
import { browserStore, loadSave, writeSave } from "../storage/localStore";
import { DEFAULT_CHILD_NAME, type SaveData } from "../storage/save";
import {
  HOLIDAYS,
  type HolidayId,
  activeHoliday,
  chooseHoliday,
  greeting,
  seasonOf,
} from "../game/seasons/seasons";
import { type Player, PlayerBadge, PlayerContext, SkinPicker } from "./components/Avatar";
import { Backdrop } from "./components/Backdrop";
import { PetPicker } from "./components/Companion";
import { AbacusToggle } from "./components/AbacusChoice";
import { claimQuests } from "../game/island/quests";
import { CardsScreen } from "./screens/CardsScreen";
import { CertificateScreen } from "./screens/CertificateScreen";
import { FlashScreen } from "./screens/FlashScreen";
import { SorobanLessonScreen } from "./screens/SorobanLessonScreen";
import { IslandScreen } from "./screens/IslandScreen";
import { LessonScreen, Summary } from "./screens/LessonScreen";
import { MapScreen } from "./screens/MapScreen";
import { ParentsScreen } from "./screens/ParentsScreen";
import { PlacementScreen } from "./screens/PlacementScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { registerServiceWorker } from "./pwa";
import { playSound, setSoundEnabled } from "./sound";

type Tab = "map" | "cards" | "island" | "trainer" | "parents";
type Screen = Tab | "lesson" | "summary" | "placement" | "soroban" | "flash" | "certificate";

interface Finished {
  session: Session;
  setup: LessonSetup;
  earned: Loot;
  bonuses: Bonus[];
}

const TABS: { id: Tab; label: string }[] = [
  { id: "map", label: "🗺 Карта" },
  { id: "cards", label: "🃏 Картки" },
  { id: "island", label: "🏝 Острів" },
  { id: "trainer", label: "🎯 Тренажер" },
  { id: "parents", label: "👪 Для батьків" },
];

export function App() {
  const [loaded] = useState(() => loadSave(browserStore()));
  const [save, setSave] = useState<SaveData>(loaded.data);
  const [saveFailed, setSaveFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>("map");
  const [finished, setFinished] = useState<Finished | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Тема, з якою тренажер відкрили з картки рівня. */
  /** Тема, з якою тренажер відкрили з картки рівня: прийом або рівень множення чи ділення. */
  const [presetTopic, setPresetTopic] = useState<string | null>(null);
  /** Набір карток, запущений із плану дня: стартує одразу; key перезапускає екран. */
  /** Світ, грамоту за який зараз показуємо. */
  const [certWorld, setCertWorld] = useState<string | null>(null);
  const [cardsRun, setCardsRun] = useState<{ setup: CardSetup; key: number } | null>(null);
  const [pickingSkin, setPickingSkin] = useState(false);
  const [pickingPet, setPickingPet] = useState(false);

  // Кожна зміна прогресу одразу пишеться в сховище; невдачу показуємо батькам.
  useEffect(() => {
    setSaveFailed(!writeSave(browserStore(), save));
  }, [save]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    setSoundEnabled(save.sound);
  }, [save.sound]);

  // Завдання будівельника, виконані ще до їх появи (чи на іншому пристрої), нагороджуються одразу.
  useEffect(() => {
    setSave((current) => claimQuests(current));
  }, []);

  // Фон: пора року — сама за місяцем; святковий — коли його ввімкнули.
  const today = new Date();
  const season = seasonOf(today);
  const holiday = activeHoliday(save.backdrop, today);
  useEffect(() => {
    document.documentElement.dataset.scene = holiday ?? season;
  }, [holiday, season]);
  const setBackdrop = (id: HolidayId | null) =>
    setSave((current) => ({ ...current, backdrop: id ? chooseHoliday(id, new Date(), current.birthday) : null }));

  // Нова версія застосунку чекає, доки її не приймуть: посеред заняття нічого не перезавантажується.
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  useEffect(() => {
    registerServiceWorker((apply) => setApplyUpdate(() => apply));
  }, []);

  // Дата здобуття розряду фіксується в момент, коли світ уперше пройдено повністю.
  useEffect(() => {
    const fresh = earnedRanks(levelStates(save.skills, save.unlockAll, save.placement)).filter(
      (rank) => !save.rankDates[rank.world.id],
    );
    if (fresh.length === 0) return;
    const now = new Date().toISOString();
    setSave((current) => ({
      ...current,
      rankDates: { ...current.rankDates, ...Object.fromEntries(fresh.map((rank) => [rank.world.id, now])) },
    }));
  }, [save.skills, save.unlockAll, save.placement, save.rankDates]);

  const active = save.active;
  // Приклади незавершеного заняття відтворюються з seed, тому перераховуємо лише для нового заняття.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restored = useMemo(() => (active ? restoreSession(active) : null), [active?.id]);
  const session: Session | null =
    active && restored
      ? { drill: restored.drill, index: active.index, results: active.results, current: active.current, status: active.status }
      : null;

  /** remember = false — заняття з карти чи разова проба, що не змінює налаштування тренажера. */
  const start = (setup: LessonSetup, remember: boolean) => {
    const now = new Date();
    try {
      const drill = generateDrill(toDrillConfig(setup));
      const id = `${now.getTime()}-${drill.seed}`;
      setSave((current) => ({
        ...closeActive(current, now),
        setup: remember ? setup : current.setup,
        active: {
          id,
          setup,
          config: { ...drill.config, seed: drill.seed },
          // Повторення — це вже знайомі прийоми, пояснення теми для нього не показуємо.
          started: !!setup.review,
          index: 0,
          results: [],
          current: { answers: [], solved: false, hintUsed: false },
          status: "answering",
        },
      }));
      setError(null);
      setScreen("lesson");
    } catch (problem) {
      if (!(problem instanceof GeneratorError)) throw problem;
      if (remember) setSave((current) => ({ ...current, setup }));
      setError(problem.message);
      setScreen("trainer");
    }
  };

  const updateSession = (next: Session) => {
    if (!active) return;
    const { id, setup } = active;
    if (next.status === "finished") {
      const credit = {
        id,
        finishedAt: new Date(),
        topic: setup.topic,
        mode: setup.mode,
        partial: false,
        review: !!setup.review,
        level: setup.level,
        pacing: setup.pacing,
        session: next,
      };
      // Зарахування, нагороди й закриття заняття — один запис; повтор із тим самим id нічого не змінить.
      setSave((current) => ({
        ...creditSession(current, credit),
        active: current.active?.id === id ? null : current.active,
      }));
      const record = creditSession(save, credit).history.find((item) => item.id === id);
      setFinished({ session: next, setup, earned: record?.earned ?? {}, bonuses: record?.bonuses ?? [] });
      playSound("finish");
      setScreen("summary");
      // Просимо браузер не видаляти дані застосунку без потреби.
      void navigator.storage?.persist?.().catch(() => false);
      return;
    }
    const { index, results, current: currentResult, status } = next;
    setSave((current) =>
      current.active?.id === id
        ? { ...current, active: { ...current.active, index, results, current: currentResult, status } }
        : current,
    );
  };

  const finishCards = (setup: CardSetup, results: boolean[]): Loot => {
    const now = new Date();
    const credit = { id: `cards-${now.getTime()}`, finishedAt: now, setup, results };
    setSave((current) => creditCards(current, credit));
    return creditCards(save, credit).cardLog.find((record) => record.id === credit.id)?.earned ?? {};
  };

  const openCertificate = (world: string) => {
    setCertWorld(world);
    setScreen("certificate");
  };

  const markStarted = () =>
    setSave((current) => (current.active ? { ...current, active: { ...current.active, started: true } } : current));

  const openTab = (tab: Tab) => {
    if (tab !== "trainer") setPresetTopic(null);
    if (tab === "cards") setCardsRun(null);
    setScreen(tab);
  };

  const inLesson = screen === "lesson" && active && session;
  const inSummary = screen === "summary" && finished;
  const inPlacement = screen === "placement";
  // Екрани на весь застосунок: без вкладок і банерів.
  const inOverlay = inPlacement || screen === "soroban" || screen === "flash" || screen === "certificate";
  const tab: Tab =
    screen === "map" || screen === "cards" || screen === "island" || screen === "trainer" || screen === "parents"
      ? screen
      : screen === "flash"
        ? "trainer"
        : "map";
  const states = useMemo(
    () => levelStates(save.skills, save.unlockAll, save.placement),
    [save.skills, save.unlockAll, save.placement],
  );
  const ranks = useMemo(() => earnedRanks(states), [states]);
  const certificate = ranks.find((rank) => rank.world.id === certWorld) ?? null;
  const trainerSetup: LessonSetup = !presetTopic
    ? save.setup
    : levelById(presetTopic)?.skill
      ? { ...save.setup, topic: levelById(presetTopic)!.skill!, level: undefined }
      : { ...save.setup, topic: "simple", level: presetTopic, pacing: "all" };

  const player: Player = {
    name: save.childName.trim() || DEFAULT_CHILD_NAME,
    skin: save.skin,
    pet: save.pet,
    screenAbacus: save.screenAbacus,
    onScreenAbacus: (screenAbacus) => setSave((current) => ({ ...current, screenAbacus })),
    onPickSkin: () => setPickingSkin(true),
    onPickPet: () => setPickingPet(true),
    onRename: (childName) => setSave((current) => ({ ...current, childName })),
  };

  return (
    <PlayerContext.Provider value={player}>
    <Backdrop season={season} holiday={holiday} />
    {pickingSkin && (
      <SkinPicker
        onPick={(skin) => {
          setSave((current) => ({ ...current, skin }));
          setPickingSkin(false);
        }}
        onClose={() => setPickingSkin(false)}
      />
    )}
    {pickingPet && (
      <PetPicker
        onPick={(pet) => {
          setSave((current) => ({ ...current, pet }));
          setPickingPet(false);
        }}
        onClose={() => setPickingPet(false)}
      />
    )}
    <div className="app">
      {holiday && !inLesson && (
        <p className="holiday-ribbon">
          {HOLIDAYS[holiday].icon} {greeting(holiday, today, save.childName.trim() || DEFAULT_CHILD_NAME)}{" "}
          {HOLIDAYS[holiday].icon}
        </p>
      )}
      <header className="topbar">
        <div className="logo" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <h1>Ментальна математика</h1>
        <div className="topbar-actions">
          <PlayerBadge />
          <AbacusToggle />
          <button
            className="btn btn-quiet"
            aria-pressed={save.sound}
            aria-label={save.sound ? "Вимкнути звук" : "Увімкнути звук"}
            onClick={() => setSave((current) => ({ ...current, sound: !current.sound }))}
          >
            {save.sound ? "🔊" : "🔇"}
          </button>
          {inLesson && (
            <button className="btn btn-quiet" onClick={() => setScreen("map")}>
              ✕ Вийти
            </button>
          )}
        </div>
      </header>

      {applyUpdate && !inLesson && (
        <div className="banner banner-resume">
          <span>Є нова версія застосунку. Прогрес збережеться.</span>
          <button className="btn" onClick={applyUpdate}>
            Оновити
          </button>
        </div>
      )}

      {loaded.warning && <p className="banner banner-error">{loaded.warning}</p>}
      {saveFailed && !loaded.warning && (
        <p className="banner banner-error">
          Не вдалося зберегти прогрес у браузері. Збережіть резервну копію у файл, щоб нічого не втратити.
        </p>
      )}

      {!inLesson && !inSummary && !inOverlay && (
        <nav className="tabs" aria-label="Розділи">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`tab${item.id === tab ? " tab-active" : ""}`}
              aria-current={item.id === tab ? "page" : undefined}
              onClick={() => openTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {!inLesson && !inSummary && !inOverlay && active && session && (
        <div className="banner banner-resume">
          <span>
            Є незавершене тренування: приклад {active.index + 1} з {active.setup.exampleCount}.
          </span>
          <button className="btn" onClick={() => setScreen("lesson")}>
            Продовжити ▶
          </button>
        </div>
      )}

      <main>
        {inLesson ? (
          <LessonScreen
            key={active.id}
            setup={active.setup}
            started={active.started}
            session={session}
            onStart={markStarted}
            onSession={updateSession}
          />
        ) : inSummary ? (
          <Summary
            session={finished.session}
            topic={finished.setup.topic}
            review={finished.setup.review}
            mode={finished.setup.mode}
            earned={finished.earned}
            bonuses={finished.bonuses}
            onRepeat={() => start(finished.setup, false)}
            onMentalTry={() => start(mentalTryout(finished.setup), false)}
            onExit={() => setScreen("map")}
          />
        ) : screen === "trainer" ? (
          <SetupScreen
            key={JSON.stringify(trainerSetup)}
            initial={trainerSetup}
            skills={save.skills}
            active={session ? active : null}
            error={error}
            onStart={(setup) => start(setup, true)}
            onFlash={() => setScreen("flash")}
          />
        ) : screen === "soroban" ? (
          <SorobanLessonScreen
            onDone={() => {
              setSave((current) => ({ ...current, introSeen: true }));
              setScreen("map");
            }}
          />
        ) : screen === "flash" ? (
          <FlashScreen
            best={save.flashBest}
            onResult={(level, correctRounds) => setSave((current) => creditFlash(current, level, correctRounds))}
            onExit={() => setScreen("trainer")}
          />
        ) : screen === "certificate" && certificate ? (
          <CertificateScreen
            rank={certificate}
            childName={save.childName}
            earnedAt={save.rankDates[certificate.world.id]}
            onClose={() => setScreen("map")}
          />
        ) : inPlacement ? (
          <PlacementScreen
            onApply={(placement) => {
              setSave((current) => ({ ...current, placement }));
              setScreen("map");
            }}
            onCancel={() => setScreen("map")}
          />
        ) : tab === "cards" ? (
          <CardsScreen
            key={cardsRun?.key ?? 0}
            initial={cardsRun?.setup ?? DEFAULT_CARDS}
            autostart={cardsRun !== null}
            onFinish={finishCards}
            onExit={() => setScreen("map")}
          />
        ) : tab === "island" ? (
          <IslandScreen
            world={{ inventory: save.inventory, plots: save.plots }}
            questsDone={save.questsDone}
            onChange={(world) => setSave((current) => claimQuests({ ...current, ...world }))}
          />
        ) : tab === "parents" ? (
          <ParentsScreen
            save={save}
            onReplace={setSave}
            onExported={(at) => setSave((current) => ({ ...current, lastExportAt: at }))}
            onUnlockAll={(unlockAll) => setSave((current) => ({ ...current, unlockAll }))}
            ranks={ranks}
            onCertificate={openCertificate}
            onChildName={(childName) => setSave((current) => ({ ...current, childName }))}
            season={season}
            holiday={holiday}
            onBackdrop={setBackdrop}
            onBirthday={(birthday) => setSave((current) => ({ ...current, birthday }))}
            onPlacement={() => setScreen("placement")}
            onResetPlacement={() => setSave((current) => ({ ...current, placement: null }))}
          />
        ) : (
          <MapScreen
            skills={save.skills}
            unlockAll={save.unlockAll}
            placement={save.placement}
            introSeen={save.introSeen}
            onLesson={() => setScreen("soroban")}
            ranks={ranks}
            onCertificate={openCertificate}
            onPlacement={
              save.placement === null && save.history.length === 0 && Object.keys(save.skills).length === 0
                ? () => setScreen("placement")
                : null
            }
            weekDays={weekActiveDays([...save.history, ...save.cardLog], new Date())}
            plan={dailyPlan(save, new Date())}
            onCards={(setup) => {
              setCardsRun({ setup, key: Date.now() });
              setScreen("cards");
            }}
            onStart={(setup) => start(setup, false)}
            onCustomize={(skill) => {
              setPresetTopic(skill);
              setScreen("trainer");
            }}
          />
        )}
      </main>
    </div>
    </PlayerContext.Provider>
  );
}
