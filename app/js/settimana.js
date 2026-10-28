/* Settimana personale, sul database: parte dalla settimana d'esempio (data/settimana.json) e si cambia pasto per pasto.
   Ogni pasto: {ricetta, dosi, avanzo_di, nota}; porzioni in spesa = persone × dosi; gli avanzi non entrano in spesa.
   Una ricetta nel cestino (o cancellata) lascia il posto a «Piatto eliminato» con la scelta del sostituto;
   se torna dal cestino ricompare da sola, perché il pasto la indica ancora. */
import { $, esc, store, toast } from './util.js';
import { S } from './stato.js';
import { diStagione, hasAlc, ICON_STAG, ICON_ALC, byId, archiviata, attive } from './dominio.js';
import { show } from './navigazione.js';
import { openRecipe } from './ricette.js';
import { renderShop, piuPorzioni, inSpesa } from './spesa.js';
import { scrivi, ricaricaPersonali } from './personali.js';
import { salvaPasto, togliPasto, aggiornaAvanzi, avviaSettimana, svuotaSettimana } from './dati.js';

export const GIORNI = [['lun', 'Lunedì'], ['mar', 'Martedì'], ['mer', 'Mercoledì'], ['gio', 'Giovedì'], ['ven', 'Venerdì'], ['sab', 'Sabato'], ['dom', 'Domenica']];
export const SLOT = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntino' };
const ORDINE = ['colazione', 'pranzo', 'cena', 'spuntino'];
export const OGGI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date().getDay()];

function nomeGiorno(id) { const g = GIORNI.filter(function (x) { return x[0] === id; })[0]; return g ? g[1] : id; }
function pasto(g, slot) { return S.MIA[g + '|' + slot] || null; }

/* piatto da cui viene un avanzo: nel giorno indicato, stessa ricetta, cucinato (non a sua volta avanzo) */
function origine(p) {
  if (!p.avanzo_di) return null;
  for (let i = 0; i < ORDINE.length; i++) {
    const q = pasto(p.avanzo_di, ORDINE[i]);
    if (q && !q.avanzo_di && q.ricetta === p.ricetta) return q;
  }
  return null;
}

/* dove compare una ricetta nella propria settimana (pasti cucinati, non gli avanzi) */
export function usiSett(id) {
  const out = [];
  GIORNI.forEach(function (g) {
    ORDINE.forEach(function (s) { const p = pasto(g[0], s); if (p && !p.avanzo_di && p.ricetta === id) out.push(g[0] + ' ' + s); });
  });
  return out;
}

const SLOT_PASTI = { colazione: ['colazione'], pranzo: ['pranzo', 'cena'], cena: ['cena', 'pranzo'], spuntino: ['spuntino'] };
export function opzioniRicette(slot, scelta) {
  const pref = SLOT_PASTI[slot] || [], att = attive().slice().sort(function (a, b) { return a.titolo.localeCompare(b.titolo, 'it'); });
  if (scelta && !att.some(function (r) { return r.id === scelta; }) && byId(scelta)) att.unshift(byId(scelta));
  const adatte = att.filter(function (r) { return pref.indexOf(r.pasto) > -1; }), altre = att.filter(function (r) { return pref.indexOf(r.pasto) < 0; });
  function o(list) { return list.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === scelta ? ' selected' : '') + '>' + esc(r.titolo) + '</option>'; }).join(''); }
  return '<option value="">Scegli…</option>' + (adatte.length ? '<optgroup label="Adatte a ' + esc(SLOT[slot].toLowerCase()) + '">' + o(adatte) + '</optgroup>' : '') +
    (altre.length ? '<optgroup label="Altre ricette">' + o(altre) + '</optgroup>' : '');
}

