/* PWA: registrazione del service worker (sw.js) e «Aggiungi a schermata Home» in Impostazioni.
   Android e Chrome offrono l'installazione con un evento (beforeinstallprompt); Safari su iPhone no: lì si spiegano i tocchi. */
import { $, toast } from './util.js';

let richiesta = null; /* evento conservato per mostrare la finestra d'installazione al tocco */

function installata() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function suIos() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function aggiornaInstalla() {
  const gia = installata();
  $('inst-gia').hidden = !gia;
  $('inst-da-fare').hidden = gia;
  $('inst-btn').hidden = !richiesta;
  $('inst-ios').hidden = !!richiesta || !suIos();
  $('inst-altro').hidden = !!richiesta || suIos();
}

export function initInstalla() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {
        /* senza service worker l'app funziona lo stesso, solo non senza rete */
      });
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); richiesta = e; aggiornaInstalla();
  });
  window.addEventListener('appinstalled', function () {
    richiesta = null; aggiornaInstalla(); toast('Ricettario aggiunto alla schermata Home.');
  });
  $('inst-btn').addEventListener('click', function () {
    if (!richiesta) return;
    const r = richiesta; richiesta = null;
    r.prompt();
    r.userChoice.then(function (scelta) {
      if (scelta && scelta.outcome !== 'accepted') toast('Puoi installarla quando vuoi da qui.');
      aggiornaInstalla();
    }).catch(function () { aggiornaInstalla(); });
  });
  aggiornaInstalla();
}
