/*! Caixa na Mão © 2026 Marcus Deleon™ – Tecnologia de Ponta. Todos os direitos reservados.
 *  Proibida a cópia, modificação ou distribuição sem autorização. Veja LICENSE. */

/*
 * Caixa na Mão — service worker: deixa o app funcionar sem internet.
 *
 * Estratégia "rede primeiro": com internet, busca a versão mais nova e guarda
 * uma cópia; sem internet, usa a cópia guardada.
 * Ao mudar os arquivos do app, aumente a VERSAO para limpar o cache antigo.
 */

const VERSAO = "caixa-na-mao-v5";

const ARQUIVOS = [
  "./",
  "./index.html",
  "./css/estilo.css",
  "./js/dinheiro.js",
  "./js/calculos.js",
  "./js/armazenamento.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
  "./icones/apple-touch-icon.png",
  "./icones/favicon-32.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then((cache) => cache.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
