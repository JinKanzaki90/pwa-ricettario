/* Tema: Auto → Chiaro → Scuro, ricordato su questo browser. */
import { $, store } from './util.js';

const THEMES = ['auto', 'light', 'dark'];
const LBL = { auto: 'Auto', light: 'Chiaro', dark: 'Scuro' };
let theme = 'auto';

function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  $('theme-lbl').textContent = LBL[t];
  $('theme-btn').setAttribute('aria-label', 'Tema: ' + LBL[t] + '. Tocca per cambiare');
}

export function initTema() {
  theme = store('rv-theme') || 'auto';
  if (THEMES.indexOf(theme) < 0) theme = 'auto';
  applyTheme(theme);
  $('theme-btn').addEventListener('click', function () {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % 3];
    applyTheme(theme); store('rv-theme', theme);
  });
}
