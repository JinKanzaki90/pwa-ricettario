/* Avvio dell'app: collega le schede, carica i dati statici da app/data/ e chiede l'accesso.
   Le schede si mostrano solo con una sessione valida (vedi accesso.js); le ricette si leggono dal database dopo l'accesso. */
import { $, carica, store } from './util.js';
import { S, updUsrSync } from './stato.js';
import { impostaCalendario } from './dominio.js';
import { initTema } from './tema.js';
import { initSchede, show, vista } from './navigazione.js';
import { initRicette, renderFilters, renderCards, renderDetail, updArchBtn, primaLettura } from './ricette.js';
import { initModulo, aggNomi } from './modulo.js';
import { initSpesa, renderShop } from './spesa.js';
import { initStagione, renderMesi, renderSeas, renderFonte, renderDisp } from './stagione.js';
import { initSettimana, renderSett } from './settimana.js';
import { initAccesso } from './accesso.js';

initTema();
initSchede();
initRicette();
initModulo();
initSpesa();
initStagione();
initSettimana();

renderFilters(); renderCards(); renderShop(); updUsrSync(); updArchBtn(); renderMesi();

carica('stagioni.json')
  .then(function (d) {
    impostaCalendario(d);
    renderSeas(); renderCards(); renderSett();
    if (S.cur && !$('r-detail').hidden) renderDetail();
    renderFonte(d);
  })
  .catch(function () { $('seas').innerHTML = '<div class="empty err">Non riesco a caricare il calendario. Ricarica la pagina tra poco.</div>'; });

carica('dispensa.json')
  .then(function (d) { S.DISP = d; renderDisp(); aggNomi(); })
  .catch(function () { $('disp').innerHTML = '<div class="empty err">Non riesco a caricare la dispensa. Ricarica la pagina tra poco.</div>'; });

carica('settimana.json')
  .then(function (d) { S.SETT = d; renderSett(); })
  .catch(function () { $('sett').innerHTML = '<div class="empty err">Non riesco a caricare la settimana. Ricarica la pagina tra poco.</div>'; });

/* gli ingredienti da evitare cambiano filtri e segnalazioni delle ricette */
document.addEventListener('rv-evitare', function () {
  renderFilters(); renderCards();
  if (S.cur && !$('r-detail').hidden) renderDetail();
});

initAccesso(function () {
  vista('list'); primaLettura();
  renderFilters(); renderCards();
  let start = (location.hash || '').slice(1);
  if (!start) start = store('rv-tab') || '';
  show(start || 'guida');
});
