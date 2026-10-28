/* Stato condiviso tra i moduli. Ricette, autori e archivio arrivano da Supabase (dati.js);
   sostituzioni della settimana e lista della spesa restano su questo browser fino al passo 5. */
import { $, store } from './util.js';

const LS_USR = 'rv-ricettario';
const LS_SHOP = 'rv-spesa';

/* stato personale su questo browser { sostituzioni:{'giorno|slot': id}, agg }
   (ricette personali, archivio ed eliminate dell'artifact non si usano più: ora stanno nel database) */
export function normUsr(s) {
  s = s || {};
  const sost = {};
  if (s.sostituzioni && typeof s.sostituzioni === 'object') {
    Object.keys(s.sostituzioni).forEach(function (k) { if (typeof s.sostituzioni[k] === 'string') sost[k] = s.sostituzioni[k]; });
  }
  return { sostituzioni: sost, agg: typeof s.agg === 'string' ? s.agg : '' };
}

/* lista della spesa { selezione:[{id, porzioni}], extra:[{nome, reparto}], spunte:[chiave], agg } */
export function normShop(s) {
  s = s || {};
  return {
    selezione: (Array.isArray(s.selezione) ? s.selezione : []).filter(function (x) { return x && x.id && x.porzioni > 0; }),
    extra: (Array.isArray(s.extra) ? s.extra : []).filter(function (x) { return x && x.nome; }),
    spunte: (Array.isArray(s.spunte) ? s.spunte : []).filter(function (x) { return typeof x === 'string'; }),
    agg: typeof s.agg === 'string' ? s.agg : ''
  };
}

function leggiJSON(k, norm) {
  try { return norm(JSON.parse(store(k) || 'null')); } catch (e) { return norm(null); }
}

let persIniz = parseInt(store('rv-sett-pers'), 10);
if (!(persIniz >= 1 && persIniz <= 6)) persIniz = 2;

/* S è l'unico oggetto mutabile condiviso: i moduli leggono e scrivono S.campo */
export const S = {
  RICETTE: [],       /* ricette fuori dal cestino; le archiviate restano (settimana e spesa le usano) */
  CESTINO: [],       /* ricette nel cestino, dalla più recente */
  ARCH: [],          /* id delle ricette nel proprio archivio */
  AUTORI: {},        /* id utente → nome visualizzato */
  caricate: false,
  letto: 0,          /* quando sono state lette le ricette dal database (ms) */
  usr: leggiJSON(LS_USR, normUsr),
  shop: leggiJSON(LS_SHOP, normShop),
  SETT: null,        /* settimana d'esempio */
  DISP: null,        /* dispensa di base */
  CAL: null,         /* calendario di stagione */
  ALIAS: [],
  NOMI: {},          /* nome ingrediente → reparto, per i suggerimenti */
  cur: null, porz: 2, backTo: null, lastDay: '',
  clearArmed: false,
  evitare: [],       /* ingredienti da evitare dell'utente collegato (Impostazioni) */
  pers: persIniz
};

export function saveUsr() {
  S.usr.agg = new Date().toISOString();
  store(LS_USR, JSON.stringify(S.usr));
  updUsrSync();
}

export function updUsrSync() {
  const el = $('usr-sync'); if (!el) return;
  el.textContent = 'Ricette, archivio e cestino sono nel ricettario condiviso: li vedi da ogni dispositivo.';
  el.className = 'fine sync';
}

export function saveShop() {
  S.shop.agg = new Date().toISOString();
  store(LS_SHOP, JSON.stringify(S.shop));
}

export function updSync() {
  const el = $('shop-sync'); if (!el) return;
  el.textContent = 'Salvata su questo browser.';
  el.className = 'fine sync';
}
