# TODO — Ricettario di famiglia

Stati: `[ ]` da fare · `[~]` in corso (con data e ora d'inizio) · `[x]` fatto (con data) · `[!]` in attesa di Angelo

Regola per le attività pianificate: si lavora **sul primo passo non completato**, un sotto-punto dopo l'altro. Se un passo non si chiude in un'esecuzione, si salva il lavoro con un commit, si segnano qui i sotto-punti fatti e si riprende alla prossima.

## Stato generale

- Requisiti approvati: revisione 5 (`REQUISITI.md`).
- Configurazioni di Angelo verificate il 25/10/2026: GitHub Pages attivo (origine GitHub Actions), segreti `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` validi, registrazione libera disattivata, dominio Supabase raggiungibile dalla sessione.
- Prova congiunta del passo 3 (28/10/2026): utente di Angelo creato, accesso riuscito dal telefono. Da verificare ancora: Site URL impostato.

## Passi

### [x] 1. Struttura del repository (fatto il 25/10/2026)
- [x] `app/`: copia dell'artifact divisa in `index.html`, `css/`, `js/` (moduli), `data/` (JSON di guida, stagione, dispensa, settimana d'esempio); nome «Ricettario di famiglia»; nessun collegamento a Supabase per ora: deve funzionare come l'artifact (dati sul browser). Nota: la Guida resta in HTML dentro `index.html` (sarà riscritta al passo 7); in `data/` ci sono ricette, stagioni, dispensa e settimana d'esempio. Caratteri in `app/fonts/`, niente Google Fonts.
- [x] `app/config.js` con URL e chiave publishable; `app/vendor/` con supabase-js a versione fissata.
- [x] Workflow `pubblica.yml`: pubblica `app/` su GitHub Pages a ogni push su `main` che tocca `app/`.
- [x] Workflow `migrazioni.yml`: su push a `main` che tocca `supabase/migrations/`, applica le migrazioni (`supabase db push`) usando i segreti; fallisce in modo chiaro se mancano.
- [x] Workflow `continuita.yml`: una chiamata al giorno a Supabase (evita la sospensione del piano gratuito). Backup settimanale **solo se cifrato**: il repository è pubblico; serve un segreto `BACKUP_PASSPHRASE` da chiedere ad Angelo, quindi per ora solo la chiamata giornaliera e annotare la richiesta.
- [x] Rimuovere `verifica-configurazione.yml` se superato dai workflow nuovi (oppure lasciarlo come controllo manuale). Rimosso: «Continuità» si può lanciare a mano e controlla gli stessi segreti.
- [x] Verifica: sito pubblicato raggiungibile (controllato dal job «controlla» di `pubblica.yml`, perché la sessione di Claude non raggiunge `github.io`), app funzionante a 360 px e desktop, chiaro e scuro, console senza errori (`test/prova-app.js`); workflow Pubblica, Migrazioni e Continuità verdi.
- [x] Revisione di fine passo.

