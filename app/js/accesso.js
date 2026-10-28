/* Accesso con email e password, primo accesso (nome e password), Impostazioni.
   La sessione la salva supabase-js su questo dispositivo: l'accesso si fa una volta per dispositivo.
   Nessun dato personale finisce nella console. */
import { createClient } from '../vendor/supabase-js-2.117.3.esm.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';
import { $, esc, toast } from './util.js';
import { S, normShop, togliVecchiDati } from './stato.js';
import { apriImpostazioni, tornaDaImpostazioni } from './navigazione.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'rv-accesso' }
});

/* utente collegato: { id, email }, profilo { nome, nome_scelto } */
export const U = { utente: null, profilo: null };

let quandoDentro = function () {};
let entrato = false;

/* ---------- messaggi d'errore in italiano ---------- */
export function msgErrore(e) {
  if (!e) return 'Qualcosa non ha funzionato. Riprova tra poco.';
  const code = e.code || '', msg = String(e.message || ''), st = e.status;
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Email o password non corretti.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || st === 429) return 'Troppi tentativi ravvicinati. Aspetta qualche minuto e riprova.';
  if (code === 'weak_password') return 'Password troppo debole: usa almeno 8 caratteri, meglio una frase di più parole.';
  if (code === 'same_password') return 'La nuova password è uguale a quella attuale.';
  if (code === 'user_banned') return 'Questo account è bloccato. Chiedi a chi gestisce il ricettario.';
  if (code === 'email_not_confirmed') return 'Questo account non è ancora attivo. Chiedi a chi gestisce il ricettario.';
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return 'Per sicurezza esci, rientra e riprova a cambiare la password.';
  if (code === 'session_not_found' || code === 'user_not_found' || code === 'bad_jwt' || code === 'PGRST301') return 'La sessione è scaduta: esci e rientra.';
  if (code === '23514' && /nome_non_riservato/.test(msg)) return '«Anonimo» è riservato a chi non ha scelto un nome: scegline un altro.';
  if (code === '23514' && /nome_lunghezza/.test(msg)) return 'Il nome deve avere da 1 a 40 caratteri, senza spazi all\'inizio o alla fine.';
  if (code === '23514' && /da_evitare/.test(msg)) return 'Al massimo 30 ingredienti da evitare, ognuno fino a 40 caratteri.';
  if (code === '42501') return 'Operazione non permessa.';
  if (senzaRete(e)) {
    return 'Non riesco a raggiungere il server. Controlla la connessione e riprova.';
  }
  return 'Qualcosa non ha funzionato. Riprova tra poco.';
}

function senzaRete(e) {
  const msg = String((e && e.message) || '');
  return !!e && (e.name === 'AuthRetryableFetchError' || e instanceof TypeError || e.status === 0 || /fetch|network/i.test(msg));
}
function mostraErr(id, testo) { const el = $(id); el.textContent = testo || ''; el.hidden = !testo; }
function occupato(btn, si, testo) {
  btn.disabled = si;
  if (si) { btn.dataset.testo = btn.textContent; btn.textContent = testo || 'Attendi…'; }
  else if (btn.dataset.testo) btn.textContent = btn.dataset.testo;
}

/* ---------- stati della pagina ---------- */
function stato(s) {
  document.body.dataset.stato = s;
  $('accesso').hidden = s !== 'fuori';
  $('benvenuto').hidden = s !== 'benvenuto';
  $('imp-btn').hidden = s !== 'dentro';
}

function fuori(avviso) {
  U.utente = null; U.profilo = null; S.evitare = []; entrato = false;
  /* i dati del ricettario letti con questo account non restano in memoria */
  S.RICETTE = []; S.CESTINO = []; S.ARCH = []; S.AUTORI = {}; S.caricate = false; S.cur = null;
  S.MIA = {}; S.shop = normShop(null); S.personali = false; S.erroPers = '';
  $('f-accesso').reset(); mostraErr('a-err', '');
  stato('fuori');
  if (avviso) toast(avviso);
  setTimeout(function () { $('a-email').focus(); }, 0);
}

async function caricaUtente(user) {
  U.utente = { id: user.id, email: user.email || '' };
  const p = await sb.from('profili').select('nome, nome_scelto').eq('id', user.id).single();
  if (p.error) throw p.error;
  U.profilo = p.data;
  const pr = await sb.from('preferenze').select('da_evitare').eq('utente', user.id).maybeSingle();
  if (pr.error) throw pr.error;
  S.evitare = pr.data ? pr.data.da_evitare.slice() : [];
}

