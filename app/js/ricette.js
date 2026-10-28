/* Scheda Ricette: elenco con ricerca e filtri, dettaglio, archivio personale, cestino condiviso.
   I dati stanno su Supabase (dati.js); dopo ogni scrittura si rileggono, così si vedono anche le modifiche degli altri. */
import { $, esc, toast } from './util.js';
import { S } from './stato.js';
import {
  diStagione, ingStagione, hasCal, hasAlc, scale, fmtQ, ICON_STAG, ICON_VEG, ICON_CAL, ICON_ALC,
  PASTI, ALTRI, CATEGORIE, NOME_PASTO, byId, archiviata, attive, daEvitare, trova
} from './dominio.js';
import { show, vista } from './navigazione.js';
import { renderSett, usiSett, pannelloAggiungi, initPannelloAggiungi } from './settimana.js';
import { addToShop, renderShop, pruneSpunte, inSpesa } from './spesa.js';
import { openForm, daRicetta, aggNomi } from './modulo.js';
import {
  caricaRicette, nelCestino, dalCestino, archivia as archiviaDb, togliArchivio, altreSettimane, msgDb,
  mia, puoModificare, nomeAutore, GIORNI_CESTINO
} from './dati.js';

/* ---------- lettura dal database ---------- */
let inLettura = null;
export function ricarica() {
  if (!inLettura) {
    inLettura = caricaRicette().then(function () { inLettura = null; aggiorna(); }, function (e) { inLettura = null; throw e; });
  }
  return inLettura;
}
export function primaLettura() {
  ricarica().catch(function (e) {
    $('cards').innerHTML = '<div class="empty err">Non riesco a caricare le ricette. ' + esc(msgDb(e)) +
      ' <button type="button" class="linkbtn" id="r-riprova">Riprova</button></div>';
  });
}

/* ridisegna tutto ciò che dipende dalle ricette */
export function aggiorna() {
  renderFilters(); renderCards(); renderSett(); pruneSpunte(); renderShop(); updArchBtn(); aggNomi();
  if (!$('r-detail').hidden && S.cur) {
    const c = byId(S.cur.id);
    if (c) { S.cur = c; renderDetail(); } else { S.backTo = null; vista('list'); }
  }
  if (!$('r-arch').hidden) renderArch();
  if (!$('r-cest').hidden) renderCest();
}

/* un'azione sul database alla volta: niente doppi tocchi */
let occupato = false;
async function azione(fn) {
  if (occupato) return;
  occupato = true;
  try { await fn(); } catch (e) { toast(msgDb(e)); } finally { occupato = false; }
}