### [x] 2. Schema del database (fatto il 25/10/2026)
- [x] Tabelle: `profili` (nome, predefinito «Anonimo», `nome_scelto` per il primo accesso, ruolo), `ricette` (categoria, autore nullo = generica, `eliminata_il`/`eliminata_da` per il cestino, `modificata_il`/`modificata_da`), `commenti` (max 500), `archivio`, `settimana` (giorno, pasto, ricetta, dosi, avanzo_di, nota), spesa in tre tabelle (`spesa_ricette`, `spesa_voci`, `spesa_spunte`) così i dispositivi non si sovrascrivono a vicenda. Migrazione `20261025170000_schema_iniziale.sql`.
- [x] Policy RLS secondo `REQUISITI.md` §3–§5, più permessi **colonna per colonna**: autore, date e «chi ha modificato/eliminato» li scrive solo il database; il ruolo non si cambia dall'app. Gli utenti non cancellano definitivamente le ricette: «eliminare» = spostare nel cestino.
- [x] Trigger: profilo alla creazione dell'utente e profili per gli utenti già esistenti; ultima modifica automatica (spostare nel cestino o ripristinare non conta come modifica); una ricetta spostata nel cestino esce dalle liste della spesa di tutti.
- [x] Vincoli: blocco della carne nel database (`nome_e_carne`, rete di sicurezza: parole chiave, versioni vegetali escluse), struttura e lunghezze di ingredienti, passi, tag, titoli, commenti, nomi.
- [x] Svuotamento del cestino dopo 30 giorni con `pg_cron`, ogni notte alle 3:23 UTC (`20261025170200_svuota_cestino.sql`).
- [x] 23 ricette di partenza generiche, categoria «vegana» (`20261025170100_ricette_di_partenza.sql`, generata da `supabase/strumenti/genera_ricette_partenza.py`).
- [x] Verifica: workflow Migrazioni verde; con la sola chiave publishable tutte le tabelle e le funzioni rispondono «permesso negato» (401/42501), controllato sia dalla sessione sia dal nuovo passo del workflow (`supabase/strumenti/verifica-anonimo.sh`). Regole di accesso provate su PostgreSQL locale con imitazione di Supabase (`test/db/prova-db.sh`: anon, utenti diversi, cestino, svuotamento, cancellazione di un account). App invariata: `test/prova-app.js` superato a 360 px e desktop, chiaro e scuro, console pulita.
- [x] Revisione di fine passo.

### [x] 3. Accesso e impostazioni (fatto il 28/10/2026)
- [x] Schermata di accesso (email + password), sessione persistente (supabase-js, chiave `rv-accesso` sul dispositivo), uscita solo da questo dispositivo. Errori in italiano (credenziali sbagliate, troppi tentativi, account bloccato, rete assente). Senza rete all'avvio la sessione non si perde: messaggio e «Riprova».
- [x] Primo accesso: nome visualizzato obbligatorio («Anonimo» riservato, anche nel database), cambio password facoltativo.
- [x] Impostazioni (ingranaggio in alto a destra, la barra resta a 5 voci): nome, password (con verifica di quella attuale), tema (spostato qui dall'intestazione), ingredienti da evitare (tabella `preferenze`, visibile solo al proprietario; ricette segnalate con «Contiene: …» e filtro «Senza ingredienti da evitare»), privacy, cancellazione account (password + casella; funzione `cancella_account()` security definer, solo sull'utente che chiama). Migrazione `20261025190000_accesso_impostazioni.sql`.
- [x] Pagina `privacy.html` (prima versione; da rivedere al passo 9).
- [x] Verifica: migrazione verde; con la sola chiave publishable `preferenze` e `rpc/cancella_account` rispondono 401 (anche nel workflow); registrazione libera disattivata (`signup_disabled`); prove locali del database superate (preferenze altrui, nome riservato, cancellazione del proprio account); `test/prova-app.js` superato a 360 px e desktop, chiaro e scuro, console pulita, con Supabase imitato più una prova reale di credenziali sbagliate.
- [x] Revisione di fine passo.
- [x] **Punto di controllo**: prova congiunta con Angelo il 28/10/2026. Superati: creazione degli utenti, accesso, primo accesso (nome, password, sessione che resta), impostazioni (nome, password, tema, ingredienti da evitare con segnalazione e filtro). Rimandati al passo 9, per decisione di Angelo: password sbagliata, uscita e rientro, cancellazione dell'account di prova.

