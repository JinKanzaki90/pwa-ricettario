/* Schede in basso e viste interne alla scheda Ricette. */
import { $, store } from './util.js';
import { S } from './stato.js';

let tabs = [], names = [];

export function show(name) {
  if (names.indexOf(name) < 0) name = 'guida';
  tabs.forEach(function (b) {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    $(b.getAttribute('aria-controls')).hidden = !on;
  });
  chiudiImpostazioni();
  store('rv-tab', name);
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('rv-scheda', { detail: name }));
}

/* Impostazioni: pagina a parte, aperta dall'ingranaggio; le schede restano visibili e la chiudono */
let ultima = 'guida';
export function apriImpostazioni() {
  tabs.forEach(function (b) {
    if (b.getAttribute('aria-selected') === 'true') ultima = b.dataset.tab;
    b.setAttribute('aria-selected', 'false');
    $(b.getAttribute('aria-controls')).hidden = true;
  });
  $('p-impostazioni').hidden = false;
  $('imp-btn').setAttribute('aria-expanded', 'true');
  window.scrollTo(0, 0);
  $('imp-titolo').setAttribute('tabindex', '-1'); $('imp-titolo').focus();
}
function chiudiImpostazioni() {
  $('p-impostazioni').hidden = true;
  $('imp-btn').setAttribute('aria-expanded', 'false');
}
export function tornaDaImpostazioni() { show(ultima); }

const VISTE = { list: 'r-list', detail: 'r-detail', form: 'r-form', arch: 'r-arch', cest: 'r-cest' };
export function vista(v) {
  Object.keys(VISTE).forEach(function (k) { $(VISTE[k]).hidden = k !== v; });
  window.scrollTo(0, 0);
}

export function initSchede() {
  tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  names = tabs.map(function (b) { return b.dataset.tab; });
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      /* un secondo tocco su Ricette riporta all'elenco */
      if (b.dataset.tab === 'ricette' && b.getAttribute('aria-selected') === 'true' && $('r-list').hidden) {
        S.backTo = null; vista('list'); return;
      }
      show(b.dataset.tab);
    });
  });
  document.addEventListener('click', function (e) {
    const g = e.target.closest('[data-goto]'); if (g) show(g.dataset.goto);
  });
}
