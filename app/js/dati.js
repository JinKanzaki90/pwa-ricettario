/* Ricettario sul database: lettura, salvataggio, cestino, archivio personale.
   Le regole vere (chi può modificare, ripristinare, cosa è carne) stanno nel database (RLS e vincoli);
   qui si leggono e si scrivono i dati e si traducono gli errori in italiano. */
import { sb, U } from './accesso.js';
import { S } from './stato.js';

/* colonne che l'app può scrivere (le altre le gestisce il database) */
const COLONNE = ['titolo', 'pasto', 'categoria', 'difficolta', 'tempo_min', 'tempo_prep', 'tempo_cottura', 'riposo', 'porzioni_base',
  'stagioni', 'ingredienti', 'passi', 'note_nutrizionali', 'alcolici', 'versione_di'];
const LEGGI = 'id,titolo,pasto,categoria,difficolta,tempo_min,tempo_prep,tempo_cottura,riposo,porzioni_base,stagioni,ingredienti,passi,' +
  'note_nutrizionali,alcolici,versione_di,autore,creata_il,modificata_il,modificata_da,eliminata_il,eliminata_da';
export const GIORNI_CESTINO = 30;

/* ---------- conversione al confine: nel database «tutto l'anno» è {tutto_anno}, nell'app la stringa ---------- */
export function daDb(x) {
  const r = Object.assign({}, x);
  r.stagioni = Array.isArray(x.stagioni) && x.stagioni.indexOf('tutto_anno') > -1 ? 'tutto_anno' : (x.stagioni || []);
  r.ingredienti = Array.isArray(x.ingredienti) ? x.ingredienti : [];
  r.passi = Array.isArray(x.passi) ? x.passi : [];
  ['riposo', 'note_nutrizionali'].forEach(function (k) { if (r[k] == null) delete r[k]; });
  return r;
}
export function aDb(r) {
  const o = {};
  COLONNE.forEach(function (k) { o[k] = r[k] === undefined ? null : r[k]; });
  o.stagioni = r.stagioni === 'tutto_anno' ? ['tutto_anno'] : r.stagioni;
  o.alcolici = !!r.alcolici;
  return o;
}

/* ---------- permessi (come le policy del database: generiche di tutti, le altre solo dell'autore) ---------- */
export function mia(r) { return !!(r && r.autore && U.utente && r.autore === U.utente.id); }
export function puoModificare(r) { return !!r && (!r.autore || mia(r)); }
export function nomeAutore(id) { return id ? (S.AUTORI[id] || 'Anonimo') : 'Anonimo'; }
export function generica(r) { return !r.autore; }

/* ---------- lettura ---------- */
export async function caricaRicette() {
  const [ric, aut, arc] = await Promise.all([
    sb.from('ricette').select(LEGGI).order('titolo'),
    sb.from('profili').select('id,nome'),
    sb.from('archivio').select('ricetta')
  ]);
  const err = ric.error || aut.error || arc.error;
  if (err) throw err;
  const autori = {};
  aut.data.forEach(function (p) { autori[p.id] = p.nome; });
  const tutte = ric.data.map(daDb);
  S.AUTORI = autori;
  S.RICETTE = tutte.filter(function (r) { return !r.eliminata_il; });
  S.CESTINO = tutte.filter(function (r) { return r.eliminata_il; })
    .sort(function (a, b) { return a.eliminata_il < b.eliminata_il ? 1 : -1; });
  S.ARCH = arc.data.map(function (a) { return a.ricetta; });
  S.caricate = true;
  S.letto = Date.now();
}

/* ---------- scrittura ---------- */
/* nuova ricetta (senza id) o modifica; restituisce la ricetta salvata */
export async function salvaRicetta(r, id) {
  const riga = aDb(r);
  const q = id ? sb.from('ricette').update(riga).eq('id', id) : sb.from('ricette').insert(riga);
  const res = await q.select(LEGGI);
  if (res.error) throw res.error;
  if (!res.data || !res.data.length) throw { code: 'non_permesso' };
  return daDb(res.data[0]);
}

