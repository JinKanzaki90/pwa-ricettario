/* Guida: salti dall'indice alle sezioni e voci di «Acquisti consapevoli» (data/acquisti.json, REQUISITI.md §5.8). */
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

/* una voce è mostrata solo se completa; un collegamento solo se https */
export function voceValida(v) {
  return !!(v && v.azienda && v.segnalata_da && v.motivo && v.fonte_titolo && data(v.verificata_il));
}

export function renderAcquisti(d, oggi) {
  const box = $('acq'); if (!box) return;
  const ora = oggi == null ? Date.now() : oggi;
  const voci = ((d && d.voci) || []).filter(voceValida)
    .sort(function (a, b) { return String(a.azienda).localeCompare(String(b.azienda), 'it'); });
  if (!voci.length) {
    box.innerHTML = '<div class="panel"><p><b>Sezione in preparazione.</b> Le voci arriveranno quando saranno fissati i criteri e le fonti da usare.</p></div>';
    return;
  }
  box.innerHTML = '<div class="panel acq">' + voci.map(function (v) {
    const dv = data(v.verificata_il);
    const vecchia = (ora - dv.t) / GIORNO > SCADENZA_GIORNI;
    const url = /^https:\/\/[^\s"<>]+$/.test(v.fonte_url || '') ? v.fonte_url : '';
    const fonte = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(v.fonte_titolo) + '</a>' : esc(v.fonte_titolo);
    return '<div class="acq-v"><span class="nome">' + esc(v.azienda) + '</span>' +
      '<p>Segnalata da ' + esc(v.segnalata_da) + ' per ' + esc(v.motivo) + '.</p>' +
      '<p class="meta"><span>Fonte: ' + fonte + '</span><span>Verificata il ' + dv.testo + '</span>' +
      (vecchia ? '<span class="badge ricontrolla">Da ricontrollare</span>' : '') + '</p></div>';
  }).join('') + '</div>';
}

export function initGuida() {
  $('p-guida').addEventListener('click', salta);
  carica('acquisti.json')
    .then(function (d) { renderAcquisti(d); })
    .catch(function () { $('acq').innerHTML = '<div class="empty err">Non riesco a caricare questa sezione. Ricarica la pagina tra poco.</div>'; });
}
