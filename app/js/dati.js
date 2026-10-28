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

/* ingredienti che il database considera carne: stesso elenco del vincolo ricette_senza_carne */
export async function ingredientiDiCarne(ingredienti) {
  const res = await sb.rpc('ingredienti_di_carne', { ing: ingredienti });
  if (res.error) throw res.error;
  return res.data || [];
}

/* ---------- errori del database in italiano ---------- */
const VINCOLI = {
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
  if (code === 'non_permesso' || code === '42501' || /row-level security/i.test(msg)) return 'Non puoi farlo: questa ricetta è di un\'altra persona. Puoi crearne una tua versione.';
  if (code === '23514') {
    const k = Object.keys(VINCOLI).filter(function (n) { return msg.indexOf(n) > -1; })[0];
    return k ? VINCOLI[k] : 'Alcuni dati non sono validi: controlla il modulo.';
  }
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt/i.test(msg)) return 'La sessione è scaduta: esci e rientra.';
  if (e instanceof TypeError || /fetch|network|failed to fetch/i.test(msg)) return 'Non riesco a raggiungere il server. Controlla la connessione e riprova.';
  return 'Qualcosa non ha funzionato. Riprova tra poco.';
}