### [x] 4. Ricettario collegato al database (fatto il 28/10/2026)
Lettura, ricerca, filtri (categoria, autore), inserimento e modifica con categoria e blocco della carne, eliminazione con avviso sulle settimane coinvolte, cestino, archivio personale.
- [x] Migrazione: elenco della carne ampliato (kebab, chorizo, pastrami, foie gras, colla di pesce, …) e funzione `ingredienti_di_carne()` per il modulo, con prove locali (`20261028090000_carne_ampliata.sql`).
- [x] Modulo dati `dati.js`: ricette, nomi degli autori e archivio letti da Supabase; conversione al confine (`{tutto_anno}` ↔ `'tutto_anno'`); `app/data/ricette.json` spostato in `supabase/strumenti/` (serve solo al generatore delle ricette di partenza).
- [x] Elenco: ricerca per titolo e ingrediente, filtri categoria e «Inserite da…», icone Vegana (foglia) e Di stagione (calendario con sole, anche nella scheda Stagione); confronto per parola intera degli ingredienti da evitare.
- [x] Dettaglio: autore, ultima modifica e chi l'ha fatta; «Modifica» solo a chi può.
- [x] Modulo: categoria obbligatoria, blocco della carne con lo stesso elenco del database, coerenza della categoria, niente più esclusione fissa di fave/piselli/tartufo; salvataggio su Supabase con errori del database tradotti.
- [x] Eliminazione = cestino, con avviso sulle settimane coinvolte; vista Cestino (chi e quando, ripristino a chi può); archivio personale sul database.
- [x] Content Security Policy in `index.html`; Guida: tolti i chip «Escluso dalle ricette».
- [x] Prove: `test/prova-app.js` con il ricettario imitato; prove locali del database.
- [x] Verifica: migrazione verde; con la sola chiave publishable anche `rpc/ingredienti_di_carne` risponde 401 (controllo del workflow corretto: ora chiama le funzioni con i loro argomenti); prove locali del database superate; `test/prova-app.js` superato a 360 px e desktop, chiaro e scuro, console pulita e CSP attiva (ricerca, categoria, autore, ricetta altrui non modificabile, categoria incoerente, carne rifiutata, salvataggio, avviso sulle settimane, cestino e ripristino); Pubblica verde.
- [x] Revisione di fine passo.

### [ ] 5. Settimana e spesa personali
Settimana dal database con «Aggiungi alla settimana» dal dettaglio ricetta, sostituti per ricette eliminate, spesa sincronizzata.

### [ ] 6. Commenti, settimane del gruppo, copia di un giorno

### [ ] 7. Guida riscritta e «Acquisti consapevoli»
Prima di scrivere i contenuti di «Acquisti consapevoli» chiedere ad Angelo criteri e fonti (§5.8): segnare `[!]` se mancano.

### [ ] 8. PWA
Manifest, icone, service worker per la lettura offline, «Aggiungi a schermata Home».

### [ ] 9. Pubblicazione e prova completa
Prova di tutte le funzioni, pagina privacy, istruzioni per Angelo su come creare gli utenti degli amici.
- [ ] Prove rimaste dal passo 3, da fare con Angelo: (a) password sbagliata → messaggio «Email o password non corretti»; (b) «Esci da questo dispositivo» e rientro con la nuova password; (c) con l'utente di prova, Impostazioni → «Cancella il mio account…» (password + casella): l'utente deve sparire dall'elenco della dashboard Supabase.

## Spunti dalle revisioni di fine passo

### Passo 1 (25/10/2026)
1. **Malintenzionato.** Nel repository c'è solo la chiave publishable, pubblica per costruzione; i segreti entrano nei workflow solo come variabili d'ambiente (GitHub li maschera nei log) e i workflow partono solo da push su `main` o a mano, mai da richieste di modifica esterne, quindi un fork non li vede. Rischio trovato: l'azione esterna `supabase/setup-cli`, che vede i segreti, era indicata con un'etichetta mobile (`@v1`). **Corretto subito**: fissata al commit della v1.7.3. L'app per ora salva solo sul browser; tutto il testo inserito passa da `esc()` prima di finire nell'HTML.
   - Azione (passo 4): quando i testi arriveranno dal database di altri utenti, ricontrollare che ogni valore mostrato passi da `esc()` (anche negli attributi) e valutare una Content Security Policy in `index.html`.
   - Azione (passo 2): la CLI Supabase è fissata a 2.120.0; aggiornarla di proposito, non in automatico.
