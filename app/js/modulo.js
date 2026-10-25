/* Modulo ricetta (nuova, modifica, tua versione).
   La bozza di una nuova ricetta resta su questo browser (rv-bozza) finché non la salvi o la svuoti. */
import { $, esc, store, toast } from './util.js';
import { S, saveUsr } from './stato.js';
import { M, MESI, diStagione, hasAlc, hasCal, nomeAlc, NOME_PASTO, REPARTI, ICON_STAG, ICON_CAL, ICON_ALC, byId } from './dominio.js';
import { vista } from './navigazione.js';
import { aggiorna, openRecipe } from './ricette.js';

const UNITA = [['g', 'g'], ['ml', 'ml'], ['pz', 'pezzi'], ['cucchiaio', 'cucchiai'], ['cucchiaino', 'cucchiaini'], ['pizzico', 'pizzichi'], ['fetta', 'fette'], ['rametto', 'rametti'], ['spicchio', 'spicchi'], ['costa', 'coste'], ['q.b.', 'q.b.']];
const DIFF = ['facile', 'media', 'impegnativa'];
const STAG = [['primavera', 'Primavera'], ['estate', 'Estate'], ['autunno', 'Autunno'], ['inverno', 'Inverno']];
const LS_BOZZA = 'rv-bozza';
/* parole che indicano ingredienti non vegani, salvo versioni vegetali; esclusioni del profilo
   (regole dell'artifact: categorie e blocco della carne arrivano con il passo 4) */
