#!/bin/sh
# Controlla che con la sola chiave publishable (ruolo anon, nessun accesso) nessuna tabella sia
# leggibile né scrivibile. Usato dal workflow delle migrazioni; si può lanciare anche a mano.
set -u
URL="${SUPABASE_URL:-https://wtwmjwpmovttalkxzhvm.supabase.co}"
CHIAVE="${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_i-yE0f6HfcZhjn3wUAf1rQ_GFJkaqCe}"
errori=0
RISPOSTA=$(mktemp)
for t in profili ricette commenti archivio settimana spesa_ricette spesa_voci spesa_spunte preferenze; do
  codice=$(curl -sS -o "$RISPOSTA" -w '%{http_code}' -H "apikey: $CHIAVE" "$URL/rest/v1/$t?select=*&limit=1")
  case "$codice" in
    401|403) echo "ok: $t non leggibile senza accesso ($codice)";;
    *) echo "::error::La tabella $t risponde $codice senza accesso: $(head -c 200 "$RISPOSTA")"; errori=1;;
  esac
  codice=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "apikey: $CHIAVE" -H 'Content-Type: application/json' -d '{}' "$URL/rest/v1/$t")
  case "$codice" in
    401|403) echo "ok: $t non scrivibile senza accesso ($codice)";;
    *) echo "::error::La tabella $t accetta scritture senza accesso ($codice)"; errori=1;;
  esac
done
# funzioni richiamabili dall'app: senza accesso devono essere rifiutate
for f in cancella_account; do
  codice=$(curl -sS -o "$RISPOSTA" -w '%{http_code}' -X POST -H "apikey: $CHIAVE" -H 'Content-Type: application/json' -d '{}' "$URL/rest/v1/rpc/$f")
  case "$codice" in
    401|403) echo "ok: funzione $f non richiamabile senza accesso ($codice)";;
    *) echo "::error::La funzione $f risponde $codice senza accesso: $(head -c 200 "$RISPOSTA")"; errori=1;;
  esac
done
exit $errori