function data(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- elenco e filtri ---------- */
let fPasto = 'tutti', fCat = 'tutte', fAut = '', cerca = '';
const fAltro = {};
function fchip(key, label, on, group) {
  return '<button type="button" class="fchip" data-g="' + group + '" data-k="' + key + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
}
export function renderFilters() {
  $('flt-pasto').innerHTML = PASTI.map(function (p) { return fchip(p[0], p[1], fPasto === p[0], 'pasto'); }).join('');
  $('flt-cat').innerHTML = [['tutte', 'Tutte le categorie']].concat(CATEGORIE).map(function (c) { return fchip(c[0], c[1], fCat === c[0], 'cat'); }).join('');
  if (!(S.evitare || []).length) fAltro.noevit = false;
  $('flt-altro').innerHTML = ALTRI.filter(function (p) { return p[0] !== 'noevit' || (S.evitare || []).length; })
    .map(function (p) { return fchip(p[0], p[1], !!fAltro[p[0]], 'altro'); }).join('');
  /* «Inserite da…»: solo chi ha almeno una ricetta; le generiche sono di «Anonimo» */
  const conta = {};
  S.RICETTE.forEach(function (r) { const k = r.autore || 'anonimo'; conta[k] = (conta[k] || 0) + 1; });
  const autori = Object.keys(conta).filter(function (k) { return k !== 'anonimo'; })
    .sort(function (a, b) { return nomeAutore(a).localeCompare(nomeAutore(b), 'it'); });
  if (fAut && !conta[fAut]) fAut = '';
  function o(v, l) { return '<option value="' + esc(v) + '"' + (v === fAut ? ' selected' : '') + '>' + esc(l) + '</option>'; }
  $('r-autore').innerHTML = o('', 'Tutti') + (conta.anonimo ? o('anonimo', 'Anonimo: ricette generiche (' + conta.anonimo + ')') : '') +
    autori.map(function (k) { return o(k, nomeAutore(k) + (mia({ autore: k }) ? ' (tu)' : '') + ' (' + conta[k] + ')'); }).join('');
}
function badges(r, ext) {
  let b = '';
  if (ext && mia(r)) b += '<span class="badge mine">La tua ricetta</span>';
  if (ext && archiviata(r.id)) b += '<span class="badge arch">In archivio</span>';
  if (r.categoria === 'vegana') b += '<span class="badge veg">' + ICON_VEG + 'Vegana</span>';
  else if (r.categoria === 'vegetariana') b += '<span class="badge cat">Vegetariana</span>';
  else if (r.categoria === 'pesce') b += '<span class="badge cat">Con pesce</span>';
  if (diStagione(r)) b += '<span class="badge stag">' + ICON_STAG + 'Di stagione</span>';
  if (hasCal(r)) b += '<span class="badge cal">' + ICON_CAL + 'Calabria</span>';
  if (hasAlc(r)) b += '<span class="badge alc">' + ICON_ALC + 'Con alcol</span>';
  const ev = daEvitare(r);
  if (ev.length) b += '<span class="badge evit">Contiene: ' + esc(ev.join(', ')) + '</span>';
  return b;
}
function metaTempo(r) { return r.tempo_min + ' min' + (r.riposo ? ' + riposo' : ''); }
export function renderCards() {
  if (!S.caricate) { if (!$('r-riprova')) $('cards').innerHTML = '<div class="empty">Caricamento delle ricette…</div>'; return; }
  const list = attive().filter(function (r) {
    if (fPasto !== 'tutti' && r.pasto !== fPasto) return false;
    if (fCat !== 'tutte' && r.categoria !== fCat) return false;
    if (fAut === 'anonimo' && r.autore) return false;
    if (fAut && fAut !== 'anonimo' && r.autore !== fAut) return false;
    if (fAltro.t15 && r.tempo_min > 15) return false;
    if (fAltro.t30 && r.tempo_min > 30) return false;
    if (fAltro.stag && !diStagione(r)) return false;
    if (fAltro.cal && !hasCal(r)) return false;
    if (fAltro.noalc && hasAlc(r)) return false;
    if (fAltro.mie && !mia(r)) return false;
    if (fAltro.noevit && daEvitare(r).length) return false;
    return trova(r, cerca);
  });
  $('r-conta').textContent = list.length === 1 ? '1 ricetta' : list.length + ' ricette';
  $('cards').innerHTML = list.length ? list.map(function (r) {
    return '<button type="button" class="rcard" data-id="' + esc(r.id) + '">' +
      '<h3>' + esc(r.titolo) + '</h3>' +
      '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto] || r.pasto) + '</span><span>' + metaTempo(r) + '</span><span>' + esc(r.difficolta) + '</span><span>' + esc(nomeAutore(r.autore)) + '</span></div>' +
      '<div class="badges">' + badges(r, true) + '</div></button>';
  }).join('') : '<div class="empty">' + (fAltro.mie && !S.RICETTE.some(mia) ? 'Non hai ancora ricette tue. Tocca «+ Nuova ricetta» per aggiungerne una.'
    : cerca.trim() ? 'Nessuna ricetta trovata per «' + esc(cerca.trim()) + '» con questi filtri.' : 'Nessuna ricetta con questi filtri.') + '</div>';
}

/* ---------- dettaglio ---------- */
let delArmed = null, delInfo = '';
export function openRecipe(id) {
  S.cur = byId(id); if (!S.cur) return;
  S.porz = S.cur.porzioni_base || 2; delArmed = null;
  vista('detail'); renderDetail();
}
function chi(r) {
  const inserita = r.autore ? 'Inserita da <b>' + esc(nomeAutore(r.autore)) + '</b>' + (mia(r) ? ' (tu)' : '') + ' il ' + data(r.creata_il)
    : 'Ricetta generica, firmata «Anonimo»: chiunque può modificarla.';
  const mod = r.modificata_il && r.creata_il && new Date(r.modificata_il) - new Date(r.creata_il) > 60000
    ? '<br>Ultima modifica il ' + data(r.modificata_il) + ' di <b>' + esc(nomeAutore(r.modificata_da)) + '</b>' : '';
  return '<p class="fine chi">' + inserita + mod + '</p>';
}
/* avviso prima dell'eliminazione: settimane coinvolte e spesa */
async function preparaElimina(r) {
  const mie = usiSett(r.id);
  let altre = 0, nota = '';
  try { altre = await altreSettimane(r.id); } catch (e) { nota = ' Non riesco a controllare le settimane degli altri.'; }
  const parti = [];
  if (mie.length) parti.push('nella tua settimana (' + mie.join(', ') + ')');
  if (altre) parti.push((mie.length ? 'in quella di ' : 'nella settimana di ') + altre + (altre === 1 ? ' altra persona' : ' altre persone'));
  delInfo = 'Va nel cestino per ' + GIORNI_CESTINO + ' giorni: da lì si può ripristinare.' +
    (parti.length ? ' È ' + parti.join(' e ') + ': al suo posto comparirà «Ricetta eliminata» con la scelta di un sostituto.' : '') +
    (inSpesa(r.id) ? ' Esce anche dalla lista della spesa.' : '') + nota;
}
async function elimina(r) {
  await nelCestino(r.id);
  /* dalla spesa (di tutti) la toglie il database: qui si aggiorna solo lo schermo */
  S.shop.selezione = S.shop.selezione.filter(function (x) { return x.id !== r.id; });
  delArmed = null;
  await ricarica();
  toast('«' + r.titolo + '» nel cestino', { label: 'Annulla', fn: function () { azione(function () { return ripristina(r, true); }); } });
}
async function ripristina(r, quiet) {
  await dalCestino(r.id);
  await ricarica();
  if (!quiet) toast('«' + r.titolo + '» di nuovo nel ricettario');
}
export function renderDetail() {
  const r = S.cur, porz = S.porz, f = porz / (r.porzioni_base || 2), arch = archiviata(r.id), puo = puoModificare(r), armed = delArmed === r.id;
  const ing = r.ingredienti.map(function (i) {
    const sub = i.calabrese ? '<span class="sub">Consigliato: ' + esc(i.calabrese.prodotto) + (i.calabrese.marca ? ' · ' + esc(i.calabrese.marca) : '') + (i.calabrese.dove ? ' · ' + esc(i.calabrese.dove) : '') + '</span>' : '';
    return '<li><span>' + esc(i.nome) + (ingStagione(i) === true ? '<span class="dot" title="Di stagione questo mese" aria-label="di stagione"></span>' : '') + sub + '</span><span class="q">' + fmtQ(scale(i.qta, i.unita, f), i.unita) + '</span></li>';
  }).join('');
  const tempi = r.tempo_prep != null ? '<span>Preparazione ' + r.tempo_prep + ' min</span><span>Cottura ' + (r.tempo_cottura || 0) + ' min</span>' : '<span>' + r.tempo_min + ' min</span>';
  const azioni = '<div class="panel"><div class="eyebrow">La tua raccolta</div><div class="r-actions">' +
    (puo ? '<button type="button" class="btn line small" id="d-edit">Modifica</button>' : '') +
    '<button type="button" class="btn line small" id="d-copy">Crea una tua versione</button>' +
    (arch ? '<button type="button" class="btn small" id="d-rest">Togli dall\'archivio</button>'
          : '<button type="button" class="btn line small" id="d-arch">Sposta in archivio</button>') +
    (puo ? '<button type="button" class="btn line warn small' + (armed ? ' armed' : '') + '" id="d-del">' + (armed ? 'Conferma: sposta nel cestino' : 'Elimina') + '</button>' : '') + '</div>' +
    (armed ? '<p class="warnline" role="status">' + esc(delInfo || 'Controllo le settimane…') + '</p>' : '') +
    '<p class="fine">' + (arch ? 'È nel tuo archivio: non compare nel tuo elenco, ma resta nella settimana e nella spesa.'
      : 'L\'archivio è solo tuo: toglie la ricetta dal tuo elenco senza toglierla agli altri.') +
    (puo ? '' : ' Solo chi l\'ha inserita può modificarla o eliminarla: tu puoi crearne una tua versione.') + '</p></div>';
  $('r-detail').innerHTML =
    '<button type="button" class="back" id="back">‹ ' + (S.backTo === 'settimana' ? 'Torna alla settimana' : S.backTo === 'archivio' ? 'Torna all\'archivio' : 'Tutte le ricette') + '</button>' +
    '<div class="d-head"><h2>' + esc(r.titolo) + '</h2>' +
    '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto]) + '</span>' + tempi + '<span>' + esc(r.difficolta) + '</span>' + (r.riposo ? '<span>Riposo: ' + esc(r.riposo) + '</span>' : '') + '</div>' +
    '<div class="chips">' + badges(r, true) + '</div>' + chi(r) + '</div>' +
    '<div class="panel"><div class="portions"><span class="eyebrow">Porzioni</span><div class="stepper">' +
    '<button type="button" id="p-meno" aria-label="Una porzione in meno"' + (porz <= 1 ? ' disabled' : '') + '>−</button><output id="p-val" aria-live="polite">' + porz + '</output>' +
    '<button type="button" id="p-piu" aria-label="Una porzione in più"' + (porz >= 12 ? ' disabled' : '') + '>+</button></div></div>' +
    '<ul class="ing">' + ing + '</ul>' +
    '<button type="button" class="btn" id="add-shop">Aggiungi alla spesa</button></div>' + pannelloAggiungi(r) +
    '<div class="panel"><div class="eyebrow">Procedimento</div><ol class="passi">' + r.passi.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></div>' +
    (r.note_nutrizionali ? '<div class="note">' + esc(r.note_nutrizionali) + '</div>' : '') + azioni;
  $('back').onclick = function () {
    const b = S.backTo; S.backTo = null; delArmed = null;
    if (b === 'archivio') { openArch(); return; }
    vista('list');
    if (b === 'settimana') { show('settimana'); const g = $('day-' + S.lastDay); if (g) g.scrollIntoView(); }
  };
  $('p-meno').onclick = function () { if (S.porz > 1) { S.porz--; renderDetail(); } };
  $('p-piu').onclick = function () { if (S.porz < 12) { S.porz++; renderDetail(); } };
  $('add-shop').onclick = function () { addToShop(r, S.porz); };
  initPannelloAggiungi(r);
  if ($('d-edit')) $('d-edit').onclick = function () { delArmed = null; openForm(daRicetta(r, false)); };
  $('d-copy').onclick = function () { delArmed = null; openForm(daRicetta(r, true)); };
  if ($('d-arch')) $('d-arch').onclick = function () { azione(function () { return archivia(r); }); };
  if ($('d-rest')) $('d-rest').onclick = function () { azione(function () { return togliDaArch(r); }); };
  if ($('d-del')) $('d-del').onclick = function () {
    if (delArmed !== r.id) {
      delArmed = r.id; delInfo = ''; renderDetail(); $('d-del').focus();
      preparaElimina(r).then(function () { if (delArmed === r.id && S.cur === r) { renderDetail(); $('d-del').focus(); } });
      return;
    }
    azione(function () { return elimina(r); });
  };
}

/* ---------- archivio personale ---------- */
export function updArchBtn() {
  const n = S.ARCH.filter(function (id) { return byId(id); }).length;
  $('open-arch').textContent = 'Archivio · ' + n + (n === 1 ? ' ricetta' : ' ricette');
  const c = S.CESTINO.length;
  $('open-cest').textContent = 'Cestino · ' + c + (c === 1 ? ' ricetta' : ' ricette');
}
async function archivia(r) {
  await archiviaDb(r.id);
  aggiorna();
  if (!$('r-detail').hidden && S.backTo !== 'settimana') { S.backTo = null; vista('list'); }
  toast('«' + r.titolo + '» in archivio', { label: 'Annulla', fn: function () { azione(function () { return togliDaArch(r, true); }); } });
}
async function togliDaArch(r, quiet) {
  await togliArchivio(r.id);
  aggiorna();
  if (!quiet) toast('«' + r.titolo + '» di nuovo nel tuo elenco');
}
function openArch() { delArmed = null; vista('arch'); renderArch(); }
export function renderArch() {
  const list = S.ARCH.map(byId).filter(Boolean);
  let html = '<button type="button" class="back" id="arch-back">‹ Tutte le ricette</button>' +
    '<h2>Archivio</h2><p class="lead">Il tuo archivio: le ricette che hai messo da parte non compaiono nel tuo elenco, ma restano nella settimana e nella spesa. Gli altri continuano a vederle.</p>';
  if (!list.length) html += '<div class="panel"><div class="empty">L\'archivio è vuoto. Per archiviare una ricetta aprila e tocca «Sposta in archivio».</div></div>';
  html += list.map(function (r) {
    const usi = usiSett(r.id), armed = delArmed === r.id, puo = puoModificare(r);
    const warn = armed ? '<p class="warnline" role="status">' + esc(delInfo || 'Controllo le settimane…') + '</p>' : '';
    return '<div class="panel acard"><h3>' + esc(r.titolo) + '</h3>' +
      '<div class="meta"><span>' + esc(NOME_PASTO[r.pasto] || r.pasto) + '</span><span>' + metaTempo(r) + '</span><span>' + esc(nomeAutore(r.autore)) + '</span>' + (mia(r) ? '<span class="badge mine">La tua ricetta</span>' : '') + '</div>' +
      (usi.length ? '<div class="uses">Nella settimana: ' + esc(usi.join(', ')) + '</div>' : '') + warn +
      '<div class="r-actions"><button type="button" class="btn line small" data-aopen="' + esc(r.id) + '">Apri</button>' +
      '<button type="button" class="btn small" data-arest="' + esc(r.id) + '">Rimetti nell\'elenco</button>' +
      (puo ? '<button type="button" class="btn line warn small' + (armed ? ' armed' : '') + '" data-adel="' + esc(r.id) + '">' + (armed ? 'Conferma: sposta nel cestino' : 'Elimina') + '</button>' : '') + '</div></div>';
  }).join('');
  $('r-arch').innerHTML = html;
}

/* ---------- cestino condiviso ---------- */
function openCest() { vista('cest'); renderCest(); }
export function renderCest() {
  const list = S.CESTINO;
  let html = '<button type="button" class="back" id="cest-back">‹ Tutte le ricette</button>' +
    '<h2>Cestino</h2><p class="lead">Le ricette eliminate da chiunque negli ultimi ' + GIORNI_CESTINO + ' giorni. Una ricetta generica la può ripristinare chiunque, una con autore solo chi l\'ha inserita. Dopo ' + GIORNI_CESTINO + ' giorni sparisce del tutto.</p>';
  if (!list.length) html += '<div class="panel"><div class="empty">Il cestino è vuoto.</div></div>';
  html += list.map(function (r) {
    const fine = new Date(new Date(r.eliminata_il).getTime() + GIORNI_CESTINO * 86400000).toISOString();
    return '<div class="panel acard"><h3>' + esc(r.titolo) + '</h3>' +
      '<p class="fine">Eliminata il ' + data(r.eliminata_il) + ' da <b>' + esc(nomeAutore(r.eliminata_da)) + '</b>. Sparisce del tutto il ' + data(fine) + '.<br>' +
      (r.autore ? 'Inserita da ' + esc(nomeAutore(r.autore)) + (mia(r) ? ' (tu)' : '') + '.' : 'Ricetta generica.') + '</p>' +
      (puoModificare(r) ? '<div class="r-actions"><button type="button" class="btn small" data-crest="' + esc(r.id) + '">Ripristina</button></div>'
        : '<p class="fine">La può ripristinare solo ' + esc(nomeAutore(r.autore)) + '.</p>') + '</div>';
  }).join('');
  $('r-cest').innerHTML = html;
}

export function initRicette() {
  document.querySelector('.filters').addEventListener('click', function (e) {
    const b = e.target.closest('.fchip'); if (!b) return;
    if (b.dataset.g === 'pasto') fPasto = b.dataset.k;
    else if (b.dataset.g === 'cat') fCat = b.dataset.k;
    else {
      const k = b.dataset.k; fAltro[k] = !fAltro[k];
      if (k === 't15' && fAltro.t15) fAltro.t30 = false;
      if (k === 't30' && fAltro.t30) fAltro.t15 = false;
    }
    renderFilters(); renderCards();
  });
  $('r-cerca').addEventListener('input', function (e) { cerca = e.target.value; renderCards(); });
  $('r-autore').addEventListener('change', function (e) { fAut = e.target.value; renderCards(); });
  $('cards').addEventListener('click', function (e) {
    if (e.target.id === 'r-riprova') { $('cards').innerHTML = '<div class="empty">Caricamento delle ricette…</div>'; primaLettura(); return; }
    const c = e.target.closest('.rcard'); if (c) { S.backTo = null; openRecipe(c.dataset.id); }
  });
  $('r-arch').addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'arch-back') { delArmed = null; vista('list'); return; }
    if (b.dataset.aopen) { S.backTo = 'archivio'; openRecipe(b.dataset.aopen); return; }
    const r = byId(b.dataset.arest || b.dataset.adel); if (!r) return;
    if (b.dataset.arest) { azione(function () { return togliDaArch(r); }); return; }
    if (delArmed !== r.id) {
      delArmed = r.id; delInfo = ''; renderArch();
      const sel = function () { const c = document.querySelector('[data-adel="' + r.id.replace(/"/g, '') + '"]'); if (c) c.focus(); };
      sel();
      preparaElimina(r).then(function () { if (delArmed === r.id && !$('r-arch').hidden) { renderArch(); sel(); } });
      return;
    }
    azione(function () { return elimina(r); });
  });
  $('r-cest').addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'cest-back') { vista('list'); return; }
    const r = S.CESTINO.filter(function (x) { return x.id === b.dataset.crest; })[0];
    if (r) azione(function () { return ripristina(r); });
  });
  $('open-arch').addEventListener('click', openArch);
  $('open-cest').addEventListener('click', function () {
    openCest();
    ricarica().catch(function (e) { toast(msgDb(e)); });
  });
  $('new-recipe').addEventListener('click', function () { openForm(null); });
  /* dopo «Aggiungi alla settimana» il dettaglio mostra dove compare la ricetta */
  document.addEventListener('rv-settimana', function () { if (!$('r-detail').hidden && S.cur) { const y = window.scrollY; renderDetail(); window.scrollTo(0, y); } });
  /* tornando sulla scheda Ricette dopo un po', si rileggono le ricette (modifiche degli altri) */
  document.addEventListener('rv-scheda', function (e) {
    if (e.detail === 'ricette' && S.caricate && Date.now() - S.letto > 120000) ricarica().catch(function () { /* resta la copia già letta */ });
  });
}
