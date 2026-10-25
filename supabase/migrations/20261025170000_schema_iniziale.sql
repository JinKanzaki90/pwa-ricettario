-- Schema iniziale del Ricettario di famiglia (passo 2).
-- Regole: RLS su ogni tabella, nessun permesso ad anon, policy con (select auth.uid()),
-- permessi di scrittura concessi colonna per colonna, così i campi gestiti dal database
-- (autore, date, chi ha modificato o eliminato) non si possono falsificare dall'app.

-- ---------------------------------------------------------------------------
-- Permessi predefiniti: nessun oggetto nuovo dello schema public è aperto ad anon
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni di controllo (pure, usate nei vincoli)
-- ---------------------------------------------------------------------------

-- Testo normalizzato per i controlli: minuscole, senza accenti comuni, apostrofi come spazi.
create function public.testo_semplice(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(t, '')), 'àáâäèéêëìíîïòóôöùúûüç''’`', 'aaaaeeeeiiiioooouuuuc   ')
$$;

-- Vero se il nome di un ingrediente indica carne (REQUISITI.md §5.1): carne di qualsiasi animale,
-- salumi e insaccati, strutto, lardo, brodo o dado di carne, gelatina animale.
-- Le versioni vegetali dichiarate («salsiccia vegetale», «carne di soia», «würstel vegani») e il
-- «salame di cioccolato» non contano. Parole ambigue da sole («brodo», «ragù», «polpette») non bastano:
-- «brodo di pollo» è riconosciuto da «pollo». È una rete di sicurezza: il controllo principale,
-- con messaggi chiari, è nel modulo dell'app.
create function public.nome_e_carne(nome text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s ~ ('\m('
      || 'carn[ei]|manz[oi]|vitell[oi]|vitellone|maial[ei]|suin[oi]|porchetta|poll[oi]|gallin[ae]|cappon[ei]|tacchin[oi]'
      || '|agnell[oi]|abbacchio|caprett[oi]|capra|montone|castrato|conigli[oi]|cavall[oi]|asin[oi]|anatr[ae]|oca|oche'
      || '|faraon[ae]|quagli[ae]|piccion[ei]|fagian[oi]|cinghial[ei]|cerv[oi]|capriol[oi]|daino|selvaggina|lepre|struzzo|bisonte'
      || '|prosciutt[oi]|salam[ei]|salamin[oi]|salsicci[ae]|salsicce|mortadell[ae]|speck|pancett[ae]|guancial[ei]|bresaol[ae]'
      || '|lonz[ae]|lonzino|capocoll[oi]|soppressat[ae]|sopressat[ae]|nduja|cotechin[oi]|zampon[ei]|wurstel|bacon|culatello'
      || '|salum[ei]|insaccat[oi]|lard[oi]|strutto|sugna|cicciol[oi]|frattaglie|fegat[oi]|fegatini|trippa|rognon[ei]|animelle'
      || '|gelatina animale|gelatina di maiale'
      || ')\M')
     and s !~ '\m(vegetal[ei]|vegan[aeio]?|di soia|di seitan|di tofu|plant based|cioccolat[oa])\M'
  from (select public.testo_semplice(nome) as s) as t
$$;

-- Ingredienti: elenco di oggetti { nome, qta, unita, reparto, calabrese? } con lunghezze limitate.
create function public.ingredienti_validi(ing jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(ing) = 'array'
     and jsonb_array_length(ing) between 1 and 60
     and not exists (
       select 1 from jsonb_array_elements(ing) as e(v)
       where jsonb_typeof(v) <> 'object'
          or jsonb_typeof(v->'nome') is distinct from 'string'
          or char_length(btrim(v->>'nome')) not between 1 and 80
          or (v ? 'qta' and jsonb_typeof(v->'qta') not in ('number', 'null'))
          or (jsonb_typeof(v->'qta') = 'number' and ((v->>'qta')::numeric < 0 or (v->>'qta')::numeric > 100000))
          or jsonb_typeof(v->'unita') is distinct from 'string' or char_length(v->>'unita') > 20
          or jsonb_typeof(v->'reparto') is distinct from 'string' or char_length(v->>'reparto') > 30
          or (v ? 'calabrese' and (jsonb_typeof(v->'calabrese') <> 'object' or char_length((v->'calabrese')::text) > 600))
          or char_length(v::text) > 1000
     )
$$;

create function public.ingredienti_senza_carne(ing jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(ing) = 'array'
     and not exists (select 1 from jsonb_array_elements(ing) as e(v) where public.nome_e_carne(v->>'nome'))
$$;

-- Elenco di testi con numero di elementi e lunghezza massima.
create function public.testi_validi(a text[], minimo integer, massimo integer, lunghezza integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(a), 0) between minimo and massimo
     and not exists (select 1 from unnest(a) as x(t) where t is null or char_length(btrim(t)) = 0 or char_length(t) > lunghezza)
$$;

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

-- Un profilo per ogni utente di Supabase (creato in automatico, vedi trigger sotto).
create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default 'Anonimo'
    constraint profili_nome_lunghezza check (char_length(btrim(nome)) between 1 and 40 and nome = btrim(nome)),
  nome_scelto boolean not null default false,   -- falso finché l'utente non sceglie il nome al primo accesso
  ruolo text not null default 'membro'
    constraint profili_ruolo_valido check (ruolo in ('membro', 'amministratore')),
  creato_il timestamptz not null default now(),
  modificato_il timestamptz not null default now()
);
comment on table public.profili is 'Nome visualizzato e ruolo di ogni utente; leggibile da tutti gli utenti con accesso.';

create table public.ricette (
  id text primary key default gen_random_uuid()::text
    constraint ricette_id_formato check (id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  titolo text not null
    constraint ricette_titolo_lunghezza check (char_length(btrim(titolo)) between 3 and 120),
  pasto text not null
    constraint ricette_pasto_valido check (pasto in ('colazione', 'pranzo', 'cena', 'spuntino', 'base')),
  categoria text not null
    constraint ricette_categoria_valida check (categoria in ('vegana', 'vegetariana', 'pesce')),
  difficolta text not null
    constraint ricette_difficolta_valida check (difficolta in ('facile', 'media', 'impegnativa')),
  tempo_min integer not null constraint ricette_tempo_valido check (tempo_min between 0 and 1440),
  tempo_prep integer constraint ricette_tempo_prep_valido check (tempo_prep between 0 and 600),
  tempo_cottura integer constraint ricette_tempo_cottura_valido check (tempo_cottura between 0 and 600),
  riposo text constraint ricette_riposo_lunghezza check (char_length(riposo) <= 60),
  porzioni_base smallint not null constraint ricette_porzioni_valide check (porzioni_base between 1 and 20),
  stagioni text[] not null
    constraint ricette_stagioni_valide check (
      cardinality(stagioni) between 1 and 4
      and stagioni <@ array['primavera', 'estate', 'autunno', 'inverno', 'tutto_anno']
      and (not ('tutto_anno' = any (stagioni)) or cardinality(stagioni) = 1)),
  ingredienti jsonb not null
    constraint ricette_ingredienti_validi check (public.ingredienti_validi(ingredienti))
    constraint ricette_senza_carne check (public.ingredienti_senza_carne(ingredienti)),
  passi text[] not null constraint ricette_passi_validi check (public.testi_validi(passi, 1, 40, 1000)),
  note_nutrizionali text constraint ricette_note_lunghezza check (char_length(note_nutrizionali) <= 1000),
  tag text[] not null default '{}' constraint ricette_tag_validi check (public.testi_validi(tag, 0, 10, 40)),
  alcolici boolean not null default false,
  versione_di text references public.ricette (id) on delete set null,
  -- autore nullo = ricetta generica («Anonimo»): chiunque la modifica
  autore uuid default auth.uid() references public.profili (id) on delete set null,
  creata_il timestamptz not null default now(),
  modificata_il timestamptz not null default now(),
  modificata_da uuid default auth.uid() references public.profili (id) on delete set null,
  -- cestino: eliminata_il non nullo = nel cestino; dopo 30 giorni la ricetta viene cancellata davvero
  eliminata_il timestamptz,
  eliminata_da uuid references public.profili (id) on delete set null,
  constraint ricette_tempi_coerenti check (tempo_prep is null or tempo_min = tempo_prep + coalesce(tempo_cottura, 0))
);
comment on table public.ricette is 'Ricettario condiviso; autore nullo = ricetta generica; eliminata_il non nullo = nel cestino.';
create index ricette_autore_idx on public.ricette (autore);
create index ricette_modificata_da_idx on public.ricette (modificata_da);
create index ricette_eliminata_da_idx on public.ricette (eliminata_da);
create index ricette_versione_di_idx on public.ricette (versione_di);
create index ricette_eliminata_il_idx on public.ricette (eliminata_il) where eliminata_il is not null;

create table public.commenti (
  id bigint generated always as identity primary key,
  ricetta text not null references public.ricette (id) on delete cascade,
  autore uuid default auth.uid() references public.profili (id) on delete set null,  -- nullo = «Anonimo» (account cancellato)
  testo text not null constraint commenti_testo_lunghezza check (char_length(btrim(testo)) between 1 and 500),
  creato_il timestamptz not null default now(),
  modificato_il timestamptz not null default now()
);
create index commenti_ricetta_idx on public.commenti (ricetta, creato_il);
create index commenti_autore_idx on public.commenti (autore);

create table public.archivio (
  utente uuid not null default auth.uid() references public.profili (id) on delete cascade,
  ricetta text not null references public.ricette (id) on delete cascade,
  archiviata_il timestamptz not null default now(),
  primary key (utente, ricetta)
);
create index archivio_ricetta_idx on public.archivio (ricetta);

create table public.settimana (
  utente uuid not null default auth.uid() references public.profili (id) on delete cascade,
  giorno text not null constraint settimana_giorno_valido check (giorno in ('lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom')),
  pasto text not null constraint settimana_pasto_valido check (pasto in ('colazione', 'pranzo', 'cena', 'spuntino')),
  -- nulla = ricetta cancellata definitivamente: l'app mostra «Ricetta eliminata» e propone un sostituto
  ricetta text references public.ricette (id) on delete set null,
  dosi smallint not null default 1 constraint settimana_dosi_valide check (dosi between 1 and 6),
  avanzo_di text constraint settimana_avanzo_valido check (avanzo_di in ('lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom') and avanzo_di <> giorno),
  nota text constraint settimana_nota_lunghezza check (char_length(nota) <= 200),
  modificato_il timestamptz not null default now(),
  primary key (utente, giorno, pasto)
);
comment on table public.settimana is 'Settimana di ogni utente: leggibile da tutti, modificabile solo dal proprietario.';
create index settimana_ricetta_idx on public.settimana (ricetta);

-- Lista della spesa: ricette scelte con le porzioni, voci aggiunte a mano, spunte.
create table public.spesa_ricette (
  utente uuid not null default auth.uid() references public.profili (id) on delete cascade,
  ricetta text not null references public.ricette (id) on delete cascade,
  porzioni smallint not null constraint spesa_porzioni_valide check (porzioni between 1 and 60),
  aggiunta_il timestamptz not null default now(),
  primary key (utente, ricetta)
);
create index spesa_ricette_ricetta_idx on public.spesa_ricette (ricetta);

create table public.spesa_voci (
  id bigint generated always as identity primary key,
  utente uuid not null default auth.uid() references public.profili (id) on delete cascade,
  nome text not null constraint spesa_voci_nome_lunghezza check (char_length(btrim(nome)) between 1 and 80),
  reparto text not null default 'altro' constraint spesa_voci_reparto_lunghezza check (char_length(reparto) between 1 and 30),
  aggiunta_il timestamptz not null default now()
);
create index spesa_voci_utente_idx on public.spesa_voci (utente);

create table public.spesa_spunte (
  utente uuid not null default auth.uid() references public.profili (id) on delete cascade,
  chiave text not null constraint spesa_spunte_chiave_lunghezza check (char_length(chiave) between 1 and 160),
  spuntata_il timestamptz not null default now(),
  primary key (utente, chiave)
);

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

-- Profilo creato insieme all'utente (Angelo crea gli utenti dalla dashboard).
create function public.crea_profilo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profili (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.crea_profilo() from public, anon, authenticated;

create trigger crea_profilo
  after insert on auth.users
  for each row execute function public.crea_profilo();

-- Profili per gli utenti già esistenti.
insert into public.profili (id) select id from auth.users on conflict (id) do nothing;

-- Data di ultima modifica.
create function public.aggiorna_modificato_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modificato_il := now();
  return new;
end;
$$;
revoke execute on function public.aggiorna_modificato_il() from public, anon, authenticated;

create trigger profili_modificato_il before update on public.profili
  for each row execute function public.aggiorna_modificato_il();
create trigger commenti_modificato_il before update on public.commenti
  for each row execute function public.aggiorna_modificato_il();
create trigger settimana_modificato_il before update on public.settimana
  for each row execute function public.aggiorna_modificato_il();

-- Ricette: ultima modifica e chi l'ha fatta; cestino con data e autore dell'eliminazione.
-- Spostare nel cestino o ripristinare non conta come modifica del contenuto.
create function public.ricette_prima_di_salvare()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  escluse constant text[] := array['id', 'autore', 'creata_il', 'modificata_il', 'modificata_da', 'eliminata_il', 'eliminata_da'];
begin
  if tg_op = 'INSERT' then
    new.creata_il := now();
    new.modificata_il := now();
    new.modificata_da := auth.uid();
    new.eliminata_il := null;
    new.eliminata_da := null;
    return new;
  end if;

  if (to_jsonb(new) - escluse) is distinct from (to_jsonb(old) - escluse) then
    new.modificata_il := now();
    new.modificata_da := coalesce(auth.uid(), old.modificata_da);
  end if;

  if old.eliminata_il is null and new.eliminata_il is not null then
    new.eliminata_il := now();
    new.eliminata_da := auth.uid();
  elsif old.eliminata_il is not null and new.eliminata_il is null then
    new.eliminata_da := null;
  elsif new.eliminata_il is distinct from old.eliminata_il then
    new.eliminata_il := old.eliminata_il;  -- la data di eliminazione non si sposta
  end if;
  return new;
end;
$$;
revoke execute on function public.ricette_prima_di_salvare() from public, anon, authenticated;

create trigger ricette_prima_di_salvare
  before insert or update on public.ricette
  for each row execute function public.ricette_prima_di_salvare();

-- Una ricetta spostata nel cestino esce dalle liste della spesa di tutti (REQUISITI.md §4).
-- Serve security definer perché le liste degli altri non sono visibili a chi elimina;
-- la funzione agisce solo sulla ricetta appena eliminata.
create function public.ricetta_nel_cestino()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.spesa_ricette where ricetta = new.id;
  return null;
end;
$$;
revoke execute on function public.ricetta_nel_cestino() from public, anon, authenticated;

create trigger ricetta_nel_cestino
  after update of eliminata_il on public.ricette
  for each row when (old.eliminata_il is null and new.eliminata_il is not null)
  execute function public.ricetta_nel_cestino();

-- ---------------------------------------------------------------------------
-- Regole di accesso (RLS)
-- ---------------------------------------------------------------------------
alter table public.profili enable row level security;
alter table public.ricette enable row level security;
alter table public.commenti enable row level security;
alter table public.archivio enable row level security;
alter table public.settimana enable row level security;
alter table public.spesa_ricette enable row level security;
alter table public.spesa_voci enable row level security;
alter table public.spesa_spunte enable row level security;

-- Nessun permesso ad anon né a public; a authenticated solo quanto serve, colonna per colonna.
revoke all on table public.profili, public.ricette, public.commenti, public.archivio, public.settimana,
  public.spesa_ricette, public.spesa_voci, public.spesa_spunte from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on function public.testo_semplice(text), public.nome_e_carne(text), public.ingredienti_validi(jsonb),
  public.ingredienti_senza_carne(jsonb), public.testi_validi(text[], integer, integer, integer) from public, anon;
grant execute on function public.testo_semplice(text), public.nome_e_carne(text), public.ingredienti_validi(jsonb),
  public.ingredienti_senza_carne(jsonb), public.testi_validi(text[], integer, integer, integer) to authenticated;

-- profili: tutti leggono; ognuno cambia solo nome e nome_scelto del proprio (il ruolo no)
grant select on public.profili to authenticated;
grant update (nome, nome_scelto) on public.profili to authenticated;
create policy profili_lettura on public.profili for select to authenticated using (true);
create policy profili_modifica on public.profili for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ricette: tutti leggono (anche il cestino); inserisce chiunque a proprio nome;
-- modifica, sposta nel cestino e ripristina chi ne ha diritto: tutti per le generiche, solo l'autore per le sue.
-- La cancellazione definitiva la fa solo il database dopo 30 giorni di cestino.
grant select on public.ricette to authenticated;
grant insert (titolo, pasto, categoria, difficolta, tempo_min, tempo_prep, tempo_cottura, riposo, porzioni_base,
  stagioni, ingredienti, passi, note_nutrizionali, tag, alcolici, versione_di, autore) on public.ricette to authenticated;
grant update (titolo, pasto, categoria, difficolta, tempo_min, tempo_prep, tempo_cottura, riposo, porzioni_base,
  stagioni, ingredienti, passi, note_nutrizionali, tag, alcolici, versione_di, eliminata_il) on public.ricette to authenticated;
create policy ricette_lettura on public.ricette for select to authenticated using (true);
create policy ricette_inserimento on public.ricette for insert to authenticated
  with check (autore = (select auth.uid()));
create policy ricette_modifica on public.ricette for update to authenticated
  using (autore is null or autore = (select auth.uid()))
  with check (autore is null or autore = (select auth.uid()));

-- commenti: tutti leggono; ognuno scrive a proprio nome e modifica o elimina solo i propri
grant select, delete on public.commenti to authenticated;
grant insert (ricetta, testo, autore) on public.commenti to authenticated;
grant update (testo) on public.commenti to authenticated;
create policy commenti_lettura on public.commenti for select to authenticated using (true);
create policy commenti_inserimento on public.commenti for insert to authenticated
  with check (autore = (select auth.uid()));
create policy commenti_modifica on public.commenti for update to authenticated
  using (autore = (select auth.uid())) with check (autore = (select auth.uid()));
create policy commenti_eliminazione on public.commenti for delete to authenticated
  using (autore = (select auth.uid()));

-- archivio: solo del proprietario
grant select, delete on public.archivio to authenticated;
grant insert (utente, ricetta) on public.archivio to authenticated;
create policy archivio_proprio on public.archivio for all to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));

-- settimana: tutti leggono, solo il proprietario scrive
grant select, delete on public.settimana to authenticated;
grant insert (utente, giorno, pasto, ricetta, dosi, avanzo_di, nota) on public.settimana to authenticated;
grant update (ricetta, dosi, avanzo_di, nota) on public.settimana to authenticated;
create policy settimana_lettura on public.settimana for select to authenticated using (true);
create policy settimana_inserimento on public.settimana for insert to authenticated
  with check (utente = (select auth.uid()));
create policy settimana_modifica on public.settimana for update to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));
create policy settimana_eliminazione on public.settimana for delete to authenticated
  using (utente = (select auth.uid()));

-- spesa: solo del proprietario
grant select, delete on public.spesa_ricette, public.spesa_voci, public.spesa_spunte to authenticated;
grant insert (utente, ricetta, porzioni) on public.spesa_ricette to authenticated;
grant update (porzioni) on public.spesa_ricette to authenticated;
grant insert (utente, nome, reparto) on public.spesa_voci to authenticated;
grant update (nome, reparto) on public.spesa_voci to authenticated;
grant insert (utente, chiave) on public.spesa_spunte to authenticated;
create policy spesa_ricette_proprie on public.spesa_ricette for all to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));
create policy spesa_voci_proprie on public.spesa_voci for all to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));
create policy spesa_spunte_proprie on public.spesa_spunte for all to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));
