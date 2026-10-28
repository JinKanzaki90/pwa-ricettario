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

### [x] 5. Settimana e spesa personali (fatto il 28/10/2026)
Settimana dal database con «Aggiungi alla settimana» dal dettaglio ricetta, sostituti per ricette eliminate, spesa sincronizzata.
- [x] Migrazione `20261028110000_settimana_avviata.sql`: colonna `profili.settimana_avviata` (la settimana d'esempio si copia una sola volta), modificabile solo sul proprio profilo; prove locali su settimana e spesa ampliate.
- [x] Modulo dati: settimana e spesa lette e scritte da `dati.js`; `personali.js` legge, copia la settimana d'esempio al primo accesso, porta sul database i dati delle versioni precedenti (spesa e sostituti salvati sul browser) e poi li toglie; scritture in fila, con messaggio e rilettura se una fallisce; rilettura tornando su Settimana o Spesa dopo 30 secondi o riaprendo l'app.
- [x] Settimana: «Cambia» e «Togli» per ogni pasto (scelta della ricetta, doppia dose), pasti vuoti con «Scegli»; gli avanzi seguono il piatto da cui derivano; «Ricetta eliminata» con sostituto (la ricetta ripristinata dal cestino ricompare da sola); «Riparti dal piano d'esempio» con conferma; avviso che gli altri vedono la settimana, note comprese.
- [x] «Aggiungi alla settimana» nel dettaglio della ricetta: giorno, pasto, doppia dose, conferma se il pasto è occupato, «Già nella tua settimana: …».
- [x] Spesa sincronizzata (ricette con porzioni, voci a mano anche dalla dispensa, spunte); una ricetta nel cestino esce dalla spesa (lo fa il database). Corretto un difetto: le voci con reparto sconosciuto (per esempio «altro», il predefinito del database) non comparivano: ora vanno in Dispensa.
- [x] Uscita: settimana e spesa tolte dalla memoria; eventuali dati delle versioni precedenti tolti dal browser.
- [x] Verifica: migrazione verde; con la sola chiave publishable `profili`, `settimana` e le tre tabelle della spesa rispondono 401 sul progetto vero; prove locali del database superate; `test/prova-app.js` superato a 360 px e desktop, chiaro e scuro, console pulita (copia della settimana d'esempio, passaggio dei dati del browser, aggiungi alla settimana con conferma, cambia/togli/scegli, avanzo che segue il piatto, sostituto di una ricetta nel cestino, spunte e voci sincronizzate, scrittura fallita); Pubblica verde.
- [x] Revisione di fine passo.

### [x] 6. Commenti, settimane del gruppo, copia di un giorno (fatto il 28/10/2026)
- [x] Commenti nel dettaglio della ricetta (§5.5): elenco con autore, data e «modificato»; nuovo commento (testo semplice, massimo 500 caratteri, contatore); modifica ed eliminazione (con conferma) solo dei propri; errori del database in italiano. Lo schema e le policy ci sono già dal passo 2: nessuna migrazione.
- [x] Settimane del gruppo (§5.3): nella scheda Settimana la scelta «La mia / di …» (solo chi ha una settimana); la settimana dell'altro in sola lettura, con le ricette apribili (e il ritorno a quella settimana), i piatti eliminati indicati senza sostituto.
- [x] Copia di un giorno intero dalla settimana di un altro nella propria, con conferma se il proprio giorno ha già dei pasti: ogni pasto diventa un piatto normale a dose singola (niente doppie dosi, avanzi, note); i piatti eliminati non si copiano; gli avanzi della propria settimana che venivano dal giorno sostituito diventano piatti normali.
- [x] Prove: `test/prova-app.js` con commenti e settimana di un'altra persona imitati.
- [x] Verifica: nessuna migrazione nuova (schema e policy dal passo 2); con la sola chiave publishable `commenti` e `settimana` (e tutte le altre tabelle e funzioni) rispondono 401 sul progetto vero; `test/prova-app.js` superato a 360 px e desktop, chiaro e scuro, console pulita (commento altrui non modificabile e mostrato come testo, pubblica/modifica/elimina il proprio, contatore, testo vuoto rifiutato; settimana di Marta in sola lettura con avanzo, doppia dose, nota e piatto eliminato; copia di un giorno con conferma, dose singola, piatto eliminato escluso, avanzo proprio che diventa piatto normale; ritorno dalla ricetta alla settimana dell'altro); Pubblica verde.
- [x] Revisione di fine passo.

### [~] 7. Guida riscritta e «Acquisti consapevoli» (iniziato il 28/10/2026 alle 15:00 UTC)
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

### Passo 5 (28/10/2026)
1. **Malintenzionato.** Settimana e spesa passano solo per le tabelle con RLS già provate al passo 2: ogni lettura e scrittura dell'app filtra anche per `utente`, ma è il database a impedire di toccare i dati altrui (prove locali ampliate: C non cambia porzioni né spunte di B, B non sposta la propria settimana a C, non cambia la ricetta di una riga di spesa). La nuova colonna `settimana_avviata` si cambia solo sul proprio profilo e non rivela nulla. Nessuna funzione con privilegi elevati nuova. I dati portati dal browser passano dagli stessi vincoli del database; ogni testo mostrato (titoli, note, voci) passa da `esc()`. Nessun problema grave trovato. Da sapere:
   - le **note dei pasti** sono leggibili da tutti gli utenti (come deciso in §3): l'app lo dice sotto la settimana. Oggi le note vengono solo dal piano d'esempio; se al passo 6 si permette di scriverle, ripeterlo vicino al campo.
2. **Utente.** Settimana e spesa si usano da telefono e da computer nei due temi; le modifiche si vedono subito e arrivano sugli altri dispositivi. Limiti e azioni:
   - senza rete le scritture falliscono con un messaggio e lo schermo può mostrare per un po' una modifica non salvata (alla rilettura successiva torna giusto). Azione (passo 8): con il service worker, avviso chiaro «sei senza rete: le modifiche non si salvano» e pulsanti disattivati;
   - «Metti tutta la settimana nella spesa» manda una richiesta per ricetta (circa 20, in fila): un paio di secondi con rete lenta. Azione (passo 9, se dà fastidio): una sola richiesta;
   - gli avanzi si creano solo copiando il piano d'esempio: non c'è un comando «questo pasto è l'avanzo di…». Azione (passo 6 o 9, da proporre ad Angelo);
   - il numero di persone resta per dispositivo (come prima);
   - il piano d'esempio parla ancora di B12 e alimentazione vegana: azione (passo 7) adeguarlo insieme alla Guida.
3. **Revisore esterno.**
   - Prove con Supabase imitato e PostgreSQL locale, non sul progetto vero con un account reale. Azione (passo 9, prova con Angelo): aggiungere un pasto, cambiare una cena con avanzo, spuntare la spesa dal telefono e controllarla dal computer;
   - l'avanzo si riconosce dalla ricetta uguale nel giorno indicato: se in quel giorno la stessa ricetta compare due volte la scelta è ambigua (innocuo: entrambe uguali). Uno schema con riferimento al pasto d'origine sarebbe più solido, ma non vale una migrazione adesso;
   - `pruneSpunte` toglie dal database le spunte di voci non più in lista calcolandole sullo schermo: se le ricette fossero lette solo in parte potrebbe togliere spunte valide (perdita minima: una spunta). Accettato;
   - le dipendenze circolari restano (`settimana` ↔ `ricette`, `spesa` → `personali` → `dati`), ma l'accesso ai dati di settimana e spesa ora sta tutto in `dati.js` come previsto al passo 4.

### Passo 6 (28/10/2026)
1. **Malintenzionato.** Nessuna migrazione e nessuna funzione nuova: commenti e settimane passano dalle policy del passo 2 (tutti leggono; ognuno scrive, modifica ed elimina solo i propri commenti e la propria settimana, provato in locale: C non modifica né cancella il commento di B, non commenta a nome di B, non scrive nella settimana di B). L'app filtra anche per autore nelle modifiche, ma la regola vera è nel database. Il testo dei commenti è mostrato solo tramite `esc()` (provato con `<b>` nel testo: compare come testo); la CSP del passo 4 resta. Nessun problema grave trovato. Da sapere:
   - nessun limite al numero di commenti per persona (accettato per un gruppo su invito, come per le ricette);
   - la vista del gruppo scarica le settimane di tutti, note comprese: è la regola di §3, ricordata sotto la propria settimana.
2. **Utente.** Commenti e settimane del gruppo si usano da telefono e da computer nei due temi; la copia chiede conferma se il proprio giorno ha già dei pasti e avvisa dei piatti eliminati non copiati. Limiti e azioni:
   - la copia di un giorno non ha «Annulla» (si rimedia a mano o con «Riparti dal piano d'esempio»). Azione (passo 9, se serve): conservare il giorno sostituito per un annullamento;
   - i commenti nuovi degli altri compaiono riaprendo la ricetta dopo 30 secondi; le settimane degli altri tornando sulla scheda dopo 30 secondi o cambiando persona;
   - a 360 px la scelta «Settimana da vedere» aggiunge un riquadro sopra la settimana. Azione (passo 9): valutare con Angelo se spostarla in una riga più compatta;
   - restano dal passo 5: le note dei pasti non si scrivono dall'app e non c'è il comando «questo pasto è l'avanzo di…». Azione (passo 9): proporli ad Angelo.
3. **Revisore esterno.**
   - Prove con Supabase imitato; le policy di commenti e settimane sono provate su PostgreSQL locale, non sul progetto vero con account reali. Azione (passo 9, prova con Angelo): da due account, commentare la stessa ricetta e controllare che l'altro non possa modificare il commento; vedere la settimana dell'altro e copiarne un giorno;
   - la copia di un giorno sono fino a otto scritture in fila, non un'unica operazione: se una fallisce l'app lo dice e rilegge, e il giorno può restare copiato a metà (si rifà la copia). Accettato: una funzione nel database costerebbe di più del rischio;
   - i nomi delle persone arrivano con le ricette; ora la lettura delle settimane del gruppo li aggiorna, così chi è entrato da poco non compare come «Anonimo»;
   - `commenti.js` tiene in memoria solo i commenti della ricetta aperta e li toglie all'uscita (evento `rv-fuori`), senza nuove dipendenze circolari con `accesso.js`.

## Richieste per Angelo

- **Backup cifrato (passo 1, non bloccante):** per attivare il backup settimanale serve un segreto `BACKUP_PASSPHRASE` (una frase lunga e casuale, da conservare anche fuori da GitHub: senza di essa il backup non si apre) in GitHub → Settings → Secrets and variables → Actions. Finché manca, «Continuità» fa solo la chiamata giornaliera.

- **Prove rimaste del passo 3 (non bloccanti, da fare al passo 9):** password sbagliata, uscita e rientro, cancellazione dell'account di prova (dettagli nel passo 9).
- **Password minima (consigliato, non bloccante):** dashboard Supabase → Authentication → Sign In / Providers → Email → «Minimum password length» a 8, così il server chiede lo stesso minimo dell'app.
