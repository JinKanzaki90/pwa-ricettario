# Gestione del ricettario — istruzioni per Angelo

Indirizzo dell'app: **https://jinkanzaki90.github.io/pwa-ricettario/**
Dashboard Supabase: https://supabase.com/dashboard/project/wtwmjwpmovttalkxzhvm

Il repository è pubblico: in questo file non vanno mai scritti email, password o nomi degli amici.

## Aggiungere un amico

1. Dashboard Supabase → **Authentication → Users → Add user → Create new user**.
2. Scrivi la sua email e una **password iniziale** di almeno 8 caratteri (meglio 12, per esempio tre parole a caso con un numero).
3. Lascia attiva **«Auto Confirm User»**: l'account è subito pronto e non parte nessuna email.
4. Manda all'amico, per un canale privato (di persona o in un messaggio diretto, non in un gruppo):
   - l'indirizzo dell'app;
   - la sua email di accesso e la password iniziale;
   - il messaggio qui sotto.

> Apri il link dal telefono ed entra con email e password. Al primo accesso ti chiede il nome da mostrare agli altri e ti propone di cambiare la password: cambiala. Per averla come app: su Android, Impostazioni (ingranaggio in alto a destra) → «Installa l'app»; su iPhone, da Safari → Condividi → «Aggiungi alla schermata Home». L'accesso si fa una volta per dispositivo.

Nell'app l'amico compare come «Anonimo» finché non sceglie un nome.

## Password dimenticata

Non c'è recupero via email: le voci della dashboard «Send password recovery» e «Send magic link» mandano un'email e qui non servono.

1. Se nella scheda dell'utente (Authentication → Users → clic sulla riga) c'è un'opzione per impostare la password, usala con una password provvisoria.
2. Altrimenti: dashboard → **SQL Editor** → nuova query, sostituisci email e password e premi Run (cambia solo i dati di quell'utente, non lo schema):
   ```sql
   update auth.users
      set encrypted_password = extensions.crypt('password-provvisoria', extensions.gen_salt('bf'))
    where email = 'email-dell-amico@esempio.it';
   ```
   Deve rispondere «1 row affected». Non salvare la query con la password dentro.
3. Manda la password provvisoria all'amico come sopra: da Impostazioni → Cambia password la sostituisce.

## Bloccare o togliere un amico

- **Bloccare** (reversibile): Users → menu «…» della riga → **Ban user**, scegliendo la durata. Non può più entrare; sui dispositivi dove era già dentro resta attivo al massimo per un'ora (la durata della sessione), poi viene escluso. I suoi contenuti restano. Per riammetterlo: «Unban user».
- **Eliminare** (definitivo): Users → menu «…» → **Delete user**. L'effetto è lo stesso della cancellazione fatta dall'amico in Impostazioni: le sue ricette diventano generiche (autore «Anonimo»), i commenti restano firmati «Anonimo», settimana, spesa, archivio e preferenze vengono cancellati.

Un amico può anche cancellarsi da solo: Impostazioni → «Cancella il mio account…», con la sua password.

## Impostazioni del progetto da controllare una volta

- **Authentication → Sign In / Providers**: «Allow new users to sign up» **spenta** (nessuno si registra da solo); Email → «Minimum password length» **8**.
- **Authentication → URL Configuration → Site URL**: `https://jinkanzaki90.github.io/pwa-ricettario/`.
- **GitHub → Settings → Secrets and variables → Actions**: `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` presenti; `BACKUP_PASSPHRASE` quando vorrai attivare il backup settimanale cifrato (conservala anche fuori da GitHub).

## Se qualcosa non va

- **Il sito non si aggiorna**: GitHub → Actions → «Pubblica l'app» deve essere verde. Sul telefono la nuova versione arriva al successivo avvio con la rete.
- **«Prove» o «Migrazioni del database» in rosso**: qualcosa nell'ultimo cambiamento non va; le attività pianificate lo segnalano in `TODO.md`.
- **Il database non risponde** (accesso impossibile per tutti): il piano gratuito di Supabase sospende i progetti inattivi. Il workflow «Continuità» lo chiama ogni giorno; se è in rosso, dalla dashboard Supabase si riattiva il progetto con «Restore».
- **Un amico vede «Senza connessione»**: l'app mostra i dati salvati sul telefono e blocca le modifiche finché non torna la rete; non serve fare nulla.
