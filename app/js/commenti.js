/* Commenti nel dettaglio di una ricetta: li vede tutto il gruppo, con autore e data.
   Ognuno modifica ed elimina solo i propri (lo impone il database; qui si nascondono i pulsanti).
   Testo semplice fino a 500 caratteri: si mostra sempre tramite esc(), a capo compresi. */
import { $, esc, toast } from './util.js';
import { U } from './accesso.js';
import { caricaCommenti, nuovoCommento, cambiaCommento, togliCommento, nomeAutore, msgDb } from './dati.js';

export const MAX_COMMENTO = 500;
const DOPO = 30000; /* riaprendo la stessa ricetta dopo 30 secondi i commenti si rileggono */

/* stato della ricetta aperta: commenti letti, bozza, commento in modifica, eliminazione armata */
let C = { ricetta: null, lista: null, letto: 0, errore: '', bozza: '', inModifica: null, testoModifica: '', togliArmato: null };
let occupato = false;

function quando(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function mio(c) { return !!(c.autore && U.utente && c.autore === U.utente.id); }
function conta(n) { return n + '/' + MAX_COMMENTO; }

function voce(c) {
  const modificato = c.modificato_il && new Date(c.modificato_il) - new Date(c.creato_il) > 60000;
  const testa = '<div class="c-h"><b>' + esc(nomeAutore(c.autore)) + '</b>' + (mio(c) ? ' (tu)' : '') +
    ' · <time datetime="' + esc(c.creato_il) + '">' + quando(c.creato_il) + '</time>' + (modificato ? ' · modificato' : '') + '</div>';
  if (C.inModifica === c.id) {
    return '<li class="comm" data-cid="' + c.id + '">' + testa +
      '<label class="sr" for="c-mod">Modifica il commento</label>' +
      '<textarea id="c-mod" maxlength="' + MAX_COMMENTO + '" rows="3">' + esc(C.testoModifica) + '</textarea>' +
      '<div class="c-piede"><span class="c-conta" id="c-mod-conta">' + conta(C.testoModifica.length) + '</span>' +
      '<div class="r-actions"><button type="button" class="btn small" data-csalva>Salva</button>' +
      '<button type="button" class="btn line small" data-cannulla>Annulla</button></div></div></li>';
  }
  const armato = C.togliArmato === c.id;
  return '<li class="comm" data-cid="' + c.id + '">' + testa + '<p class="c-t">' + esc(c.testo) + '</p>' +
    (mio(c) ? '<div class="r-actions"><button type="button" class="btn line small" data-cmod aria-label="Modifica il tuo commento del ' + esc(quando(c.creato_il)) + '">Modifica</button>' +
      '<button type="button" class="btn line warn small' + (armato ? ' armed' : '') + '" data-ctogli>' + (armato ? 'Conferma: elimina' : 'Elimina') + '</button></div>' : '') + '</li>';
}

/* pannello dei commenti per il dettaglio (r = ricetta aperta) */
export function pannelloCommenti(r) {
  if (C.ricetta !== r.id) C = { ricetta: r.id, lista: null, letto: 0, errore: '', bozza: '', inModifica: null, testoModifica: '', togliArmato: null };
  const n = C.lista ? C.lista.length : 0;
  let corpo;
  if (C.errore && !C.lista) corpo = '<div class="empty err">Non riesco a leggere i commenti. ' + esc(C.errore) + ' <button type="button" class="linkbtn" data-criprova>Riprova</button></div>';
  else if (!C.lista) corpo = '<p class="fine">Caricamento dei commenti…</p>';
  else if (!n) corpo = '<p class="fine">Ancora nessun commento: scrivi tu il primo, per esempio come l\'hai cambiata o con cosa l\'hai servita.</p>';
  else corpo = '<ul class="comms">' + C.lista.map(voce).join('') + '</ul>';
  return '<div class="panel" id="d-comm"><div class="eyebrow">Commenti' + (n ? ' · ' + n : '') + '</div>' + corpo +
    '<form class="c-nuovo" id="c-form" novalidate><label for="c-testo">Scrivi un commento</label>' +
    '<textarea id="c-testo" maxlength="' + MAX_COMMENTO + '" rows="3" aria-describedby="c-conta c-chi">' + esc(C.bozza) + '</textarea>' +
    '<div class="c-piede"><span class="c-conta" id="c-conta">' + conta(C.bozza.length) + '</span>' +
    '<button type="submit" class="btn small">Pubblica</button></div>' +
    '<p class="fine" id="c-chi">Lo vede tutto il gruppo, con il tuo nome e la data. Solo testo, fino a ' + MAX_COMMENTO + ' caratteri.</p></form></div>';
}

async function leggi(id) {
  try {
    const l = await caricaCommenti(id);
    if (C.ricetta !== id) return;
    C.lista = l; C.letto = Date.now(); C.errore = '';
  } catch (e) {
    if (C.ricetta !== id) return;
    C.errore = msgDb(e);
    if (C.lista) toast('Non riesco a rileggere i commenti. ' + C.errore);
  }
  ridisegna();
}

/* ridisegna solo il pannello dei commenti, senza perdere il punto in cui si stava scrivendo */
let aperta = null;
function ridisegna() {
  const p = $('d-comm'); if (!p || !aperta || aperta.id !== C.ricetta) return;
  const a = document.activeElement, fuoco = a && (a.id === 'c-testo' || a.id === 'c-mod') ? [a.id, a.selectionStart, a.selectionEnd] : null;
  p.outerHTML = pannelloCommenti(aperta);
  collega(aperta);
  if (fuoco && $(fuoco[0])) { const t = $(fuoco[0]); t.focus({ preventScroll: true }); t.setSelectionRange(fuoco[1], fuoco[2]); }
}

/* da chiamare dopo aver disegnato il dettaglio: legge i commenti se servono e collega i comandi */
export function initCommenti(r) {
  aperta = r;
  if (!$('d-comm')) return;
  collega(r);
  if (!C.lista && !C.errore || C.lista && Date.now() - C.letto > DOPO) { C.letto = Date.now(); leggi(r.id); }
}
function collega(r) {
  const p = $('d-comm');
  p.addEventListener('input', function (e) {
    if (e.target.id === 'c-testo') { C.bozza = e.target.value; $('c-conta').textContent = conta(C.bozza.length); }
    if (e.target.id === 'c-mod') { C.testoModifica = e.target.value; $('c-mod-conta').textContent = conta(C.testoModifica.length); }
  });
  p.addEventListener('submit', function (e) {
    e.preventDefault();
    const t = C.bozza.trim();
    if (!t) { toast('Scrivi qualcosa prima di pubblicare.'); $('c-testo').focus(); return; }
    azione(async function () {
      await nuovoCommento(r.id, t);
      C.bozza = '';
      await leggi(r.id);
      toast('Commento pubblicato');
      if ($('c-testo')) $('c-testo').focus({ preventScroll: true });
    });
  });
  p.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-criprova')) { C.errore = ''; ridisegna(); leggi(r.id); return; }
    const li = b.closest('[data-cid]'); if (!li) return;
    const id = Number(li.dataset.cid), c = (C.lista || []).filter(function (x) { return x.id === id; })[0]; if (!c) return;
    if (b.hasAttribute('data-cmod')) { C.inModifica = id; C.testoModifica = c.testo; C.togliArmato = null; ridisegna(); if ($('c-mod')) $('c-mod').focus(); return; }
    if (b.hasAttribute('data-cannulla')) { C.inModifica = null; ridisegna(); focusVoce(id, '[data-cmod]'); return; }
    if (b.hasAttribute('data-csalva')) {
      const t = C.testoModifica.trim();
      if (!t) { toast('Il commento non può restare vuoto: per toglierlo usa «Elimina».'); $('c-mod').focus(); return; }
      azione(async function () {
        if (t !== c.testo) await cambiaCommento(id, t);
        C.inModifica = null;
        await leggi(r.id);
        focusVoce(id, '[data-cmod]');
        toast('Commento aggiornato');
      });
      return;
    }
    if (b.hasAttribute('data-ctogli')) {
      if (C.togliArmato !== id) { C.togliArmato = id; C.inModifica = null; ridisegna(); focusVoce(id, '[data-ctogli]'); return; }
      azione(async function () {
        await togliCommento(id);
        C.togliArmato = null;
        await leggi(r.id);
        toast('Commento eliminato');
      });
    }
  });
}
function focusVoce(id, sel) { const x = document.querySelector('[data-cid="' + id + '"] ' + sel); if (x) x.focus({ preventScroll: true }); }

/* una scrittura alla volta; se fallisce si dice perché e si rilegge */
async function azione(fn) {
  if (occupato) return;
  occupato = true;
  try { await fn(); } catch (e) { toast(msgDb(e)); await leggi(C.ricetta); } finally { occupato = false; }
}

/* uscita dall'account: niente commenti in memoria */
document.addEventListener('rv-fuori', function () { aperta = null; C = { ricetta: null, lista: null, letto: 0, errore: '', bozza: '', inModifica: null, testoModifica: '', togliArmato: null }; });
