-- Passo 5: la settimana personale parte dalla settimana d'esempio una sola volta.
-- L'app copia la settimana d'esempio quando settimana_avviata è falso e poi lo imposta a vero:
-- così chi toglie tutti i pasti non se la ritrova ricopiata al prossimo accesso.
alter table public.profili
  add column settimana_avviata boolean not null default false;
comment on column public.profili.settimana_avviata is 'Vero dopo la prima copia della settimana d''esempio nella settimana dell''utente.';

-- solo sul proprio profilo (policy profili_modifica già esistente)
grant update (settimana_avviata) on public.profili to authenticated;