2. **Utente.** L'app si comporta come l'artifact, da telefono e da computer, nei due temi. Corretto durante il passo un difetto vero: senza la regola `[hidden]` tutte le schede comparivano una sotto l'altra (nell'artifact la nascondeva la pagina ospite). Restano i testi «vegani» (Guida, conferma «la ricetta è vegana», esclusione di fave/piselli/tartufo): cambiano ai passi 4 e 7 come da requisiti.
   - Azione (passo 8): senza rete l'app non si apre ancora; arriva con il service worker.
3. **Revisore esterno.** Il codice è diviso in moduli ma resta molto simile all'originale: HTML costruito a stringhe, stato condiviso in un unico oggetto `S`, dipendenze circolari tra moduli (funzionano perché nessun modulo chiama gli altri durante il caricamento). Accettabile adesso, perché ricette, settimana e spesa verranno riscritte sul database ai passi 4 e 5.
   - Azione (passi 4–5): sostituire `S.usr`/`S.shop` con un modulo dati che parla con Supabase e togliere le dipendenze circolari; aggiornare `test/prova-app.js` a ogni passo.
   - Azione: il pacchetto supabase-js pesa circa 220 KB; caricarlo solo quando serve (dopo la schermata di accesso) e includerlo nel service worker al passo 8.

### Passo 2 (25/10/2026)
1. **Malintenzionato.** Senza accesso non si legge né si scrive nulla (provato sul progetto vero, tabella per tabella, e ripetuto a ogni migrazione dal workflow). Con un accesso non si può scrivere a nome di altri, appropriarsi di una ricetta generica, darsi il ruolo di amministratore, falsificare date o «modificata da», né toccare settimana, spesa, archivio e commenti altrui (prove locali). Le due funzioni `security definer` (creazione del profilo, pulizia della spesa quando una ricetta va nel cestino) partono solo da trigger, hanno `search_path` vuoto e non sono richiamabili dall'app. Nessun problema grave trovato. Rischi accettati e da tenere d'occhio:
   - chiunque abbia accesso può modificare o mandare nel cestino tutte le ricette generiche (è la regola di §4): il cestino le salva per 30 giorni, ma una **modifica** sovrascrive il testo senza storico. Azione (passo 4): valutare una tabella delle versioni precedenti, o almeno mostrare «ultima modifica di X» ben visibile;
   - nessun limite al numero di righe per utente (ricette, commenti): accettabile per un gruppo di amici su invito;
   - il blocco della carne si aggira con grafie fantasiose: è una rete di sicurezza, il controllo principale resta nel modulo.
2. **Utente.** Non c'è ancora interfaccia collegata. Gli errori del database arrivano come codici tecnici con il nome del vincolo (per esempio `ricette_senza_carne`).
   - Azione (passo 4): tradurre i nomi dei vincoli in messaggi chiari in italiano; usare per il modulo lo stesso elenco della carne del database (si può chiamare la funzione `nome_e_carne` da utente collegato), così app e database non danno risposte diverse.
   - Azione (passo 5): la settimana d'esempio sta nel frontend (`data/settimana.json`): al primo accesso l'app deve copiarla nella settimana dell'utente. Indicare che le note della settimana sono visibili al gruppo.
   - Azione (passo 4): nel database «tutto l'anno» è `stagioni = {tutto_anno}`, nell'app è la stringa `'tutto_anno'`: convertire al confine.
3. **Revisore esterno.** Lo schema è ordinato e provato, ma:
   - l'elenco della carne è fatto a mano; mancano per esempio kebab, chorizo, pastrami, foie gras, «colla di pesce» (spesso di maiale). Azione (passo 4): ampliarlo con una nuova migrazione insieme al modulo;
   - le prove sui permessi degli utenti collegati girano su un'imitazione locale di Supabase, non sul progetto vero (lì è provato solo l'accesso anonimo). Azione (passo 3, prova congiunta): ripetere sul progetto vero con due utenti le prove principali (leggere e non modificare la settimana altrui, non vedere la spesa altrui);
   - le ricette di partenza ora esistono due volte (`app/data/ricette.json` e database). Azione (passo 4): quando il ricettario legge dal database, togliere il JSON dal frontend;
   - `ruolo` per ora non serve a nulla (sono tutti «membro»): usarlo solo se arriva una funzione per l'amministratore, altrimenti toglierlo più avanti.

