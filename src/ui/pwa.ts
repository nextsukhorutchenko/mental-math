/**
 * Офлайн-робота: service worker кешує застосунок цілком (див. vite.config.ts).
 * Нова версія встановлюється у фоні й чекає; onUpdate отримує функцію, яка її вмикає.
 * У режимі розробки service worker не реєструється, щоб не кешувати змінювані файли.
 */
export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const offer = (registration: ServiceWorkerRegistration) => {
    // Якщо сторінкою ще ніхто не керує — це перше встановлення, а не оновлення.
    if (!registration.waiting || !navigator.serviceWorker.controller) return;
    onUpdate(() => {
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      registration.waiting?.postMessage("skip-waiting");
    });
  };

  navigator.serviceWorker
    .register("sw.js")
    .then((registration) => {
      const watch = (worker: ServiceWorker | null) =>
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") offer(registration);
        });
      offer(registration);
      // Оновлення могло початися ще до цього рядка — тоді подія updatefound уже минула.
      watch(registration.installing);
      registration.addEventListener("updatefound", () => watch(registration.installing));
    })
    .catch(() => {
      // Без service worker застосунок працює як звичайна сторінка.
    });
}
