/* Stato condiviso tra i moduli. Ricette, autori, archivio, settimana e spesa arrivano da Supabase (dati.js);
   su questo browser restano solo tema, scheda aperta e numero di persone. */
import { $, store } from './util.js';

/* lista della spesa { selezione:[{id, porzioni}], extra:[{id, nome, reparto}], spunte:[chiave] } */
export function normShop(s) {
  s = s || {};
  return {
    selezione: (Array.isArray(s.selezione) ? s.selezione : []).filter(function (x) { return x && x.id && x.porzioni > 0; }),
    extra: (Array.isArray(s.extra) ? s.extra : []).filter(function (x) { return x && x.nome; }),
    spunte: (Array.isArray(s.spunte) ? s.spunte : []).filter(function (x) { return typeof x === 'string'; })
  };
}

/* dati delle versioni precedenti, salvati solo sul browser: letti una volta per portarli sul database, poi tolti */
const VECCHIE = ['rv-ricettario', 'rv-spesa'];
export function vecchiDati() {
  const out = {};
  try {
    const u = JSON.parse(store('rv-ricettario') || 'null');
    out.sostituzioni = u && u.sostituzioni && typeof u.sostituzioni === 'object' ? u.sostituzioni : {};
  } catch (e) { out.sostituzioni = {}; }
  try { out.spesa = normShop(JSON.parse(store('rv-spesa') || 'null')); } catch (e) { out.spesa = normShop(null); }
  return out;
}
export function togliVecchiDati() {
  try { VECCHIE.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* archiviazione non disponibile */ }
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
  MIA: {},           /* la propria settimana: 'giorno|pasto' → {ricetta, dosi, avanzo_di, nota} */
  shop: normShop(null),
  personali: false,  /* settimana e spesa lette dal database */
  lettoPers: 0,      /* quando sono state lette (ms) */
  erroPers: '',      /* motivo per cui non si sono potute leggere */
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

export function updUsrSync() {
  const el = $('usr-sync'); if (!el) return;
  el.textContent = 'Ricette, archivio e cestino sono nel ricettario condiviso: li vedi da ogni dispositivo.';
  el.className = 'fine sync';
}
