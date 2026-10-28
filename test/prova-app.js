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
    if (p === '/rest/v1/settimana') return json(200, [{ utente: ALTRO }, { utente: UID }]);
    if (p === '/rest/v1/rpc/ingredienti_di_carne') {
      return json(200, corpo.ing.filter(function (i) { return RE_CARNE.test(i.nome); }).map(function (i) { return i.nome; }));
    }
    if (p === '/rest/v1/profili') {
      if (m === 'PATCH') {
        if (corpo.nome.toLowerCase() === 'anonimo') return json(400, { code: '23514', message: 'violates check constraint "profili_nome_non_riservato"' });
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

(async () => {
  const browser = await chromium.launch();
  let fail = 0;
  for (const [w, h] of [[360, 760], [1280, 900]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const db = { esiste: true, password: 'iniziale-123', profilo: { nome: 'Anonimo', nome_scelto: false }, preferenze: null, chiamate: [], ricette: ricettario(), archivio: [] };
    await imitaSupabase(ctx, db);
    const page = await ctx.newPage(); const errs = []; let attesi = 0;
    /* i 400 del token sono voluti (password sbagliata): contati a parte */
    const voluto = function (url) { return url.indexOf('/auth/v1/token') > -1 || url.indexOf('/rest/v1/profili') > -1; };
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { if (voluto(m.location().url || '')) attesi++; else errs.push(m.type() + ': ' + m.text()); } });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    /* rete giù simulata e l'uscita, che non legge la risposta (204): con l'imitazione Chromium la segna «interrotta», non è un errore dell'app */
    page.on('requestfailed', r => { if (r.url().indexOf('/auth/v1/logout') < 0 && !db.giu) errs.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText); });
    page.on('response', r => { if (r.status() >= 400 && !voluto(r.url())) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
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

    /* le schede funzionano come prima */
    await page.screenshot({ path: `${dir}/${tag}-guida.png` });
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
    await page.click('#d-del'); await page.waitForFunction(() => /altra persona/.test((document.querySelector('.warnline') || {}).textContent || ''));
    const avviso = await testo('.warnline');
    await page.click('#d-del'); await page.waitForSelector('#r-list:not([hidden])');
    const nelCestino = !!salvata.eliminata_il;
    await page.click('#open-cest'); await page.waitForSelector('[data-crest]');
    const cestino = await testo('#r-cest');
    await page.screenshot({ path: `${dir}/${tag}-cestino.png`, fullPage: true });
    await page.click('[data-crest]'); await page.waitForFunction(() => !document.querySelector('[data-crest]'));
    const cestinoOk = nelCestino && !salvata.eliminata_il && /solo Marta/.test(cestino) && /Frittata di zucchine/.test(cestino) && /1 altra persona/.test(avviso);
    await page.click('#cest-back');

    /* la sessione resta dopo il ricaricamento */
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('nav.tabs', { state: 'visible' });
    const persist = await page.$eval('#shop-count', e => e.textContent);

    /* senza rete all'avvio la sessione non si perde: messaggio e «Riprova» */
    db.giu = true;
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#avvio-riprova');
    const msgRete = await testo('#avvio');
    db.giu = false;
    await page.click('#avvio-riprova'); await page.waitForSelector('nav.tabs', { state: 'visible' });
    const reteOk = /connessione/.test(msgRete);

    /* uscita e cancellazione dell'account */
    await page.click('#imp-btn'); await page.click('#imp-esci');
    await page.waitForSelector('#f-accesso', { state: 'visible' });
    const uscitoOk = await page.evaluate(() => !Object.keys(localStorage).some(k => k === 'rv-accesso'));
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
      ricercaOk, errCat, errCarne, salvataOk, avviso, cestinoOk, persist, reteOk, uscitoOk, errCasella: !!errCasella, cancOk, attesi, errs
    };
    console.log(tag, esito);
    const ok = db.uscite === 2 && !errs.length && scrollW <= w && scrollWImp <= w && nCards && nascosta && esito.errVuoto && /non corretti/.test(errSbagliata) &&
      mostrata === 'text' && esito.errRiservato && /non coincidono/.test(errDiverse) && benvenutoOk && nomeCampo === 'Prova' &&
      /non è corretta/.test(errPwdAtt) && pwdOk && evitOk && temaOk && filtroOk && ricercaOk && /Vegetariana/.test(errCat) && /carne/.test(errCarne) && salvataOk && cestinoOk && persist && reteOk && uscitoOk && esito.errCasella && cancOk && esito.email;
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
