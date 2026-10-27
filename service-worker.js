/* Service worker — Apontamento de Campo (v8).
   Estratégia "rede primeiro": com internet, sempre busca a versão mais nova
   dos arquivos (e atualiza o cache); sem internet, usa o cache. Assim as
   atualizações do app chegam sozinhas aos celulares. */
const CACHE_NAME = "apontamento-campo-v8";
const ARQUIVOS = ["./", "./index.html", "./app.js?v=7", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ns) => Promise.all(ns.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copia = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(e.request, copia)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match("./index.html")))
  );
});
