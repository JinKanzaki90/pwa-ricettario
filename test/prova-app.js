/* Prova funzionale dell'app in Chromium headless: 360 px e desktop, tema chiaro e scuro, console senza errori.
   Uso: servire app/ (es. python3 -m http.server 8123 --bind 127.0.0.1 -d app) e poi: node test/prova-app.js [indirizzo] */
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8123/';
const dir = process.env.CARTELLA_SCHERMATE || '/tmp';
(async () => {
  const browser = await chromium.launch();
  let fail = 0;
  for (const [w, h] of [[360, 760], [1280, 900]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage(); const errs = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    const tag = `${w}-${scheme}`;
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
    const sb = await page.evaluate(async () => { const m = await import('./vendor/supabase-js-2.117.3.esm.js'); const c = await import('./config.js'); return typeof m.createClient === 'function' && c.SUPABASE_URL.startsWith('https://'); });
    await page.reload({ waitUntil: 'networkidle' });
    const persist = await page.$eval('#shop-count', e => e.textContent);
    console.log(tag, { nCards, nErr, nVoci, scrollW, font, sb, persist, errs });
    if (errs.length || scrollW > w || !sb || !nCards) fail++;
    await ctx.close();
  }
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
