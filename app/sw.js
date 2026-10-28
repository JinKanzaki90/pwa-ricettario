/* Service worker del Ricettario di famiglia: lettura senza rete del guscio dell'app.
   - All'installazione salva tutti i file del sito elencati in GUSCIO (la prova automatica controlla che l'elenco
     corrisponda ai file di app/).
   - Per i file del sito: prima la rete (così non resta mai una versione vecchia), e la copia salvata solo se la rete
     manca o non risponde entro ATTESA millisecondi; ogni risposta buona aggiorna la copia.
   - Le chiamate a Supabase (altro dominio) non passano di qui: i dati personali non finiscono in questa copia. */
const COPIA = 'ricettario-guscio';
const ATTESA = 4000;
const GUSCIO = [
  './',
  'index.html',
  'privacy.html',
  'manifest.webmanifest',
  'config.js',
  'css/stile.css',
  'js/accesso.js',
  'js/commenti.js',
  'js/copia.js',
  'js/dati.js',
  'js/dominio.js',
  'js/guida.js',
  'js/installa.js',
  'js/main.js',
  'js/modulo.js',
  'js/navigazione.js',
  'js/personali.js',
  'js/ricette.js',
  'js/settimana.js',
  'js/spesa.js',
  'js/stagione.js',
  'js/stato.js',
  'js/tema.js',
  'js/util.js',
  'vendor/supabase-js-2.117.3.esm.js',
  'data/acquisti.json',
  'data/dispensa.json',
  'data/settimana.json',
  'data/stagioni.json',
  'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  'fonts/bricolage-grotesque-latin-500-normal.woff2',
  'fonts/bricolage-grotesque-latin-700-normal.woff2',
  'icone/apple-touch-icon.png',
  'icone/favicon-32.png',
  'icone/icona-192.png',
  'icone/icona-512.png',
  'icone/icona-maskable-512.png',
  'icone/icona.svg'
];

function assoluto(p) { return new URL(p, self.registration.scope).href; }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(COPIA).then(function (c) {
    return c.addAll(GUSCIO.map(function (p) { return new Request(assoluto(p), { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

/* via dalla copia i file che non fanno più parte del sito */
self.addEventListener('activate', function (e) {
  const validi = GUSCIO.map(assoluto);
  e.waitUntil(caches.keys().then(function (nomi) {
    return Promise.all(nomi.filter(function (n) { return n !== COPIA && n.indexOf('ricettario-') === 0; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return caches.open(COPIA); }).then(function (c) {
    return c.keys().then(function (reqs) {
      return Promise.all(reqs.filter(function (r) { return validi.indexOf(r.url.split('?')[0]) < 0; }).map(function (r) { return c.delete(r); }));
    });
  }).then(function () { return self.clients.claim(); }));
});

function salva(req, risp) {
  if (!risp || !risp.ok || risp.type !== 'basic') return;
  const copia = risp.clone();
  caches.open(COPIA).then(function (c) { return c.put(req, copia); }).catch(function () { /* spazio esaurito: si resta con la copia vecchia */ });
}

function dallaCopia(req, pagina) {
  return caches.open(COPIA).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (r) {
      if (r || !pagina) return r;
      return c.match(assoluto('./'));
    });
  });
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || req.url.indexOf(self.registration.scope) !== 0) return;
  const pagina = req.mode === 'navigate';
  e.respondWith(new Promise(function (risolvi) {
    let fatto = false;
    function usaCopia(ripiego) {
      dallaCopia(req, pagina).then(function (r) {
        if (r) { fatto = true; risolvi(r); }
        else if (ripiego) { fatto = true; risolvi(ripiego); }
      });
    }
    const t = setTimeout(function () { if (!fatto) usaCopia(null); }, ATTESA);
    fetch(req).then(function (r) {
      clearTimeout(t);
      salva(req, r);
      if (fatto) return;
      if (r.ok || r.type !== 'basic') { fatto = true; risolvi(r); return; }
      usaCopia(r); /* errore del server: meglio la copia, se c'è */
    }).catch(function () {
      clearTimeout(t);
      if (fatto) return;
      dallaCopia(req, pagina).then(function (r) {
        fatto = true;
        risolvi(r || new Response('Senza connessione e senza una copia salvata di questo file.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }));
      });
    });
  }));
});
