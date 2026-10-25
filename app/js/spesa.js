/* Lista della spesa: ricette scelte + voci a mano + spunte, salvate su questo browser. */
import { $, esc, toast } from './util.js';
import { S, normShop, saveShop, updSync } from './stato.js';
import { scale, fmtQ, REPARTI, byId } from './dominio.js';
import { updDisp } from './stagione.js';

function vuota(s) { return !s.selezione.length && !s.extra.length; }
function chiave(nome, unita) { return nome.toLowerCase().trim() + '|' + unita; }
export function inSpesa(id) { return S.shop.selezione.some(function (x) { return x.id === id; }); }

/* in spesa le dosi a cucchiai e pizzichi non si sommano: sono prodotti da avere in dispensa (q.b.);
   i rametti si arrotondano all'intero per eccesso */
const DA_DISPENSA = { cucchiaio: 1, cucchiaino: 1, pizzico: 1 };
function vociSpesa() {
  const m = {}, out = [], nomi = {};
  S.shop.selezione.forEach(function (s) {
    const r = byId(s.id); if (!r) return;
    const f = s.porzioni / (r.porzioni_base || 2);
    r.ingredienti.forEach(function (i) {
      const u = DA_DISPENSA[i.unita] ? 'q.b.' : i.unita;
      const k = chiave(i.nome, u), q = (i.qta == null || u === 'q.b.') ? null : i.qta * f;
      let v = m[k];
      if (!v) { v = m[k] = { k: k, nome: i.nome, unita: u, raw: q, reparto: i.reparto || 'dispensa', calabrese: i.calabrese || null }; out.push(v); }
      else if (q != null && v.raw != null) v.raw += q;
      if (!v.calabrese && i.calabrese) v.calabrese = i.calabrese;
      nomi[i.nome.toLowerCase().trim()] = true;
    });
  });
  out.forEach(function (v) { v.qta = v.unita === 'rametto' && v.raw != null ? Math.ceil(v.raw - 0.01) : scale(v.raw, v.unita, 1); });
  S.shop.extra.forEach(function (x) {
    const n = x.nome.toLowerCase().trim(), k = 'mano|' + n;
    if (nomi[n]) return; /* già presente dalle ricette: niente doppione */
    if (!m[k]) { m[k] = { k: k, nome: x.nome, reparto: x.reparto || 'dispensa', manuale: true }; out.push(m[k]); }
  });
  return out;
}

export function addToShop(r, p) {
  const s = S.shop.selezione.filter(function (x) { return x.id === r.id; })[0];
  if (s) { s.porzioni = Math.min(48, s.porzioni + p); toast(r.titolo + ': ora ' + s.porzioni + ' porzioni in lista'); }
  else { S.shop.selezione.push({ id: r.id, porzioni: p }); toast(r.titolo + ' in lista (' + p + (p > 1 ? ' porzioni)' : ' porzione)')); }
  S.clearArmed = false; saveShop(); renderShop();
}

