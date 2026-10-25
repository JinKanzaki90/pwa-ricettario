# Requisiti — Ricettario Vegetale (PWA)

Stato: **bozza da approvare**, revisione 2 · ultimo aggiornamento 25/10/2026

Questo documento è il riferimento per lo sviluppo, anche per le attività pianificate: ogni esecuzione lo rilegge prima di lavorare. Le decisioni prese sono marcate **[deciso]**; quelle da confermare con Angelo sono marcate **[da decidere]**.

---

## 1. Obiettivo

Trasformare l'artifact «Ricettario Vegetale» in una PWA installabile da telefono, con dati su Supabase, da condividere con un gruppo ristretto di amici su invito. Il ricettario è comune al gruppo: si vede chi ha inserito ogni ricetta.

Fuori ambito per ora: app store, APK, notifiche push, funzionamento offline in scrittura.

## 2. Utenti e accesso

**[da decidere] Modalità di accesso: proposta «email + password creata dall'amministratore».**

| Requisito | Stato |
|---|---|
| Registrazione libera **disattivata** nel progetto Supabase: nessuno può creare un account da solo | proposta |
| Angelo crea ogni utente dalla dashboard Supabase (Authentication → Users → Add user) con email e password iniziale, già confermato; nessuna email viene spedita | proposta |
| L'elenco utenti di Supabase è l'elenco degli ammessi: non serve una tabella separata | proposta |
| Accesso nell'app con email e password; la sessione resta salvata sul dispositivo, quindi l'accesso si fa una volta per dispositivo | proposta |
| Più dispositivi per lo stesso utente | proposta |
| Al primo accesso l'app chiede il **nome visualizzato** e propone di cambiare la password | proposta |
| Password dimenticata: la reimposta Angelo dalla dashboard (non c'è recupero via email) | proposta |
| Disattivazione di un amico: Angelo blocca o elimina l'utente dalla dashboard | proposta |
| Ogni utente ha un **nome visualizzato**, mostrato come autore di ricette, commenti e settimana | [deciso] |
| Un utente può chiedere la cancellazione del proprio account | [deciso, requisito GDPR] |

Alternative valutate e scartate (salvo diversa decisione):
- *Solo email, senza secondo elemento*: chiunque conosca l'email di un amico entra al suo posto e può modificarne o eliminarne i contenuti.
- *Email + codice d'invito personalizzato*: sicurezza simile, ma logica di accesso da scrivere e mantenere.
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
| Ricette private (visibili solo all'autore) | — | [da decidere: servono o tutto è condiviso?] |

## 4. Permessi sulle ricette

| Azione | Ricette «generiche» (le 23 di partenza) | Ricette con autore |
|---|---|---|
| Vedere | Tutti | Tutti |
| Archiviare (solo per sé) | Tutti | Tutti |
| Modificare | Tutti | Solo l'autore [da confermare] |
| Eliminare definitivamente | Tutti | Solo l'autore |
| Commentare | Tutti | Tutti |

Ogni ricetta registra autore, data di creazione, **ultima modifica e chi l'ha fatta**.

**[da decidere] Protezione delle ricette generiche.** Chiunque può eliminarle: un errore cancella la ricetta per tutto il gruppo. Proposta: l'eliminazione sposta la ricetta in un **cestino condiviso** per 30 giorni, da cui chiunque può ripristinarla; dopo 30 giorni sparisce davvero.

**[da decidere] Cancellazione di un account.** Proposta: le ricette dell'utente cancellato diventano «generiche» (restano nel ricettario e chiunque le può gestire); i suoi commenti restano con autore «utente rimosso».

## 5. Funzioni

### 5.1 Ricettario
- Elenco con filtri esistenti: pasto, tempo, di stagione, prodotti calabresi, senza alcol; in più **«Inserite da…»** (filtro per autore) e ricerca per titolo e ingrediente.
- Dettaglio con porzioni regolabili, autore, ultima modifica, commenti.
- Modulo di inserimento e modifica: lo stesso dell'artifact attuale (campi obbligatori, controllo vegano ed esclusioni fave, piselli, tartufo, rilevamento alcolici, prodotti calabresi, anteprima del simbolo di stagione).
- Icone: Di stagione (calcolata dal calendario), Calabria (peperoncino), Con alcol.

### 5.2 Archivio personale
- Ogni utente archivia qualunque ricetta solo per sé; dall'archivio la ripristina.
- Dall'archivio, l'eliminazione definitiva è disponibile solo per le ricette che l'utente può eliminare (vedi §4).
- Se una ricetta presente nella settimana di qualcuno viene eliminata, in quella settimana compare lo spazio vuoto con la scelta del sostituto (comportamento attuale).

### 5.3 Settimana personale
- Ogni utente parte dalla settimana d'esempio e può **scegliere la ricetta di ogni pasto** (oggi si possono solo sostituire i piatti eliminati).
- Doppie dosi e avanzi come oggi.
- Invio alla spesa del giorno o dell'intera settimana.
- **Settimane del gruppo**: ognuno può consultare in sola lettura la settimana degli altri (chi ha scelto cosa, giorno per giorno) e aprirne le ricette; non può modificarla. Facoltativo: copiare un pasto o un giorno nella propria settimana [da decidere].

### 5.4 Lista della spesa personale
- Comportamento attuale: ricette in lista con porzioni, somma per ingrediente, raggruppamento per reparto, voci a mano, spunte, prodotti calabresi indicati.
- Sincronizzata tra i dispositivi dell'utente.

### 5.5 Commenti
- Testo semplice, massimo 1.000 caratteri, con autore e data.
- Ognuno modifica ed elimina i propri commenti.

### 5.6 Guida e Stagione
- Contenuti dell'artifact attuale, invariati. Restano file statici nel frontend: non serve il database.

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
| Hosting | Repository privato → Cloudflare Pages [da decidere: Cloudflare Pages o repository pubblico con GitHub Pages] |

## 7. Vincoli emersi

1. **Email.** Il servizio email incluso in Supabase consegna solo agli indirizzi del team del progetto, con un limite indicativo di 2 messaggi l'ora. Con l'accesso proposto (§2) non serve; servirebbe un servizio SMTP esterno (per esempio Brevo o Resend) per inviti via email, codici di accesso o recupero password.
2. **Rete dell'ambiente di sviluppo.** L'ambiente cloud in cui lavora Claude non raggiunge `*.supabase.co`. Migrazioni e controlli sul database passano da GitHub Actions; per i test dell'app collegata al database serve aggiungere il dominio del progetto tra quelli consentiti in claude.ai, altrimenti i test li fa Angelo dal telefono.

## 8. Configurazioni a carico di Angelo

| Cosa | Dove | Quando |
|---|---|---|
| Segreti `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | GitHub → repository → Settings → Secrets and variables → Actions | Prima della prima migrazione |
| Disattivare la registrazione libera (Authentication → Sign In / Providers) | Dashboard Supabase | Prima di pubblicare l'app |
| Creare gli utenti degli amici con email e password | Dashboard Supabase → Authentication → Users | Prima di invitarli |
| Account Cloudflare collegato al repository | Cloudflare Pages | Prima della prima pubblicazione |
| URL dell'app tra gli indirizzi consentiti per l'accesso | Supabase → Authentication → URL Configuration | Dopo la prima pubblicazione |
| (Facoltativo) dominio `wtwmjwpmovttalkxzhvm.supabase.co` consentito | Impostazioni di claude.ai | Per i test da parte di Claude |

## 9. Piano di lavoro proposto (attività pianificate)

1. Struttura del repository: frontend dall'artifact attuale, cartella `supabase/`, workflow di migrazione e di continuità.
2. Schema del database: profili, inviti, ricette, commenti, archivio, settimana, spesa; regole di accesso; caricamento delle 23 ricette generiche.
3. Accesso con email e password, primo accesso con nome visualizzato e cambio password.
4. Ricettario collegato al database (lettura, inserimento, modifica, eliminazione, cestino).
5. Archivio, settimana e spesa personali collegati al database.
6. Commenti e settimane del gruppo in sola lettura.
7. PWA: manifest, icona, service worker per lettura offline.
8. Pubblicazione, prova completa, pagina privacy.

Ogni passo si chiude con un commit e una nota in `TODO.md`.
