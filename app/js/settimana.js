/* Settimana di esempio (data/settimana.json), collegata alla spesa.
   Ogni pasto: {slot, id, dosi?, avanzo_di?, nota?}; porzioni in spesa = persone × dosi; gli avanzi non entrano in spesa. */
import { $, esc, store, toast } from './util.js';
import { S, saveUsr, saveShop } from './stato.js';
import { diStagione, hasAlc, ICON_STAG, ICON_ALC, byId, archiviata, attive } from './dominio.js';
import { show } from './navigazione.js';
import { openRecipe } from './ricette.js';
import { renderShop } from './spesa.js';

const SLOT = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Spuntino' };
const OGGI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date().getDay()];
const GIORNO_BREVE = { lun: 'lun', mar: 'mar', mer: 'mer', gio: 'gio', ven: 'ven', sab: 'sab', dom: 'dom' };

function nomeGiorno(id) { const g = S.SETT.giorni.filter(function (x) { return x.id === id; })[0]; return g ? g.nome.toLowerCase() : id; }

/* ricetta effettiva di un pasto: sostituto scelto dall'utente, oppure quella del piano;
   un avanzo segue sempre il piatto del giorno in cui è stato cucinato */
function effId(g, p) {
  if (p.avanzo_di && S.SETT) {
    const src = S.SETT.giorni.filter(function (x) { return x.id === p.avanzo_di; })[0];
    const sp = src && src.pasti.filter(function (q) { return q.id === p.id && !q.avanzo_di; })[0];
    if (sp) return effId(src, sp);
  }
  return S.usr.sostituzioni[g.id + '|' + p.slot] || p.id;
}

/* dove compare una ricetta nel piano della settimana (pasti cucinati, non gli avanzi) */
export function usiSett(id) {
  const out = []; if (!S.SETT) return out;
  S.SETT.giorni.forEach(function (g) { g.pasti.forEach(function (p) { if (!p.avanzo_di && effId(g, p) === id) out.push(GIORNO_BREVE[g.id] + ' ' + p.slot); }); });
  return out;
}

const SLOT_PASTI = { colazione: ['colazione'], pranzo: ['pranzo', 'cena'], cena: ['cena', 'pranzo'], spuntino: ['spuntino'] };
function opzioniSost(slot) {
  const pref = SLOT_PASTI[slot] || [], att = attive().slice().sort(function (a, b) { return a.titolo.localeCompare(b.titolo, 'it'); });
  const adatte = att.filter(function (r) { return pref.indexOf(r.pasto) > -1; }), altre = att.filter(function (r) { return pref.indexOf(r.pasto) < 0; });
  function o(list) { return list.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.titolo) + '</option>'; }).join(''); }
  return '<option value="">Scegli…</option>' + (adatte.length ? '<optgroup label="Adatte a ' + esc(SLOT[slot].toLowerCase()) + '">' + o(adatte) + '</optgroup>' : '') +
    (altre.length ? '<optgroup label="Altre ricette">' + o(altre) + '</optgroup>' : '');
}

