-- Passo 3: impostazioni personali e cancellazione dell'account (REQUISITI.md §2, §4, §5.9).

-- ---------------------------------------------------------------------------
-- Nome visualizzato: «Anonimo» è riservato a chi non ha ancora scelto e agli account cancellati.
-- ---------------------------------------------------------------------------
alter table public.profili
  add constraint profili_nome_non_riservato
  check (not nome_scelto or lower(nome) <> 'anonimo');

-- ---------------------------------------------------------------------------
-- Preferenze personali: per ora gli ingredienti da evitare.
-- Tabella separata dai profili perché i profili sono leggibili da tutti, le preferenze no
-- (possono rivelare intolleranze o scelte personali).
-- ---------------------------------------------------------------------------
create table public.preferenze (
  utente uuid primary key default auth.uid() references public.profili (id) on delete cascade,
  da_evitare text[] not null default '{}'
    constraint preferenze_da_evitare_validi check (public.testi_validi(da_evitare, 0, 30, 40)),
  modificato_il timestamptz not null default now()
);
comment on table public.preferenze is 'Preferenze personali (ingredienti da evitare); visibili e modificabili solo dal proprietario.';

create trigger preferenze_modificato_il before update on public.preferenze
  for each row execute function public.aggiorna_modificato_il();

alter table public.preferenze enable row level security;
revoke all on table public.preferenze from public, anon, authenticated;
grant select, delete on public.preferenze to authenticated;
grant insert (utente, da_evitare) on public.preferenze to authenticated;
grant update (da_evitare) on public.preferenze to authenticated;
create policy preferenze_proprie on public.preferenze for all to authenticated
  using (utente = (select auth.uid())) with check (utente = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Cancellazione del proprio account (§4, §5.9).
-- Cancella l'utente di chi chiama da auth.users; il resto lo fanno le chiavi esterne già esistenti:
-- profilo, settimana, spesa, archivio e preferenze cancellati; ricette e commenti restano con
-- autore nullo, cioè «Anonimo», e le ricette diventano generiche.
-- Serve security definer perché l'utente non ha (e non deve avere) permessi su auth.users.
-- Agisce solo sull'utente che chiama: nessun parametro, quindi nessun modo di indicare un altro utente.
-- ---------------------------------------------------------------------------
do $$
begin
  if not has_table_privilege('auth.users', 'delete') then
    raise exception 'Il proprietario delle migrazioni non può cancellare da auth.users: la cancellazione dell''account non funzionerebbe';
  end if;
end $$;

create function public.cancella_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chi uuid := auth.uid();
begin
  if chi is null then
    raise exception 'Serve l''accesso per cancellare un account' using errcode = '42501';
  end if;
  delete from auth.users where id = chi;
end;
$$;
comment on function public.cancella_account() is 'Cancella l''account di chi la chiama (e solo quello).';
revoke execute on function public.cancella_account() from public, anon;
grant execute on function public.cancella_account() to authenticated;
