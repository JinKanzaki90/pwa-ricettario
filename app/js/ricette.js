/* Scheda Ricette: elenco con filtri, dettaglio, archivio personale. */
import { $, esc, toast } from './util.js';
import { S, saveUsr, saveShop } from './stato.js';
import {
  diStagione, ingStagione, hasCal, hasAlc, scale, fmtQ, ICON_STAG, ICON_CAL, ICON_ALC,
  PASTI, ALTRI, NOME_PASTO, ricompila, byId, archiviata, attive
} from './dominio.js';
import { show, vista } from './navigazione.js';
import { renderSett, usiSett } from './settimana.js';
import { addToShop, renderShop, pruneSpunte, inSpesa } from './spesa.js';
import { openForm, daRicetta, aggNomi } from './modulo.js';

/* ridisegna tutto ciò che dipende dalle ricette */
export function aggiorna() {
  ricompila(); renderCards(); renderSett(); pruneSpunte(); renderShop(); updArchBtn(); aggNomi();
  if (!$('r-detail').hidden && S.cur) {
    const c = byId(S.cur.id);
    if (c) { S.cur = c; renderDetail(); } else vista('list');
  }
  if (!$('r-arch').hidden) renderArch();
}

/* ---------- elenco e filtri ---------- */
let fPasto = 'tutti';
const fAltro = {};
function fchip(key, label, on, group) {
  return '<button type="button" class="fchip" data-g="' + group + '" data-k="' + key + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
}
export function renderFilters() {
  $('flt-pasto').innerHTML = PASTI.map(function (p) { return fchip(p[0], p[1], fPasto === p[0], 'pasto'); }).join('');
  $('flt-altro').innerHTML = ALTRI.map(function (p) { return fchip(p[0], p[1], !!fAltro[p[0]], 'altro'); }).join('');
}
function badges(r, ext) {
  let b = '';
  if (ext && r.personale) b += '<span class="badge mine">La tua ricetta</span>';
  if (ext && archiviata(r.id)) b += '<span class="badge arch">In archivio</span>';
  if (diStagione(r)) b += '<span class="badge stag">' + ICON_STAG + 'Di stagione</span>';
  if (hasCal(r)) b += '<span class="badge cal">' + ICON_CAL + 'Calabria</span>';
  if (hasAlc(r)) b += '<span class="badge alc">' + ICON_ALC + 'Con alcol</span>';
  return b;
}
function metaTempo(r) { return r.tempo_min + ' min' + (r.riposo ? ' + riposo' : ''); }
export function renderCards() {
  if (!S.caricate) { $('cards').innerHTML = '<div class="empty">Caricamento delle ricette…</div>'; return; }
  const list = attive().filter(function (r) {
    if (fPasto !== 'tutti' && r.pasto !== fPasto) return false;
    if (fAltro.t15 && r.tempo_min > 15) return false;
    if (fAltro.t30 && r.tempo_min > 30) return false;
    if (fAltro.stag && !diStagione(r)) return false;
    if (fAltro.cal && !hasCal(r)) return false;
    if (fAltro.noalc && hasAlc(r)) return false;
    if (fAltro.mie && !r.personale) return false;
    return true;
  });
  $('cards').innerHTML = list.length ? list.map(function (r) {
    return '<button type="button" class="rcard" data-id="' + esc(r.id) + '">' +
      '<h3>' + esc(r.titolo) + '</h3>' +
      '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto] || r.pasto) + '</span><span>' + metaTempo(r) + '</span><span>' + esc(r.difficolta) + '</span></div>' +
      '<div class="badges">' + badges(r, true) + '</div></button>';
  }).join('') : '<div class="empty">' + (fAltro.mie ? 'Non hai ancora ricette tue. Tocca «+ Nuova ricetta» per aggiungerne una.' : 'Nessuna ricetta con questi filtri.') + '</div>';
}

