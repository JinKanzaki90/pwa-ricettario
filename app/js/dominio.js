/* Regole sulle ricette: stagionalità, prodotti calabresi, alcolici, quantità, costanti. */
import { S } from './stato.js';

/* ---------- stagionalità: calendario mensile da stagioni.json ----------
   una ricetta è "di stagione" se più di metà dei suoi prodotti ortofrutticoli riconosciuti nel calendario
   lo è nel mese corrente; non contano i prodotti di tutto l'anno (12 mesi), cipolle e funghi coltivati
   (fonte "conservazione") e gli aromi segnati "aromatico" (aglio, limone, sedano).
   Se il calendario non si carica si ripiega sul campo stagioni della ricetta. */
export const M = new Date().getMonth();
export const MESE = M + 1;
export const STAGIONE = M >= 2 && M <= 4 ? 'primavera' : M >= 5 && M <= 7 ? 'estate' : M >= 8 && M <= 10 ? 'autunno' : 'inverno';
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export function impostaCalendario(d) {
  S.CAL = d; S.ALIAS = [];
  (d.prodotti || []).forEach(function (p) { (p.alias || []).forEach(function (a) { S.ALIAS.push([a, p]); }); });
  S.ALIAS.sort(function (a, b) { return b[0].length - a[0].length; });
}

function prodotto(nome) {
  const n = String(nome || '').toLowerCase();
  for (let i = 0; i < S.ALIAS.length; i++) {
    const a = S.ALIAS[i][0];
    if (n.indexOf(a) === 0 || n.indexOf(' ' + a) > -1) return S.ALIAS[i][1];
  }
  return null;
}
export function ingStagione(i) {
  if (!S.CAL || i.reparto !== 'ortofrutta') return null;
  const p = prodotto(i.nome);
  if (!p || p.fonte === 'conservazione' || p.aromatico || p.mesi.length === 12) return null;
  return p.mesi.indexOf(MESE) > -1;
}
export function diStagione(r) {
  if (!S.CAL) return Array.isArray(r.stagioni) && r.stagioni.indexOf(STAGIONE) > -1;
  let tot = 0, si = 0;
  (r.ingredienti || []).forEach(function (i) { const v = ingStagione(i); if (v === null) return; tot++; if (v) si++; });
  return tot > 0 && si * 2 > tot;
}
export function hasCal(r) { return (r.ingredienti || []).some(function (i) { return i.calabrese; }); }

/* alcolici: vino, birra e superalcolici; aceto e salsa di soia non contano */
const RE_ALC = /\b(vino|vini|birra|birre|liquore|liquori|grappa|rum|brandy|cognac|marsala|vermouth|whisky|vodka|gin|limoncello|sake|spumante|prosecco|passito)\b/i;
export function nomeAlc(nome) { const n = String(nome || ''); return !/aceto/i.test(n) && RE_ALC.test(n); }
export function hasAlc(r) { return r.alcolici === true || (r.ingredienti || []).some(function (i) { return nomeAlc(i.nome); }); }

/* ---------- quantità scalate ---------- */
export function scale(q, unita, f) {
  if (q == null || unita === 'q.b.') return null;
  let v = q * f;
  if (unita === 'g' || unita === 'ml') v = v >= 50 ? Math.round(v / 5) * 5 : Math.round(v);
  else v = Math.round(v * 2) / 2;
  return v;
}
const UN = { pz: ['pezzo', 'pezzi'], fetta: ['fetta', 'fette'], pizzico: ['pizzico', 'pizzichi'], cucchiaio: ['cucchiaio', 'cucchiai'], cucchiaino: ['cucchiaino', 'cucchiaini'], rametto: ['rametto', 'rametti'], spicchio: ['spicchio', 'spicchi'], costa: ['costa', 'coste'] };
export function fmtQ(v, unita) {
  if (v == null) return 'q.b.';
  const n = String(v).replace('.', ',').replace(',5', '½').replace(/^0½$/, '½');
  if (UN[unita]) return n + ' ' + (v > 1 ? UN[unita][1] : UN[unita][0]);
  return n + ' ' + unita;
}

export const ICON_STAG = '<svg viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/></svg>';
export const ICON_CAL = '<svg viewBox="0 0 24 24"><path d="M16.2 8.2c1.9.9 2.6 3 1.6 5.6-1.5 3.9-5.9 6.8-12.3 7.2 3.3-1.6 5.7-4.1 6.8-7.6.8-2.7 2.1-4.6 3.9-5.2z"/><path d="M13.6 8.6c.9-1.3 2.9-1.8 4.4-.8"/><path d="M16.2 7.4c0-2 .9-3.4 2.8-4.1"/></svg>';
export const ICON_ALC = '<svg viewBox="0 0 24 24"><path d="M7 3h10l-1 6.5a4 4 0 0 1-8 0z"/><path d="M12 13.5V20M8.5 21h7"/></svg>';
export const PASTI = [['tutti', 'Tutti'], ['colazione', 'Colazione'], ['pranzo', 'Pranzo'], ['cena', 'Cena'], ['spuntino', 'Spuntino'], ['base', 'Basi']];
export const ALTRI = [['t15', 'Fino a 15 min'], ['t30', 'Fino a 30 min'], ['stag', 'Di stagione'], ['cal', 'Prodotti calabresi'], ['noalc', 'Senza alcol'], ['mie', 'Le mie ricette'], ['noevit', 'Senza ingredienti da evitare']];
export const NOME_PASTO = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntino', base: 'Base' };
export const REPARTI = [['ortofrutta', 'Ortofrutta'], ['legumi', 'Legumi'], ['cereali', 'Pasta, riso e cereali'], ['frigo', 'Frigo'], ['surgelati', 'Surgelati'], ['dispensa', 'Dispensa'], ['spezie', 'Spezie ed erbe']];

/* ---------- raccolta: ricette di partenza + personali, meno le eliminate ---------- */
export function ricompila() {
  const el = {}; S.usr.eliminate.forEach(function (i) { el[i] = true; });
  S.RICETTE = S.BASE.filter(function (r) { return !el[r.id]; })
    .concat(S.usr.personali.map(function (r) { r.personale = true; return r; }));
}
export function byId(id) {
  for (let i = 0; i < S.RICETTE.length; i++) if (S.RICETTE[i].id === id) return S.RICETTE[i];
  return null;
}
export function archiviata(id) { return S.usr.archiviate.indexOf(id) > -1; }
export function attive() { return S.RICETTE.filter(function (r) { return !archiviata(r.id); }); }

/* ingredienti della ricetta che compaiono nell'elenco personale «da evitare» (confronto senza accenti né maiuscole) */
function semplice(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
export function daEvitare(r) {
  const l = (S.evitare || []).map(semplice);
  if (!l.length) return [];
  const trovati = [];
  (r.ingredienti || []).forEach(function (i) {
    const n = semplice(i.nome);
    l.forEach(function (x, k) { if (n.indexOf(x) > -1 && trovati.indexOf(S.evitare[k]) < 0) trovati.push(S.evitare[k]); });
  });
  return trovati;
}
