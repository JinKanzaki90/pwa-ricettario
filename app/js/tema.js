/* Tema: automatico, chiaro o scuro, scelto dalle Impostazioni e ricordato su questo dispositivo. */
import { store } from './util.js';

const THEMES = ['auto', 'light', 'dark'];

function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('input[name="tema"]').forEach(function (r) { r.checked = r.value === t; });
}

export function initTema() {
  let theme = store('rv-theme') || 'auto';
  if (THEMES.indexOf(theme) < 0) theme = 'auto';
  applyTheme(theme);
  document.querySelectorAll('input[name="tema"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      applyTheme(r.value); store('rv-theme', r.value);
    });
  });
}