/* ---------- scritture ---------- */
/* mette una ricetta in un pasto; gli avanzi cucinati da quel piatto lo seguono (o diventano piatti normali) */
export function mettiPasto(g, slot, ricetta, dosi) {
  const k = g + '|' + slot, prima = S.MIA[k] || null;
  const tieniNota = prima && !prima.avanzo_di && prima.dosi > 1 && dosi === prima.dosi;
  const nuovo = { ricetta: ricetta, dosi: dosi, avanzo_di: null, nota: tieniNota ? prima.nota : '' };
  S.MIA[k] = nuovo;
  const vecchia = prima && !prima.avanzo_di ? prima.ricetta : undefined;
  if (vecchia !== undefined) seguiAvanzi(g, vecchia, dosi > 1 ? ricetta : null);
  scrivi(async function () {
    await salvaPasto(g, slot, nuovo);
    if (vecchia !== undefined && vecchia !== ricetta) await aggiornaAvanzi(g, vecchia, dosi > 1 ? ricetta : null);
    else if (vecchia !== undefined && dosi < 2) await aggiornaAvanzi(g, vecchia, null);
  });
}
function seguiAvanzi(g, vecchia, nuova) {
  Object.keys(S.MIA).forEach(function (k) {
    const p = S.MIA[k];
    if (p.avanzo_di !== g || p.ricetta !== vecchia) return;
    if (nuova) p.ricetta = nuova; else { p.avanzo_di = null; p.nota = ''; }
  });
}
function togli(g, slot) {
  const k = g + '|' + slot, prima = S.MIA[k];
  if (!prima) return;
  delete S.MIA[k];
  if (!prima.avanzo_di) seguiAvanzi(g, prima.ricetta, null);
  scrivi(async function () {
    await togliPasto(g, slot);
    if (!prima.avanzo_di) await aggiornaAvanzi(g, prima.ricetta, null);
  });
}

/* ---------- disegno ---------- */
let inModifica = null, ripartiArmato = false;

function rigaModifica(g, slot, p) {
  const id = 'mod-' + g + '-' + slot, doppia = p && !p.avanzo_di && p.dosi > 1;
  return '<div class="meal edit" data-k="' + g + '|' + slot + '"><span class="slot">' + SLOT[slot] + '</span>' +
    '<div class="swap"><label for="' + id + '">' + (p ? 'Cambia il piatto' : 'Scegli il piatto') + '</label>' +
    '<select id="' + id + '">' + opzioniRicette(slot, p && p.ricetta && byId(p.ricetta) ? p.ricetta : '') + '</select>' +
    '<label class="ck"><input type="checkbox" id="' + id + '-d"' + (doppia ? ' checked' : '') + '><span>Doppia dose</span></label>' +
    '<div class="r-actions"><button type="button" class="btn small" data-salva>Salva</button>' +
    '<button type="button" class="btn line small" data-annulla>Annulla</button>' +
    (p ? '<button type="button" class="btn line warn small" data-togli>Togli il pasto</button>' : '') + '</div></div></div>';
}

function rigaPasto(g, slot) {
  const p = pasto(g, slot), k = g + '|' + slot;
  if (inModifica === k) return rigaModifica(g, slot, p);
  const cambia = '<button type="button" class="mod" data-mod="' + k + '" aria-label="' + (p ? 'Cambia' : 'Scegli') + ' ' + esc(SLOT[slot].toLowerCase()) + ' di ' + esc(nomeGiorno(g).toLowerCase()) + '">' + (p ? 'Cambia' : 'Scegli') + '</button>';
  if (!p) return '<div class="meal-r"><div class="meal vuoto"><span class="slot">' + SLOT[slot] + '</span><span class="t">Nessun piatto</span></div>' + cambia + '</div>';
  const r = p.ricetta ? byId(p.ricetta) : null;
  if (!r) {
    if (p.avanzo_di && origine(p)) return '<div class="meal-r"><div class="meal gone"><span class="slot">' + SLOT[slot] + '</span><span class="t">Avanzo di un piatto eliminato</span><span class="m">scegli il sostituto nel giorno di ' + esc(nomeGiorno(p.avanzo_di).toLowerCase()) + '</span></div>' + cambia + '</div>';
    const sid = 'sw-' + g + '-' + slot;
    return '<div class="meal-r"><div class="meal gone"><span class="slot">' + SLOT[slot] + '</span><span class="t">Ricetta eliminata</span>' +
      '<div class="swap"><label for="' + sid + '">Scegli un sostituto</label><select id="' + sid + '" data-sw="' + k + '">' + opzioniRicette(slot, '') + '</select></div></div>' + cambia + '</div>';
  }
  let m = '<span>' + r.tempo_min + ' min</span>';
  if (p.avanzo_di) m = '<span class="badge avz">avanzo di ' + esc(nomeGiorno(p.avanzo_di).toLowerCase()) + '</span>';
  else if (p.dosi > 1) m += '<span class="badge dose">' + (p.dosi === 2 ? 'doppia dose' : p.dosi + ' dosi') + '</span>';
  if (archiviata(r.id)) m += '<span class="badge arch">in archivio</span>';
  if (!p.avanzo_di && diStagione(r)) m += '<span class="badge stag">' + ICON_STAG + 'Di stagione</span>';
  if (hasAlc(r)) m += '<span class="badge alc">' + ICON_ALC + 'Con alcol</span>';
  if (p.nota) m += '<span>' + esc(p.nota) + '</span>';
  return '<div class="meal-r"><button type="button" class="meal" data-id="' + esc(r.id) + '" data-day="' + g + '"><span class="slot">' + SLOT[slot] + '</span><span class="t">' + esc(r.titolo) + '</span><span class="m">' + m + '</span></button>' + cambia + '</div>';
}

