-- Prove delle regole di accesso e dei vincoli, su database locale (vedi prova-db.sh).
-- Utenti: A esisteva prima delle migrazioni, B e C vengono creati dopo.
\set ON_ERROR_STOP 1
\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''

insert into auth.users (id, email) values (:B, 'b@esempio.invalid'), (:C, 'c@esempio.invalid');

-- funzione di appoggio: esegue un comando e controlla che fallisca con il codice atteso
create function pg_temp.deve_fallire(comando text, codice text, cosa text) returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    if sqlstate = codice then return; end if;
    raise exception 'PROVA FALLITA (%): atteso errore %, ottenuto % %', cosa, codice, sqlstate, sqlerrm;
  end;
  raise exception 'PROVA FALLITA (%): il comando doveva fallire con %', cosa, codice;
end $$;
create function pg_temp.verifica(condizione boolean, cosa text) returns void language plpgsql as $$
begin
  if condizione is not true then raise exception 'PROVA FALLITA: %', cosa; end if;
end $$;
create function pg_temp.righe(comando text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute comando;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- struttura
select pg_temp.verifica((select count(*) from public.profili) = 3, 'un profilo per ogni utente, anche per quello creato prima');
select pg_temp.verifica((select bool_and(nome = 'Anonimo' and not nome_scelto and ruolo = 'membro') from public.profili), 'profili predefiniti');
select pg_temp.verifica((select count(*) from public.ricette) = 23, '23 ricette di partenza');
select pg_temp.verifica((select bool_and(autore is null and categoria = 'vegana' and eliminata_il is null) from public.ricette), 'ricette di partenza generiche e vegane');
select pg_temp.verifica(
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'), 'RLS attiva su tutte le tabelle');
select pg_temp.verifica(
  not exists (select 1 from information_schema.role_table_grants where grantee in ('anon', 'PUBLIC') and table_schema = 'public'),
  'nessun permesso ad anon sulle tabelle');
select pg_temp.verifica(
  not exists (select 1 from information_schema.role_column_grants where grantee in ('anon', 'PUBLIC') and table_schema = 'public'),
  'nessun permesso ad anon sulle colonne');
select pg_temp.verifica(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosecdef
                and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  'funzioni security definer non eseguibili da anon e authenticated');
select pg_temp.verifica(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosecdef
                and not coalesce(p.proconfig @> array['search_path=""'], false)),
  'funzioni security definer con search_path vuoto');
select pg_temp.verifica((select count(*) from cron.job where jobname = 'svuota-cestino') = 1, 'svuotamento del cestino programmato');

-- ---------------------------------------------------------------- controllo della carne
select pg_temp.verifica(bool_and(public.nome_e_carne(n)), 'riconosce la carne: ' || string_agg(n, ', ') filter (where not public.nome_e_carne(n)))
from unnest(array['Pancetta affumicata', 'Petto di pollo', 'Carne macinata', 'Brodo di carne', 'Dado di manzo', 'Strutto',
  'Lardo di Colonnata', '''Nduja di Spilinga', 'Würstel', 'Salsiccia calabrese', 'Prosciutto crudo', 'Gelatina animale',
  'Fegatini di pollo', 'Guanciale', 'Salame piccante', 'Brodo di gallina', 'Spezzatino di vitello', 'Ragù di cinghiale',
  'Soppressata', 'Capocollo di Calabria', 'Speck', 'Coniglio', 'Polpette di maiale']) as t(n);
select pg_temp.verifica(not bool_or(public.nome_e_carne(n)), 'non scambia per carne: ' || string_agg(n, ', ') filter (where public.nome_e_carne(n)))
from unnest(array['Seitan al naturale', 'Salsiccia vegetale', 'Carne di soia', 'Brodo vegetale', 'Dado vegetale', 'Würstel vegani',
  'Salame di cioccolato', 'Pecorino', 'Noce moscata', 'Lingue di gatto', 'Ragù di lenticchie', 'Polpette di ceci', 'Tonno al naturale',
  'Acciughe', 'Uova', 'Latte intero', 'Polpo', 'Cavolo cappuccio', 'Cervella di vitello vegana', 'Pollock (merluzzo d''Alaska)', 'Lardellato di zucca']) as t(n);
select pg_temp.verifica(not bool_or(public.ingredienti_senza_carne(ingredienti) is not true), 'nessuna ricetta di partenza bloccata') from public.ricette;

-- ---------------------------------------------------------------- senza accesso (anon)
set role anon;
select pg_temp.deve_fallire('select * from public.' || t, '42501', 'anon legge ' || t)
from unnest(array['profili', 'ricette', 'commenti', 'archivio', 'settimana', 'spesa_ricette', 'spesa_voci', 'spesa_spunte']) as t;
select pg_temp.deve_fallire($$insert into public.commenti (ricetta, testo) values ('hummus-di-ceci', 'x')$$, '42501', 'anon scrive');
reset role;

-- ---------------------------------------------------------------- utente B
set role authenticated;
select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.verifica((select count(*) from public.ricette) = 23, 'B legge le ricette');
select pg_temp.verifica((select count(*) from public.profili) = 3, 'B legge i profili');
select pg_temp.verifica(pg_temp.righe($$update public.profili set nome = 'Bea', nome_scelto = true where id = auth.uid()$$) = 1, 'B cambia il proprio nome');
select pg_temp.verifica(pg_temp.righe($$update public.profili set nome = 'Intruso' where id <> auth.uid()$$) = 0, 'B non cambia il nome degli altri');
select pg_temp.deve_fallire($$update public.profili set ruolo = 'amministratore' where id = auth.uid()$$, '42501', 'B si dà il ruolo di amministratore');
select pg_temp.deve_fallire($$update public.profili set nome = '' where id = auth.uid()$$, '23514', 'nome vuoto');
select pg_temp.deve_fallire($$delete from public.profili where id = auth.uid()$$, '42501', 'B cancella il profilo');

insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi)
values ('Frittata di zucchine', 'cena', 'vegetariana', 'facile', 20, 2, array['estate'],
  '[{"nome":"Uova","qta":4,"unita":"pz","reparto":"frigo"},{"nome":"Zucchine","qta":2,"unita":"pz","reparto":"ortofrutta"}]', array['Sbatti le uova.', 'Cuoci.']);
select pg_temp.verifica((select autore = auth.uid() and modificata_da = auth.uid() from public.ricette where titolo = 'Frittata di zucchine'), 'autore e modifica registrati');
select pg_temp.deve_fallire($$insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi, autore)
  values ('Finta', 'cena', 'vegana', 'facile', 5, 1, array['estate'], '[{"nome":"Sale","qta":null,"unita":"q.b.","reparto":"spezie"}]', array['x'], '00000000-0000-0000-0000-00000000000a')$$,
  '42501', 'B inserisce a nome di A');
select pg_temp.deve_fallire($$insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi, autore)
  values ('Generica finta', 'cena', 'vegana', 'facile', 5, 1, array['estate'], '[{"nome":"Sale","qta":null,"unita":"q.b.","reparto":"spezie"}]', array['x'], null)$$,
  '42501', 'B inserisce una ricetta generica');
select pg_temp.deve_fallire($$insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi)
  values ('Pasta alla carbonara', 'pranzo', 'vegetariana', 'facile', 20, 2, array['inverno'], '[{"nome":"Guanciale","qta":100,"unita":"g","reparto":"frigo"}]', array['x'])$$,
  '23514', 'ricetta con carne rifiutata');
select pg_temp.deve_fallire($$insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi)
  values ('Strana', 'cena', 'vegana', 'facile', 5, 1, array['estate'], '[{"nome":"Sale"}]', array['x'])$$,
  '23514', 'ingrediente incompleto rifiutato');
select pg_temp.deve_fallire($$insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi)
  values ('Strana', 'cena', 'vegana', 'facile', 5, 1, array['estate', 'tutto_anno'], '[{"nome":"Sale","qta":null,"unita":"q.b.","reparto":"spezie"}]', array['x'])$$,
  '23514', 'stagioni incoerenti rifiutate');
select pg_temp.deve_fallire($$insert into public.ricette (id, titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi)
  values ('scelta', 'Strana', 'cena', 'vegana', 'facile', 5, 1, array['estate'], '[{"nome":"Sale","qta":null,"unita":"q.b.","reparto":"spezie"}]', array['x'])$$,
  '42501', 'B sceglie il codice della ricetta');
select pg_temp.deve_fallire($$update public.ricette set autore = auth.uid() where id = 'hummus-di-ceci'$$, '42501', 'B si appropria di una ricetta generica');
select pg_temp.deve_fallire($$update public.ricette set modificata_da = null where id = 'hummus-di-ceci'$$, '42501', 'B falsifica chi ha modificato');
select pg_temp.deve_fallire($$delete from public.ricette where id = 'hummus-di-ceci'$$, '42501', 'B cancella definitivamente');

insert into public.commenti (ricetta, testo) values ('hummus-di-ceci', 'Buonissimo con il limone.');
select pg_temp.deve_fallire(format($$insert into public.commenti (ricetta, testo) values ('hummus-di-ceci', %L)$$, repeat('a', 501)), '23514', 'commento oltre 500 caratteri');
select pg_temp.deve_fallire($$insert into public.commenti (ricetta, testo) values ('hummus-di-ceci', '   ')$$, '23514', 'commento vuoto');
insert into public.settimana (giorno, pasto, ricetta) values ('lun', 'pranzo', 'pasta-lenticchie-rosse'), ('mar', 'cena', 'hummus-di-ceci');
insert into public.settimana (giorno, pasto, ricetta, avanzo_di) values ('mer', 'pranzo', 'hummus-di-ceci', 'mar');
select pg_temp.deve_fallire($$insert into public.settimana (giorno, pasto, ricetta, avanzo_di) values ('gio', 'pranzo', 'hummus-di-ceci', 'gio')$$, '23514', 'avanzo dallo stesso giorno');
insert into public.spesa_ricette (ricetta, porzioni) values ('hummus-di-ceci', 4), ('pasta-lenticchie-rosse', 2);
insert into public.spesa_voci (nome) values ('Carta da forno');
insert into public.spesa_spunte (chiave) values ('ceci|g');
insert into public.archivio (ricetta) values ('ceci-croccanti-paprika');
reset role;

-- ---------------------------------------------------------------- utente C
set role authenticated;
select set_config('request.jwt.claim.sub', :C, false);
select pg_temp.verifica((select count(*) from public.settimana) = 3, 'C vede la settimana di B');
select pg_temp.verifica((select count(*) from public.spesa_ricette) + (select count(*) from public.spesa_voci) + (select count(*) from public.spesa_spunte) = 0, 'C non vede la spesa di B');
select pg_temp.verifica((select count(*) from public.archivio) = 0, 'C non vede l''archivio di B');
select pg_temp.verifica((select count(*) from public.commenti) = 1, 'C legge i commenti');
select pg_temp.verifica(pg_temp.righe($$update public.settimana set ricetta = 'ceci-croccanti-paprika'$$) = 0, 'C non modifica la settimana di B');
select pg_temp.verifica(pg_temp.righe($$delete from public.settimana$$) = 0, 'C non cancella la settimana di B');
select pg_temp.deve_fallire($$insert into public.settimana (utente, giorno, pasto, ricetta) values ('00000000-0000-0000-0000-00000000000b', 'dom', 'cena', 'hummus-di-ceci')$$, '42501', 'C scrive nella settimana di B');
select pg_temp.verifica(pg_temp.righe($$update public.commenti set testo = 'cambiato'$$) = 0, 'C non modifica il commento di B');
select pg_temp.verifica(pg_temp.righe($$delete from public.commenti$$) = 0, 'C non cancella il commento di B');
select pg_temp.deve_fallire($$insert into public.commenti (ricetta, testo, autore) values ('hummus-di-ceci', 'firmato B', '00000000-0000-0000-0000-00000000000b')$$, '42501', 'C commenta a nome di B');
select pg_temp.verifica(pg_temp.righe($$update public.ricette set titolo = 'Frittata rovinata' where titolo = 'Frittata di zucchine'$$) = 0, 'C non modifica la ricetta di B');
select pg_temp.verifica(pg_temp.righe($$update public.ricette set eliminata_il = now() where titolo = 'Frittata di zucchine'$$) = 0, 'C non elimina la ricetta di B');
select pg_temp.verifica(pg_temp.righe($$update public.ricette set titolo = 'Hummus di ceci al limone' where id = 'hummus-di-ceci'$$) = 1, 'C modifica una ricetta generica');
select pg_temp.verifica((select modificata_da = auth.uid() and modificata_il > creata_il from public.ricette where id = 'hummus-di-ceci'), 'ultima modifica registrata a nome di C');
select pg_temp.verifica(pg_temp.righe($$update public.ricette set eliminata_il = '2000-01-01' where id = 'hummus-di-ceci'$$) = 1, 'C sposta nel cestino una ricetta generica');
select pg_temp.verifica((select eliminata_da = auth.uid() and eliminata_il > now() - interval '1 minute' from public.ricette where id = 'hummus-di-ceci'), 'cestino: data reale e autore registrati');
reset role;
select pg_temp.verifica(not exists (select 1 from public.spesa_ricette where ricetta = 'hummus-di-ceci'), 'la ricetta eliminata esce dalla spesa di B');
select pg_temp.verifica(exists (select 1 from public.spesa_ricette where ricetta = 'pasta-lenticchie-rosse'), 'il resto della spesa di B resta');
select pg_temp.verifica((select count(*) from public.settimana where ricetta = 'hummus-di-ceci') = 2, 'nella settimana di B la ricetta resta (mostrata come eliminata)');

set role authenticated;
select set_config('request.jwt.claim.sub', :B, false);
select pg_temp.verifica(pg_temp.righe($$update public.ricette set eliminata_il = null where id = 'hummus-di-ceci'$$) = 1, 'B ripristina una ricetta generica');
select pg_temp.verifica((select eliminata_il is null and eliminata_da is null and modificata_da = '00000000-0000-0000-0000-00000000000c' from public.ricette where id = 'hummus-di-ceci'),
  'ripristino: il cestino non conta come modifica');
select pg_temp.verifica(pg_temp.righe($$update public.ricette set eliminata_il = now() where titolo = 'Frittata di zucchine'$$) = 1, 'B elimina la propria ricetta');
reset role;

-- ---------------------------------------------------------------- svuotamento del cestino
set session_replication_role = replica;  -- solo per la prova: retrodata l'eliminazione senza trigger
update public.ricette set eliminata_il = now() - interval '31 days' where titolo = 'Frittata di zucchine';
update public.ricette set eliminata_il = now() - interval '29 days' where id = 'besciamella-vegetale';
set session_replication_role = origin;
select pg_temp.verifica(public.svuota_cestino() = 1, 'svuotamento: cancellata solo la ricetta oltre i 30 giorni');
select pg_temp.verifica(exists (select 1 from public.ricette where id = 'besciamella-vegetale'), 'la ricetta nel cestino da 29 giorni resta');

-- ---------------------------------------------------------------- cancellazione di un account
insert into public.ricette (titolo, pasto, categoria, difficolta, tempo_min, porzioni_base, stagioni, ingredienti, passi, autore)
values ('Spaghetti alle vongole', 'pranzo', 'pesce', 'media', 30, 2, array['tutto_anno'],
  '[{"nome":"Vongole","qta":500,"unita":"g","reparto":"pesce"}]', array['Apri le vongole.'], :B);
delete from auth.users where id = :B;
select pg_temp.verifica((select autore is null from public.ricette where titolo = 'Spaghetti alle vongole'), 'account cancellato: la ricetta diventa generica');
select pg_temp.verifica((select count(*) = 1 and bool_and(autore is null) from public.commenti), 'account cancellato: il commento resta firmato «Anonimo»');
select pg_temp.verifica(not exists (select 1 from public.settimana) and not exists (select 1 from public.spesa_ricette)
  and not exists (select 1 from public.spesa_voci) and not exists (select 1 from public.spesa_spunte) and not exists (select 1 from public.archivio),
  'account cancellato: settimana, spesa e archivio cancellati');

\echo 'Tutte le prove sono andate a buon fine.'
