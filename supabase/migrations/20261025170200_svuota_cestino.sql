-- Svuotamento automatico del cestino (REQUISITI.md §5.7): ogni notte il database cancella davvero
-- le ricette rimaste nel cestino per più di 30 giorni. Con la cancellazione spariscono anche
-- commenti, archiviazioni e righe della spesa di quella ricetta; nelle settimane il pasto resta
-- vuoto («Ricetta eliminata») in attesa di un sostituto.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create function public.svuota_cestino()
returns integer
language sql
set search_path = ''
as $$
  with via as (
    delete from public.ricette
    where eliminata_il is not null and eliminata_il < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from via
$$;
revoke execute on function public.svuota_cestino() from public, anon, authenticated;

-- cron.schedule con lo stesso nome sostituisce l'operazione esistente: rieseguibile senza doppioni.
select cron.schedule('svuota-cestino', '23 3 * * *', 'select public.svuota_cestino()');
