/* Settimana e spesa personali: lettura dal database, prima copia della settimana d'esempio,
   passaggio dei dati delle versioni precedenti (salvati sul browser) e scritture in fila, una dopo l'altra.
   Se una scrittura fallisce si mostra il motivo e si rilegge dal database, così lo schermo torna a dire il vero. */
import { carica, toast } from './util.js';
import { S, normShop, vecchiDati, togliVecchiDati } from './stato.js';
import { U } from './accesso.js';
import { segnaCopia, ripristinaPersonali } from './copia.js';
import { caricaSettimana, avviaSettimana, settimanaAvviata, caricaSpesa, porzioniInSpesa, aggiungiVoce, spunta, msgDb } from './dati.js';

let ridisegna = function () {};
export function quandoCambiano(fn) { ridisegna = fn; }

function esempio() { return S.SETT ? Promise.resolve(S.SETT) : carica('settimana.json').then(function (d) { S.SETT = d; return d; }); }

/* settimana d'esempio con i sostituti scelti nelle versioni precedenti (salvati sul browser) */
function esempioConSostituti(d, sost) {
  const c = JSON.parse(JSON.stringify(d));
  const tutti = [];
  c.giorni.forEach(function (g) { g.pasti.forEach(function (p) { tutti.push(p); }); });
  c.giorni.forEach(function (g) {
    g.pasti.forEach(function (p) {
      const nuovo = !p.avanzo_di && typeof sost[g.id + '|' + p.slot] === 'string' && sost[g.id + '|' + p.slot];
      if (!nuovo) return;
      tutti.forEach(function (q) { if (q.avanzo_di === g.id && q.id === p.id) q.id = nuovo; });
      p.id = nuovo;
    });
  });
  return c;
}

async function portaSulDatabase(vecchi, spesa) {
  const sp = vecchi.spesa;
  if (spesa.selezione.length || spesa.extra.length || (!sp.selezione.length && !sp.extra.length)) return false;
  for (const x of sp.selezione) await porzioniInSpesa(x.id, Math.min(60, x.porzioni)).catch(function () { /* ricetta non più esistente */ });
  for (const x of sp.extra) await aggiungiVoce(x.nome.slice(0, 80), x.reparto || 'dispensa');
  for (const k of sp.spunte) await spunta(k, true);
  return true;
}

let inLettura = null;
async function leggi(prima) {
  if (prima && !(await settimanaAvviata())) {
    const v = vecchiDati();
    await avviaSettimana(esempioConSostituti(await esempio(), v.sostituzioni));
  }
  let spesa = await caricaSpesa();
  if (prima) {
    if (await portaSulDatabase(vecchiDati(), spesa)) spesa = await caricaSpesa();
    togliVecchiDati();
  }
  S.MIA = await caricaSettimana();
  S.shop = normShop(spesa);
  S.personali = true; S.erroPers = '';
  S.lettoPers = Date.now();
  ridisegna();
}
export function ricaricaPersonali(prima) {
  if (!inLettura) inLettura = leggi(prima).finally(function () { inLettura = null; });
  return inLettura;
}
export function primaLetturaPersonali() {
  return ricaricaPersonali(true).catch(function (e) {
    S.personali = false; S.erroPers = msgDb(e); ridisegna();
  });
}

/* scritture in fila: l'ordine dei tocchi è l'ordine sul database */
let fila = Promise.resolve();
export function scrivi(fn) {
  fila = fila.then(fn).then(function () { segnaCopia(U); }).catch(function (e) {
    toast(msgDb(e));
    /* lo schermo torna a dire il vero: dal database o, senza rete, dall'ultima copia salvata */
    const daCopia = function () { if (U.utente && ripristinaPersonali(U.utente.id)) ridisegna(); };
    if (S.offline) { daCopia(); return; }
    return ricaricaPersonali(false).catch(daCopia);
  });
  return fila;
}

/* modifiche fatte da un altro dispositivo: si rileggono tornando su Settimana o Spesa, o sull'app */
const DOPO = 30000;
function forseRileggi() {
  if (!S.offline && S.personali && Date.now() - S.lettoPers > DOPO) ricaricaPersonali(false).catch(function () { /* resta la copia letta */ });
}
export function initPersonali() {
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-riprova-pers]'); if (!b) return;
    S.erroPers = ''; ridisegna(); primaLetturaPersonali();
  });
  document.addEventListener('rv-scheda', function (e) { if (e.detail === 'settimana' || e.detail === 'spesa') forseRileggi(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') forseRileggi(); });
}
