/* Avvio dell'app: collega le schede e carica i dati statici da app/data/. */
import { $, carica, store } from './util.js';
import { S, updUsrSync } from './stato.js';
import { impostaCalendario } from './dominio.js';
import { initTema } from './tema.js';
import { initSchede, show } from './navigazione.js';
import { initRicette, renderFilters, renderCards, renderDetail, updArchBtn, aggiorna } from './ricette.js';
import { initModulo, aggNomi } from './modulo.js';
import { initSpesa, renderShop } from './spesa.js';
import { initStagione, renderMesi, renderSeas, renderFonte, renderDisp } from './stagione.js';
import { initSettimana, renderSett } from './settimana.js';

initTema();
initSchede();
initRicette();
initModulo();
initSpesa();
initStagione();
initSettimana();

renderFilters(); renderCards(); renderShop(); updUsrSync(); updArchBtn(); renderMesi();

carica('ricette.json')
  .then(function (d) { S.BASE = d.ricette || []; S.caricate = true; aggiorna(); })
  .catch(function () { $('cards').innerHTML = '<div class="empty err">Non riesco a caricare le ricette. Ricarica la pagina tra poco.</div>'; });

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

let start = (location.hash || '').slice(1);
if (!start) start = store('rv-tab') || '';
show(start || 'guida');
