/* Stato condiviso tra i moduli e salvataggio su questo browser (localStorage).
   Per ora nessun collegamento a Supabase: arriverà con i passi 4 e 5. */
import { $, store } from './util.js';

const LS_USR = 'rv-ricettario';
const LS_SHOP = 'rv-spesa';

function strArr(a) { return (Array.isArray(a) ? a : []).filter(function (x) { return typeof x === 'string'; }); }

/* stato personale { personali:[ricetta], archiviate:[id], eliminate:[id], sostituzioni:{'giorno|slot': id}, agg } */
export function normUsr(s) {
  s = s || {};
  const sost = {};
  if (s.sostituzioni && typeof s.sostituzioni === 'object') {
    Object.keys(s.sostituzioni).forEach(function (k) { if (typeof s.sostituzioni[k] === 'string') sost[k] = s.sostituzioni[k]; });
  }
  return {
    personali: (Array.isArray(s.personali) ? s.personali : []).filter(function (r) {
      return r && r.id && r.titolo && Array.isArray(r.ingredienti) && Array.isArray(r.passi);
    }),
    archiviate: strArr(s.archiviate), eliminate: strArr(s.eliminate), sostituzioni: sost,
    agg: typeof s.agg === 'string' ? s.agg : ''
  };
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
  BASE: [],          /* ricette di partenza (data/ricette.json) */
  RICETTE: [],       /* BASE senza le eliminate + personali; le archiviate restano (settimana e spesa le usano) */
  caricate: false,
  usr: leggiJSON(LS_USR, normUsr),
  shop: leggiJSON(LS_SHOP, normShop),
  SETT: null,        /* settimana d'esempio */
  DISP: null,        /* dispensa di base */
  CAL: null,         /* calendario di stagione */
  ALIAS: [],
  NOMI: {},          /* nome ingrediente → reparto, per i suggerimenti */
  cur: null, porz: 2, backTo: null, lastDay: '',
  clearArmed: false,
  pers: persIniz
};

export function saveUsr() {
  S.usr.agg = new Date().toISOString();
  store(LS_USR, JSON.stringify(S.usr));
  updUsrSync();
}

export function updUsrSync() {
  const el = $('usr-sync'); if (!el) return;
  el.textContent = 'Ricette personali e archivio sono salvati su questo browser.';
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