/* ---------- dettaglio ---------- */
export function openRecipe(id) {
  S.cur = byId(id); if (!S.cur) return;
  S.porz = S.cur.porzioni_base || 2;
  vista('detail'); renderDetail();
}
export function renderDetail() {
  const r = S.cur, porz = S.porz, f = porz / (r.porzioni_base || 2), arch = archiviata(r.id);
  const ing = r.ingredienti.map(function (i) {
    const sub = i.calabrese ? '<span class="sub">Consigliato: ' + esc(i.calabrese.prodotto) + (i.calabrese.marca ? ' · ' + esc(i.calabrese.marca) : '') + (i.calabrese.dove ? ' · ' + esc(i.calabrese.dove) : '') + '</span>' : '';
    return '<li><span>' + esc(i.nome) + (ingStagione(i) === true ? '<span class="dot" title="Di stagione questo mese" aria-label="di stagione"></span>' : '') + sub + '</span><span class="q">' + fmtQ(scale(i.qta, i.unita, f), i.unita) + '</span></li>';
  }).join('');
  const tempi = r.tempo_prep != null ? '<span>Preparazione ' + r.tempo_prep + ' min</span><span>Cottura ' + (r.tempo_cottura || 0) + ' min</span>' : '<span>' + r.tempo_min + ' min</span>';
  const azioni = '<div class="panel"><div class="eyebrow">La tua raccolta</div><div class="r-actions">' +
    (r.personale ? '<button type="button" class="btn line small" id="d-edit">Modifica</button>' : '') +
    '<button type="button" class="btn line small" id="d-copy">Crea una tua versione</button>' +
    (arch ? '<button type="button" class="btn small" id="d-rest">Ripristina dall\'archivio</button>'
          : '<button type="button" class="btn line warn small" id="d-arch">Sposta in archivio</button>') + '</div>' +
    '<p class="fine">' + (arch ? 'Questa ricetta è in archivio: non compare nell\'elenco, ma resta nel piano della settimana e nella spesa.'
      : 'Archiviare toglie la ricetta dall\'elenco senza toglierla dalla settimana; dall\'archivio puoi ripristinarla o eliminarla per sempre.') + '</p></div>';
  $('r-detail').innerHTML =
    '<button type="button" class="back" id="back">‹ ' + (S.backTo === 'settimana' ? 'Torna alla settimana' : S.backTo === 'archivio' ? 'Torna all\'archivio' : 'Tutte le ricette') + '</button>' +
    '<div style="display:grid;gap:8px"><h2>' + esc(r.titolo) + '</h2>' +
    '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto]) + '</span>' + tempi + '<span>' + esc(r.difficolta) + '</span>' + (r.riposo ? '<span>Riposo: ' + esc(r.riposo) + '</span>' : '') + '</div>' +
    '<div class="chips">' + badges(r, true) + '</div></div>' +
    '<div class="panel"><div class="portions"><span class="eyebrow">Porzioni</span><div class="stepper">' +
    '<button type="button" id="p-meno" aria-label="Una porzione in meno"' + (porz <= 1 ? ' disabled' : '') + '>−</button><output id="p-val" aria-live="polite">' + porz + '</output>' +
    '<button type="button" id="p-piu" aria-label="Una porzione in più"' + (porz >= 12 ? ' disabled' : '') + '>+</button></div></div>' +
    '<ul class="ing">' + ing + '</ul>' +
    '<button type="button" class="btn" id="add-shop">Aggiungi alla spesa</button></div>' +
    '<div class="panel"><div class="eyebrow">Procedimento</div><ol class="passi">' + r.passi.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></div>' +
    (r.note_nutrizionali ? '<div class="note">' + esc(r.note_nutrizionali) + '</div>' : '') + azioni;
  $('back').onclick = function () {
    const b = S.backTo; S.backTo = null;
    if (b === 'archivio') { openArch(); return; }
    vista('list');
    if (b === 'settimana') { show('settimana'); const g = $('day-' + S.lastDay); if (g) g.scrollIntoView(); }
  };
  $('p-meno').onclick = function () { if (S.porz > 1) { S.porz--; renderDetail(); } };
  $('p-piu').onclick = function () { if (S.porz < 12) { S.porz++; renderDetail(); } };
  $('add-shop').onclick = function () { addToShop(r, S.porz); };
  if ($('d-edit')) $('d-edit').onclick = function () { openForm(daRicetta(r, false)); };
  $('d-copy').onclick = function () { openForm(daRicetta(r, true)); };
  if ($('d-arch')) $('d-arch').onclick = function () { archivia(r.id); if (S.backTo !== 'settimana') { S.backTo = null; vista('list'); } };
  if ($('d-rest')) $('d-rest').onclick = function () { ripristina(r.id); };
}

