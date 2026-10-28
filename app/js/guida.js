/* Guida: salti dall'indice alle sezioni e «Acquisti consapevoli» (data/acquisti.json, REQUISITI.md §5.8).
   Il file si genera con strumenti/acquisti/genera_acquisti.py: voci divise per settore, ognuna con una o più segnalazioni. */
import { $, esc, carica } from './util.js';

const GIORNO = 24 * 60 * 60 * 1000;
const SCADENZA_GIORNI = 365; /* «da ricontrollare» dopo 12 mesi senza verifica */

/* i salti non cambiano l'indirizzo (l'àncora #… serve a scegliere la scheda all'avvio) */
function salta(e) {
  const a = e.target.closest('a[data-salta]'); if (!a) return;
  const meta = document.getElementById((a.getAttribute('href') || '').slice(1)); if (!meta) return;
  e.preventDefault();
  meta.scrollIntoView({ block: 'start' });
  const h = meta.matches('h2, h3') ? meta : meta.querySelector('h2, h3');
  if (h) h.focus({ preventScroll: true });
}

function data(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return isNaN(t) ? null : { t: t, testo: m[3] + '/' + m[2] + '/' + m[1] };
}
const httpsOk = function (u) { return /^https:\/\/[^\s"<>]+$/.test(u || ''); };
function collegamento(url, testo) {
  return httpsOk(url) ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(testo) + '</a>' : esc(testo);
}
/* confronto senza maiuscole né accenti */
function piano(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/* una fonte vale solo se completa; una segnalazione solo se la sua fonte vale */
function fontiValide(d) {
  const f = {};
  Object.keys((d && d.fonti) || {}).forEach(function (k) {
    const x = d.fonti[k];
    if (x && x.da && x.titolo && data(x.verificata_il)) f[k] = x;
  });
  return f;
}
export function vociValide(d) {
  const fonti = fontiValide(d);
  return ((d && d.voci) || []).map(function (v) {
    if (!v || !v.azienda) return null;
    const s = (v.segnalazioni || []).filter(function (x) { return x && x.per && fonti[x.fonte]; });
    return s.length ? Object.assign({}, v, { segnalazioni: s }) : null;
  }).filter(Boolean);
}

let DATI = null, ORA = null;

function htmlVoce(v, fonti, tipi, ora) {
  const sotto = [];
  if (v.marchi && v.marchi.length) sotto.push('Anche: ' + v.marchi.map(esc).join(', '));
  if (v.paese) sotto.push('Sede: ' + esc(v.paese));
  return '<div class="acq-v"><span class="nome">' + esc(v.azienda) + '</span>' +
    (sotto.length ? '<span class="sotto">' + sotto.join(' · ') + '</span>' : '') +
    v.segnalazioni.map(function (s) {
      const f = fonti[s.fonte], dv = data(f.verificata_il);
      const vecchia = (ora - dv.t) / GIORNO > SCADENZA_GIORNI;
      return '<div class="acq-s">' + (tipi[s.tipo] ? '<span class="badge tipo">' + esc(tipi[s.tipo]) + '</span>' : '') +
        '<p>Segnalata ' + esc(f.da) + ' per ' + esc(s.per) + '.</p>' +
        '<p class="meta"><span>Fonte: ' + collegamento(f.url, f.titolo) + '</span><span>Verificata il ' + dv.testo + '</span>' +
        (vecchia ? '<span class="badge ricontrolla">Da ricontrollare</span>' : '') + '</p></div>';
    }).join('') + '</div>';
}

function disegnaElenco() {
  const box = $('acq-elenco'); if (!box || !DATI) return;
  const d = DATI, fonti = fontiValide(d), tipi = d.tipi || {};
  const q = piano(($('acq-cerca') || {}).value || '').trim();
  const voci = vociValide(d).filter(function (v) {
    return !q || piano(v.azienda + ' ' + (v.marchi || []).join(' ')).indexOf(q) > -1;
  });
  const settori = (d.settori || []).slice();
  const noti = {}; settori.forEach(function (s) { noti[s.id] = 1; });
  if (voci.some(function (v) { return !noti[v.settore]; })) settori.push({ id: '', nome: 'Senza settore' });
  const gruppi = settori.map(function (s) {
    const qui = voci.filter(function (v) { return s.id ? v.settore === s.id : !noti[v.settore]; })
      .sort(function (a, b) { return String(a.azienda).localeCompare(String(b.azienda), 'it'); });
    if (!qui.length) return '';
    return '<details class="acq-g"' + (q ? ' open' : '') + '><summary><span class="nn">' + esc(s.nome) + '</span><span class="nk">' + qui.length + '</span></summary>' +
      '<div class="nb acq">' + qui.map(function (v) { return htmlVoce(v, fonti, tipi, ORA); }).join('') + '</div></details>';
  }).join('');
  $('acq-conta').textContent = q ? (voci.length === 1 ? '1 voce trovata' : voci.length + ' voci trovate') : voci.length + ' voci, divise per settore';
  box.innerHTML = gruppi ? '<div class="nutr">' + gruppi + '</div>' : '<p class="empty">Nessuna voce corrisponde alla ricerca.</p>';
}

export function renderAcquisti(d, oggi) {
  const box = $('acq'); if (!box) return;
  DATI = d; ORA = oggi == null ? Date.now() : oggi;
  const fonti = fontiValide(d);
  if (!vociValide(d).length) {
    box.innerHTML = '<div class="panel"><p><b>Sezione in preparazione.</b> Le voci arriveranno quando saranno fissati i criteri e le fonti da usare.</p></div>';
    return;
  }
  const temi = d.temi || {};
  const usate = Object.keys(fonti);
  box.innerHTML =
    '<p class="fine">Temi: ' + Object.keys(temi).map(function (k) { return esc(temi[k]); }).join(', ') + '. Puoi cercare un\'azienda o un marchio, oppure aprire un settore.</p>' +
    '<div class="fld acq-ricerca"><label for="acq-cerca">Cerca un\'azienda o un marchio</label>' +
    '<input type="search" id="acq-cerca" autocomplete="off" spellcheck="false" maxlength="60"></div>' +
    '<p class="fine" id="acq-conta" role="status"></p>' +
    '<div id="acq-elenco"></div>' +
    '<div class="nutr"><details><summary><span class="nn">Da dove vengono le voci</span><span class="nk">fonti</span></summary><div class="nb">' +
    usate.map(function (k) {
      const f = fonti[k];
      return '<p><b>' + collegamento(f.url, f.titolo) + '.</b> ' + esc(f.nota || '') + '</p>';
    }).join('') + '</div></details></div>';
  $('acq-cerca').addEventListener('input', disegnaElenco);
  disegnaElenco();
}

export function initGuida() {
  $('p-guida').addEventListener('click', salta);
  carica('acquisti.json')
    .then(function (d) { renderAcquisti(d); })
    .catch(function () { $('acq').innerHTML = '<div class="empty err">Non riesco a caricare questa sezione. Ricarica la pagina tra poco.</div>'; });
}
