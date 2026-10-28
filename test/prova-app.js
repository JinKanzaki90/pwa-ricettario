/* Prova funzionale dell'app in Chromium headless: 360 px e desktop, tema chiaro e scuro, console senza errori.
   Supabase è imitato (nessun account vero serve alla prova): accesso, primo accesso, impostazioni,
   ingredienti da evitare, uscita, cancellazione dell'account. Alla fine una sola prova contro il progetto
   vero: credenziali sbagliate → messaggio chiaro.
   Uso: servire app/ (es. python3 -m http.server 8123 --bind 127.0.0.1 -d app) e poi: node test/prova-app.js [indirizzo]
   Schermate in CARTELLA_SCHERMATE (predefinita /tmp). */
const { chromium } = require('playwright');
const path = require('path');
const PARTENZA = require(path.join(__dirname, '../supabase/strumenti/ricette_partenza.json')).ricette;
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const dir = process.env.CARTELLA_SCHERMATE || '/tmp';
const SB = 'https://wtwmjwpmovttalkxzhvm.supabase.co';
const UID = '00000000-0000-4000-8000-000000000001';
const EMAIL = 'prova@esempio.invalid';
const ALTRO = '00000000-0000-4000-8000-000000000002';
const ORA = '2026-10-20T10:00:00.000Z';

/* ricettario finto: le 23 ricette di partenza (generiche) + una di Marta con pesce + una di Marta nel cestino */
function ricettario() {
  const righe = PARTENZA.map(function (r) {
    return Object.assign({}, r, { categoria: 'vegana', stagioni: r.stagioni === 'tutto_anno' ? ['tutto_anno'] : r.stagioni, autore: null,
      alcolici: !!r.alcolici, versione_di: null, creata_il: ORA, modificata_il: ORA, modificata_da: null, eliminata_il: null, eliminata_da: null });
  });
  const marta = { pasto: 'cena', difficolta: 'facile', tempo_min: 20, tempo_prep: 10, tempo_cottura: 10, porzioni_base: 2, stagioni: ['tutto_anno'],
    passi: ['Cuoci tutto.'], alcolici: false, versione_di: null, autore: ALTRO, creata_il: ORA, modificata_il: ORA, modificata_da: ALTRO };
  righe.push(Object.assign({}, marta, { id: 'orata-marta', titolo: 'Orata al forno di Marta', categoria: 'pesce',
    ingredienti: [{ nome: 'Orata', qta: 2, unita: 'pz', reparto: 'frigo' }, { nome: 'Patate', qta: 400, unita: 'g', reparto: 'ortofrutta' }], eliminata_il: null, eliminata_da: null }));
  righe.push(Object.assign({}, marta, { id: 'frittata-marta', titolo: 'Frittata di zucchine', categoria: 'vegetariana',
    ingredienti: [{ nome: 'Uova', qta: 4, unita: 'pz', reparto: 'frigo' }, { nome: 'Zucchine', qta: 300, unita: 'g', reparto: 'ortofrutta' }],
    eliminata_il: '2026-10-27T10:00:00.000Z', eliminata_da: ALTRO }));
  return righe;
}
const RE_CARNE = /\b(chorizo|pancetta|salsiccia)\b(?! vegetale)/i;
function filtra(righe, u) {
  const salta = { select: 1, order: 1, on_conflict: 1, limit: 1, columns: 1 };
  u.searchParams.forEach(function (v, k) {
    if (salta[k] || v.indexOf('eq.') !== 0) return;
    righe = righe.filter(function (r) { return String(r[k]) === v.slice(3); });
  });
  return righe;
}

/* filtri PostgREST usati dall'app: eq., is.null, in.(…) */
function valoriIn(v) { return v.slice(4, -1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g).map(x => x[0] === '"' ? x.slice(1, -1) : x); }
function filtraTutto(righe, u) {
  const salta = { select: 1, order: 1, on_conflict: 1, limit: 1, columns: 1 };
  u.searchParams.forEach(function (v, k) {
    if (salta[k]) return;
    if (v.indexOf('eq.') === 0) righe = righe.filter(r => String(r[k]) === v.slice(3));
    else if (v === 'is.null') righe = righe.filter(r => r[k] == null);
    else if (v.indexOf('in.(') === 0) { const l = valoriIn(v); righe = righe.filter(r => l.indexOf(String(r[k])) > -1); }
  });
  return righe;
}
/* tabelle personali (settimana e spesa): chiave primaria oltre all'utente */
const PERSONALI = { settimana: ['giorno', 'pasto'], spesa_ricette: ['ricetta'], spesa_voci: ['id'], spesa_spunte: ['chiave'] };
function tabellaPersonale(db, nome, m, u, corpo, prefer) {
  const t = db[nome], pk = PERSONALI[nome];
  if (m === 'GET') return [200, filtraTutto(t, u)];
  if (m === 'POST') {
    const nuove = [];
    (Array.isArray(corpo) ? corpo : [corpo]).forEach(function (x) {
      const r = Object.assign({ utente: UID, dosi: nome === 'settimana' ? 1 : undefined }, x);
      if (nome === 'spesa_voci') r.id = ++db.idVoce;
      const gia = t.filter(y => pk.every(k => String(y[k]) === String(r[k])))[0];
      if (gia) { if (prefer.indexOf('ignore-duplicates') < 0) throw { code: '23505' }; return; }
      if (nome === 'spesa_ricette') r.aggiunta_il = new Date().toISOString();
      t.push(r); nuove.push(r);
    });
    return [201, nuove];
  }
  if (m === 'PATCH') { const tocc = filtraTutto(t, u); tocc.forEach(r => Object.assign(r, corpo)); return [200, tocc]; }
  if (m === 'DELETE') { const via = filtraTutto(t, u); db[nome] = t.filter(r => via.indexOf(r) < 0); return [200, via]; }
}

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, email: EMAIL }) + '.firma';
}
function utente() { return { id: UID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: '2026-10-25T00:00:00Z' }; }