/* cestino: il database registra data e autore dell'eliminazione */
async function cambiaCestino(id, dentro) {
  const res = await sb.from('ricette').update({ eliminata_il: dentro ? new Date().toISOString() : null }).eq('id', id).select('id');
  if (res.error) throw res.error;
  if (!res.data || !res.data.length) throw { code: 'non_permesso' };
}
export function nelCestino(id) { return cambiaCestino(id, true); }
export function dalCestino(id) { return cambiaCestino(id, false); }

export async function archivia(id) {
  const res = await sb.from('archivio').upsert({ ricetta: id }, { onConflict: 'utente,ricetta', ignoreDuplicates: true });
  if (res.error) throw res.error;
  if (S.ARCH.indexOf(id) < 0) S.ARCH.push(id);
}
export async function togliArchivio(id) {
  const res = await sb.from('archivio').delete().eq('ricetta', id);
  if (res.error) throw res.error;
  S.ARCH = S.ARCH.filter(function (x) { return x !== id; });
}

/* persone (diverse da chi chiama) che hanno la ricetta nella settimana salvata sul database */
export async function altreSettimane(id) {
  const res = await sb.from('settimana').select('utente').eq('ricetta', id);
  if (res.error) throw res.error;
  const io = U.utente && U.utente.id, visti = {};
  res.data.forEach(function (x) { if (x.utente !== io) visti[x.utente] = true; });
  return Object.keys(visti).length;
}

/* ---------- settimana personale ----------
   una riga per pasto: chiave 'giorno|pasto' → {ricetta, dosi, avanzo_di, nota}; ricetta nulla = cancellata per sempre */