### Passo 3 (25/10/2026)
1. **Malintenzionato.** Nomi e ingredienti da evitare finiscono nella pagina solo tramite `esc()` o `textContent`. La cancellazione dell'account non ha parametri: agisce solo su chi chiama e senza accesso risponde 401. Le preferenze sono in una tabella separata dai profili (che tutti leggono) perché possono rivelare intolleranze. Corretto durante il passo: un avvio senza rete faceva uscire l'utente (ora la sessione resta). Rischi rimasti:
   - la richiesta di password prima di cancellare l'account o cambiare la password è controllata dall'app, non dal server: chi rubasse una sessione aperta potrebbe chiamare `cancella_account` direttamente. Accettabile per un gruppo di amici; azione (passo 9): valutare con Angelo l'opzione «Secure password change» di Supabase e, se serve, una verifica lato server;
   - la sessione sta nel `localStorage`: un difetto XSS la esporrebbe. Azione (passo 4, già annotata): Content Security Policy in `index.html`;
   - la lunghezza minima della password (8) è imposta dall'app; il server accetta il minimo impostato nel progetto (predefinito 6). Vedi richiesta ad Angelo.
2. **Utente.** Accesso, primo accesso e impostazioni funzionano da telefono e da computer nei due temi; errori chiari, nessun vicolo cieco (dal primo accesso si esce solo scegliendo un nome, per scelta). Restano:
   - azione (passo 4): dopo le Impostazioni la scheda Ricette torna alla vista in cui era (per esempio il modulo); valutare se riportarla all'elenco;
   - azione (passo 4): togliere dal modulo l'esclusione fissa di fave, piselli e tartufo e dalla Guida i chip «Escluso dalle ricette», ora sostituiti dagli ingredienti da evitare personali;
   - azione (passo 5): all'uscita i dati locali (ricette personali, spesa) restano sul browser; quando passeranno al database, svuotare i dati dell'utente all'uscita.
3. **Revisore esterno.** La prova automatica usa un Supabase imitato: il flusso vero con un utente reale non è ancora stato provato (serve la prova congiunta). supabase-js (circa 220 KB) ora si carica all'avvio, perché senza sessione non si vede nulla: l'azione del passo 1 di caricarlo dopo l'accesso decade; resta da metterlo in cache col service worker (passo 8). Il confronto degli ingredienti da evitare è per sottostringa («ceci» trova anche «farina di ceci», ma «pera» troverebbe «peperoni»): azione (passo 4) confrontare per parola intera. Rimosse dal repository le schermate di prova finite lì per errore al passo 1 (ora in `schermate/`, esclusa da git).

### Passo 4 (28/10/2026)
1. **Malintenzionato.** Le regole vere restano nel database: l'app nasconde «Modifica» ed «Elimina» a chi non può, ma anche chiamando le API a mano le policy limitano modifica, cestino e ripristino a ricette generiche o proprie (prove locali del passo 2). Ogni testo che arriva dal database (titoli, ingredienti, passi, note, nomi) passa da `esc()`; in più ora c'è una **Content Security Policy** (`index.html` e `privacy.html`): script solo dal sito più l'unico script in linea con impronta, stili solo dal file CSS (tolti gli `style=` in linea), connessioni solo verso il progetto Supabase, niente `<object>`, `<base>`, invii di moduli. La nuova funzione `ingredienti_di_carne` è pura, senza privilegi elevati, chiusa ad anon (401, verificato sul progetto vero). Nessun problema grave trovato. Rischi accettati, già noti:
   - chiunque può modificare o mandare nel cestino le ricette generiche; il cestino le salva 30 giorni, una **modifica** invece sovrascrive senza storico (si vede almeno «Ultima modifica il … di X» nel dettaglio). Azione (passo 9, da decidere con Angelo): tabella delle versioni precedenti se il gruppo la ritiene utile;
   - la CSP sta in un `<meta>` (GitHub Pages non permette intestazioni): niente `frame-ancestors`, quindi la pagina si può incorniciare in un altro sito. Rischio basso (nessuna azione con un solo clic senza conferma). Da rivalutare se si passa a Cloudflare Pages.
