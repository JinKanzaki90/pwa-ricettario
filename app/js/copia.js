/* Copia sul dispositivo dei dati letti dal database, per consultarli senza rete (passo 8).
   Si salva dopo ogni lettura o modifica riuscita, solo per l'utente collegato; si cancella all'uscita,
   quando la sessione finisce e alla cancellazione dell'account. Senza rete l'app la mostra in sola lettura. */
import { S, normShop } from './stato.js';
import { $, esc, toast } from './util.js';

const CHIAVE = 'rv-copia';
const VERSIONE = 1;

function leggi() {
  try {
    const c = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
    return c && c.v === VERSIONE && c.utente && c.utente.id ? c : null;
  } catch (e) { return null; }
}

/* copia dell'utente indicato (o di chiunque, se id manca) */
export function copiaDi(id) {
  const c = leggi();
  return c && (!id || c.utente.id === id) ? c : null;
}

export function togliCopia() {
  clearTimeout(timer);
  try { localStorage.removeItem(CHIAVE); } catch (e) { /* archiviazione non disponibile */ }
}

/* salvataggio raggruppato: tante modifiche ravvicinate, una sola scrittura */
let timer = null, chi = null;
export function segnaCopia(U) {
  if (S.offline || !U || !U.utente || !U.profilo) return;
  chi = U;
  clearTimeout(timer);
  timer = setTimeout(salva, 400);
}
function salva() {
  const U = chi;
  if (S.offline || !U || !U.utente || !U.profilo) return;
  const prima = copiaDi(U.utente.id) || {};
  const c = {
    v: VERSIONE,
    utente: { id: U.utente.id, email: U.utente.email },
    profilo: { nome: U.profilo.nome, nome_scelto: !!U.profilo.nome_scelto },
    evitare: (S.evitare || []).slice(),
    salvata: Date.now()
  };
  /* ogni parte si aggiorna solo se è stata letta in questa sessione; altrimenti resta quella di prima */
  if (S.caricate) {
    c.ricette = { RICETTE: S.RICETTE, CESTINO: S.CESTINO, ARCH: S.ARCH, AUTORI: S.AUTORI, letto: S.letto };
  } else if (prima.ricette) c.ricette = prima.ricette;
  if (S.personali) c.personali = { MIA: S.MIA, shop: S.shop, letto: S.lettoPers };
  else if (prima.personali) c.personali = prima.personali;
  try { localStorage.setItem(CHIAVE, JSON.stringify(c)); }
  catch (e) { /* spazio esaurito o archiviazione bloccata: senza copia l'app funziona lo stesso con la rete */ }
}

/* riporta in S i dati della copia; restituisce il momento della lettura più vecchia (ms) */
export function usaCopia(c) {
  if (c.ricette) {
    S.RICETTE = c.ricette.RICETTE || []; S.CESTINO = c.ricette.CESTINO || []; S.ARCH = c.ricette.ARCH || [];
    S.AUTORI = c.ricette.AUTORI || {}; S.caricate = true; S.letto = c.ricette.letto || 0;
  }
  if (c.personali) {
    S.MIA = c.personali.MIA || {}; S.shop = normShop(c.personali.shop); S.personali = true; S.erroPers = '';
    S.lettoPers = c.personali.letto || 0;
  } else {
    S.personali = false; S.erroPers = 'Settimana e spesa non sono mai state aperte su questo dispositivo: servono la rete e un primo caricamento.';
  }
  S.evitare = (c.evitare || []).slice();
}

/* solo settimana e spesa: per annullare una modifica che non si è potuta salvare */
export function ripristinaPersonali(id) {
  const c = copiaDi(id);
  if (!c || !c.personali) return false;
  S.MIA = c.personali.MIA || {}; S.shop = normShop(c.personali.shop);
  return true;
}

/* ---------- avviso «senza connessione» ---------- */
function quando(ms) {
  if (!ms) return '';
  const d = new Date(ms), oggi = new Date();
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === oggi.toDateString()) return 'di oggi alle ' + ora;
  return 'del ' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) + ' alle ' + ora;
}
export function mostraAvviso() {
  const el = $('senza-rete'); if (!el) return;
  if (S.offline) {
    const ms = Math.min.apply(null, [S.letto, S.lettoPers].filter(function (x) { return x > 0; }).concat([Date.now()]));
    el.innerHTML = '<span><b>Senza connessione.</b> Vedi i dati salvati su questo dispositivo ' + esc(quando(ms)) +
      '; per modificare serve la rete.</span> <button type="button" class="linkbtn" id="senza-rete-riprova">Riprova</button>';
    el.hidden = false;
  } else if (navigator.onLine === false && document.body.dataset.stato === 'dentro') {
    el.innerHTML = '<span><b>Senza connessione.</b> Le modifiche non si possono salvare finché non torna la rete.</span>';
    el.hidden = false;
  } else {
    el.hidden = true; el.innerHTML = '';
  }
}

/* da chiamare prima di ogni scrittura: false (con un avviso) se si sta guardando la copia */
export function serveRete() {
  if (!S.offline) return true;
  toast('Senza connessione: per modificare serve la rete.');
  return false;
}
