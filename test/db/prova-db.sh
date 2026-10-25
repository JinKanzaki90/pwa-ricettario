#!/bin/sh
# Applica le migrazioni a un PostgreSQL locale vuoto con l'imitazione di Supabase e lancia le prove.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres sh test/db/prova-db.sh
set -eu
cd "$(dirname "$0")/../.."
psql -q -v ON_ERROR_STOP=1 -d postgres -c 'drop database if exists prova_ricettario' -c 'create database prova_ricettario'
P="psql -q -v ON_ERROR_STOP=1 -d prova_ricettario"
$P -f test/db/supabase-finto.sql
for f in supabase/migrations/*.sql; do
  echo "migrazione: $f"
  # pg_cron non c'è in locale: lo sostituisce lo schema cron finto
  sed '/create extension if not exists pg_cron/d' "$f" | $P --single-transaction
done
$P -f test/db/prove.sql
echo "Prove del database superate."
