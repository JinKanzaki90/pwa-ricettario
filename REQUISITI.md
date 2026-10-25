# Requisiti — Ricettario di famiglia (PWA)

Stato: **approvato**, revisione 5 · ultimo aggiornamento 25/10/2026 · resta da definire solo §5.8 (Acquisti consapevoli), da fissare quando si lavora a quei contenuti

Questo documento è il riferimento per lo sviluppo, anche per le attività pianificate: ogni esecuzione lo rilegge prima di lavorare. Le decisioni prese sono marcate **[deciso]**; quelle da confermare con Angelo sono marcate **[da decidere]**.

---

## 1. Obiettivo

Trasformare l'artifact «Ricettario Vegetale» in una PWA installabile da telefono, con dati su Supabase, da condividere con un gruppo ristretto di amici su invito. Il ricettario è comune al gruppo: si vede chi ha inserito ogni ricetta.

**[deciso] Ambito alimentare: niente carne.** Sono ammesse ricette vegane, vegetariane (con uova, latte e derivati) e con pesce. La carne non è ammessa in nessuna forma (vedi §5.1 per l'elenco di cosa conta come carne). Nome dell'app: **«Ricettario di famiglia»** [deciso, provvisorio].

Fuori ambito per ora: app store, APK, notifiche push, funzionamento offline in scrittura.

## 2. Utenti e accesso

**[deciso] Modalità di accesso: «email + password creata dall'amministratore».** Se in prova non funziona bene si passa all'alternativa «email + codice d'invito personale».

| Requisito | Stato |
|---|---|
| Registrazione libera **disattivata** nel progetto Supabase: nessuno può creare un account da solo | [deciso] |
| Angelo crea ogni utente dalla dashboard Supabase (Authentication → Users → Add user) con email e password iniziale, già confermato; nessuna email viene spedita | [deciso] |
| L'elenco utenti di Supabase è l'elenco degli ammessi: non serve una tabella separata | [deciso] |
| Accesso nell'app con email e password; la sessione resta salvata sul dispositivo, quindi l'accesso si fa una volta per dispositivo | [deciso] |
| Più dispositivi per lo stesso utente | [deciso] |
| Al primo accesso l'app chiede il **nome visualizzato** e propone di cambiare la password | [deciso] |
| Password dimenticata: la reimposta Angelo dalla dashboard (non c'è recupero via email) | [deciso] |
| Disattivazione di un amico: Angelo blocca o elimina l'utente dalla dashboard | [deciso] |
| Ogni utente ha un **nome visualizzato**, mostrato come autore di ricette, commenti e settimana | [deciso] |
| Nome predefinito **«Anonimo»** per chi non ha ancora scelto un nome, per gli account cancellati e come autore delle ricette generiche | [deciso] |
| Un utente può chiedere la cancellazione del proprio account | [deciso, requisito GDPR] |

Alternative valutate:
- *Solo email, senza secondo elemento*: chiunque conosca l'email di un amico entra al suo posto e può modificarne o eliminarne i contenuti.
- *Email + codice d'invito personalizzato*: sicurezza simile, ma logica di accesso da scrivere e mantenere. **Piano di riserva.**
- *Codice di 6 cifre via email*: richiede un servizio SMTP esterno; da riconsiderare se il gruppo cresce o serve il recupero password autonomo.

## 3. Cosa è condiviso e cosa è personale

| Contenuto | Visibilità | Stato |
|---|---|---|
| Ricettario | Condiviso con tutti | [deciso] |
| Guida nutrizionale | Condivisa, contenuto statico | [deciso] |
| Stagione (calendario e dispensa) | Condivisa, contenuto statico | [deciso] |
| Commenti alle ricette | Condivisi, con autore e data | [deciso] |
| Lista della spesa | Personale | [deciso] |
| Settimana | Ognuno modifica solo la propria; le settimane degli altri sono visibili **in sola lettura** | [deciso] |
| Archivio | Personale | [deciso] |
| Ricette private (visibili solo all'autore) | Non previste: tutto ciò che si inserisce è condiviso | [deciso] |

## 4. Permessi sulle ricette

| Azione | Ricette «generiche» (le 23 di partenza) | Ricette con autore |
|---|---|---|
| Autore mostrato | «Anonimo» | Nome visualizzato dell'autore |
| Vedere | Tutti | Tutti |
| Archiviare (solo per sé) | Tutti | Tutti |
| Modificare | Tutti | Solo l'autore (gli altri interagiscono con i commenti) |
| Eliminare definitivamente | Tutti | Solo l'autore |
| Commentare | Tutti | Tutti |

Ogni ricetta registra autore, data di creazione, **ultima modifica e chi l'ha fatta**.

**[deciso] Cestino.** Eliminare una ricetta (generica o propria) la sposta in un **cestino condiviso** per 30 giorni; dopo 30 giorni sparisce davvero. Vedi §5.7.

**[deciso] Cancellazione di un account.** Le ricette dell'utente diventano «generiche»: restano nel ricettario, con autore «Anonimo», e chiunque le può modificare ed eliminare. I suoi commenti restano con autore «Anonimo». Settimana, spesa e archivio dell'utente vengono cancellati.

**[deciso] Eliminazione di una ricetta presente nella settimana di qualcuno.** Vale per qualsiasi eliminazione (ricetta generica eliminata da chiunque, ricetta con autore eliminata dall'autore):
- nella settimana di ogni utente che la usa, il pasto compare come «Ricetta eliminata» con la scelta di un sostituto, come oggi nell'artifact; un avanzo segue il sostituto del piatto da cui deriva;
- chi elimina vede prima un avviso con il numero di settimane coinvolte (per esempio «È nella settimana di 2 persone»);
- se la ricetta è nella lista della spesa di qualcuno, esce dalla lista; le voci già spuntate restano spuntate se l'ingrediente serve ad altre ricette;
- se la ricetta viene ripristinata dal cestino, ricompare automaticamente in tutte le settimane dove non è già stata sostituita.

## 5. Funzioni

### 5.1 Ricettario
- Elenco con filtri esistenti: pasto, tempo, di stagione, prodotti calabresi, senza alcol; in più **categoria** (vegana, vegetariana, con pesce), **«Inserite da…»** (filtro per autore) e ricerca per titolo e ingrediente.
- Dettaglio con porzioni regolabili, autore, ultima modifica, commenti e pulsante **«Aggiungi alla settimana»** (scelta di giorno e pasto, eventuale doppia dose).
- Modulo di inserimento e modifica: lo stesso dell'artifact attuale (campi obbligatori, rilevamento alcolici, prodotti calabresi, anteprima del simbolo di stagione), con queste differenze:
  - campo obbligatorio **categoria** [deciso]: vegana, vegetariana, con pesce;
  - **blocco della carne** [deciso]: il salvataggio è rifiutato se un ingrediente è carne (carne di qualsiasi animale, salumi e insaccati, strutto, lardo, brodo o dado di carne, gelatina animale);
  - **coerenza della categoria**: se la categoria è «vegana» ma ci sono uova, latticini, miele o pesce, il modulo lo segnala; idem per «vegetariana» con pesce;
  - nessun divieto su fave, piselli, tartufo [deciso]: diventano esempi della preferenza personale «ingredienti da evitare» (§5.9).
- Icone [deciso]: **Vegana** (foglia), **Di stagione** (piccolo calendario con sole; calcolata dal calendario), Calabria (peperoncino), Con alcol. Anche la scheda Stagione passa all'icona calendario con sole.
- Le 23 ricette di partenza sono tutte vegane e ricevono l'icona Vegana.

### 5.2 Archivio personale
- Ogni utente archivia qualunque ricetta solo per sé; dall'archivio la ripristina.
- Dall'archivio, l'eliminazione definitiva è disponibile solo per le ricette che l'utente può eliminare (vedi §4).
- Se una ricetta presente nella settimana di qualcuno viene eliminata, in quella settimana compare lo spazio vuoto con la scelta del sostituto (comportamento attuale).

### 5.3 Settimana personale
- Ogni utente parte dalla settimana d'esempio e può **scegliere la ricetta di ogni pasto** (oggi si possono solo sostituire i piatti eliminati); può modificare solo la propria settimana.
- Doppie dosi e avanzi come oggi.
- Invio alla spesa del giorno o dell'intera settimana.
- **Settimane del gruppo** [deciso]: ognuno può consultare in sola lettura la settimana degli altri (chi ha scelto cosa, giorno per giorno) e aprirne le ricette; non può modificarla.
- Un singolo pasto non si copia: si apre la ricetta e si usa «Aggiungi alla settimana».
- **Copia di un giorno intero** dalla settimana di un altro nella propria [deciso], con conferma prima di sovrascrivere. Nella copia ogni pasto diventa un piatto normale a dose singola: doppie dosi e avanzi non vengono copiati.

### 5.4 Lista della spesa personale
- Comportamento attuale: ricette in lista con porzioni, somma per ingrediente, raggruppamento per reparto, voci a mano, spunte, prodotti calabresi indicati.
- Sincronizzata tra i dispositivi dell'utente.

### 5.5 Commenti
- Testo semplice, massimo 500 caratteri, con autore e data.
- Ognuno modifica ed elimina i propri commenti.

### 5.6 Guida e Stagione
- **Stagione**: contenuti dell'artifact attuale, invariati.
- **Guida** [deciso, contenuti da definire]: va riscritta per un'alimentazione senza carne (non più solo vegana):
  - rimuovere le indicazioni sull'integrazione per la dieta vegana, tenendo una **nota breve sulla B12** per chi segue un'alimentazione solo vegana [deciso];
  - aggiungere una sezione sul consumo di carne rossa: effetti sulla salute e impatto ambientale, con fonti autorevoli citate;
  - aggiungere una sezione «Acquisti consapevoli» con aziende da evitare, solo con criteri espliciti e una fonte e una data per ogni voce (vedi §5.8).
- Struttura della Guida da progettare per contenuti lunghi: indice in alto con salto alle sezioni, riassunto «in breve» all'inizio di ogni sezione, dettagli a scomparsa, fonti in fondo a ogni sezione.
- Guida e Stagione restano file statici nel frontend: non serve il database.

### 5.7 Cestino
- Elenco delle ricette eliminate negli ultimi 30 giorni, con chi le ha eliminate e quando.
- Chiunque può ripristinare una ricetta generica; una ricetta con autore la ripristina solo l'autore.
- Eliminazione definitiva automatica dopo 30 giorni (operazione programmata nel database).

### 5.8 Acquisti consapevoli [da definire quando si lavora ai contenuti: criteri e fonti]
- Ogni voce: azienda o marchio, motivo, fonte, data della verifica.
- Si riportano solo segnalazioni di enti o campagne riconoscibili, formulate come «segnalata da X per Y», senza giudizi propri.
- Revisione periodica: le voci senza verifica da oltre 12 mesi vengono segnalate come da ricontrollare.

### 5.9 Impostazioni [deciso]
- Raggiungibili dall'icona a ingranaggio in alto a destra, non come sesta scheda (la barra in basso resta a 5 voci).
- Cambio password, cambio nome visualizzato, tema (automatico, chiaro, scuro), uscita dall'account.
- Ingredienti da evitare: elenco personale; le ricette che li contengono sono segnalate e si possono nascondere con un filtro.
- Cancellazione dell'account con doppia conferma; effetti come in §4 (ricette che diventano generiche, commenti firmati «Anonimo», dati personali cancellati). Richiede una funzione lato database che agisce con privilegi elevati: va scritta e verificata con particolare attenzione.
- Collegamento alla pagina privacy.

## 6. Requisiti non funzionali

| Area | Requisito |
|---|---|
| Piattaforma | PWA installabile su Android e iPhone, layout da 360 px in su, tema chiaro e scuro |
| Dati | Supabase, regione UE (progetto `wtwmjwpmovttalkxzhvm`) |
| Sicurezza | Regole di accesso (RLS) su **tutte** le tabelle; nessun permesso al ruolo `anon`; nel frontend solo la chiave publishable |
| Segreti | Mai nel codice né nel repository: solo nei segreti di GitHub e di Supabase |
| Schema | Versionato con migrazioni nel repository, applicate da GitHub Actions; nessuna modifica dalla dashboard |
| Email | Nessuna email inviata dall'app con l'accesso proposto; un servizio SMTP serve solo se in futuro si passa ad accesso con codice o recupero password (vedi §7) |
| Continuità | Workflow GitHub Actions programmato: una chiamata al giorno per evitare la sospensione del piano gratuito e backup settimanale del database |
| Privacy | Pagina breve che spiega quali dati si raccolgono (email, nome visualizzato, contenuti inseriti) e come chiedere la cancellazione |
| Costi | Tutto su piani gratuiti; nessun costo ricorrente previsto |
| Hosting | [deciso] GitHub Pages dal repository pubblico; Cloudflare Pages come piano di riserva |
| Repository pubblico | Codice, requisiti e contenuti statici sono visibili a chiunque; i dati degli utenti stanno solo su Supabase |

## 7. Vincoli emersi

1. **Email.** Il servizio email incluso in Supabase consegna solo agli indirizzi del team del progetto, con un limite indicativo di 2 messaggi l'ora. Con l'accesso proposto (§2) non serve; servirebbe un servizio SMTP esterno (per esempio Brevo o Resend) per inviti via email, codici di accesso o recupero password.
2. **Rete dell'ambiente di sviluppo.** L'ambiente cloud in cui lavora Claude non raggiunge `*.supabase.co`. Migrazioni e controlli sul database passano da GitHub Actions; per i test dell'app collegata al database serve aggiungere il dominio del progetto tra quelli consentiti in claude.ai, altrimenti i test li fa Angelo dal telefono.

## 8. Configurazioni a carico di Angelo

| Cosa | Dove | Entro |
|---|---|---|
| Attivare GitHub Pages con origine «GitHub Actions» | GitHub → repository → Settings → Pages | Passo 1 |
| (Consigliato) dominio `wtwmjwpmovttalkxzhvm.supabase.co` tra quelli consentiti, così Claude prova l'app collegata al database | Impostazioni di claude.ai | Passo 1 |
| Segreti `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` (il codice del progetto non è segreto e sta nel repository) | GitHub → repository → Settings → Secrets and variables → Actions | Passo 2 |
| Disattivare la registrazione libera | Dashboard Supabase → Authentication → Sign In / Providers | Passo 3 |
| Creare il proprio utente (e poi quelli degli amici) con email e password, già confermato | Dashboard Supabase → Authentication → Users → Add user | Passo 3, prima della prova congiunta |
| Indirizzo dell'app come Site URL | Dashboard Supabase → Authentication → URL Configuration | Passo 9 |

## 9. Piano di lavoro proposto (attività pianificate)

1. Struttura del repository: frontend dall'artifact attuale, cartella `supabase/`, workflow di migrazione e di continuità.
2. Schema del database: profili, inviti, ricette, commenti, archivio, settimana, spesa; regole di accesso; caricamento delle 23 ricette generiche.
3. Accesso con email e password, primo accesso con nome visualizzato e cambio password, nome «Anonimo» predefinito, scheda Impostazioni. **Punto di controllo: le attività si fermano qui per una prova congiunta con Angelo e riprendono solo dopo il suo via libera.**
4. Ricettario collegato al database (lettura, inserimento, modifica, categorie, blocco della carne, eliminazione, cestino).
5. Archivio, settimana (con «Aggiungi alla settimana») e spesa personali collegati al database.
6. Commenti, settimane del gruppo in sola lettura, copia di un giorno.
7. Guida riscritta e sezione «Acquisti consapevoli».
8. PWA: manifest, icona, service worker per lettura offline.
9. Pubblicazione, prova completa, pagina privacy.

Ogni passo si chiude con un commit e una nota in `TODO.md`.

### Revisione di fine passo [deciso]
Alla fine di ogni passo, prima del commit, rispondere per iscritto a tre domande e riportare in `TODO.md` le azioni che ne derivano:
1. **Malintenzionato.** Se fossi un malintenzionato, potrei leggere dati altrui, modificarli o sfruttare una vulnerabilità (regole di accesso, funzioni con privilegi elevati, chiavi, input non controllati)?
2. **Utente.** Se fossi un utente, riuscirei a usare bene quello che è stato fatto, anche da telefono, con errori chiari e senza vicoli ciechi?
3. **Revisore esterno.** Se fossi un'altra IA chiamata a criticare il lavoro, quali difetti, semplificazioni e miglioramenti indicherei?