const RE_ANIM = /\b(carne|manzo|maiale|pollo|tacchino|vitello|agnello|prosciutto|pancetta|guanciale|salame|salsiccia|speck|bresaola|wurstel|pesce|tonno|salmone|acciughe|acciuga|alici|gamberi|uova|uovo|albume|tuorlo|miele|formaggio|parmigiano|grana|pecorino|mozzarella|ricotta|burrata|stracchino|gorgonzola|panna|burro|latte|yogurt|strutto|gelatina|colla di pesce)\b/i;
const RE_VEG = /(vegetal|vegan|di soia|d'avena|di avena|di riso|di mandorl|di cocco|di arachid|di cacao|di nocciol|di anacard|di girasole|di sesamo|di ceci)/i;
const RE_ESCL = /\b(fave|fava|piselli|pisello|tartufo|tartufi|tartufato)\b/i;

function ingVuoto() { return { nome: '', qta: '', unita: 'g', reparto: '', cal: false, prodotto: '', marca: '', dove: '' }; }
function nuovaBozza() {
  return { id: null, base: null, titolo: '', pasto: '', difficolta: '', tempo_prep: '', tempo_cottura: '', riposo: '', porzioni_base: '2',
    stagioni: [], tutto_anno: false, alcolici: false, calabria: false, vegana: false,
    ingredienti: [ingVuoto(), ingVuoto(), ingVuoto()], passi: ['', ''], note: '' };
}
export function daRicetta(r, copia) {
  const tp = r.tempo_prep != null ? r.tempo_prep : r.tempo_min, tc = r.tempo_cottura != null ? r.tempo_cottura : 0;
  return { id: copia ? null : r.id, base: copia ? r.id : null, titolo: copia ? r.titolo + ' (la mia versione)' : r.titolo, pasto: r.pasto, difficolta: r.difficolta,
    tempo_prep: String(tp), tempo_cottura: String(tc), riposo: r.riposo || '', porzioni_base: String(r.porzioni_base || 2),
    stagioni: Array.isArray(r.stagioni) ? r.stagioni.slice() : [], tutto_anno: r.stagioni === 'tutto_anno',
    alcolici: hasAlc(r), calabria: hasCal(r), vegana: !copia && !!r.personale,
    ingredienti: r.ingredienti.map(function (i) {
      return { nome: i.nome, qta: i.qta == null ? '' : String(i.qta), unita: i.unita, reparto: i.reparto || '',
        cal: !!i.calabrese, prodotto: i.calabrese ? i.calabrese.prodotto || '' : '', marca: i.calabrese ? i.calabrese.marca || '' : '', dove: i.calabrese ? i.calabrese.dove || '' : '' };
    }),
    passi: r.passi.slice(), note: r.note_nutrizionali || '' };
}

let bozza = null, ferr = {}, bozzaT = null, bozzaRipresa = false, svuotaArmed = false;

export function openForm(b) {
  ferr = {}; svuotaArmed = false; bozzaRipresa = false;
  if (b) bozza = b;
  else {
    let saved = null; try { saved = JSON.parse(store(LS_BOZZA) || 'null'); } catch (e) { /* bozza illeggibile: si riparte */ }
    if (saved && saved.ingredienti) { bozza = saved; bozza.id = null; bozzaRipresa = true; } else bozza = nuovaBozza();
  }
  vista('form'); renderForm();
}
function salvaBozza() {
  if (!bozza || bozza.id) return;
  clearTimeout(bozzaT); bozzaT = setTimeout(function () { store(LS_BOZZA, JSON.stringify(bozza)); }, 400);
}
function opt(v, l, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>'; }
function errAttr(k) { return ferr[k] ? ' aria-invalid="true" aria-describedby="e-' + k + '"' : ''; }
function errMsg(k) { return ferr[k] ? '<p class="ferr" id="e-' + k + '">' + esc(ferr[k]) + '</p>' : ''; }
function fld(k, label, ctl, hint, req) {
  return '<div class="fld"><label for="' + k + '">' + label + (req ? ' <span class="req">*</span>' : '') + '</label>' + ctl + (hint ? '<p class="hint">' + hint + '</p>' : '') + errMsg(k) + '</div>';
}
function txt(k, v, extra) { return '<input type="text" id="' + k + '" value="' + esc(v) + '"' + errAttr(k) + (extra || '') + '>'; }
function num(k, v, min, max, extra) { return '<input type="number" inputmode="numeric" id="' + k + '" min="' + min + '" max="' + max + '" value="' + esc(v) + '"' + errAttr(k) + (extra || '') + '>'; }
function suf(ctl, u) { return '<div class="suf">' + ctl + '<span aria-hidden="true">' + u + '</span></div>'; }
function ck(k, label, on, cls) { return '<label class="ck' + (cls ? ' ' + cls : '') + '"' + (ferr[k] ? ' aria-invalid="true"' : '') + '><input type="checkbox" id="' + k + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>'; }
const ETICHETTE = { 'f-titolo': 'Titolo', 'f-pasto': 'Pasto', 'f-diff': 'Difficoltà', 'f-tp': 'Tempo di preparazione', 'f-tc': 'Tempo di cottura', 'f-porz': 'Porzioni', 'f-stag': 'Stagioni', 'f-veg': 'Conferma ricetta vegana', 'f-alc': 'Contiene alcolici', 'f-cal': 'Prodotti calabresi', 'f-ing': 'Ingredienti', 'f-passi': 'Procedimento' };

function renderForm() {
  const b = bozza, nuovo = !b.id;
  const tot = (parseInt(b.tempo_prep, 10) || 0) + (parseInt(b.tempo_cottura, 10) || 0);
  const errs = Object.keys(ferr);
  let h = '<button type="button" class="back" id="form-back">‹ ' + (nuovo ? 'Torna alle ricette' : 'Annulla le modifiche') + '</button>' +
    '<h2>' + (b.id ? 'Modifica ricetta' : b.base ? 'La tua versione' : 'Nuova ricetta') + '</h2>' +
    '<p class="lead">Compila tutti i campi con <span class="req">*</span>. Le quantità valgono per le porzioni indicate: nel dettaglio si potranno ricalcolare.</p>';
  if (nuovo && bozzaRipresa) h += '<div class="draftbar"><span>Ho ripreso la bozza che avevi lasciato.</span><button type="button" class="linkbtn" id="f-reset">Ricomincia da capo</button></div>';
  if (errs.length) {
    h += '<div class="errsum" id="f-errsum" tabindex="-1" role="alert"><b>' + (errs.length === 1 ? 'C\'è un campo da sistemare' : 'Ci sono ' + errs.length + ' campi da sistemare') + '</b><ul>' +
      errs.map(function (k) { return '<li><button type="button" class="linkbtn" data-focus="' + k + '">' + esc(ETICHETTE[k] || etichettaIng(k)) + ': ' + esc(ferr[k]) + '</button></li>'; }).join('') + '</ul></div>';
  }
  h += '<form class="form" id="rform" novalidate autocomplete="off">';
  /* dati principali */
  h += '<fieldset class="fs"><legend>Dati principali</legend>' +
    fld('f-titolo', 'Titolo', txt('f-titolo', b.titolo, ' maxlength="80" placeholder="es. Pasta e ceci al rosmarino"'), '', true) +
    fld('f-pasto', 'Pasto', '<select id="f-pasto"' + errAttr('f-pasto') + '>' + opt('', 'Scegli…', b.pasto) + ['colazione', 'pranzo', 'cena', 'spuntino', 'base'].map(function (p) { return opt(p, NOME_PASTO[p], b.pasto); }).join('') + '</select>', '', true) +
    '<div class="fld" role="radiogroup" aria-labelledby="l-diff"' + (ferr['f-diff'] ? ' aria-describedby="e-f-diff"' : '') + '><span class="lbl" id="l-diff">Difficoltà <span class="req">*</span></span><div class="checks">' +
      DIFF.map(function (d, i) { return '<label class="ck"' + (ferr['f-diff'] ? ' aria-invalid="true"' : '') + '><input type="radio" name="f-diff" id="' + (i === 0 ? 'f-diff' : 'f-diff-' + d) + '" value="' + d + '"' + (b.difficolta === d ? ' checked' : '') + '><span>' + d.charAt(0).toUpperCase() + d.slice(1) + '</span></label>'; }).join('') +
      '</div>' + errMsg('f-diff') + '</div>' +
    '<div class="row2">' + fld('f-tp', 'Preparazione', suf(num('f-tp', b.tempo_prep, 1, 600), 'min'), '', true) + fld('f-tc', 'Cottura', suf(num('f-tc', b.tempo_cottura, 0, 600), 'min'), '', true) + '</div>' +
    '<p class="hint" id="f-tot">Tempo totale: ' + tot + ' min. Metti 0 nella cottura se il piatto non si cuoce.</p>' +
    fld('f-riposo', 'Riposo o attesa', txt('f-riposo', b.riposo, ' maxlength="60" placeholder="es. 2 ore in frigo"'), 'Lascia vuoto se non serve: ammollo, lievitazione, frigo.', false) +
    fld('f-porz', 'Porzioni', num('f-porz', b.porzioni_base, 1, 12), 'Per quante persone sono le quantità che inserisci.', true) +
    '</fieldset>';
  /* stagionalità e icone */
  h += '<fieldset class="fs"><legend>Stagione e icone</legend>' +
    '<div class="fld"' + (ferr['f-stag'] ? ' aria-describedby="e-f-stag"' : '') + '><span class="lbl">Stagioni <span class="req">*</span></span><div class="checks">' +
      STAG.map(function (s, i) { return ck(i === 0 ? 'f-stag' : 'f-st-' + s[0], s[1], !b.tutto_anno && b.stagioni.indexOf(s[0]) > -1); }).join('') + ck('f-tutto', 'Tutto l\'anno', b.tutto_anno) +
      '</div><p class="hint">Il simbolo «Di stagione» si calcola da solo ogni mese con il calendario della scheda Stagione; queste stagioni servono quando gli ingredienti non sono nel calendario.</p>' + errMsg('f-stag') + '</div>' +
    '<div class="prev" id="f-prev"></div>' +
    '<div class="fld">' + ck('f-alc', '<b>Contiene alcolici</b> (vino, birra, superalcolici; non contano aceto e salsa di soia)', b.alcolici, 'block') + errMsg('f-alc') + '</div>' +
    '<div class="fld">' + ck('f-cal', '<b>Usa prodotti calabresi</b>: per ogni ingrediente calabrese indicherai prodotto, marca e dove trovarlo', b.calabria, 'block') + errMsg('f-cal') + '</div>' +
    '<div class="fld">' + ck('f-veg', '<b>Confermo che la ricetta è vegana</b> e non contiene fave, piselli o tartufo <span class="req">*</span>', b.vegana, 'block') + errMsg('f-veg') + '</div>' +
    '</fieldset>';
  /* ingredienti */
  h += '<fieldset class="fs" id="f-ing" tabindex="-1"><legend>Ingredienti <span class="req">*</span></legend><p class="hint">Almeno due. Scegli i nomi già suggeriti quando puoi: così nella spesa le stesse voci si sommano.</p>' + errMsg('f-ing') +
    b.ingredienti.map(function (i, n) {
      const k = 'f-i' + n, qb = i.unita === 'q.b.';
      return '<div class="ingrow" data-row="' + n + '"><div class="ingrow-h"><span class="eyebrow">Ingrediente ' + (n + 1) + '</span>' +
        (b.ingredienti.length > 1 ? '<button type="button" class="xbtn" data-rmi="' + n + '" aria-label="Togli l\'ingrediente ' + (n + 1) + '">×</button>' : '') + '</div>' +
        fld(k + '-nome', 'Nome', txt(k + '-nome', i.nome, ' maxlength="60" list="ing-names" placeholder="es. Ceci in barattolo"'), '', true) +
        '<div class="ingrow-g">' +
          fld(k + '-qta', 'Quantità', '<input type="number" inputmode="decimal" step="any" min="0" id="' + k + '-qta" value="' + esc(qb ? '' : i.qta) + '"' + (qb ? ' disabled' : '') + errAttr(k + '-qta') + '>', '', !qb) +
          fld(k + '-un', 'Unità', '<select id="' + k + '-un"' + errAttr(k + '-un') + '>' + UNITA.map(function (u) { return opt(u[0], u[1], i.unita); }).join('') + '</select>', '', true) +
          fld(k + '-rep', 'Reparto', '<select id="' + k + '-rep"' + errAttr(k + '-rep') + '>' + opt('', 'Scegli…', i.reparto) + REPARTI.map(function (r) { return opt(r[0], r[1], i.reparto); }).join('') + '</select>', '', true) +
        '</div>' +
        (b.calabria ? ck(k + '-cal', 'Prodotto calabrese', i.cal) + (i.cal ? '<div class="calf">' +
          fld(k + '-prod', 'Prodotto', txt(k + '-prod', i.prodotto, ' maxlength="80" placeholder="es. Cipolla Rossa di Tropea Calabria IGP"'), '', true) +
          fld(k + '-marca', 'Marca', txt(k + '-marca', i.marca, ' maxlength="80" placeholder="es. Sapori & Dintorni Conad"'), '', false) +
          fld(k + '-dove', 'Dove trovarlo', txt(k + '-dove', i.dove, ' maxlength="120" placeholder="es. Conad, reparto ortofrutta"'), '', false) + '</div>' : '') : '') +
        '</div>';
    }).join('') +
    '<button type="button" class="addline" id="f-addi">+ Aggiungi ingrediente</button></fieldset>';
  /* procedimento */
  h += '<fieldset class="fs" id="f-passi" tabindex="-1"><legend>Procedimento <span class="req">*</span></legend><p class="hint">Un passaggio per riquadro, nell\'ordine in cui si fanno.</p>' + errMsg('f-passi') +
    b.passi.map(function (p, n) {
      return '<div class="steprow"><span class="num">' + (n + 1) + '</span><div class="fld"><label class="hint" for="f-p' + n + '">Passaggio ' + (n + 1) + '</label><textarea id="f-p' + n + '" maxlength="600"' + errAttr('f-p' + n) + '>' + esc(p) + '</textarea>' + errMsg('f-p' + n) + '</div>' +
        (b.passi.length > 1 ? '<button type="button" class="xbtn" data-rmp="' + n + '" aria-label="Togli il passaggio ' + (n + 1) + '">×</button>' : '<span></span>') + '</div>';
    }).join('') +
    '<button type="button" class="addline" id="f-addp">+ Aggiungi passaggio</button></fieldset>';
  /* note */
  h += '<fieldset class="fs"><legend>Note</legend>' + fld('f-note', 'Note nutrizionali o consigli', '<textarea id="f-note" maxlength="600" placeholder="es. Il limone porta vitamina C, utile per il ferro dei legumi.">' + esc(b.note) + '</textarea>', '', false) + '</fieldset>';
  h += '<div class="form-end"><button type="submit" class="btn">Salva ricetta</button>' +
    (nuovo ? '<button type="button" class="btn line warn small' + (svuotaArmed ? ' armed' : '') + '" id="f-svuota">' + (svuotaArmed ? 'Tocca ancora per svuotare il modulo' : 'Svuota il modulo') + '</button>' : '') +
    '<p class="fine">' + (nuovo ? 'Finché non salvi, la bozza resta su questo browser.' : 'Le modifiche si applicano anche alla settimana e alla spesa.') + '</p></div>';
  h += '</form>';
  $('r-form').innerHTML = h;
  aggPrev();
}
function etichettaIng(k) {
  const m = /^f-(i|p)(\d+)(?:-(\w+))?$/.exec(k); if (!m) return k;
  if (m[1] === 'p') return 'Passaggio ' + (+m[2] + 1);
  const c = { nome: 'nome', qta: 'quantità', un: 'unità', rep: 'reparto', prod: 'prodotto calabrese' }[m[3]] || m[3];
  return 'Ingrediente ' + (+m[2] + 1) + ', ' + c;
}
/* legge il modulo nella bozza */
function leggi() {
  const b = bozza;
  function v(id) { const e = $(id); return e ? e.value : ''; }
  function c(id) { const e = $(id); return !!(e && e.checked); }
  b.titolo = v('f-titolo'); b.pasto = v('f-pasto');
  const d = document.querySelector('input[name="f-diff"]:checked'); b.difficolta = d ? d.value : '';
  b.tempo_prep = v('f-tp'); b.tempo_cottura = v('f-tc'); b.riposo = v('f-riposo'); b.porzioni_base = v('f-porz');
  b.tutto_anno = c('f-tutto');
  b.stagioni = STAG.filter(function (s, i) { return c(i === 0 ? 'f-stag' : 'f-st-' + s[0]); }).map(function (s) { return s[0]; });
  b.alcolici = c('f-alc'); b.calabria = c('f-cal'); b.vegana = c('f-veg');
  b.ingredienti.forEach(function (i, n) {
    const k = 'f-i' + n;
    i.nome = v(k + '-nome'); i.unita = v(k + '-un') || i.unita; i.reparto = v(k + '-rep');
    if (i.unita !== 'q.b.') i.qta = v(k + '-qta');
    if ($(k + '-cal')) i.cal = c(k + '-cal');
    if ($(k + '-prod')) { i.prodotto = v(k + '-prod'); i.marca = v(k + '-marca'); i.dove = v(k + '-dove'); }
  });
  b.passi = b.passi.map(function (p, n) { return v('f-p' + n); });
  b.note = v('f-note');
}
function aggPrev() {
  const el = $('f-prev'); if (!el || !bozza) return;
  const finta = { stagioni: bozza.tutto_anno ? 'tutto_anno' : bozza.stagioni, ingredienti: bozza.ingredienti.filter(function (i) { return i.nome.trim(); }) };
  const t = $('f-tot'); if (t) t.textContent = 'Tempo totale: ' + ((parseInt(bozza.tempo_prep, 10) || 0) + (parseInt(bozza.tempo_cottura, 10) || 0)) + ' min. Metti 0 nella cottura se il piatto non si cuoce.';
  const si = diStagione(finta);
  el.innerHTML = 'Anteprima per ' + MESI[M].toLowerCase() + ': ' + (si ? '<span class="badge stag">' + ICON_STAG + 'Di stagione</span>' : '<span>senza simbolo di stagione</span>') +
    (bozza.calabria && bozza.ingredienti.some(function (i) { return i.cal; }) ? '<span class="badge cal">' + ICON_CAL + 'Calabria</span>' : '') +
    (bozza.alcolici ? '<span class="badge alc">' + ICON_ALC + 'Con alcol</span>' : '');
}
function intero(s) { return /^\d+$/.test(String(s).trim()) ? parseInt(s, 10) : NaN; }
function valida() {
  const b = bozza, e = {};
  const t = b.titolo.replace(/\s+/g, ' ').trim();
  if (t.length < 3) e['f-titolo'] = 'scrivi un titolo di almeno 3 caratteri';
  else if (S.RICETTE.some(function (r) { return r.id !== b.id && r.titolo.toLowerCase() === t.toLowerCase(); })) e['f-titolo'] = 'esiste già una ricetta con questo titolo';
  if (!b.pasto) e['f-pasto'] = 'scegli il pasto';
  if (!b.difficolta) e['f-diff'] = 'scegli la difficoltà';
  const tp = intero(b.tempo_prep), tc = intero(b.tempo_cottura), pz = intero(b.porzioni_base);
  if (!(tp >= 1 && tp <= 600)) e['f-tp'] = 'minuti interi da 1 a 600';
  if (!(tc >= 0 && tc <= 600)) e['f-tc'] = 'minuti interi da 0 a 600';
  if (!(pz >= 1 && pz <= 12)) e['f-porz'] = 'un numero intero da 1 a 12';
  if (!b.tutto_anno && !b.stagioni.length) e['f-stag'] = 'scegli almeno una stagione o «Tutto l\'anno»';
  if (!b.vegana) e['f-veg'] = 'conferma che la ricetta è vegana';
  let piene = 0, alcNome = '', calOk = false;
  b.ingredienti.forEach(function (i, n) {
    const k = 'f-i' + n, nome = i.nome.replace(/\s+/g, ' ').trim();
    const vuota = !nome && !String(i.qta).trim() && !i.reparto;
    if (vuota) return;
    piene++;
    if (!nome) e[k + '-nome'] = 'scrivi il nome';
    else if (RE_ESCL.test(nome)) e[k + '-nome'] = '«' + nome + '» è tra gli alimenti esclusi';
    else if (RE_ANIM.test(nome) && !RE_VEG.test(nome)) e[k + '-nome'] = '«' + nome + '» non sembra vegano: se è una versione vegetale scrivilo nel nome (es. «burro vegetale»)';
    if (i.unita !== 'q.b.') { const q = parseFloat(String(i.qta).replace(',', '.')); if (!(q > 0 && q < 100000)) e[k + '-qta'] = 'inserisci una quantità maggiore di zero, o scegli q.b.'; }
    if (!i.reparto) e[k + '-rep'] = 'scegli il reparto';
    if (nomeAlc(nome) && !alcNome) alcNome = nome;
    if (b.calabria && i.cal) { if (!i.prodotto.trim()) e[k + '-prod'] = 'indica il prodotto calabrese'; else calOk = true; }
  });
  if (piene < 2) e['f-ing'] = 'inserisci almeno due ingredienti';
  if (alcNome && !b.alcolici) e['f-alc'] = 'tra gli ingredienti c\'è «' + alcNome + '»: spunta «Contiene alcolici»';
  if (b.calabria && !calOk && !Object.keys(e).some(function (k) { return /-prod$/.test(k); })) e['f-cal'] = 'segna almeno un ingrediente come prodotto calabrese, oppure togli la spunta';
  let passi = 0;
  b.passi.forEach(function (p) { if (p.trim()) passi++; });
  if (!passi) e['f-passi'] = 'scrivi almeno un passaggio';
  return e;
}
function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function costruisci() {
  const b = bozza, tp = intero(b.tempo_prep), tc = intero(b.tempo_cottura);
  const r = {
    id: b.id || ('mia-' + slug(b.titolo) + '-' + Date.now().toString(36)),
    titolo: b.titolo.replace(/\s+/g, ' ').trim(), pasto: b.pasto, tempo_min: tp + tc, tempo_prep: tp, tempo_cottura: tc,
    difficolta: b.difficolta, porzioni_base: intero(b.porzioni_base),
    stagioni: b.tutto_anno ? 'tutto_anno' : b.stagioni.slice(),
    ingredienti: b.ingredienti.filter(function (i) { return i.nome.trim(); }).map(function (i) {
      const o = { nome: i.nome.replace(/\s+/g, ' ').trim(), qta: i.unita === 'q.b.' ? null : parseFloat(String(i.qta).replace(',', '.')), unita: i.unita, reparto: i.reparto };
      if (b.calabria && i.cal && i.prodotto.trim()) o.calabrese = { prodotto: i.prodotto.trim(), marca: i.marca.trim(), dove: i.dove.trim() };
      return o;
    }),
    passi: b.passi.map(function (p) { return p.trim(); }).filter(Boolean),
    alcolici: !!b.alcolici, aggiornata: new Date().toISOString()
  };
  if (b.riposo.trim()) r.riposo = b.riposo.trim();
  if (b.note.trim()) r.note_nutrizionali = b.note.trim();
  if (b.base) r.versione_di = b.base;
  return r;
}

/* nomi degli ingredienti già usati, per i suggerimenti e il reparto automatico */
export function aggNomi() {
  const NOMI = {}, nomi = {};
  S.RICETTE.forEach(function (r) { r.ingredienti.forEach(function (i) { const k = i.nome.toLowerCase(); if (!NOMI[k]) NOMI[k] = i.reparto; nomi[i.nome] = 1; }); });
  if (S.DISP) S.DISP.gruppi.forEach(function (g) { g.voci.forEach(function (v) { const k = v.nome.toLowerCase(); if (!NOMI[k]) NOMI[k] = v.reparto; nomi[v.nome] = 1; }); });
  S.NOMI = NOMI;
  $('ing-names').innerHTML = Object.keys(nomi).sort(function (a, b) { return a.localeCompare(b, 'it'); })
    .map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('');
}

export function initModulo() {
  const form = $('r-form');
  form.addEventListener('input', function (e) {
    if (!bozza) return;
    leggi(); salvaBozza();
    if (/^f-(tp|tc|tutto|st-|stag|alc)/.test(e.target.id) || /-(nome|rep)$/.test(e.target.id)) aggPrev();
  });
  form.addEventListener('change', function (e) {
    if (!bozza) return;
    const id = e.target.id || '';
    leggi();
    /* nome ingrediente: reparto suggerito e spunta alcolici automatica */
    const m = /^f-i(\d+)-nome$/.exec(id);
    if (m) {
      const i = bozza.ingredienti[+m[1]], noto = S.NOMI[i.nome.trim().toLowerCase()];
      if (noto && !i.reparto) { i.reparto = noto; const s = $('f-i' + m[1] + '-rep'); if (s) s.value = noto; }
      if (nomeAlc(i.nome) && !bozza.alcolici) { bozza.alcolici = true; $('f-alc').checked = true; toast('Segnata «Contiene alcolici»: tra gli ingredienti c\'è ' + i.nome.trim()); }
    }
    /* stagioni e «tutto l'anno» si escludono */
    if (id === 'f-tutto' && bozza.tutto_anno) { bozza.stagioni = []; STAG.forEach(function (s, n) { const c = $(n === 0 ? 'f-stag' : 'f-st-' + s[0]); if (c) c.checked = false; }); }
    if ((id === 'f-stag' || /^f-st-/.test(id)) && e.target.checked) { bozza.tutto_anno = false; $('f-tutto').checked = false; }
    /* cambi che modificano la struttura del modulo */
    if (id === 'f-cal' || /^f-i\d+-(cal|un)$/.test(id)) { renderForm(); const el = $(id); if (el) el.focus(); }
    salvaBozza(); aggPrev();
  });
  form.addEventListener('click', function (e) {
    const b = e.target.closest('button'); if (!b || !bozza) return;
    if (b.id === 'form-back') { leggi(); salvaBozza(); ferr = {}; if (bozza.id && byId(bozza.id)) openRecipe(bozza.id); else vista('list'); return; }
    if (b.dataset.focus) { const t = $(b.dataset.focus); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } return; }
    if (b.id === 'f-reset') { bozza = nuovaBozza(); store(LS_BOZZA, ''); bozzaRipresa = false; ferr = {}; renderForm(); return; }
    if (b.id === 'f-svuota') {
      if (!svuotaArmed) { svuotaArmed = true; leggi(); renderForm(); $('f-svuota').focus(); return; }
      bozza = nuovaBozza(); store(LS_BOZZA, ''); svuotaArmed = false; bozzaRipresa = false; ferr = {}; renderForm(); window.scrollTo(0, 0); toast('Modulo svuotato'); return;
    }
    leggi();
    if (b.id === 'f-addi') { bozza.ingredienti.push(ingVuoto()); renderForm(); $('f-i' + (bozza.ingredienti.length - 1) + '-nome').focus(); salvaBozza(); return; }
    if (b.id === 'f-addp') { bozza.passi.push(''); renderForm(); $('f-p' + (bozza.passi.length - 1)).focus(); salvaBozza(); return; }
    if (b.dataset.rmi) { bozza.ingredienti.splice(+b.dataset.rmi, 1); ferr = {}; renderForm(); salvaBozza(); return; }
    if (b.dataset.rmp) { bozza.passi.splice(+b.dataset.rmp, 1); ferr = {}; renderForm(); salvaBozza(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (!bozza) return;
    leggi(); ferr = valida(); svuotaArmed = false;
    if (Object.keys(ferr).length) { renderForm(); const s = $('f-errsum'); if (s) { s.focus(); s.scrollIntoView({ block: 'start' }); } return; }
    const r = costruisci(), modifica = !!bozza.id;
    if (modifica) S.usr.personali = S.usr.personali.map(function (x) { return x.id === r.id ? r : x; });
    else { S.usr.personali.push(r); store(LS_BOZZA, ''); }
    saveUsr(); bozza = null; ferr = {}; aggiorna();
    S.backTo = null; openRecipe(r.id);
    toast(modifica ? 'Modifiche salvate' : 'Ricetta salvata nella tua raccolta');
  });
}
