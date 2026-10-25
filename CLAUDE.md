# Ricettario di famiglia — istruzioni per Claude

Leggi questo file, poi `REQUISITI.md` (fonte di verità sulle funzioni) e `TODO.md` (stato dei lavori) prima di qualsiasi modifica.

## Progetto

PWA per un gruppo di amici: guida alimentare, ricettario condiviso (niente carne), settimana e lista della spesa personali. Proprietario: Angelo. Interfaccia e testi **in italiano**, limitando gli inglesismi.

- `artifact-originale/` — l'app di partenza (artifact Claude): pagina unica `index.html` + dati JSON. È il riferimento per aspetto, testi e logica; non si modifica.
- `app/` — il frontend della PWA, pubblicato su GitHub Pages (`https://jinkanzaki90.github.io/pwa-ricettario/`).
- `supabase/` — configurazione e migrazioni del database.
- `.github/workflows/` — automazioni (migrazioni, pubblicazione, continuità).

## Scelte tecniche

- **Frontend statico senza passo di build**: HTML, CSS e JavaScript (moduli ES) serviti così come sono. Librerie esterne copiate in `app/vendor/` con versione fissata nel nome del file (niente CDN a runtime, serve anche alla lettura offline).
- **Supabase**: progetto `wtwmjwpmovttalkxzhvm`, URL `https://wtwmjwpmovttalkxzhvm.supabase.co`, chiave publishable `sb_publishable_i-yE0f6HfcZhjn3wUAf1rQ_GFJkaqCe` (pubblica per costruzione, sta in `app/config.js`).
- **Accesso**: email + password create da Angelo dalla dashboard; registrazione libera disattivata.
- Percorsi del frontend sempre **relativi**: il sito è servito sotto `/pwa-ricettario/`.

## Regole non negoziabili

1. **Nessun segreto** nel codice, nei commit, nei log, nei messaggi. I segreti stanno solo nei Secrets di GitHub (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, ed eventuali futuri). Il repository è **pubblico**.
2. **RLS attiva su ogni tabella**; nessun permesso al ruolo `anon`; le policy usano `(select auth.uid())`.
3. Funzioni `security definer`: solo se indispensabili, con `set search_path = ''`, nomi qualificati, controlli espliciti su chi chiama, `revoke execute ... from public, anon`.
4. **Schema solo tramite migrazioni** in `supabase/migrations/` (`AAAAMMGGHHMMSS_descrizione.sql`), applicate dal workflow su push a `main`. Mai modifiche dalla dashboard. Una migrazione già applicata non si modifica: se ne scrive una nuova.
5. Dati personali (email, nomi) mai in file pubblici, artefatti di workflow non cifrati o log.
6. Si lavora su `main`. Commit piccoli, messaggi in italiano, che terminano con:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```
7. Prima di dichiarare chiuso un passo: verifica funzionale (pagina caricata in Chromium headless a 360 px e a desktop, chiaro e scuro, nessun errore in console; workflow GitHub verdi) e **revisione di fine passo** (le tre domande in `REQUISITI.md`, risposte scritte in `TODO.md` con le azioni che ne derivano).

## Ambiente di lavoro di Claude

- La sessione raggiunge GitHub (tramite proxy) e `wtwmjwpmovttalkxzhvm.supabase.co`; non ha la password del database né il token Supabase.
- Esito dei workflow: API pubblica `https://api.github.com/repos/JinKanzaki90/pwa-ricettario/actions/runs` (senza autenticazione, limite 60 richieste l'ora: non interrogare in ciclo stretto, attendi almeno 15 secondi tra un controllo e l'altro).
- Chromium è preinstallato per Playwright (`/opt/pw-browsers`); non eseguire `playwright install`.