/* ---------- archivio ---------- */
export function updArchBtn() {
  const n = S.usr.archiviate.filter(function (id) { return byId(id); }).length;
  $('open-arch').textContent = 'Archivio · ' + n + (n === 1 ? ' ricetta' : ' ricette');
}
function archivia(id) {
  const r = byId(id); if (!r) return;
  if (!archiviata(id)) S.usr.archiviate.push(id);
  saveUsr(); aggiorna();
  toast('«' + r.titolo + '» in archivio', { label: 'Annulla', fn: function () { ripristina(id, true); } });
}
function ripristina(id, quiet) {
  S.usr.archiviate = S.usr.archiviate.filter(function (x) { return x !== id; });
  saveUsr(); aggiorna();
  if (!quiet) { const r = byId(id); toast((r ? '«' + r.titolo + '»' : 'Ricetta') + ' di nuovo nell\'elenco'); }
}
let delArmed = null;
function elimina(id) {
  const r = byId(id); if (!r) return;
  const usr = S.usr, usi = usiSett(id);
  if (r.personale) usr.personali = usr.personali.filter(function (x) { return x.id !== id; });
  else if (usr.eliminate.indexOf(id) < 0) usr.eliminate.push(id);
  usr.archiviate = usr.archiviate.filter(function (x) { return x !== id; });
  Object.keys(usr.sostituzioni).forEach(function (k) { if (usr.sostituzioni[k] === id) delete usr.sostituzioni[k]; });
  const spesa = inSpesa(id);
  if (spesa) S.shop.selezione = S.shop.selezione.filter(function (x) { return x.id !== id; });
  saveUsr(); delArmed = null; aggiorna(); if (spesa) saveShop();
  toast('«' + r.titolo + '» eliminata' + (usi.length ? ': nella settimana scegli un sostituto' : ''));
}
function openArch() { delArmed = null; vista('arch'); renderArch(); }
export function renderArch() {
  const list = S.usr.archiviate.map(byId).filter(Boolean);
  let html = '<button type="button" class="back" id="arch-back">‹ Tutte le ricette</button>' +
    '<h2>Archivio</h2><p class="lead">Le ricette archiviate non compaiono nell\'elenco ma restano nel piano della settimana e nella spesa. Puoi ripristinarle o eliminarle per sempre.</p>';
  if (!list.length) html += '<div class="panel"><div class="empty">L\'archivio è vuoto. Per archiviare una ricetta aprila e tocca «Sposta in archivio».</div></div>';
  html += list.map(function (r) {
    const usi = usiSett(r.id), armed = delArmed === r.id, sp = inSpesa(r.id);
    const warn = armed ? '<p class="warnline">L\'eliminazione non si può annullare.' +
      (usi.length ? ' È nel piano della settimana (' + esc(usi.join(', ')) + '): al suo posto potrai scegliere un sostituto.' : '') +
      (sp ? ' Verrà tolta anche dalla lista della spesa.' : '') + '</p>' : '';
    return '<div class="panel acard"><h3>' + esc(r.titolo) + '</h3>' +
      '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto] || r.pasto) + '</span><span>' + metaTempo(r) + '</span>' + (r.personale ? '<span class="badge mine">La tua ricetta</span>' : '') + '</div>' +
      (usi.length ? '<div class="uses">Nel piano: ' + esc(usi.join(', ')) + '</div>' : '') + warn +
      '<div class="r-actions"><button type="button" class="btn line small" data-aopen="' + esc(r.id) + '">Apri</button>' +
      '<button type="button" class="btn small" data-arest="' + esc(r.id) + '">Ripristina</button>' +
      '<button type="button" class="btn line warn small' + (armed ? ' armed' : '') + '" data-adel="' + esc(r.id) + '">' + (armed ? 'Conferma: elimina per sempre' : 'Elimina') + '</button></div></div>';
  }).join('');
  $('r-arch').innerHTML = html;
}

export function initRicette() {
  document.querySelector('.filters').addEventListener('click', function (e) {
    const b = e.target.closest('.fchip'); if (!b) return;
    if (b.dataset.g === 'pasto') fPasto = b.dataset.k;
    else {
      const k = b.dataset.k; fAltro[k] = !fAltro[k];
      if (k === 't15' && fAltro.t15) fAltro.t30 = false;
      if (k === 't30' && fAltro.t30) fAltro.t15 = false;
    }
    renderFilters(); renderCards();
  });
  $('cards').addEventListener('click', function (e) {
    const c = e.target.closest('.rcard'); if (c) { S.backTo = null; openRecipe(c.dataset.id); }
  });
  $('r-arch').addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'arch-back') { delArmed = null; vista('list'); return; }
    if (b.dataset.aopen) { S.backTo = 'archivio'; openRecipe(b.dataset.aopen); return; }
    if (b.dataset.arest) { ripristina(b.dataset.arest); return; }
    if (b.dataset.adel) {
      const id = b.dataset.adel;
      if (delArmed !== id) {
        delArmed = id; renderArch();
        const c = document.querySelector('[data-adel="' + id.replace(/"/g, '') + '"]'); if (c) c.focus();
        return;
      }
      elimina(id);
    }
  });
  $('open-arch').addEventListener('click', openArch);
  $('new-recipe').addEventListener('click', function () { openForm(null); });
}