2. **Utente.** Ricerca, filtri, dettaglio con autore e date, modulo con categoria e messaggi chiari, cestino con chi e quando: provati da telefono e da computer nei due temi. Difetti e limiti:
   - a 360 px i filtri a chip occupano circa sei righe prima delle ricette. Azione (passo 9): raccogliere «Tempo, stagione, Calabria, alcol…» sotto un pulsante «Altri filtri»;
   - le modifiche degli altri compaiono quando si torna sulla scheda Ricette dopo 2 minuti, aprendo il cestino o ricaricando: niente aggiornamento in tempo reale (accettabile per un gruppo di amici);
   - l'avviso prima dell'eliminazione conta le settimane degli altri dal database, ma le settimane passano sul database solo al passo 5: fino ad allora conta solo la propria (sul browser). Azione (passo 5): verificare il conteggio con la settimana sul database;
   - le ricette personali create con la versione dell'artifact (salvate solo sul browser) non vengono più mostrate né caricate: nessuno le usava fuori dalle prove. Se Angelo ne avesse di importanti, si recuperano dalla chiave `rv-ricettario` del browser;
   - rimandata al passo 9 l'azione del passo 3 sul ritorno dalle Impostazioni (la scheda Ricette riapre la vista in cui era, per esempio il modulo con la bozza: utile, ma da valutare con Angelo).
   - senza rete le ricette non si leggono. Azione (passo 8): tenere una copia dell'ultima lettura per la consultazione offline.
3. **Revisore esterno.**
   - Il flusso vero con RLS (inserire, modificare, cestino, ripristino, archivio) è provato su PostgreSQL locale e con un Supabase imitato, non sul progetto vero con un account reale. Azione (passo 9, prova con Angelo): creare una ricetta, modificarla, eliminarla e ripristinarla; controllare da un secondo account che non si possa modificarla;
   - la coerenza della categoria usa parole chiave nel browser (uova, latticini, miele, pesce): ha falsi allarmi possibili (si risolvono scrivendo «vegetale» nel nome) e non è ripetuta nel database, per scelta: è una segnalazione, non una regola di sicurezza;
   - ogni lettura scarica tutte le ricette (decine): va bene per il gruppo; oltre qualche centinaio servirebbe la paginazione;
   - le dipendenze circolari tra moduli sono aumentate (`ricette` ↔ `modulo`, `dati` → `accesso`); funzionano perché nessun modulo chiama gli altri durante il caricamento. Azione (passo 5): quando settimana e spesa passano al database, spostare in `dati.js` anche il loro accesso ai dati;
   - durante il passo un commit intermedio ha pubblicato per pochi minuti un'app che cercava `data/ricette.json` già spostato (il controllo di «Pubblica» l'ha segnalato; corretto dal commit successivo). Lezione: con `git mv` già in sospeso, un commit di file scelti porta con sé anche lo spostamento: controllare `git status` prima di ogni commit parziale.

## Richieste per Angelo

- **Backup cifrato (passo 1, non bloccante):** per attivare il backup settimanale serve un segreto `BACKUP_PASSPHRASE` (una frase lunga e casuale, da conservare anche fuori da GitHub: senza di essa il backup non si apre) in GitHub → Settings → Secrets and variables → Actions. Finché manca, «Continuità» fa solo la chiamata giornaliera.

- **Prove rimaste del passo 3 (non bloccanti, da fare al passo 9):** password sbagliata, uscita e rientro, cancellazione dell'account di prova (dettagli nel passo 9).
- **Password minima (consigliato, non bloccante):** dashboard Supabase → Authentication → Sign In / Providers → Email → «Minimum password length» a 8, così il server chiede lo stesso minimo dell'app.
