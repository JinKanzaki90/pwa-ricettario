-- Passo 4: elenco della carne ampliato e funzione per il modulo dell'app.
-- La revisione del passo 2 aveva trovato voci mancanti (kebab, chorizo, pastrami, foie gras, colla di pesce…).
-- Voci lasciate fuori di proposito perché darebbero falsi allarmi: «bue» (pomodoro cuore di bue),
-- «hamburger» e «polpette» (spesso di legumi), «coppa» (anche dolce), «carpaccio» (anche di verdure).

create or replace function public.nome_e_carne(nome text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s ~ ('\m('
      || 'carn[ei]|manz[oi]|vitell[aoi]|vitellone|maial[ei]|maialin[oi]|suin[oi]|porc[oi]|porchetta|poll[oi]|pollame|gallin[ae]|cappon[ei]|tacchin[oi]'
      || '|agnell[oi]|abbacchio|caprett[oi]|capra|montone|castrato|conigli[oi]|cavall[oi]|asin[oi]|anatr[ae]|oca|oche'
      || '|faraon[ae]|quagli[ae]|piccion[ei]|fagian[oi]|pernic[ei]|cinghial[ei]|cerv[oi]|capriol[oi]|daino|camosci[oi]|renna|canguro'
      || '|selvaggina|lepre|struzzo|bisonte'
      || '|prosciutt[oi]|salam[ei]|salamin[oi]|salamell[ae]|salsicci[ae]|salsicce|mortadell[ae]|speck|pancett[ae]|guancial[ei]|bresaol[ae]'
      || '|lonz[ae]|lonzino|capocoll[oi]|soppressat[ae]|sopressat[ae]|finocchiona|ciauscolo|nduja|cotechin[oi]|zampon[ei]|wurstel|bacon|culatello'
      || '|chorizo|pastrami|kebab|roast beef|ossobuc[oh]i?|ossibuchi|foie gras'
      || '|salum[ei]|insaccat[oi]|lard[oi]|strutto|sugna|cicciol[oi]|cotenn[ae]|frattaglie|fegat[oi]|fegatini|trippa|rognon[ei]|animelle'
      || '|gelatina animale|gelatina di maiale|colla di pesce'
      || ')\M')
     and s !~ '\m(vegetal[ei]|vegan[aeio]?|di soia|di seitan|di tofu|plant based|cioccolat[oa])\M'
  from (select public.testo_semplice(nome) as s) as t
$$;

-- Nomi degli ingredienti che il database considera carne: il modulo dell'app la chiama prima di salvare,
-- così app e database rispondono allo stesso modo e il messaggio indica l'ingrediente.
create function public.ingredienti_di_carne(ing jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(v->>'nome' order by n), '{}')
  from jsonb_array_elements(case when jsonb_typeof(ing) = 'array' then ing else '[]'::jsonb end) with ordinality as e(v, n)
  where public.nome_e_carne(v->>'nome')
$$;
comment on function public.ingredienti_di_carne(jsonb) is 'Nomi degli ingredienti riconosciuti come carne (stesso elenco del vincolo ricette_senza_carne).';
revoke execute on function public.ingredienti_di_carne(jsonb) from public, anon;
grant execute on function public.ingredienti_di_carne(jsonb) to authenticated;
