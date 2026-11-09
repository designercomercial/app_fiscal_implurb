/*
 * Service worker mínimo: permite ABRIR a página sem internet.
 * - Navegação (HTML): rede primeiro; sem rede, a última versão guardada.
 * - /_next/static (JS/CSS com hash): cache primeiro.
 * - /api: nunca passa pelo cache do SW (a lista offline vem do localStorage, com o horário).
 */
const CACHE = "lf-acoes-do-dia-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (salvo) =>
          salvo ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: req.mode === "navigate" })
          .then((salvo) => salvo || Response.error()),
      ),
  );
});
