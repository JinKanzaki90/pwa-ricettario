# TODO — Ricettario di famiglia

Stati: `[ ]` da fare · `[~]` in corso (con data e ora d'inizio) · `[x]` fatto (con data) · `[!]` in attesa di Angelo

Regola per le attività pianificate: si lavora **sul primo passo non completato**, un sotto-punto dopo l'altro. Se un passo non si chiude in un'esecuzione, si salva il lavoro con un commit, si segnano qui i sotto-punti fatti e si riprende alla prossima.

## Stato generale

- Requisiti approvati: revisione 5 (`REQUISITI.md`).
- Configurazioni di Angelo verificate il 25/10/2026: GitHub Pages attivo (origine GitHub Actions), segreti `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` validi, registrazione libera disattivata, dominio Supabase raggiungibile dalla sessione.
- Da verificare nella prova congiunta: utente di Angelo creato, Site URL impostato.

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

### [~] 2. Schema del database (iniziato il 25/10/2026 alle 16:58 UTC)
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

### Passo 1 (25/10/2026)
1. **Malintenzionato.** Nel repository c'è solo la chiave publishable, pubblica per costruzione; i segreti entrano nei workflow solo come variabili d'ambiente (GitHub li maschera nei log) e i workflow partono solo da push su `main` o a mano, mai da richieste di modifica esterne, quindi un fork non li vede. Rischio trovato: l'azione esterna `supabase/setup-cli`, che vede i segreti, era indicata con un'etichetta mobile (`@v1`). **Corretto subito**: fissata al commit della v1.7.3. L'app per ora salva solo sul browser; tutto il testo inserito passa da `esc()` prima di finire nell'HTML.
   - Azione (passo 4): quando i testi arriveranno dal database di altri utenti, ricontrollare che ogni valore mostrato passi da `esc()` (anche negli attributi) e valutare una Content Security Policy in `index.html`.
   - Azione (passo 2): la CLI Supabase è fissata a 2.120.0; aggiornarla di proposito, non in automatico.
2. **Utente.** L'app si comporta come l'artifact, da telefono e da computer, nei due temi. Corretto durante il passo un difetto vero: senza la regola `[hidden]` tutte le schede comparivano una sotto l'altra (nell'artifact la nascondeva la pagina ospite). Restano i testi «vegani» (Guida, conferma «la ricetta è vegana», esclusione di fave/piselli/tartufo): cambiano ai passi 4 e 7 come da requisiti.
   - Azione (passo 8): senza rete l'app non si apre ancora; arriva con il service worker.
3. **Revisore esterno.** Il codice è diviso in moduli ma resta molto simile all'originale: HTML costruito a stringhe, stato condiviso in un unico oggetto `S`, dipendenze circolari tra moduli (funzionano perché nessun modulo chiama gli altri durante il caricamento). Accettabile adesso, perché ricette, settimana e spesa verranno riscritte sul database ai passi 4 e 5.
   - Azione (passi 4–5): sostituire `S.usr`/`S.shop` con un modulo dati che parla con Supabase e togliere le dipendenze circolari; aggiornare `test/prova-app.js` a ogni passo.
   - Azione: il pacchetto supabase-js pesa circa 220 KB; caricarlo solo quando serve (dopo la schermata di accesso) e includerlo nel service worker al passo 8.

## Richieste per Angelo

- **Backup cifrato (passo 1, non bloccante):** per attivare il backup settimanale serve un segreto `BACKUP_PASSPHRASE` (una frase lunga e casuale, da conservare anche fuori da GitHub: senza di essa il backup non si apre) in GitHub → Settings → Secrets and variables → Actions. Finché manca, «Continuità» fa solo la chiamata giornaliera.
