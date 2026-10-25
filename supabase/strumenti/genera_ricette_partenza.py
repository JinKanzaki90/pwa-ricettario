#!/usr/bin/env python3
"""Genera la migrazione con le ricette di partenza (generiche, categoria «vegana») da app/data/ricette.json.

Uso, dalla radice del repository:
    python3 supabase/strumenti/genera_ricette_partenza.py > supabase/migrations/20261025170100_ricette_di_partenza.sql

Serve una sola volta: una migrazione già applicata non si modifica. Le ricette esistenti non vengono
toccate (on conflict do nothing), quindi la migrazione si può rieseguire senza danni.
"""
import json
import pathlib
import sys

RADICE = pathlib.Path(__file__).resolve().parents[2]
dati = json.loads((RADICE / 'app/data/ricette.json').read_text(encoding='utf-8'))


def testo(v):
    if v is None:
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"


def elenco(a):
    if not a:
        return "'{}'::text[]"
    return 'array[' + ', '.join(testo(x) for x in a) + ']::text[]'


righe = []
for r in dati['ricette']:
    stagioni = ['tutto_anno'] if r['stagioni'] == 'tutto_anno' else r['stagioni']
    ingredienti = json.dumps(r['ingredienti'], ensure_ascii=False, separators=(',', ':'))
    valori = [
        testo(r['id']), testo(r['titolo']), testo(r['pasto']), "'vegana'", testo(r['difficolta']),
        str(int(r['tempo_min'])), testo(r.get('riposo')), str(int(r['porzioni_base'])),
        elenco(stagioni), testo(ingredienti) + '::jsonb', elenco(r['passi']),
        testo(r.get('note_nutrizionali')), elenco(r.get('tag') or []),
        'true' if r.get('alcolici') else 'false',
    ]
    righe.append('  (' + ', '.join(valori) + ')')

out = sys.stdout
out.write('-- Ricette di partenza: le ' + str(len(righe)) + ' ricette dell\'artifact, generiche (autore nullo = «Anonimo»)\n')
out.write('-- e tutte vegane. Generata da supabase/strumenti/genera_ricette_partenza.py a partire da app/data/ricette.json.\n\n')
out.write('insert into public.ricette (id, titolo, pasto, categoria, difficolta, tempo_min, riposo, porzioni_base,\n')
out.write('  stagioni, ingredienti, passi, note_nutrizionali, tag, alcolici, autore)\n')
out.write('select v.*, null::uuid from (values\n')
out.write(',\n'.join(righe))
out.write('\n) as v (id, titolo, pasto, categoria, difficolta, tempo_min, riposo, porzioni_base,\n')
out.write('  stagioni, ingredienti, passi, note_nutrizionali, tag, alcolici)\n')
out.write('on conflict (id) do nothing;\n')
