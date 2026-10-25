/* Funzioni di servizio comuni a tutte le schede. */

export function $(id) { return document.getElementById(id); }

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* lettura e scrittura su localStorage, senza errori se il browser lo blocca */
export function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { return null; }
  return null;
}

/* dati statici in app/data/ (percorso relativo: il sito è servito sotto /pwa-ricettario/) */
export function carica(nome) {
  return fetch('data/' + nome, { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

/* avviso temporaneo, con un'azione facoltativa (es. Annulla) */
let toastT;
export function toast(msg, act) {
  const t = $('toast'); t.textContent = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if (act) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = act.label;
    b.addEventListener('click', function () { t.hidden = true; clearTimeout(toastT); act.fn(); });
    t.appendChild(b);
  }
  t.hidden = false; clearTimeout(toastT);
  toastT = setTimeout(function () { t.hidden = true; }, act ? 6500 : 2600);
}