export function renderShop() {
  const c = $('shop-count'), shop = S.shop;
  if (vuota(shop)) {
    c.hidden = true; S.clearArmed = false;
    updDisp();
    $('shop').innerHTML = '<div class="empty">La lista è vuota. Apri una ricetta, scegli le porzioni e tocca «Aggiungi alla spesa», oppure scrivi qui sotto una voce a mano.</div>' + formAdd() + '<p class="fine sync" id="shop-sync"></p>';
    updSync(); return;
  }
  if (shop.selezione.length && !S.caricate) { $('shop').innerHTML = '<div class="empty">Caricamento della lista…</div>'; return; }
  const all = vociSpesa(), done = {};
  shop.spunte.forEach(function (k) { done[k] = true; });
  const left = all.filter(function (v) { return !done[v.k]; }).length;
  c.hidden = !left; c.textContent = left;

  let html = '<div class="shop-head"><span>' + left + ' da comprare su ' + all.length + '</span>' +
    '<button type="button" class="back' + (S.clearArmed ? ' warn' : '') + '" id="shop-clear">' + (S.clearArmed ? 'Tocca ancora per svuotare' : 'Svuota') + '</button></div>';
  if (shop.selezione.length) {
    html += '<div class="rsel"><span class="eyebrow">Ricette in lista</span><div class="rsel-list">' + shop.selezione.map(function (s) {
      const r = byId(s.id); if (!r) return '';
      return '<span class="rpill"><span>' + esc(r.titolo) + ' <b>· ' + s.porzioni + '</b></span>' +
        '<button type="button" data-rm="' + esc(s.id) + '" aria-label="Togli ' + esc(r.titolo) + ' dalla lista">×</button></span>';
    }).join('') + '</div></div>';
  }
  let n = 0;
  REPARTI.forEach(function (rp) {
    const items = all.filter(function (v) { return v.reparto === rp[0]; });
    if (!items.length) return;
    items.sort(function (a, b) { return (done[a.k] ? 1 : 0) - (done[b.k] ? 1 : 0) || a.nome.localeCompare(b.nome, 'it'); });
    html += '<div class="dept"><h3>' + rp[1] + '</h3>' + items.map(function (v) {
      const id = 'sh-' + (n++) + '-' + v.k.replace(/[^a-z0-9]/g, '-').slice(0, 30), on = !!done[v.k];
      const sub = v.calabrese ? '<span class="sub">Calabrese: ' + esc(v.calabrese.prodotto) + (v.calabrese.dove ? ' · ' + esc(v.calabrese.dove) : '') + '</span>' : '';
      const right = v.manuale ? '<button type="button" class="rm" data-rmx="' + esc(v.nome) + '" aria-label="Togli ' + esc(v.nome) + '">×</button>' : '<span class="q">' + fmtQ(v.qta, v.unita) + '</span>';
      return '<div class="item' + (on ? ' done' : '') + '"><input type="checkbox" id="' + id + '" data-k="' + esc(v.k) + '"' + (on ? ' checked' : '') + '>' +
        '<label class="n" for="' + id + '">' + esc(v.nome) + sub + '</label>' + right + '</div>';
    }).join('') + '</div>';
  });
  html += formAdd() + '<p class="fine sync" id="shop-sync"></p>';
  $('shop').innerHTML = html;
  updSync(); updDisp();
}
function formAdd() {
  return '<form class="addrow" id="shop-add" autocomplete="off"><label class="eyebrow" for="shop-new">Aggiungi una voce</label>' +
    '<div class="addrow-f"><input id="shop-new" type="text" maxlength="60" placeholder="es. Bevanda di soia con calcio">' +
    '<select id="shop-rep" aria-label="Reparto">' + REPARTI.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === 'dispensa' ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select>' +
    '<button type="submit" class="btn small">Aggiungi</button></div></form>';
}
export function pruneSpunte() {
  if (!S.caricate) return;
  const keys = {}; vociSpesa().forEach(function (v) { keys[v.k] = true; });
  S.shop.spunte = S.shop.spunte.filter(function (k) { return keys[k]; });
}

export function initSpesa() {
  const el = $('shop');
  el.addEventListener('change', function (e) {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    const i = S.shop.spunte.indexOf(k);
    if (e.target.checked && i < 0) S.shop.spunte.push(k);
    if (!e.target.checked && i > -1) S.shop.spunte.splice(i, 1);
    S.clearArmed = false; saveShop(); renderShop();
  });
  el.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'shop-clear') {
      if (!S.clearArmed) { S.clearArmed = true; renderShop(); return; }
      S.shop = normShop(null); S.clearArmed = false; saveShop(); renderShop(); toast('Lista svuotata'); return;
    }
    if (b.dataset.rm) { S.shop.selezione = S.shop.selezione.filter(function (x) { return x.id !== b.dataset.rm; }); pruneSpunte(); saveShop(); renderShop(); return; }
    if (b.dataset.rmx) { const nm = b.dataset.rmx; S.shop.extra = S.shop.extra.filter(function (x) { return x.nome !== nm; }); pruneSpunte(); saveShop(); renderShop(); }
  });
  el.addEventListener('submit', function (e) {
    e.preventDefault();
    const inp = $('shop-new'), nome = (inp.value || '').replace(/\s+/g, ' ').trim(); if (!nome) { inp.focus(); return; }
    if (!S.shop.extra.some(function (x) { return x.nome.toLowerCase() === nome.toLowerCase(); })) S.shop.extra.push({ nome: nome, reparto: $('shop-rep').value });
    saveShop(); renderShop(); toast(nome + ' aggiunto alla lista');
    const ni = $('shop-new'); if (ni) ni.focus();
  });
}
