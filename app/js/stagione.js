/* Scheda Stagione: calendario di frutta e verdura e dispensa di base (collegata alla spesa). */
import { $, esc, toast } from './util.js';
import { S, saveShop } from './stato.js';
import { MESE, MESI } from './dominio.js';
import { renderShop, pruneSpunte } from './spesa.js';

/* ---------- calendario di stagione ---------- */
let meseSel = MESE;
export function renderMesi() {
  $('mesi').innerHTML = MESI.map(function (m, i) {
    const k = i + 1;
    return '<button type="button" class="fchip' + (k === MESE ? ' oggi' : '') + '" data-m="' + k + '" aria-pressed="' + (k === meseSel) + '" aria-label="' + m + (k === MESE ? ', mese corrente' : '') + '" title="' + m + '">' + m.slice(0, 3) + '</button>';
  }).join('');
}
export function renderSeas() {
  const CAL = S.CAL; if (!CAL) return;
  const prev = meseSel === 1 ? 12 : meseSel - 1, next = meseSel === 12 ? 1 : meseSel + 1;
  let html = '';
  [['verdura', 'Verdura'], ['frutta', 'Frutta']].forEach(function (t) {
    const list = CAL.prodotti.filter(function (p) { return p.tipo === t[0] && p.fonte !== 'conservazione' && p.mesi.indexOf(meseSel) > -1 && p.mesi.length < 12; });
    list.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it'); });
    html += '<div class="seas-g"><div class="eyebrow">' + t[1] + ' a ' + MESI[meseSel - 1].toLowerCase() + '<span>' + list.length + '</span></div><div class="prod">' +
      (list.length ? list.map(function (p) {
        const cls = p.mesi.indexOf(prev) < 0 ? 'nuovo' : (p.mesi.indexOf(next) < 0 ? 'ultimo' : '');
        return '<span' + (cls ? ' class="' + cls + '"' : '') + ' title="' + (cls === 'nuovo' ? 'Arriva questo mese' : cls === 'ultimo' ? 'Ultimo mese' : 'Di stagione') + '">' + esc(p.nome) + '</span>';
      }).join('') : '<span>nessun prodotto</span>') + '</div></div>';
  });
  const sempre = CAL.prodotti.filter(function (p) { return p.mesi.length === 12; }).map(function (p) { return p.nome.toLowerCase(); });
  html += '<p class="fine">Tutto l\'anno: ' + esc(sempre.join(', ')) + '.</p>';
  $('seas').innerHTML = html;
}
export function renderFonte(d) {
  if (d.fonte) {
    $('seas-fonte').innerHTML = 'Fonte: <a href="' + esc(d.fonte.url) + '" target="_blank" rel="noopener">' + esc(d.fonte.titolo) + '</a>. ' +
      esc(d.nota_integrazioni || '') + (d.nota_stagionalita ? ' ' + esc(d.nota_stagionalita) : '');
  }
}

/* ---------- dispensa di base, collegata alla spesa come voci a mano ---------- */
function inLista(nome) { const n = nome.toLowerCase(); return S.shop.extra.some(function (x) { return x.nome.toLowerCase() === n; }); }
export function renderDisp() {
  if (!S.DISP) return;
  $('disp').innerHTML = S.DISP.gruppi.map(function (g, gi) {
    return '<details class="' + (g.id === 'calabria' ? 'cal-g' : '') + '"' + (gi === 0 ? ' open' : '') + '><summary><span class="nn">' + esc(g.titolo) + '</span><span class="nk">' + g.voci.length + ' prodotti</span></summary><div class="nb">' +
      (g.nota ? '<p class="fine">' + esc(g.nota) + '</p>' : '') + '<div>' +
      g.voci.map(function (v) {
        const c = v.calabrese, on = inLista(v.nome);
        const sub = c ? '<span class="sub">' + esc(c.prodotto) + (c.marca ? ' · ' + esc(c.marca) : '') + (c.dove ? ' · ' + esc(c.dove) : '') + '</span>' : '';
        return '<div class="pitem"><span class="n">' + esc(v.nome) + (v.nota ? '<span class="d">' + esc(v.nota) + '</span>' : '') + sub + '</span>' +
          '<button type="button" class="addp" data-dn="' + esc(v.nome) + '" data-dr="' + esc(v.reparto) + '" aria-pressed="' + on + '">' + (on ? 'In lista ✓' : 'Aggiungi') + '</button></div>';
      }).join('') + '</div></div></details>';
  }).join('');
}
export function updDisp() {
  if (!S.DISP) return;
  Array.prototype.forEach.call(document.querySelectorAll('#disp .addp'), function (b) {
    const on = inLista(b.dataset.dn); b.setAttribute('aria-pressed', on); b.textContent = on ? 'In lista ✓' : 'Aggiungi';
  });
}

export function initStagione() {
  $('mesi').addEventListener('click', function (e) {
    const b = e.target.closest('.fchip'); if (!b) return;
    meseSel = +b.dataset.m; renderMesi(); renderSeas();
  });
  $('disp').addEventListener('click', function (e) {
    const b = e.target.closest('.addp'); if (!b) return;
    const nome = b.dataset.dn;
    if (inLista(nome)) { S.shop.extra = S.shop.extra.filter(function (x) { return x.nome.toLowerCase() !== nome.toLowerCase(); }); pruneSpunte(); toast(nome + ' tolto dalla lista'); }
    else { S.shop.extra.push({ nome: nome, reparto: b.dataset.dr || 'dispensa' }); toast(nome + ' aggiunto alla spesa'); }
    S.clearArmed = false; saveShop(); renderShop();
  });
}