const LEGGI_SETT = 'giorno,pasto,ricetta,dosi,avanzo_di,nota';
function io() { return U.utente && U.utente.id; }
function senzaErrore(res) { if (res.error) throw res.error; return res.data; }
function aMappa(righe) {
  const m = {};
  righe.forEach(function (x) { m[x.giorno + '|' + x.pasto] = { ricetta: x.ricetta, dosi: x.dosi || 1, avanzo_di: x.avanzo_di || null, nota: x.nota || '' }; });
  return m;
}
export async function caricaSettimana() {
  return aMappa(senzaErrore(await sb.from('settimana').select(LEGGI_SETT).eq('utente', io())));
}
/* prima volta: copia la settimana d'esempio (i pasti già presenti, per esempio da un altro dispositivo, restano) */
export async function avviaSettimana(esempio) {
  const righe = [];
  esempio.giorni.forEach(function (g) {
    g.pasti.forEach(function (p) {
      righe.push({ giorno: g.id, pasto: p.slot, ricetta: p.id, dosi: p.dosi || 1, avanzo_di: p.avanzo_di || null, nota: p.nota || null });
    });
  });
  /* una ricetta d'esempio cancellata per sempre diventa un pasto «eliminato» con la scelta del sostituto */
  const ids = righe.map(function (x) { return x.ricetta; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
  const esistenti = senzaErrore(await sb.from('ricette').select('id').in('id', ids)).map(function (x) { return x.id; });
  righe.forEach(function (x) { if (esistenti.indexOf(x.ricetta) < 0) x.ricetta = null; });
  senzaErrore(await sb.from('settimana').upsert(righe, { onConflict: 'utente,giorno,pasto', ignoreDuplicates: true }));
  senzaErrore(await sb.from('profili').update({ settimana_avviata: true }).eq('id', io()));
}
export async function settimanaAvviata() {
  const d = senzaErrore(await sb.from('profili').select('settimana_avviata').eq('id', io()).single());
  return !!d.settimana_avviata;
}
/* scrive un pasto (nuovo o sostituito); un pasto vuoto si toglie */
export async function salvaPasto(giorno, pasto, v) {
  const riga = { ricetta: v.ricetta, dosi: v.dosi || 1, avanzo_di: v.avanzo_di || null, nota: v.nota || null };
  const agg = senzaErrore(await sb.from('settimana').update(riga).eq('utente', io()).eq('giorno', giorno).eq('pasto', pasto).select('giorno'));
  if (!agg.length) senzaErrore(await sb.from('settimana').insert(Object.assign({ giorno: giorno, pasto: pasto }, riga)));
}
export async function svuotaSettimana() {
  senzaErrore(await sb.from('settimana').delete().eq('utente', io()));
}
export async function togliPasto(giorno, pasto) {
  senzaErrore(await sb.from('settimana').delete().eq('utente', io()).eq('giorno', giorno).eq('pasto', pasto));
}
/* gli avanzi cucinati in «giorno» seguono il piatto nuovo (o diventano piatti normali se il piatto non c'è più) */
export async function aggiornaAvanzi(giorno, vecchia, nuova) {
  let q = sb.from('settimana').update(nuova ? { ricetta: nuova } : { avanzo_di: null, nota: null }).eq('utente', io()).eq('avanzo_di', giorno);
  q = vecchia ? q.eq('ricetta', vecchia) : q.is('ricetta', null);
  senzaErrore(await q.select('giorno'));
}

/* settimane degli altri del gruppo, in sola lettura: id utente → mappa dei pasti */
export async function caricaSettimaneGruppo() {
  const righe = senzaErrore(await sb.from('settimana').select('utente,' + LEGGI_SETT).neq('utente', io()));
  const per = {};
  righe.forEach(function (x) { (per[x.utente] = per[x.utente] || []).push(x); });
  const out = {};
  Object.keys(per).forEach(function (u) { out[u] = aMappa(per[u]); });
  return out;
}

/* ---------- commenti alle ricette: tutti leggono, ognuno modifica ed elimina i propri ---------- */
const LEGGI_COMM = 'id,ricetta,autore,testo,creato_il,modificato_il';
export async function caricaCommenti(ricetta) {
  return senzaErrore(await sb.from('commenti').select(LEGGI_COMM).eq('ricetta', ricetta).order('creato_il').order('id'));
}
export async function nuovoCommento(ricetta, testo) {
  return senzaErrore(await sb.from('commenti').insert({ ricetta: ricetta, testo: testo }).select(LEGGI_COMM).single());
}
export async function cambiaCommento(id, testo) {
  const d = senzaErrore(await sb.from('commenti').update({ testo: testo }).eq('id', id).eq('autore', io()).select('id'));
  if (!d.length) throw { code: 'commento_altrui' };
}
export async function togliCommento(id) {
  const d = senzaErrore(await sb.from('commenti').delete().eq('id', id).eq('autore', io()).select('id'));
  if (!d.length) throw { code: 'commento_altrui' };
}

/* ---------- lista della spesa personale (tre tabelle: i dispositivi non si sovrascrivono a vicenda) ---------- */
export async function caricaSpesa() {
  const [r, v, s] = await Promise.all([
    sb.from('spesa_ricette').select('ricetta,porzioni,aggiunta_il').eq('utente', io()).order('aggiunta_il'),
    sb.from('spesa_voci').select('id,nome,reparto').eq('utente', io()).order('id'),
    sb.from('spesa_spunte').select('chiave').eq('utente', io())
  ]);
  return {
    selezione: senzaErrore(r).map(function (x) { return { id: x.ricetta, porzioni: x.porzioni }; }),
    extra: senzaErrore(v).map(function (x) { return { id: x.id, nome: x.nome, reparto: x.reparto }; }),
    spunte: senzaErrore(s).map(function (x) { return x.chiave; })
  };
}
/* porzioni di una ricetta in lista: aggiorna la riga se c'è, altrimenti la crea */
export async function porzioniInSpesa(ricetta, porzioni) {
  const agg = senzaErrore(await sb.from('spesa_ricette').update({ porzioni: porzioni }).eq('utente', io()).eq('ricetta', ricetta).select('ricetta'));
  if (!agg.length) senzaErrore(await sb.from('spesa_ricette').insert({ ricetta: ricetta, porzioni: porzioni }));
}
export async function togliDaSpesa(ricetta) {
  senzaErrore(await sb.from('spesa_ricette').delete().eq('utente', io()).eq('ricetta', ricetta));
}
export async function aggiungiVoce(nome, reparto) {
  return senzaErrore(await sb.from('spesa_voci').insert({ nome: nome, reparto: reparto }).select('id,nome,reparto').single());
}
export async function togliVoce(id) {
  senzaErrore(await sb.from('spesa_voci').delete().eq('utente', io()).eq('id', id));
}
export async function spunta(chiave, si) {
  if (si) senzaErrore(await sb.from('spesa_spunte').upsert({ chiave: chiave }, { onConflict: 'utente,chiave', ignoreDuplicates: true }));
  else senzaErrore(await sb.from('spesa_spunte').delete().eq('utente', io()).eq('chiave', chiave));
}
export async function togliSpunte(chiavi) {
  if (chiavi.length) senzaErrore(await sb.from('spesa_spunte').delete().eq('utente', io()).in('chiave', chiavi));
}
export async function svuotaSpesa() {
  await Promise.all(['spesa_ricette', 'spesa_voci', 'spesa_spunte'].map(async function (t) {
    senzaErrore(await sb.from(t).delete().eq('utente', io()));
  }));
}

/* ingredienti che il database considera carne: stesso elenco del vincolo ricette_senza_carne */
export async function ingredientiDiCarne(ingredienti) {
  const res = await sb.rpc('ingredienti_di_carne', { ing: ingredienti });
  if (res.error) throw res.error;
  return res.data || [];
}

/* ---------- errori del database in italiano ---------- */
const VINCOLI = {
  commenti_testo_lunghezza: 'Il commento deve avere da 1 a 500 caratteri.',
  spesa_porzioni_valide: 'In lista ci stanno da 1 a 60 porzioni per ricetta.',
  spesa_voci_nome_lunghezza: 'La voce deve avere da 1 a 80 caratteri.',
  settimana_dosi_valide: 'Le dosi vanno da 1 a 6.',
  settimana_nota_lunghezza: 'La nota può avere al massimo 200 caratteri.',
  ricette_senza_carne: 'Un ingrediente risulta carne: il ricettario non ammette carne, salumi, strutto, brodo di carne o gelatina animale.',
  ricette_titolo_lunghezza: 'Il titolo deve avere da 3 a 120 caratteri.',
  ricette_ingredienti_validi: 'Controlla gli ingredienti: da 1 a 60, con nomi fino a 80 caratteri.',
  ricette_passi_validi: 'Controlla il procedimento: da 1 a 40 passaggi, ognuno fino a 1000 caratteri.',
  ricette_note_lunghezza: 'Le note possono avere al massimo 1000 caratteri.',
  ricette_riposo_lunghezza: 'Il riposo può avere al massimo 60 caratteri.',
  ricette_categoria_valida: 'Scegli la categoria: vegana, vegetariana o con pesce.',
  ricette_stagioni_valide: 'Scegli una o più stagioni, oppure «Tutto l\'anno».',
  ricette_porzioni_valide: 'Le porzioni vanno da 1 a 20.'
};
export function msgDb(e) {
  if (!e) return 'Qualcosa non ha funzionato. Riprova tra poco.';
  const code = e.code || '', msg = String(e.message || '') + ' ' + String(e.details || '');
  if (code === 'commento_altrui') return 'Puoi modificare o eliminare solo i tuoi commenti (forse questo non c\'è più).';
  if (code === 'non_permesso' || code === '42501' || /row-level security/i.test(msg)) return 'Non puoi farlo: questa ricetta è di un\'altra persona. Puoi crearne una tua versione.';
  if (code === '23503') return 'La ricetta non esiste più: è stata cancellata del tutto.';
  if (code === '23505') return 'Già fatto, forse da un altro dispositivo: ho riletto i dati.';
  if (code === '23514') {
    const k = Object.keys(VINCOLI).filter(function (n) { return msg.indexOf(n) > -1; })[0];
    return k ? VINCOLI[k] : 'Alcuni dati non sono validi: controlla il modulo.';
  }
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(msg)) return 'La sessione è scaduta: esci e rientra.';
  if (e instanceof TypeError || /fetch|network|failed to fetch/i.test(msg)) return 'Non riesco a raggiungere il server. Controlla la connessione e riprova.';
  return 'Qualcosa non ha funzionato. Riprova tra poco.';
}