/* Supabase finto: stato in memoria per ogni contesto */
async function imitaSupabase(ctx, db) {
  await ctx.route(SB + '/**', async function (route) {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = function (status, body) { return route.fulfill({ status: status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) }); };
    const oggetto = (req.headers()['accept'] || '').indexOf('vnd.pgrst.object') > -1;
    const corpo = req.postData() ? JSON.parse(req.postData()) : null;
    db.chiamate.push(m + ' ' + p);
    if (db.giu && p.indexOf('/rest/') === 0) return route.abort('internetdisconnected');
    if (p === '/auth/v1/token') {
      if (!db.esiste || corpo.password !== db.password) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, { access_token: jwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rinnovo', user: utente() });
    }
    if (p === '/auth/v1/user' && m === 'PUT') { db.password = corpo.password; return json(200, utente()); }
    if (p === '/auth/v1/user') return json(200, utente());
    if (p === '/auth/v1/logout') { db.uscite = (db.uscite || 0) + 1; return route.fulfill({ status: 204 }); }
    if (p === '/rest/v1/profili' && m === 'GET' && !oggetto) {
      return json(200, [{ id: UID, nome: db.profilo.nome }, { id: ALTRO, nome: 'Marta' }]);
    }
    if (p === '/rest/v1/ricette') {
      if (m === 'GET') return json(200, db.ricette);
      if (m === 'POST') {
        if (corpo.ingredienti.some(function (i) { return RE_CARNE.test(i.nome); })) return json(400, { code: '23514', message: 'new row violates check constraint "ricette_senza_carne"' });
        const r = Object.assign({}, corpo, { id: 'nuova-' + (db.ricette.length + 1), autore: UID, creata_il: ORA, modificata_il: ORA, modificata_da: UID, eliminata_il: null, eliminata_da: null });
        db.ricette.push(r); return json(201, [r]);
      }
      if (m === 'PATCH') {
        const toccate = filtra(db.ricette, u).filter(function (r) { return !r.autore || r.autore === UID; });
        toccate.forEach(function (r) {
          if ('eliminata_il' in corpo) { r.eliminata_il = corpo.eliminata_il ? new Date().toISOString() : null; r.eliminata_da = corpo.eliminata_il ? UID : null; }
          else Object.assign(r, corpo, { modificata_il: new Date().toISOString(), modificata_da: UID });
        });
        return json(200, toccate);
      }
    }
    if (p === '/rest/v1/archivio') {
      if (m === 'GET') return json(200, db.archivio.map(function (x) { return { ricetta: x }; }));
      if (m === 'POST') { if (db.archivio.indexOf(corpo.ricetta) < 0) db.archivio.push(corpo.ricetta); return json(201); }
      if (m === 'DELETE') { const id = (u.searchParams.get('ricetta') || '').slice(3); db.archivio = db.archivio.filter(function (x) { return x !== id; }); return route.fulfill({ status: 204, body: '' }); }
    }
    /* chi ha la ricetta in settimana (avviso prima dell'eliminazione): risposta fissa, una persona oltre a chi chiama */
    if (p === '/rest/v1/settimana' && m === 'GET' && u.searchParams.get('ricetta')) return json(200, [{ utente: ALTRO }, { utente: UID }]);
    /* passo 6: settimane degli altri (sola lettura) */
    if (p === '/rest/v1/settimana' && m === 'GET' && u.searchParams.get('utente') === 'neq.' + UID) return json(200, db.altre);
    if (p === '/rest/v1/commenti') {
      if (m === 'GET') return json(200, filtraTutto(db.commenti, u));
      if (m === 'POST') {
        if (!corpo.testo.trim() || corpo.testo.length > 500) return json(400, { code: '23514', message: 'violates check constraint "commenti_testo_lunghezza"' });
        const c = { id: ++db.idComm, ricetta: corpo.ricetta, autore: UID, testo: corpo.testo, creato_il: new Date().toISOString(), modificato_il: new Date().toISOString() };
        db.commenti.push(c); return json(201, oggetto ? c : [c]);
      }
      const tocc = filtraTutto(db.commenti, u);
      if (m === 'PATCH') { tocc.forEach(c => Object.assign(c, corpo, { modificato_il: new Date(Date.now() + 120000).toISOString() })); return json(200, tocc); }
      if (m === 'DELETE') { db.commenti = db.commenti.filter(c => tocc.indexOf(c) < 0); return json(200, tocc); }
    }
    const tab = p.replace('/rest/v1/', '');
    if (PERSONALI[tab]) {
      if (db.giuPersonali) return json(503, { message: 'non disponibile' });
      try {
        const [st, righe] = tabellaPersonale(db, tab, m, u, corpo, req.headers()['prefer'] || '');
        return json(st, oggetto ? righe[0] : righe);
      } catch (e) { return json(409, { code: e.code, message: 'duplicate key' }); }
    }
    if (p === '/rest/v1/rpc/ingredienti_di_carne') {
      return json(200, corpo.ing.filter(function (i) { return RE_CARNE.test(i.nome); }).map(function (i) { return i.nome; }));
    }
    if (p === '/rest/v1/profili') {
      if (m === 'PATCH') {
        if (corpo.nome && corpo.nome.toLowerCase() === 'anonimo') return json(400, { code: '23514', message: 'violates check constraint "profili_nome_non_riservato"' });
        Object.assign(db.profilo, corpo);
      }
      return json(200, oggetto ? db.profilo : [db.profilo]);
    }
    if (p === '/rest/v1/preferenze') {
      if (m === 'PATCH') { if (!db.preferenze) return json(200, []); db.preferenze.da_evitare = corpo.da_evitare; return json(200, [db.preferenze]); }
      if (m === 'POST') { db.preferenze = { da_evitare: corpo.da_evitare }; return json(201, [db.preferenze]); }
      return json(200, db.preferenze ? [db.preferenze] : []);
    }
    if (p === '/rest/v1/rpc/cancella_account') { db.esiste = false; return route.fulfill({ status: 204, body: '' }); }
    return json(404, { message: 'non imitato: ' + m + ' ' + p });
  });
}