async function dopoAccesso(user) {
  try {
    await caricaUtente(user);
  } catch (e) {
    /* senza rete la sessione resta valida: niente uscita, si propone di riprovare */
    if (senzaRete(e)) {
      stato('avvio');
      $('avvio').querySelector('.wrap').innerHTML = '<div class="panel"><p>' + esc(msgErrore(e)) + '</p>' +
        '<button type="button" class="btn small" id="avvio-riprova">Riprova</button></div>';
      $('avvio-riprova').onclick = function () { $('avvio').querySelector('.wrap').innerHTML = '<p class="empty">Caricamento…</p>'; dopoAccesso(user); };
      return;
    }
    /* senza profilo non si va avanti: si torna all'accesso con il motivo */
    U.utente = null;
    await sb.auth.signOut({ scope: 'local' }).catch(function () {});
    fuori(); mostraErr('a-err', msgErrore(e));
    return;
  }
  if (!U.profilo.nome_scelto) {
    stato('benvenuto'); mostraErr('b-err', '');
    $('b-nome').value = ''; $('b-pwd').value = ''; $('b-pwd2').value = '';
    setTimeout(function () { $('b-nome').focus(); }, 0);
    return;
  }
  entra();
}

function entra() {
  stato('dentro');
  riempiImpostazioni();
  if (!entrato) { entrato = true; quandoDentro(); }
}

/* ---------- accesso ---------- */
async function inviaAccesso(ev) {
  ev.preventDefault();
  const email = $('a-email').value.trim(), pwd = $('a-pwd').value, btn = $('a-invia');
  if (!email || !pwd) { mostraErr('a-err', 'Scrivi email e password.'); (email ? $('a-pwd') : $('a-email')).focus(); return; }
  mostraErr('a-err', ''); occupato(btn, true, 'Accesso in corso…');
  const r = await sb.auth.signInWithPassword({ email: email, password: pwd }).catch(function (e) { return { error: e }; });
  occupato(btn, false);
  if (r.error) { mostraErr('a-err', msgErrore(r.error)); $('a-pwd').select(); return; }
  await dopoAccesso(r.data.user);
}

/* ---------- primo accesso ---------- */
function controllaNuova(nuova, ripeti) {
  if (nuova.length < 8) return 'La nuova password deve avere almeno 8 caratteri.';
  if (nuova !== ripeti) return 'Le due password non coincidono.';
  return '';
}
async function salvaNome(nome) {
  const r = await sb.from('profili').update({ nome: nome, nome_scelto: true }).eq('id', U.utente.id).select('nome, nome_scelto').single();
  if (r.error) throw r.error;
  U.profilo = r.data;
  S.AUTORI[U.utente.id] = r.data.nome;
}
async function inviaBenvenuto(ev) {
  ev.preventDefault();
  const nome = $('b-nome').value.trim().replace(/\s+/g, ' '), nuova = $('b-pwd').value, ripeti = $('b-pwd2').value, btn = $('b-invia');
  if (!nome) { mostraErr('b-err', 'Scrivi il nome che vuoi mostrare agli altri.'); $('b-nome').focus(); return; }
  if (nome.toLowerCase() === 'anonimo') { mostraErr('b-err', '«Anonimo» è riservato a chi non ha scelto un nome: scegline un altro.'); $('b-nome').focus(); return; }
  if (nuova || ripeti) {
    const m = controllaNuova(nuova, ripeti);
    if (m) { mostraErr('b-err', m); $('b-pwd').focus(); return; }
  }
  mostraErr('b-err', ''); occupato(btn, true, 'Salvataggio…');
  try {
    if (nuova) {
      const r = await sb.auth.updateUser({ password: nuova });
      if (r.error) throw r.error;
    }
    await salvaNome(nome);
  } catch (e) {
    occupato(btn, false); mostraErr('b-err', msgErrore(e)); return;
  }
  occupato(btn, false);
  entra();
  toast('Ciao, ' + nome + '!');
}

/* ---------- impostazioni ---------- */
function riempiImpostazioni() {
  if (!U.utente) return;
  $('imp-email').textContent = U.utente.email;
  $('i-pwd-user').value = U.utente.email; $('c-user').value = U.utente.email;
  $('i-nome').value = U.profilo ? U.profilo.nome : '';
  renderEvitare();
}