export function renderSett() {
  const pers = S.pers;
  if (!S.personali || !S.caricate) {
    $('sett').innerHTML = S.erroPers ? '<div class="empty err">Non riesco a leggere la settimana. ' + esc(S.erroPers) + ' <button type="button" class="linkbtn" data-riprova-pers>Riprova</button></div>'
      : '<div class="empty">Caricamento della settimana…</div>';
    return;
  }
  let html = '<div class="panel"><div class="week-ctl"><span class="eyebrow">Persone</span><div class="stepper">' +
    '<button type="button" id="s-meno" aria-label="Una persona in meno"' + (pers <= 1 ? ' disabled' : '') + '>−</button><output aria-live="polite">' + pers + '</output>' +
    '<button type="button" id="s-piu" aria-label="Una persona in più"' + (pers >= 6 ? ' disabled' : '') + '>+</button></div></div>' +
    '<button type="button" class="btn" id="sett-all">Metti tutta la settimana nella spesa</button>' +
    '<p class="fine">Le quantità tengono conto delle persone scelte e delle dosi doppie. Tocca un piatto per aprire la ricetta, «Cambia» per sceglierne un altro.</p></div>';
  html += '<div class="filter-row" role="group" aria-label="Vai al giorno">' + GIORNI.map(function (g) {
    return '<button type="button" class="fchip' + (g[0] === OGGI ? ' oggi' : '') + '" data-go="' + g[0] + '">' + esc(g[1].slice(0, 3)) + (g[0] === OGGI ? ' · oggi' : '') + '</button>';
  }).join('') + '</div><div class="days">';
  html += GIORNI.map(function (g) {
    const rows = ORDINE.map(function (s) { return rigaPasto(g[0], s); }).join('');
    return '<div class="panel day' + (g[0] === OGGI ? ' oggi' : '') + '" id="day-' + g[0] + '"><div class="day-h"><h3>' + esc(g[1]) + (g[0] === OGGI ? '<span class="badge stag">oggi</span>' : '') + '</h3>' +
      '<button type="button" class="addp" data-addday="' + g[0] + '">Spesa del giorno</button></div><div class="meals">' + rows + '</div></div>';
  }).join('') + '</div>';
  const SETT = S.SETT;
  html += '<div class="panel"><div class="eyebrow">Il piano d\'esempio</div>' +
    (SETT ? '<p><b>' + esc(SETT.titolo) + '.</b> ' + esc(SETT.nota) + '</p>' +
      (SETT.consigli && SETT.consigli.length ? '<ul class="consigli">' + SETT.consigli.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') : '') +
    '<p class="fine">La tua settimana è salvata nel tuo account. Gli altri del gruppo possono vederla, note comprese, ma solo tu puoi cambiarla.</p>' +
    '<div class="r-actions"><button type="button" class="btn line small' + (ripartiArmato ? ' armed warn' : '') + '" id="sett-riparti">' +
    (ripartiArmato ? 'Conferma: rimetti il piano d\'esempio' : 'Riparti dal piano d\'esempio') + '</button></div>' +
    (ripartiArmato ? '<p class="warnline" role="status">Tutti i pasti della tua settimana tornano quelli del piano d\'esempio.</p>' : '') + '</div>';
  $('sett').innerHTML = html;
}

/* ---------- invio alla spesa ---------- */
function settToShop(giorni) {
  const pers = S.pers;
  let n = 0, mancanti = 0, somm = 0;
  giorni.forEach(function (g) {
    ORDINE.forEach(function (s) {
      const p = pasto(g, s);
      if (!p || p.avanzo_di) return;
      const r = p.ricetta ? byId(p.ricetta) : null; if (!r) { mancanti++; return; }
      if (inSpesa(r.id)) somm++;
      piuPorzioni(r, pers * (p.dosi || 1));
      n++;
    });
  });
  S.clearArmed = false; renderShop();
  toast(n + (n === 1 ? ' piatto aggiunto' : ' piatti aggiunti') + ' alla spesa per ' + pers + (pers === 1 ? ' persona' : ' persone') +
    (somm ? '. ' + somm + (somm === 1 ? ' era già in lista: porzioni sommate' : ' erano già in lista: porzioni sommate') : '') +
    (mancanti ? '. ' + mancanti + (mancanti === 1 ? ' piatto eliminato escluso: scegli un sostituto' : ' piatti eliminati esclusi: scegli i sostituti') : ''));
}

function riparti() {
  ripartiArmato = false; inModifica = null;
  scrivi(async function () {
    await svuotaSettimana();
    await avviaSettimana(S.SETT);
    await ricaricaPersonali(false);
    toast('La settimana è tornata quella del piano d\'esempio');
  });
}

export function initSettimana() {
  const el = $('sett');
  el.addEventListener('change', function (e) {
    const k = e.target.dataset && e.target.dataset.sw; if (!k || !e.target.value) return;
    const r = byId(e.target.value); if (!r) return;
    const [g, s] = k.split('|'), p = S.MIA[k];
    mettiPasto(g, s, r.id, p && !p.avanzo_di ? p.dosi : 1);
    renderSett(); toast('Sostituto scelto: ' + r.titolo);
  });
  el.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 's-meno' || b.id === 's-piu') { S.pers = Math.max(1, Math.min(6, S.pers + (b.id === 's-piu' ? 1 : -1))); store('rv-sett-pers', String(S.pers)); renderSett(); return; }
    if (b.id === 'sett-all') { settToShop(GIORNI.map(function (g) { return g[0]; })); return; }
    if (b.id === 'sett-riparti') { if (ripartiArmato && S.SETT) riparti(); else ripartiArmato = true; renderSett(); if ($('sett-riparti')) $('sett-riparti').focus(); return; }
    if (b.dataset.addday) { settToShop([b.dataset.addday]); return; }
    if (b.dataset.go) { const d = $('day-' + b.dataset.go); if (d) d.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    if (b.dataset.mod) {
      inModifica = b.dataset.mod; ripartiArmato = false; renderSett();
      const sel = $('mod-' + inModifica.replace('|', '-')); if (sel) sel.focus();
      return;
    }
    const riga = b.closest('.meal.edit');
    if (riga) {
      const k = riga.dataset.k, [g, s] = k.split('|'), id = 'mod-' + g + '-' + s;
      if (b.hasAttribute('data-annulla')) { inModifica = null; renderSett(); focusMod(k); return; }
      if (b.hasAttribute('data-togli')) { inModifica = null; togli(g, s); renderSett(); focusMod(k); toast(SLOT[s] + ' di ' + nomeGiorno(g).toLowerCase() + ' tolto'); return; }
      if (b.hasAttribute('data-salva')) {
        const r = byId($(id).value);
        if (!r) { toast('Scegli una ricetta.'); $(id).focus(); return; }
        inModifica = null; mettiPasto(g, s, r.id, $(id + '-d').checked ? 2 : 1); renderSett(); focusMod(k);
        toast(SLOT[s] + ' di ' + nomeGiorno(g).toLowerCase() + ': ' + r.titolo);
      }
      return;
    }
    if (b.classList.contains('meal')) { S.backTo = 'settimana'; S.lastDay = b.dataset.day; show('ricette'); openRecipe(b.dataset.id); }
  });
}
function focusMod(k) { const b = document.querySelector('[data-mod="' + k + '"]'); if (b) b.focus(); }