/* passo 8: l'elenco dei file salvati dal service worker deve corrispondere ai file del sito (licenze e note escluse) */
function controllaGuscio() {
  const fs = require('fs'), app = path.join(__dirname, '../app');
  const sw = fs.readFileSync(path.join(app, 'sw.js'), 'utf8');
  const elenco = JSON.parse(sw.match(/const GUSCIO = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  const file = [];
  (function giro(d) {
    fs.readdirSync(path.join(app, d), { withFileTypes: true }).forEach(function (x) {
      const rel = d ? d + '/' + x.name : x.name;
      if (x.isDirectory()) giro(rel);
      else if (!/LICENSE|\.md$|\.txt$/.test(x.name) && rel !== 'sw.js') file.push(rel);
    });
  })('');
  const mancano = file.filter(f => elenco.indexOf(f) < 0), inPiu = elenco.filter(f => f !== './' && file.indexOf(f) < 0);
  console.log('elenco del service worker:', mancano.length || inPiu.length ? { mancano, inPiu } : 'ok (' + elenco.length + ' voci)');
  return !mancano.length && !inPiu.length && elenco.indexOf('./') > -1;
}

(async () => {
  const browser = await chromium.launch();
  let fail = controllaGuscio() ? 0 : 1;
  for (const [w, h] of [[360, 760], [1280, 900]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const db = { esiste: true, password: 'iniziale-123', profilo: { nome: 'Anonimo', nome_scelto: false, settimana_avviata: false }, preferenze: null, chiamate: [], ricette: ricettario(), archivio: [],
      settimana: [], spesa_ricette: [], spesa_voci: [], spesa_spunte: [], idVoce: 0,
      commenti: [{ id: 1, ricetta: 'hummus-di-ceci', autore: ALTRO, testo: 'Ottimo <b>con</b> il limone.\nE un po\' di cumino.', creato_il: ORA, modificato_il: ORA }], idComm: 1,
      altre: [
        { utente: ALTRO, giorno: 'mar', pasto: 'colazione', ricetta: 'avena-in-ammollo-fichi-pera', dosi: 1, avanzo_di: null, nota: null },
        { utente: ALTRO, giorno: 'mar', pasto: 'pranzo', ricetta: 'pasta-lenticchie-rosse', dosi: 2, avanzo_di: null, nota: 'Ne avanza per domani' },
        { utente: ALTRO, giorno: 'mar', pasto: 'cena', ricetta: 'frittata-marta', dosi: 1, avanzo_di: null, nota: null },
        { utente: ALTRO, giorno: 'mer', pasto: 'pranzo', ricetta: 'pasta-lenticchie-rosse', dosi: 1, avanzo_di: 'mar', nota: null }
      ] };
    await imitaSupabase(ctx, db);
    const page = await ctx.newPage(); const errs = []; let attesi = 0;
    /* i 400 del token sono voluti (password sbagliata): contati a parte */
    const voluto = function (url) { return url.indexOf('/auth/v1/token') > -1 || url.indexOf('/rest/v1/profili') > -1; };
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { if (voluto(m.location().url || '') || /status of 503/.test(m.text()) || (db.giu && /ERR_INTERNET_DISCONNECTED/.test(m.text()) && (m.location().url || '').indexOf(SB) === 0)) attesi++; else errs.push(m.type() + ': ' + m.text() + ' ' + (m.location().url || '')); } });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    /* rete giù simulata e l'uscita, che non legge la risposta (204): con l'imitazione Chromium la segna «interrotta», non è un errore dell'app */
    page.on('requestfailed', r => { if (r.url().indexOf('/auth/v1/logout') < 0 && !db.giu) errs.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText); });
    page.on('response', r => { if (r.status() >= 400 && !voluto(r.url()) && r.status() !== 503) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
    const tag = `${w}-${scheme}`;
    const testo = sel => page.$eval(sel, e => e.textContent.trim());

    /* accesso: prima sbagliato, poi giusto */
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#f-accesso', { state: 'visible' });
    const nascosta = await page.$eval('main', e => getComputedStyle(e).display === 'none');
    await page.screenshot({ path: `${dir}/${tag}-accesso.png` });
    await page.click('#a-invia');
    const errVuoto = await testo('#a-err');
    await page.fill('#a-email', EMAIL); await page.fill('#a-pwd', 'sbagliata');
    await page.click('#a-invia'); await page.waitForSelector('#a-err:not([hidden])');
    await page.waitForFunction(() => document.getElementById('a-err').textContent.indexOf('non corretti') > -1);
    const errSbagliata = await testo('#a-err');
    await page.click('[data-mostra="a-pwd"]');
    const mostrata = await page.$eval('#a-pwd', e => e.type);
    /* dati di una versione precedente salvati sul browser: vanno sul database al primo accesso */
    await page.evaluate(() => {
      localStorage.setItem('rv-spesa', JSON.stringify({ selezione: [{ id: 'hummus-di-ceci', porzioni: 2 }], extra: [{ nome: 'Tovaglioli di carta', reparto: 'altro' }], spunte: [] }));
      localStorage.setItem('rv-ricettario', JSON.stringify({ sostituzioni: { 'lun|pranzo': 'hummus-di-ceci' } }));
    });
    await page.fill('#a-pwd', 'iniziale-123'); await page.click('#a-invia');

    /* primo accesso: nome riservato, password diverse, poi giusto */
    await page.waitForSelector('#f-benvenuto', { state: 'visible' });
    await page.screenshot({ path: `${dir}/${tag}-benvenuto.png` });
    await page.fill('#b-nome', 'anonimo'); await page.click('#b-invia');
    const errRiservato = await testo('#b-err');
    await page.fill('#b-nome', 'Prova'); await page.fill('#b-pwd', 'nuova-password-1'); await page.fill('#b-pwd2', 'diversa');
    await page.click('#b-invia');
    const errDiverse = await testo('#b-err');
    await page.fill('#b-pwd2', 'nuova-password-1'); await page.click('#b-invia');
    await page.waitForSelector('#p-guida', { state: 'visible' });
    const benvenutoOk = db.profilo.nome === 'Prova' && db.profilo.nome_scelto && db.password === 'nuova-password-1';
    /* passo 5: settimana d'esempio copiata una volta, dati del browser portati sul database */
    await page.waitForFunction(() => !/Caricamento/.test(document.getElementById('shop').textContent));
    const riga = (g, s) => db.settimana.filter(r => r.giorno === g && r.pasto === s)[0];
    const avvioOk = db.profilo.settimana_avviata && db.settimana.length === 28 && riga('lun', 'pranzo').ricetta === 'hummus-di-ceci' &&
      riga('mer', 'pranzo').avanzo_di === 'mar' && riga('mar', 'cena').dosi === 2 &&
      db.spesa_ricette.length === 1 && db.spesa_voci.length === 1 &&
      await page.evaluate(() => !localStorage.getItem('rv-spesa') && !localStorage.getItem('rv-ricettario'));

    /* le schede funzionano come prima */
    await page.screenshot({ path: `${dir}/${tag}-guida.png` });
    /* passo 7: guida con indice, riassunti, fonti per sezione; salti senza cambiare l'indirizzo; acquisti consapevoli */
    await page.waitForFunction(() => !/Caricamento/.test(document.getElementById('acq').textContent));
    const guida = await page.evaluate(() => {
      const sez = Array.prototype.slice.call(document.querySelectorAll('#p-guida .g-sez'));
      return { sezioni: sez.length, inBreve: sez.every(x => x.querySelector('.inbreve')), fonti: sez.filter(x => x.querySelector('.g-fonti a[href^="https://"]')).length,
        voci: document.querySelectorAll('#p-guida .indice a[data-salta]').length, vere: document.querySelectorAll('#acq .acq-v').length, gruppi: document.querySelectorAll('#acq details.acq-g').length,
        vegano: /arrivare a un'alimentazione vegana completa|Solo vegano/.test(document.getElementById('p-guida').textContent) };
    });
    const hashPrima = await page.evaluate(() => location.hash);
    await page.click('#p-guida .indice a[href="#g-carne"]');
    await page.waitForTimeout(150);
    const salto = await page.evaluate(() => ({ hash: location.hash, focus: document.activeElement && document.activeElement.id, top: document.getElementById('g-carne').getBoundingClientRect().top }));
    await page.click('#g-carne details summary');
    await page.screenshot({ path: `${dir}/${tag}-guida-carne.png` });
    /* voci vere: ricerca per nome e per marchio */
    await page.locator('#g-acquisti').scrollIntoViewIfNeeded();
    await page.fill('#acq-cerca', 'carrefour');
    const cerca1 = await page.evaluate(() => ({ n: document.querySelectorAll('#acq .acq-v').length, tipo: (document.querySelector('#acq .acq-v .badge.tipo') || {}).textContent,
      aperto: !!document.querySelector('#acq details.acq-g[open]'), conta: document.getElementById('acq-conta').textContent }));
    await page.fill('#acq-cerca', 'booking.com');
    const cerca2 = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#acq .acq-v'), v => v.querySelector('.nome').textContent + ':' + v.querySelectorAll('.acq-s').length));
    await page.screenshot({ path: `${dir}/${tag}-guida-acquisti-vere.png` });
    await page.fill('#acq-cerca', 'prigat');
    const cerca4 = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#acq .acq-v'), v => v.querySelector('.nome').textContent + ':' +
      Array.prototype.map.call(v.querySelectorAll('.badge.tipo'), b => b.textContent).join('+')));
    await page.fill('#acq-cerca', 'sodastream');
    const cerca5 = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#acq .acq-v .badge.tipo'), b => b.textContent));
    await page.fill('#acq-cerca', 'nessunamarcaesistente');
    const cerca3 = await page.evaluate(() => /Nessuna voce/.test(document.getElementById('acq-elenco').textContent));
    /* voci imitate: testo come testo, collegamenti solo https, fonte sconosciuta scartata, verifica vecchia */
    await page.evaluate(() => import('./js/guida.js').then(m => m.renderAcquisti({
      temi: { t: 'Tema di prova' }, settori: [{ id: 'cibo', nome: 'Cibo e bevande' }], tipi: { x: 'Tipo X' },
      fonti: { a: { da: 'dalla Campagna A', titolo: 'Rapporto 2026', url: 'https://esempio.invalid/r', verificata_il: '2026-09-01' },
        b: { da: 'dall\'Ente B', titolo: 'Scheda', url: 'javascript:alert(1)', verificata_il: '2025-06-01' }, c: { da: 'X' } },
      voci: [
        { azienda: 'Marchio <b>Uno</b>', settore: 'cibo', segnalazioni: [{ fonte: 'a', tipo: 'x', per: 'deforestazione' }] },
        { azienda: 'Marchio Due', settore: 'nuovo', segnalazioni: [{ fonte: 'b', per: 'condizioni di lavoro' }] },
        { azienda: 'Senza fonte', settore: 'cibo', segnalazioni: [{ fonte: 'c', per: 'Y' }] }
      ] }, Date.UTC(2026, 9, 28))));
    await page.evaluate(() => document.querySelectorAll('#acq details').forEach(d => { d.open = true; }));
    await page.locator('#g-acquisti').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${tag}-guida-acquisti.png` });
    const acq = await page.evaluate(() => {
      const v = document.querySelectorAll('#acq .acq-v');
      return { n: v.length, b: document.querySelectorAll('#acq-elenco b').length, testoB: /<b>Uno<\/b>/.test(document.getElementById('acq').textContent),
        link: Array.prototype.map.call(document.querySelectorAll('#acq-elenco a'), a => a.getAttribute('href')),
        ricontrolla: Array.prototype.filter.call(v, x => !!x.querySelector('.ricontrolla')).map(x => x.querySelector('.nome').textContent),
        frase: /Segnalata dalla Campagna A per deforestazione\./.test(document.getElementById('acq').textContent) };
    });
    const guidaOk = guida.sezioni === 6 && guida.inBreve && guida.fonti === 5 && guida.voci === 6 && guida.vere > 200 && guida.gruppi > 10 && !guida.vegano &&
      salto.hash === hashPrima && salto.focus === 'g-carne-t' && salto.top >= 0 && salto.top < 120 &&
      cerca1.n === 1 && cerca1.tipo === 'Boicottaggio prioritario' && cerca1.aperto && /1 voce trovata/.test(cerca1.conta) &&
      cerca2.join() === 'Booking Holdings:3,Booking.com B.V.:1' && cerca3 &&
      cerca4.join() === 'Central Bottling Company (Coca-Cola Israele):Banca dati Who Profits' &&
      cerca5.join() === 'Boicottaggio prioritario,Obiettivo di disinvestimento (per banche, fondi ed enti)' &&
      acq.n === 2 && acq.b === 0 && acq.testoB && acq.link.length === 1 && acq.link[0] === 'https://esempio.invalid/r' && acq.ricontrolla.join() === 'Marchio Due' && acq.frase;
    if (!guidaOk) console.log('guida', guida, salto, cerca1, cerca2, cerca3, cerca4, cerca5, acq);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#t-stagione'); await page.waitForSelector('#seas .seas-g');
    await page.click('#disp .addp');
    await page.click('#t-ricette'); await page.waitForSelector('.rcard');
    const nCards = await page.$$eval('.rcard', a => a.length);
    await page.click('.rcard'); await page.waitForSelector('#add-shop');
    await page.click('#p-piu'); await page.click('#add-shop');
    await page.screenshot({ path: `${dir}/${tag}-dettaglio.png` });
    await page.click('#d-arch'); await page.click('#open-arch'); await page.waitForSelector('.acard');
    await page.click('[data-arest]');
    await page.click('#t-ricette'); await page.click('#new-recipe'); await page.waitForSelector('#rform');
    await page.click('#rform button[type=submit]'); await page.waitForSelector('#f-errsum');
    const nErr = await page.$$eval('#f-errsum li', a => a.length);
    await page.click('#t-settimana'); await page.waitForSelector('.meal');
    await page.click('#sett-all');
    await page.screenshot({ path: `${dir}/${tag}-settimana.png` });
    await page.click('#t-spesa'); await page.waitForSelector('.dept');
    const nVoci = await page.$$eval('#shop .item', a => a.length);
    await page.screenshot({ path: `${dir}/${tag}-spesa.png`, fullPage: false });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const font = await page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"') && document.fonts.check('700 16px "Bricolage Grotesque"'));

    /* impostazioni: nome, password, tema, ingredienti da evitare */
    await page.click('#imp-btn'); await page.waitForSelector('#p-impostazioni', { state: 'visible' });
    const email = await testo('#imp-email');
    const nomeCampo = await page.$eval('#i-nome', e => e.value);
    await page.fill('#i-nome', 'Prova due'); await page.click('#f-nome button[type=submit]');
    await page.waitForFunction(() => document.getElementById('i-nome').value === 'Prova due');
    await page.fill('#i-pwd-att', 'sbagliata'); await page.fill('#i-pwd-nuova', 'altra-password-2'); await page.fill('#i-pwd-rip', 'altra-password-2');
    await page.click('#f-pwd button[type=submit]'); await page.waitForSelector('#i-pwd-err:not([hidden])');
    const errPwdAtt = await testo('#i-pwd-err');
    await page.fill('#i-pwd-att', 'nuova-password-1'); await page.click('#f-pwd button[type=submit]');
    await page.waitForFunction(() => document.getElementById('i-pwd-att').value === '');
    const pwdOk = db.password === 'altra-password-2';
    await page.fill('#i-evit', 'Ceci'); await page.click('#f-evitare button[type=submit]');
    await page.waitForSelector('#evit-lista .chip.evit');
    const evitOk = db.preferenze && db.preferenze.da_evitare.join() === 'ceci';
    await page.click('#canc-apri');
    await page.screenshot({ path: `${dir}/${tag}-impostazioni.png`, fullPage: true });
    await page.click('#canc-annulla');
    const scrollWImp = await page.evaluate(() => document.documentElement.scrollWidth);
    const altroTema = scheme === 'light' ? 'dark' : 'light';
    await page.check(`input[name="tema"][value="${altroTema}"]`);
    const temaOk = await page.evaluate(t => document.documentElement.dataset.theme === t, altroTema);
    await page.check('input[name="tema"][value="auto"]');
    await page.click('#t-ricette'); await page.click('#t-ricette'); /* il secondo tocco riporta all'elenco */
    await page.waitForSelector('.rcard');
    const conCeci = await page.$$eval('.badge.evit', a => a.length);
    await page.click('[data-k="noevit"]');
    const senzaCeci = await page.$$eval('.rcard', a => a.length);
    const filtroOk = conCeci > 0 && senzaCeci === nCards - conCeci && (await page.$$eval('.badge.evit', a => a.length)) === 0;
    await page.click('[data-k="noevit"]');

    /* passo 4: ricerca, categoria, autore, permessi */
    await page.fill('#r-cerca', 'ceci');
    const titoliCeci = await page.$$eval('.rcard', a => a.length);
    await page.screenshot({ path: `${dir}/${tag}-elenco.png` });
    await page.fill('#r-cerca', '');
    await page.click('[data-g="cat"][data-k="pesce"]');
    const soloPesce = await page.$$eval('.rcard h3', a => a.map(e => e.textContent));
    await page.click('[data-g="cat"][data-k="tutte"]');
    await page.selectOption('#r-autore', ALTRO);
    const diMarta = await page.$$eval('.rcard', a => a.length);
    await page.click('.rcard'); await page.waitForSelector('#d-copy');
    const altruiBloccata = !(await page.$('#d-edit')) && !(await page.$('#d-del')) && /Marta/.test(await testo('.chi'));
    await page.click('#back'); await page.selectOption('#r-autore', '');
    const ricercaOk = titoliCeci > 0 && titoliCeci < nCards && soloPesce.join() === 'Orata al forno di Marta' && diMarta === 1 && altruiBloccata;

    /* nuova ricetta: categoria incoerente, carne rifiutata dal database, poi salvata */
    await page.click('#new-recipe'); await page.waitForSelector('#rform');
    await page.fill('#f-titolo', 'Pasta prova del gruppo'); await page.selectOption('#f-pasto', 'pranzo');
    await page.check('#f-cat'); await page.check('#f-diff'); await page.fill('#f-tp', '10'); await page.fill('#f-tc', '10'); await page.check('#f-tutto');
    await page.fill('#f-i0-nome', 'Pasta corta'); await page.fill('#f-i0-qta', '160'); await page.selectOption('#f-i0-rep', 'cereali');
    await page.fill('#f-i1-nome', 'Uova'); await page.fill('#f-i1-qta', '2'); await page.selectOption('#f-i1-rep', 'frigo');
    await page.fill('#f-p0', 'Cuoci la pasta e condisci.');
    await page.click('#rform button[type=submit]'); await page.waitForSelector('#e-f-cat');
    const errCat = await testo('#e-f-cat');
    await page.check('#f-cat-vegetariana');
    await page.fill('#f-i1-nome', 'Chorizo');
    await page.click('#rform button[type=submit]'); await page.waitForSelector('#e-f-i1-nome');
    const errCarne = await testo('#e-f-i1-nome');
    await page.screenshot({ path: `${dir}/${tag}-modulo-errori.png` });
    await page.fill('#f-i1-nome', 'Zucchine'); await page.selectOption('#f-i1-rep', 'ortofrutta');
    await page.click('#rform button[type=submit]'); await page.waitForSelector('#d-del');
    const salvata = db.ricette.filter(r => r.titolo === 'Pasta prova del gruppo')[0];
    const salvataOk = !!salvata && salvata.categoria === 'vegetariana' && salvata.stagioni.join() === 'tutto_anno' && /Inserita da/.test(await testo('.chi'));
    await page.screenshot({ path: `${dir}/${tag}-nuova.png`, fullPage: true });

    /* eliminazione: avviso sulle settimane degli altri, cestino, ripristino */
    await page.click('#d-del'); await page.waitForFunction(() => /altra persona/.test((document.querySelector('.warnline:not(#w-avviso)') || {}).textContent || ''));
    const avviso = await testo('.warnline:not(#w-avviso)');
    await page.click('#d-del'); await page.waitForSelector('#r-list:not([hidden])');
    const nelCestino = !!salvata.eliminata_il;
    await page.click('#open-cest'); await page.waitForSelector('[data-crest]');
    const cestino = await testo('#r-cest');
    await page.screenshot({ path: `${dir}/${tag}-cestino.png`, fullPage: true });
    await page.click('[data-crest]'); await page.waitForFunction(() => !document.querySelector('[data-crest]'));
    const cestinoOk = nelCestino && !salvata.eliminata_il && /solo Marta/.test(cestino) && /Frittata di zucchine/.test(cestino) && /1 altra persona/.test(avviso);
    await page.click('#cest-back');

    /* passo 5: «Aggiungi alla settimana» dal dettaglio, con conferma se il pasto è occupato */
    await page.fill('#r-cerca', 'hummus'); await page.click('.rcard[data-id="hummus-di-ceci"]'); await page.waitForSelector('#w-add');
    await page.selectOption('#w-giorno', 'dom'); await page.selectOption('#w-pasto', 'cena');
    await page.click('#w-add');
    const avvisoSost = await testo('#w-avviso');
    await page.click('#w-add');
    await page.waitForFunction(() => /domenica a cena/.test(document.getElementById('r-detail').textContent));
    await page.screenshot({ path: `${dir}/${tag}-aggiungi-settimana.png`, fullPage: true });
    await page.click('#back'); await page.fill('#r-cerca', '');
    const aggiungiOk = /Al posto di «Riso/.test(avvisoSost) && riga('dom', 'cena').ricetta === 'hummus-di-ceci';

    /* passo 6: commenti (quello di Marta non si modifica; il proprio si pubblica, modifica, elimina) */
    await page.fill('#r-cerca', 'hummus'); await page.click('.rcard[data-id="hummus-di-ceci"]'); await page.waitForSelector('#d-comm .comm');
    const commMarta = await testo('#d-comm .comm');
    const htmlMarta = await page.$eval('#d-comm .c-t', e => e.innerHTML);
    const martaBloccato = !(await page.$('#d-comm [data-cmod]'));
    await page.click('#c-form button[type=submit]');
    const msgVuoto = await testo('#toast');
    await page.fill('#c-testo', 'Provata con la paprika: buona.');
    const contatore = await testo('#c-conta');
    await page.click('#c-form button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('#d-comm .comm').length === 2);
    const pubblicato = db.commenti.length === 2 && db.commenti[1].testo === 'Provata con la paprika: buona.' && (await page.$eval('#c-testo', e => e.value)) === '';
    await page.click('#d-comm [data-cmod]'); await page.fill('#c-mod', 'Provata con la paprika affumicata: buonissima.');
    await page.click('#d-comm [data-csalva]');
    await page.waitForFunction(() => /affumicata/.test(document.getElementById('d-comm').textContent) && !document.getElementById('c-mod'));
    const modificato = db.commenti[1].testo === 'Provata con la paprika affumicata: buonissima.' && /modificato/.test(await testo('#d-comm'));
    await (await page.$('#d-comm')).screenshot({ path: `${dir}/${tag}-commenti.png` });
    await page.click('#d-comm [data-ctogli]');
    const armato = await testo('#d-comm [data-ctogli]');
    await page.click('#d-comm [data-ctogli]');
    await page.waitForFunction(() => document.querySelectorAll('#d-comm .comm').length === 1);
    const commOk = /Marta/.test(commMarta) && /<b>con<\/b>/.test(commMarta) && htmlMarta.indexOf('&lt;b&gt;') > -1 && martaBloccato &&
      /Scrivi qualcosa/.test(msgVuoto) && contatore === '30/500' && pubblicato && modificato && /Conferma/.test(armato) && db.commenti.length === 1;
    await page.click('#back'); await page.fill('#r-cerca', '');

    /* settimana: cambiare un pasto (l'avanzo segue), togliere un pasto, sceglierne uno nuovo */
    await page.click('#t-settimana'); await page.waitForSelector('[data-mod="mar|cena"]');
    await page.click('[data-mod="mar|cena"]');
    await page.selectOption('#mod-mar-cena', 'pasta-fagioli-borlotti');
    const doppiaGia = await page.isChecked('#mod-mar-cena-d');
    await page.screenshot({ path: `${dir}/${tag}-settimana-cambia.png` });
    await page.click('.meal.edit [data-salva]');
    await page.click('[data-mod="lun|spuntino"]'); await page.click('.meal.edit [data-togli]');
    await page.waitForSelector('[data-mod="lun|spuntino"]');
    const vuoto = /Nessun piatto/.test(await page.$eval('[data-mod="lun|spuntino"]', b => b.parentElement.textContent));
    await page.click('[data-mod="lun|spuntino"]'); await page.click('.meal.edit [data-salva]');
    const serveRicetta = await page.$('.meal.edit') !== null;
    await page.selectOption('#mod-lun-spuntino', 'ceci-croccanti-paprika'); await page.click('.meal.edit [data-salva]');
    await page.waitForFunction(() => !document.querySelector('.meal.edit'));
    await page.waitForTimeout(300);
    const settOk = doppiaGia && riga('mar', 'cena').ricetta === 'pasta-fagioli-borlotti' && riga('mar', 'cena').dosi === 2 &&
      riga('mer', 'pranzo').ricetta === 'pasta-fagioli-borlotti' && riga('mer', 'pranzo').avanzo_di === 'mar' &&
      vuoto && serveRicetta && riga('lun', 'spuntino').ricetta === 'ceci-croccanti-paprika';

    /* ricetta nel cestino: «Ricetta eliminata» e sostituto, l'avanzo lo segue */
    riga('gio', 'cena').ricetta = 'frittata-marta'; riga('ven', 'pranzo').ricetta = 'frittata-marta';
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#t-settimana'); await page.waitForSelector('[data-sw="gio|cena"]');
    const eliminata = await page.$eval('#day-gio', e => e.textContent) + await page.$eval('#day-ven', e => e.textContent);
    await (await page.$('#day-gio')).screenshot({ path: `${dir}/${tag}-settimana-eliminata.png` });
    await (await page.$('#day-ven')).screenshot({ path: `${dir}/${tag}-settimana-avanzo.png` });
    await page.selectOption('[data-sw="gio|cena"]', 'farro-ceci-zucca-rucola');
    await page.waitForFunction(() => !document.querySelector('[data-sw]'));
    await page.waitForTimeout(300);
    const sostOk = /Ricetta eliminata/.test(eliminata) && /Avanzo di un piatto eliminato/.test(eliminata) &&
      riga('gio', 'cena').ricetta === 'farro-ceci-zucca-rucola' && riga('gio', 'cena').dosi === 2 && riga('ven', 'pranzo').ricetta === 'farro-ceci-zucca-rucola';

    /* passo 6: settimana di Marta in sola lettura, copia del suo martedì nella propria */
    await page.waitForSelector('#s-chi option[value="' + ALTRO + '"]', { state: 'attached' });
    await page.selectOption('#s-chi', ALTRO); await page.waitForSelector('.days.altrui');
    const altrui = await testo('#sett');
    const solaLettura = !(await page.$('[data-mod]')) && !(await page.$('[data-sw]')) && !(await page.$('#sett-all'));
    await (await page.$('#day-mar')).screenshot({ path: `${dir}/${tag}-settimana-altrui.png` });
    await page.click('[data-copia="mar"]');
    const conferma = await testo('#day-mar .warnline');
    await page.click('[data-copia="mar"]');
    await page.waitForTimeout(400);
    const msgCopia = await testo('#toast');
    const copiaOk = riga('mar', 'colazione').ricetta === 'avena-in-ammollo-fichi-pera' && riga('mar', 'pranzo').ricetta === 'pasta-lenticchie-rosse' &&
      riga('mar', 'pranzo').dosi === 1 && !riga('mar', 'pranzo').nota && !riga('mar', 'cena') && !riga('mar', 'spuntino') &&
      riga('mer', 'pranzo').ricetta === 'pasta-fagioli-borlotti' && !riga('mer', 'pranzo').avanzo_di && /1 piatto eliminato/.test(msgCopia);
    /* aprire una ricetta dalla settimana di Marta e tornarci */
    await page.click('#day-mer .meal[data-id]'); await page.waitForSelector('#back');
    const tornaTesto = await testo('#back');
    await page.click('#back'); await page.waitForSelector('.days.altrui');
    await page.selectOption('#s-chi', ''); await page.waitForSelector('[data-mod="mar|cena"]');
    const mieiVuoti = /Nessun piatto/.test(await page.$eval('[data-mod="mar|cena"]', b => b.parentElement.textContent));
    const gruppoOk = /La settimana di Marta/.test(altrui) && /Ricetta eliminata/.test(altrui) && /avanzo di martedì/.test(altrui) && /doppia dose/.test(altrui) &&
      /Ne avanza per domani/.test(altrui) && solaLettura && /sostituiti/.test(conferma) && copiaOk && /settimana/.test(tornaTesto) && mieiVuoti;

    /* spesa: spunta, voce a mano tolta, sincronizzate sul database */
    await page.click('#t-spesa'); await page.waitForSelector('#shop .item input');
    await page.click('#shop .item input');
    await page.click('[data-rmx="Tovaglioli di carta"]');
    await page.waitForTimeout(300);
    const spesaOk = db.spesa_spunte.length === 1 && !db.spesa_voci.some(v => v.nome === 'Tovaglioli di carta') &&
      db.spesa_ricette.some(r => r.ricetta === 'hummus-di-ceci') && db.spesa_ricette.length > 5;
    /* errore di scrittura: messaggio e lista riletta dal database */
    db.giuPersonali = true;
    await page.click('#shop .item input:not(:checked)');
    await page.waitForFunction(() => /Riprova|riprova|server|Qualcosa/.test(document.getElementById('toast').textContent));
    const msgScrittura = await testo('#toast');
    await page.waitForTimeout(800); /* anche la rilettura fallisce: resta ciò che si vede, senza errori nella pagina */
    db.giuPersonali = false;

    /* la sessione resta dopo il ricaricamento */
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('nav.tabs', { state: 'visible' });
    const persist = await page.$eval('#shop-count', e => e.textContent);

    /* passo 8, PWA: manifest, icone, service worker attivo */
    const pwa = await page.evaluate(async function () {
      const m = await (await fetch('manifest.webmanifest')).json();
      const icone = await Promise.all(m.icons.map(function (i) { return fetch(i.src).then(function (r) { return r.ok; }); }));
      const reg = await navigator.serviceWorker.ready;
      return { nome: m.name, avvio: m.start_url, display: m.display, icone: icone.length >= 3 && icone.every(Boolean),
        maskable: m.icons.some(function (i) { return i.purpose === 'maskable'; }), attivo: !!reg.active, controlla: !!navigator.serviceWorker.controller };
    });
    const pwaOk = pwa.nome === 'Ricettario di famiglia' && pwa.avvio === './' && pwa.display === 'standalone' && pwa.icone && pwa.maskable && pwa.attivo && pwa.controlla;
    const instOk = await page.evaluate(function () {
      document.getElementById('imp-btn').click();
      const v = function (id) { return !document.getElementById(id).hidden; };
      const r = v('inst-da-fare') && !v('inst-gia') && !v('inst-btn') && (v('inst-ios') !== v('inst-altro'));
      document.getElementById('imp-chiudi').click();
      return r;
    });

    /* avvio senza rete vera (pagina dal service worker, Supabase irraggiungibile): copia salvata, sola lettura */
    const contaSpesa = await page.$eval('#shop-count', e => e.textContent);
    await page.click('#t-ricette');
    const nCardsOn = await page.$$eval('#cards .rcard', l => l.length);
    db.giu = true; await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#senza-rete:not([hidden])');
    const avvisoRete = await testo('#senza-rete');
    await page.click('#t-ricette');
    const nCardsOff = await page.$$eval('#cards .rcard', l => l.length);
    await page.click('#t-spesa');
    const spesaOff = await page.$eval('#shop-count', e => e.textContent);
    await page.screenshot({ path: `${dir}/${tag}-senza-rete.png` });
    const primaSpunta = await page.$eval('#shop .item input', e => e.checked);
    await page.click('#shop .item input');
    await page.waitForFunction(() => /Senza connessione/.test(document.getElementById('toast').textContent));
    await page.waitForTimeout(300);
    const dopoSpunta = await page.$eval('#shop .item input', e => e.checked);
    const offlineOk = /Senza connessione/.test(avvisoRete) && nCardsOff === nCardsOn && nCardsOn > 0 && spesaOff === contaSpesa && primaSpunta === dopoSpunta;
    /* torna la rete: si rilegge da sola e l'avviso sparisce */
    db.giu = false; await ctx.setOffline(false);
    await page.waitForSelector('#senza-rete', { state: 'hidden' });
    const tornataOk = await page.evaluate(() => !document.body.textContent.includes('Senza connessione.'));

    /* senza rete e senza copia la sessione non si perde: messaggio e «Riprova» */
    await page.evaluate(() => localStorage.removeItem('rv-copia'));
    db.giu = true;
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#avvio-riprova');
    const msgRete = await testo('#avvio');
    db.giu = false;
    await page.click('#avvio-riprova'); await page.waitForSelector('nav.tabs', { state: 'visible' });
    const reteOk = /connessione/.test(msgRete) && pwaOk && instOk && offlineOk && tornataOk;
    if (!reteOk) console.log('pwa', pwa, instOk, avvisoRete, nCardsOn, nCardsOff, spesaOff, contaSpesa, primaSpunta, dopoSpunta, tornataOk);

    /* uscita e cancellazione dell'account */
    await page.click('#imp-btn'); await page.click('#imp-esci');
    await page.waitForSelector('#f-accesso', { state: 'visible' });
    const uscitoOk = await page.evaluate(() => !Object.keys(localStorage).some(k => k === 'rv-accesso' || k === 'rv-copia'));
    await page.fill('#a-email', EMAIL); await page.fill('#a-pwd', 'altra-password-2'); await page.click('#a-invia');
    await page.waitForSelector('nav.tabs', { state: 'visible' });
    await page.click('#imp-btn'); await page.click('#canc-apri');
    await page.fill('#c-pwd', 'altra-password-2'); await page.click('#c-invia');
    const errCasella = await testo('#c-err');
    await page.check('#c-ok'); await page.click('#c-invia');
    await page.waitForSelector('#f-accesso', { state: 'visible' });
    const cancOk = !db.esiste && await page.evaluate(() => !Object.keys(localStorage).some(k => k.indexOf('rv-') === 0 && k !== 'rv-theme'));

    const esito = {
      nascosta, errVuoto: !!errVuoto, errSbagliata, mostrata, errRiservato: !!errRiservato, errDiverse, benvenutoOk,
      nCards, nErr, nVoci, scrollW, scrollWImp, font, email: email === EMAIL, nomeCampo, errPwdAtt, pwdOk, evitOk, temaOk, filtroOk,
      ricercaOk, errCat, errCarne, salvataOk, avviso, cestinoOk, avvioOk, aggiungiOk, settOk, sostOk, commOk, gruppoOk, guidaOk, spesaOk, msgScrittura, persist, reteOk, uscitoOk, errCasella: !!errCasella, cancOk, attesi, errs
    };
    console.log(tag, esito);
    const ok = db.uscite === 2 && !errs.length && scrollW <= w && scrollWImp <= w && nCards && nascosta && esito.errVuoto && /non corretti/.test(errSbagliata) &&
      mostrata === 'text' && esito.errRiservato && /non coincidono/.test(errDiverse) && benvenutoOk && nomeCampo === 'Prova' &&
      /non è corretta/.test(errPwdAtt) && pwdOk && evitOk && temaOk && filtroOk && ricercaOk && /Vegetariana/.test(errCat) && /carne/.test(errCarne) && salvataOk && cestinoOk && avvioOk && aggiungiOk && settOk && sostOk && commOk && gruppoOk && guidaOk && spesaOk && persist && reteOk && uscitoOk && esito.errCasella && cancOk && esito.email;
    if (!ok) fail++;
    await ctx.close();
  }

  /* progetto vero: credenziali inesistenti → messaggio chiaro (unica chiamata reale) */
  if (!process.env.SENZA_RETE) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 760 } });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.fill('#a-email', 'nessuno@esempio.invalid'); await page.fill('#a-pwd', 'password-inesistente');
    await page.click('#a-invia');
    await page.waitForFunction(() => !document.getElementById('a-err').hidden, null, { timeout: 15000 });
    const vero = await page.$eval('#a-err', e => e.textContent);
    console.log('progetto vero, credenziali sbagliate:', vero);
    if (!/non corretti/.test(vero)) fail++;
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