async function inviaNome(ev) {
  ev.preventDefault();
  const nome = $('i-nome').value.trim().replace(/\s+/g, ' ');
  const btn = ev.submitter || $('f-nome').querySelector('button[type=submit]');
  if (!nome) { mostraErr('i-nome-err', 'Il nome non può essere vuoto.'); return; }
  if (nome.toLowerCase() === 'anonimo') { mostraErr('i-nome-err', '«Anonimo» è riservato a chi non ha scelto un nome: scegline un altro.'); return; }
  if (U.profilo && nome === U.profilo.nome) { mostraErr('i-nome-err', ''); toast('Il nome è già questo.'); return; }
  mostraErr('i-nome-err', ''); occupato(btn, true, 'Salvo…');
  try { await salvaNome(nome); $('i-nome').value = U.profilo.nome; toast('Nome aggiornato.'); }
  catch (e) { mostraErr('i-nome-err', msgErrore(e)); }
  occupato(btn, false);
}

/* verifica la password attuale rifacendo l'accesso (non cambia utente: stessa email) */
async function verificaPassword(pwd) {
  const r = await sb.auth.signInWithPassword({ email: U.utente.email, password: pwd });
  if (r.error) {
    if (r.error.code === 'invalid_credentials' || /invalid login credentials/i.test(r.error.message || '')) {
      const e = new Error('password'); e.code = 'password_errata'; throw e;
    }
    throw r.error;
  }
}

async function inviaPassword(ev) {
  ev.preventDefault();
  const att = $('i-pwd-att').value, nuova = $('i-pwd-nuova').value, rip = $('i-pwd-rip').value;
  const btn = $('f-pwd').querySelector('button[type=submit]');
  if (!att) { mostraErr('i-pwd-err', 'Scrivi la password attuale.'); $('i-pwd-att').focus(); return; }
  const m = controllaNuova(nuova, rip);
  if (m) { mostraErr('i-pwd-err', m); $('i-pwd-nuova').focus(); return; }
  if (nuova === att) { mostraErr('i-pwd-err', 'La nuova password è uguale a quella attuale.'); return; }
  mostraErr('i-pwd-err', ''); occupato(btn, true, 'Cambio in corso…');
  try {
    await verificaPassword(att);
    const r = await sb.auth.updateUser({ password: nuova });
    if (r.error) throw r.error;
    $('f-pwd').reset(); $('i-pwd-user').value = U.utente.email;
    toast('Password cambiata.');
  } catch (e) {
    mostraErr('i-pwd-err', e.code === 'password_errata' ? 'La password attuale non è corretta.' : msgErrore(e));
  }
  occupato(btn, false);
}

/* ingredienti da evitare: salvati nel database, visibili solo a chi li ha scelti */
function renderEvitare() {
  const l = S.evitare || [];
  $('evit-lista').innerHTML = l.length ? l.map(function (x, i) {
    return '<span class="chip evit">' + esc(x) + '<button type="button" class="xchip" data-evit="' + i + '" aria-label="Togli ' + esc(x) + '">✕</button></span>';
  }).join('') : '<span class="fine">Nessun ingrediente da evitare.</span>';
}
async function salvaEvitare(nuovo) {
  const id = U.utente.id;
  const up = await sb.from('preferenze').update({ da_evitare: nuovo }).eq('utente', id).select('da_evitare');
  if (up.error) throw up.error;
  if (!up.data.length) {
    const ins = await sb.from('preferenze').insert({ utente: id, da_evitare: nuovo }).select('da_evitare');
    if (ins.error) throw ins.error;
  }
  S.evitare = nuovo;
  renderEvitare();
  document.dispatchEvent(new CustomEvent('rv-evitare'));
}
async function aggiungiEvitare(ev) {
  ev.preventDefault();
  const v = $('i-evit').value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!v) { mostraErr('i-evit-err', 'Scrivi un ingrediente, per esempio «fave».'); return; }
  if ((S.evitare || []).indexOf(v) > -1) { mostraErr('i-evit-err', '«' + v + '» è già nell\'elenco.'); return; }
  if ((S.evitare || []).length >= 30) { mostraErr('i-evit-err', 'Al massimo 30 ingredienti.'); return; }
  mostraErr('i-evit-err', '');
  try { await salvaEvitare((S.evitare || []).concat([v])); $('i-evit').value = ''; }
  catch (e) { mostraErr('i-evit-err', msgErrore(e)); }
}
async function togliEvitare(i) {
  const l = (S.evitare || []).slice(); const tolto = l.splice(i, 1)[0];
  try { await salvaEvitare(l); toast('Tolto «' + tolto + '».'); }
  catch (e) { mostraErr('i-evit-err', msgErrore(e)); }
}