/* ---------- «Aggiungi alla settimana» dal dettaglio di una ricetta ---------- */
let aggArmato = '', scelta = null; /* ultima scelta per questa ricetta: resta dopo il ridisegno */
export function pannelloAggiungi(r) {
  const prec = scelta && scelta.id === r.id ? scelta : null;
  const g0 = prec ? prec.g : OGGI, slot0 = prec ? prec.s : SLOT[r.pasto] ? r.pasto : 'pranzo';
  const usi = usiSett(r.id).map(function (u) { const x = u.split(' '); return nomeGiorno(x[0]).toLowerCase() + ' a ' + SLOT[x[1]].toLowerCase(); });
  return '<div class="panel"><div class="eyebrow">Aggiungi alla settimana</div>' +
    '<div class="addw"><label class="sr" for="w-giorno">Giorno</label><select id="w-giorno">' +
    GIORNI.map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === g0 ? ' selected' : '') + '>' + g[1] + (g[0] === OGGI ? ' (oggi)' : '') + '</option>'; }).join('') + '</select>' +
    '<label class="sr" for="w-pasto">Pasto</label><select id="w-pasto">' +
    ORDINE.map(function (s) { return '<option value="' + s + '"' + (s === slot0 ? ' selected' : '') + '>' + SLOT[s] + '</option>'; }).join('') + '</select>' +
    '<label class="ck"><input type="checkbox" id="w-doppia"' + (prec && prec.d ? ' checked' : '') + '><span>Doppia dose</span></label></div>' +
    '<button type="button" class="btn line" id="w-add">Aggiungi alla settimana</button>' +
    '<p class="warnline" id="w-avviso" role="status"></p>' +
    (usi.length ? '<p class="fine">Già nella tua settimana: ' + esc(usi.join(', ')) + '.</p>' : '') + '</div>';
}
export function initPannelloAggiungi(r) {
  aggArmato = '';
  const avviso = function (t) { $('w-avviso').textContent = t; };
  const disarma = function () { aggArmato = ''; avviso(''); $('w-add').textContent = 'Aggiungi alla settimana'; };
  $('w-giorno').onchange = disarma; $('w-pasto').onchange = disarma;
  $('w-add').onclick = function () {
    if (!S.personali) { toast('La settimana non è ancora stata letta: riprova tra poco.'); return; }
    const g = $('w-giorno').value, s = $('w-pasto').value, k = g + '|' + s, p = S.MIA[k];
    const altra = p && p.ricetta !== r.id ? (p.ricetta && byId(p.ricetta) ? byId(p.ricetta).titolo : 'un piatto eliminato') : '';
    if (altra && aggArmato !== k) {
      aggArmato = k; avviso('Al posto di «' + altra + '»' + (p.avanzo_di ? ' (avanzo)' : '') + '. Tocca ancora per confermare.');
      $('w-add').textContent = 'Conferma: sostituisci'; return;
    }
    mettiPasto(g, s, r.id, $('w-doppia').checked ? 2 : 1);
    scelta = { id: r.id, g: g, s: s, d: $('w-doppia').checked };
    disarma();
    toast('«' + r.titolo + '»: ' + nomeGiorno(g).toLowerCase() + ', ' + SLOT[s].toLowerCase(), { label: 'Vai alla settimana', fn: function () { S.backTo = null; show('settimana'); const d = $('day-' + g); if (d) d.scrollIntoView(); } });
    renderSett();
    document.dispatchEvent(new CustomEvent('rv-settimana'));
    if ($('w-add')) $('w-add').focus({ preventScroll: true });
  };
}
