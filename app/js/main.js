/* Avvio dell'app: collega le schede, carica i dati statici da app/data/ e chiede l'accesso.
   Le schede si mostrano solo con una sessione valida (vedi accesso.js); ricette, settimana e spesa si leggono dal database dopo l'accesso. */
import { $, carica, store } from './util.js';
import { S, updUsrSync } from './stato.js';
import { impostaCalendario } from './dominio.js';
import { initTema } from './tema.js';
import { initSchede, show, vista } from './navigazione.js';
import { initRicette, renderFilters, renderCards, renderDetail, updArchBtn, primaLettura, aggiorna } from './ricette.js';
import { initModulo, aggNomi } from './modulo.js';
import { initSpesa, renderShop, pruneSpunte } from './spesa.js';
import { initStagione, renderMesi, renderSeas, renderFonte, renderDisp, updDisp } from './stagione.js';
import { initSettimana, renderSett } from './settimana.js';
import { initAccesso, U } from './accesso.js';
import { initGuida } from './guida.js';
import { initPersonali, quandoCambiano, primaLetturaPersonali } from './personali.js';
import { initInstalla } from './installa.js';
import { segnaCopia } from './copia.js';

initTema();
initInstalla();
initSchede();
initGuida();
initRicette();
initModulo();
initSpesa();
initStagione();
initSettimana();
initPersonali();
quandoCambiano(function () { pruneSpunte(); renderSett(); renderShop(); updDisp(); document.dispatchEvent(new CustomEvent('rv-settimana')); segnaCopia(U); });

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

/* tornata la rete dopo un avvio senza connessione: si rileggono i dati veri */
document.addEventListener('rv-in-linea', function () { primaLettura(); primaLetturaPersonali(); });

initAccesso(function () {
  vista('list');
  if (S.offline) aggiorna(); /* senza rete: la copia salvata sul dispositivo, già in S */
  else { primaLettura(); primaLetturaPersonali(); }
  renderFilters(); renderCards();
  let start = (location.hash || '').slice(1);
  if (!start) start = store('rv-tab') || '';
  show(start || 'guida');
});