/* uscita: solo da questo dispositivo */
async function esci() {
  U.utente = null;
  togliVecchiDati(); /* eventuali dati delle versioni precedenti rimasti sul browser */
  await sb.auth.signOut({ scope: 'local' }).catch(function () {});
  fuori('Sei uscito. A presto!');
}

/* cancellazione dell'account: doppia conferma (casella + password) */
function apriCanc(si) {
  $('f-canc').hidden = !si; $('canc-apri').hidden = si;
  $('canc-apri').setAttribute('aria-expanded', si ? 'true' : 'false');
  $('c-pwd').value = ''; $('c-ok').checked = false; mostraErr('c-err', '');
  if (si) $('c-pwd').focus();
}
async function inviaCanc(ev) {
  ev.preventDefault();
  const pwd = $('c-pwd').value, btn = $('c-invia');
  if (!pwd) { mostraErr('c-err', 'Scrivi la tua password.'); $('c-pwd').focus(); return; }
  if (!$('c-ok').checked) { mostraErr('c-err', 'Spunta la casella per confermare.'); return; }
  mostraErr('c-err', ''); occupato(btn, true, 'Cancellazione…');
  try {
    await verificaPassword(pwd);
    const r = await sb.rpc('cancella_account');
    if (r.error) throw r.error;
  } catch (e) {
    occupato(btn, false);
    mostraErr('c-err', e.code === 'password_errata' ? 'La password non è corretta.' : msgErrore(e));
    return;
  }
  occupato(btn, false);
  U.utente = null;
  await sb.auth.signOut({ scope: 'local' }).catch(function () {});
  /* i dati personali salvati su questo dispositivo vanno via insieme all'account */
  try {
    Object.keys(localStorage).forEach(function (k) { if (k.indexOf('rv-') === 0 && k !== 'rv-theme') localStorage.removeItem(k); });
  } catch (e) { /* archiviazione non disponibile: niente da togliere */ }
  apriCanc(false);
  fuori('Account cancellato.');
}

/* ---------- avvio ---------- */
export async function initAccesso(dentro) {
  quandoDentro = dentro;
  $('f-accesso').addEventListener('submit', inviaAccesso);
  $('f-benvenuto').addEventListener('submit', inviaBenvenuto);
  $('f-nome').addEventListener('submit', inviaNome);
  $('f-pwd').addEventListener('submit', inviaPassword);
  $('f-evitare').addEventListener('submit', aggiungiEvitare);
  $('evit-lista').addEventListener('click', function (e) { const b = e.target.closest('[data-evit]'); if (b) togliEvitare(+b.dataset.evit); });
  $('imp-btn').addEventListener('click', function () { riempiImpostazioni(); apriImpostazioni(); });
  $('imp-chiudi').addEventListener('click', tornaDaImpostazioni);
  $('imp-esci').addEventListener('click', esci);
  $('canc-apri').addEventListener('click', function () { apriCanc(true); });
  $('canc-annulla').addEventListener('click', function () { apriCanc(false); $('canc-apri').focus(); });
  $('f-canc').addEventListener('submit', inviaCanc);
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-mostra]'); if (!b) return;
    const inp = $(b.dataset.mostra), vedi = inp.type === 'password';
    inp.type = vedi ? 'text' : 'password';
    b.textContent = vedi ? 'Nascondi' : 'Mostra'; b.setAttribute('aria-pressed', vedi ? 'true' : 'false');
  });

  /* sessione chiusa altrove (per esempio password reimpostata o utente bloccato) */
  sb.auth.onAuthStateChange(function (evento) {
    if (evento === 'SIGNED_OUT' && U.utente) setTimeout(function () { fuori('La sessione è terminata: accedi di nuovo.'); }, 0);
  });

  const r = await sb.auth.getSession().catch(function (e) { return { error: e, data: {} }; });
  const sessione = r.data && r.data.session;
  if (sessione && sessione.user) await dopoAccesso(sessione.user);
  else fuori();
}
