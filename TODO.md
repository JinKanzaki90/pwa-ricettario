# TODO — Ricettario di famiglia

Stati: `[ ]` da fare · `[~]` in corso (con data e ora d'inizio) · `[x]` fatto (con data) · `[!]` in attesa di Angelo

Regola per le attività pianificate: si lavora **sul primo passo non completato**, un sotto-punto dopo l'altro. Se un passo non si chiude in un'esecuzione, si salva il lavoro con un commit, si segnano qui i sotto-punti fatti e si riprende alla prossima.

## Stato generale

- Requisiti approvati: revisione 5 (`REQUISITI.md`).
- Configurazioni di Angelo verificate il 25/10/2026: GitHub Pages attivo (origine GitHub Actions), segreti `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` validi, registrazione libera disattivata, dominio Supabase raggiungibile dalla sessione.
- Da verificare nella prova congiunta: utente di Angelo creato, Site URL impostato.

## Passi

### [~] 1. Struttura del repository (iniziato il 25/10/2026 alle 14:58 UTC)
- [ ] `app/`: copia dell'artifact divisa in `index.html`, `css/`, `js/` (moduli), `data/` (JSON di guida, stagione, dispensa, settimana d'esempio); nome «Ricettario di famiglia»; nessun collegamento a Supabase per ora: deve funzionare come l'artifact (dati sul browser).
- [ ] `app/config.js` con URL e chiave publishable; `app/vendor/` con supabase-js a versione fissata.
- [ ] Workflow `pubblica.yml`: pubblica `app/` su GitHub Pages a ogni push su `main` che tocca `app/`.
- [ ] Workflow `migrazioni.yml`: su push a `main` che tocca `supabase/migrations/`, applica le migrazioni (`supabase db push`) usando i segreti; fallisce in modo chiaro se mancano.
- [ ] Workflow `continuita.yml`: una chiamata al giorno a Supabase (evita la sospensione del piano gratuito). Backup settimanale **solo se cifrato**: il repository è pubblico; serve un segreto `BACKUP_PASSPHRASE` da chiedere ad Angelo, quindi per ora solo la chiamata giornaliera e annotare la richiesta.
- [ ] Rimuovere `verifica-configurazione.yml` se superato dai workflow nuovi (oppure lasciarlo come controllo manuale).
- [ ] Verifica: sito pubblicato raggiungibile, app funzionante a 360 px e desktop.
- [ ] Revisione di fine passo.

### [ ] 2. Schema del database
- [ ] Tabelle: profili (nome visualizzato, predefinito «Anonimo», ruolo), ricette (con categoria, autore nullable = generica, eliminata_il/eliminata_da per il cestino, ultima modifica e autore della modifica), commenti (max 500), archivio personale, settimana personale (giorno, pasto, ricetta, dosi, avanzo_di), spesa personale.
- [ ] Policy RLS secondo `REQUISITI.md` §3–§5 (settimane leggibili da tutti gli autenticati, modificabili solo dal proprietario; spesa e archivio solo del proprietario; ricette con autore modificabili solo dall'autore, generiche da tutti).
- [ ] Trigger: profilo creato alla creazione dell'utente **e** profili per gli utenti già esistenti; aggiornamento automatico di ultima modifica.
- [ ] Vincoli: nessuna carne (controllo lato database oltre che nel modulo, per quanto possibile), lunghezze massime.
- [ ] Svuotamento automatico del cestino dopo 30 giorni (`pg_cron` se disponibile, altrimenti workflow programmato).
- [ ] Caricamento delle 23 ricette di partenza come generiche, categoria «vegana».
- [ ] Verifica: migrazione applicata dal workflow; con la sola chiave publishable e senza accesso, nessuna tabella è leggibile.
- [ ] Revisione di fine passo.

### [ ] 3. Accesso e impostazioni
- [ ] Schermata di accesso (email + password), sessione persistente, uscita.
- [ ] Primo accesso: scelta del nome visualizzato, invito a cambiare password.
- [ ] Impostazioni (ingranaggio in alto a destra): password, nome, tema, ingredienti da evitare, cancellazione account (funzione con privilegi elevati, §5.9), collegamento alla privacy.
- [ ] Verifica e revisione di fine passo.
- [ ] **Punto di controllo**: segnare questo passo `[!]` e fermarsi. Si riprende solo quando Angelo, dopo la prova congiunta, cambia lo stato in `[x]`.

### [ ] 4. Ricettario collegato al database
Lettura, ricerca, filtri (categoria, autore), inserimento e modifica con categoria e blocco della carne, eliminazione con avviso sulle settimane coinvolte, cestino, archivio personale.

### [ ] 5. Settimana e spesa personali
Settimana dal database con «Aggiungi alla settimana» dal dettaglio ricetta, sostituti per ricette eliminate, spesa sincronizzata.

### [ ] 6. Commenti, settimane del gruppo, copia di un giorno

### [ ] 7. Guida riscritta e «Acquisti consapevoli»
Prima di scrivere i contenuti di «Acquisti consapevoli» chiedere ad Angelo criteri e fonti (§5.8): segnare `[!]` se mancano.

### [ ] 8. PWA
Manifest, icone, service worker per la lettura offline, «Aggiungi a schermata Home».

### [ ] 9. Pubblicazione e prova completa
Prova di tutte le funzioni, pagina privacy, istruzioni per Angelo su come creare gli utenti degli amici.

## Spunti dalle revisioni di fine passo

(vuoto)

## Richieste per Angelo

(vuoto)
