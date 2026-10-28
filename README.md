# Ricettario di famiglia

PWA per un gruppo di amici: guida alimentare, ricettario condiviso (niente carne), settimana e lista della spesa personali.
Frontend statico in `app/` pubblicato su GitHub Pages (https://jinkanzaki90.github.io/pwa-ricettario/), dati su Supabase (regione UE).

- Requisiti: `REQUISITI.md` · Stato dei lavori: `TODO.md` · Istruzioni per Claude: `CLAUDE.md` · Gestione degli utenti: `AMMINISTRAZIONE.md`
- Workflow: `pubblica.yml` (sito e prova sul sito pubblicato), `prove.yml` (prove del database e dell'app a ogni push), `migrazioni.yml` (schema del database), `continuita.yml` (chiamata giornaliera)
- Prova locale: `python3 -m http.server 8123 --bind 127.0.0.1 -d app`, poi `node test/prova-app.js`