export function renderSett() {
  const SETT = S.SETT, pers = S.pers;
  if (!SETT || !S.caricate) return;
  let html = '<div class="panel"><div class="week-ctl"><span class="eyebrow">Persone</span><div class="stepper">' +
    '<button type="button" id="s-meno" aria-label="Una persona in meno"' + (pers <= 1 ? ' disabled' : '') + '>−</button><output aria-live="polite">' + pers + '</output>' +
    '<button type="button" id="s-piu" aria-label="Una persona in più"' + (pers >= 6 ? ' disabled' : '') + '>+</button></div></div>' +
    '<p>' + esc(SETT.nota) + '</p>' +
    '<button type="button" class="btn" id="sett-all">Metti tutta la settimana nella spesa</button>' +
    '<p class="fine">Le quantità tengono conto delle persone scelte e delle dosi doppie. Tocca un piatto per aprire la ricetta.</p></div>';
  html += '<div class="filter-row" role="group" aria-label="Vai al giorno">' + SETT.giorni.map(function (g) {
    return '<button type="button" class="fchip' + (g.id === OGGI ? ' oggi' : '') + '" data-go="' + g.id + '" aria-pressed="false">' + esc(g.nome.slice(0, 3)) + (g.id === OGGI ? ' · oggi' : '') + '</button>';
  }).join('') + '</div><div class="days">';
  html += SETT.giorni.map(function (g) {
    const rows = g.pasti.map(function (p) {
      const rid = effId(g, p), r = byId(rid), sost = !p.avanzo_di && S.usr.sostituzioni[g.id + '|' + p.slot];
      if (!r) {
        if (p.avanzo_di) return '<div class="meal gone"><span class="slot">' + SLOT[p.slot] + '</span><span class="t">Avanzo di un piatto eliminato</span><span class="m">scegli il sostituto nel giorno di ' + esc(nomeGiorno(p.avanzo_di)) + '</span></div>';
        const sid = 'sw-' + g.id + '-' + p.slot;
        return '<div class="meal gone"><span class="slot">' + SLOT[p.slot] + '</span><span class="t">Piatto eliminato dalla raccolta</span>' +
          '<div class="swap"><label for="' + sid + '">Scegli un sostituto</label><select id="' + sid + '" data-sw="' + g.id + '|' + p.slot + '">' + opzioniSost(p.slot) + '</select></div></div>';
      }
      let m = '<span>' + r.tempo_min + ' min</span>';
      if (p.avanzo_di) m = '<span class="badge avz">avanzo di ' + esc(nomeGiorno(p.avanzo_di)) + '</span>';
      else if (p.dosi > 1) m += '<span class="badge dose">doppia dose</span>';
      if (sost) m += '<span class="badge mine">sostituto</span>';
      if (archiviata(r.id)) m += '<span class="badge arch">in archivio</span>';
      if (!p.avanzo_di && diStagione(r)) m += '<span class="badge stag">' + ICON_STAG + 'Di stagione</span>';
      if (hasAlc(r)) m += '<span class="badge alc">' + ICON_ALC + 'Con alcol</span>';
      if (p.nota && (!sost || p.dosi > 1)) m += '<span>' + esc(p.nota) + '</span>';
      return '<button type="button" class="meal" data-id="' + esc(r.id) + '" data-day="' + g.id + '"><span class="slot">' + SLOT[p.slot] + '</span><span class="t">' + esc(r.titolo) + '</span><span class="m">' + m + '</span></button>';
    }).join('');
    return '<div class="panel day' + (g.id === OGGI ? ' oggi' : '') + '" id="day-' + g.id + '"><div class="day-h"><h3>' + esc(g.nome) + (g.id === OGGI ? '<span class="badge stag">oggi</span>' : '') + '</h3>' +
      '<button type="button" class="addp" data-addday="' + g.id + '">Spesa del giorno</button></div><div class="meals">' + rows + '</div></div>';
  }).join('') + '</div>';
  if (SETT.consigli && SETT.consigli.length) html += '<div class="panel"><div class="eyebrow">Per organizzarti</div><ul class="consigli">' + SETT.consigli.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
  $('sett').innerHTML = html;
}

function settToShop(giorni) {
  const shop = S.shop, pers = S.pers, gia = {};
  let n = 0, mancanti = 0, somm = 0;
  shop.selezione.forEach(function (x) { gia[x.id] = true; });
  giorni.forEach(function (g) {
    g.pasti.forEach(function (p) {
      if (p.avanzo_di) return;
      const r = byId(effId(g, p)); if (!r) { mancanti++; return; }
      const q = pers * (p.dosi || 1), s = shop.selezione.filter(function (x) { return x.id === r.id; })[0];
      if (gia[r.id]) somm++;
      if (s) s.porzioni = Math.min(48, s.porzioni + q); else shop.selezione.push({ id: r.id, porzioni: q });
      n++;
    });
  });
  S.clearArmed = false; saveShop(); renderShop();
  toast(n + (n === 1 ? ' piatto aggiunto' : ' piatti aggiunti') + ' alla spesa per ' + pers + (pers === 1 ? ' persona' : ' persone') +
    (somm ? '. ' + somm + (somm === 1 ? ' era già in lista: porzioni sommate' : ' erano già in lista: porzioni sommate') : '') +
    (mancanti ? '. ' + mancanti + (mancanti === 1 ? ' piatto eliminato escluso: scegli un sostituto' : ' piatti eliminati esclusi: scegli i sostituti') : ''));
}

export function initSettimana() {
  const el = $('sett');
  el.addEventListener('change', function (e) {
    const k = e.target.dataset && e.target.dataset.sw; if (!k || !e.target.value) return;
    const r = byId(e.target.value); if (!r) return;
    S.usr.sostituzioni[k] = r.id; saveUsr(); renderSett();
    toast('Sostituto scelto: ' + r.titolo);
  });
  el.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 's-meno' || b.id === 's-piu') { S.pers = Math.max(1, Math.min(6, S.pers + (b.id === 's-piu' ? 1 : -1))); store('rv-sett-pers', String(S.pers)); renderSett(); return; }
    if (b.id === 'sett-all') { settToShop(S.SETT.giorni); return; }
    if (b.dataset.addday) { settToShop(S.SETT.giorni.filter(function (g) { return g.id === b.dataset.addday; })); return; }
    if (b.dataset.go) { const d = $('day-' + b.dataset.go); if (d) d.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    if (b.classList.contains('meal')) { S.backTo = 'settimana'; S.lastDay = b.dataset.day; show('ricette'); openRecipe(b.dataset.id); }
  });
}
