-- Imitazione minima di Supabase per provare le migrazioni su un PostgreSQL locale.
-- Ruoli anon e authenticated, schema auth con users e uid(), permessi predefiniti larghi
-- come in un progetto Supabase nuovo (così si verifica che le migrazioni li restringano).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- pg_cron finto: registra soltanto le operazioni
create schema cron;
create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
-- un utente creato prima delle migrazioni, per provare la creazione dei profili mancanti
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@esempio.invalid');
