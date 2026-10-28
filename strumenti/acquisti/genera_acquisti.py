#!/usr/bin/env python3
"""Genera app/data/acquisti.json («Acquisti consapevoli», REQUISITI.md §5.8) dalle fonti trascritte qui.

Fonti ammesse (decise da Angelo il 28/10/2026): campagne riconoscibili con criteri scritti (movimento BDS)
e le fonti primarie che usano (banca dati ONU, Who Profits, AFSC Investigate). Ogni voce: «Segnalata da X per Y» (il campo «da» comprende la preposizione: «dal movimento BDS»).
Uso: python3 strumenti/acquisti/genera_acquisti.py  (riscrive app/data/acquisti.json)
"""
import json, os

QUI = os.path.dirname(os.path.abspath(__file__))
USCITA = os.path.join(QUI, '..', '..', 'app', 'data', 'acquisti.json')

TEMI = {'israele-palestina': 'Israele e Palestina'}

SETTORI = [
    ('cibo', 'Cibo e bevande'),
    ('supermercati', 'Supermercati'),
    ('ristorazione', 'Ristorazione'),
    ('agricoltura', 'Agricoltura (sementi, fertilizzanti, irrigazione)'),
    ('cosmetici', 'Cosmetici e farmaci'),
    ('abbigliamento', 'Abbigliamento e sport'),
    ('tecnologia', 'Tecnologia e informatica'),
    ('telecomunicazioni', 'Telefonia, televisione e intrattenimento'),
    ('finanza', 'Banche, assicurazioni e investimenti'),
    ('turismo', 'Viaggi e turismo'),
    ('immobiliare', 'Immobiliare'),
    ('edilizia', 'Edilizia, materiali e ingegneria'),
    ('trasporti', 'Trasporti e logistica'),
    ('energia', 'Energia e carburanti'),
    ('acqua-rifiuti', 'Acqua, rifiuti e riciclo'),
    ('sicurezza', 'Sicurezza'),
    ('altro', 'Altre imprese'),
]

FONTI = {
    'bds-2024': {
        'da': 'dal movimento BDS',
        'titolo': 'BDS movement, «Guide to BDS Boycott» (pubblicata il 6/12/2024)',
        'url': 'https://bdsmovement.net/Guide-to-BDS-Boycott',
        'verificata_il': '2026-10-28',
        'nota': 'Il BDS sceglie i bersagli per grado di complicità documentata, rilevanza per altri movimenti, notorietà del marchio e possibilità di successo. Distingue il boicottaggio prioritario, i boicottaggi spontanei che sostiene senza averli lanciati e le campagne di pressione (boicottare se c\'è un\'alternativa, chiedere di cambiare).',
    },
    'onu-2026': {
        'da': 'dall\'ONU (Alto commissariato per i diritti umani)',
        'titolo': 'ONU, banca dati delle imprese coinvolte negli insediamenti israeliani, A/HRC/63/20 (25/09/2026)',
        'url': 'https://www.ohchr.org/sites/default/files/documents/hrbodies/hrcouncil/sessions-regular/session63/advance-versions/a-hrc-63-20-aev.pdf',
        'verificata_il': '2026-10-28',
        'nota': 'Per l\'ONU l\'inserimento non è un giudizio di illecito: indica fondati motivi per ritenere che l\'impresa abbia svolto almeno una delle attività elencate tra agosto 2019 e aprile 2026. Il settore lo indichiamo noi in base al nome e all\'attività nota dell\'impresa: il rapporto non lo riporta.',
    },
}

TIPI = {
    'prioritario': 'Boicottaggio prioritario',
    'spontaneo': 'Boicottaggio spontaneo sostenuto dal BDS',
    'pressione': 'Campagna di pressione',
    'onu': 'Banca dati ONU',
}

# Attività del paragrafo 96 (rapporto della missione d'inchiesta ONU del 2013), in breve
ATTIVITA = {
    'a': 'forniture di mezzi e materiali per costruire o ampliare insediamenti e muro',
    'b': 'forniture di sistemi di sorveglianza e identificazione',
    'c': 'forniture di mezzi usati per demolizioni e per distruggere coltivazioni',
    'd': 'servizi di sicurezza a imprese degli insediamenti',
    'e': 'servizi che sostengono gli insediamenti, compresi i trasporti',
    'f': 'operazioni bancarie e finanziarie a favore degli insediamenti',
    'g': 'uso di risorse naturali, in particolare acqua e terra',
    'h': 'inquinamento e smaltimento di rifiuti verso villaggi palestinesi',
    'i': 'pratiche che svantaggiano le imprese palestinesi',
    'j': 'reinvestimento negli insediamenti dei profitti di imprese di coloni',
}

T = 'israele-palestina'

# Guida al boicottaggio del BDS (6/12/2024): tutte le voci nominate, con il motivo indicato dal BDS
BDS = [
    # boicottaggio prioritario dei consumatori
    ('Chevron', ['Caltex', 'Texaco'], 'energia', 'prioritario', 'l\'estrazione del gas rivendicato da Israele nel Mediterraneo orientale, che finanzia le casse dello Stato israeliano'),
    ('Intel', [], 'tecnologia', 'prioritario', 'lo stabilimento di Kiryat Gat, su terre di un villaggio palestinese spopolato, e il contributo all\'economia di guerra israeliana'),
    ('Dell Technologies', [], 'tecnologia', 'prioritario', 'la fornitura di server e servizi all\'esercito israeliano (contratto del 2023)'),
    ('Siemens', [], 'tecnologia', 'prioritario', 'il ruolo di appaltatore principale del cavo elettrico Euro-Asia Interconnector, che collegherebbe gli insediamenti all\'Europa'),
    ('HP', ['HP Inc.', 'Hewlett Packard Enterprise (HPE)'], 'tecnologia', 'prioritario', 'tecnologia e supporto logistico a governo, esercito, carceri e polizia israeliani'),
    ('Microsoft', [], 'tecnologia', 'prioritario', 'i servizi cloud Azure e di intelligenza artificiale forniti all\'esercito israeliano'),
    ('Carrefour', [], 'supermercati', 'prioritario', 'il contratto di franchising con imprese attive negli insediamenti, i doni ai soldati israeliani e un punto vendita in un insediamento'),
    ('AXA', [], 'finanza', 'prioritario', 'gli investimenti in aziende che forniscono armi a Israele'),
    ('Reebok', [], 'abbigliamento', 'prioritario', 'la sponsorizzazione della Federazione calcistica israeliana, che comprende squadre degli insediamenti'),
    ('Disney+', ['Disney', 'Marvel'], 'telecomunicazioni', 'prioritario', 'contenuti e testimonial che, secondo il BDS, celebrano il governo israeliano e disumanizzano i palestinesi'),
    ('Teva', ['Teva Pharmaceutical Industries'], 'cosmetici', 'prioritario', 'il sostegno alla guerra di Israele e i profitti ricavati dall\'occupazione, anche sul mercato palestinese'),
    ('SodaStream', [], 'cibo', 'prioritario', 'il ruolo nello spostamento dei beduini palestinesi del Naqab (Negev) e la discriminazione dei lavoratori palestinesi'),
    ('RE/MAX', ['Re/Max Holdings'], 'immobiliare', 'prioritario', 'la vendita di immobili negli insediamenti israeliani'),
    ('Prodotti israeliani al supermercato', ['frutta e verdura israeliana', 'Product of Israel'], 'cibo', 'prioritario', 'il sostegno all\'economia israeliana e perché tra questi ci possono essere prodotti degli insediamenti etichettati «Prodotto in Israele»'),
    # boicottaggi spontanei sostenuti dal BDS
    ('McDonald\'s', [], 'ristorazione', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Coca-Cola', [], 'cibo', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Burger King', [], 'ristorazione', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Papa John\'s', [], 'ristorazione', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Pizza Hut', [], 'ristorazione', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Domino\'s Pizza', [], 'ristorazione', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano da parte della società o del franchising in Israele durante la guerra a Gaza'),
    ('Wix', [], 'tecnologia', 'spontaneo', 'il sostegno aperto a Israele o le donazioni all\'esercito israeliano durante la guerra a Gaza'),
    # campagne di pressione
    ('Google', [], 'tecnologia', 'pressione', 'il progetto Nimbus: servizi cloud e di intelligenza artificiale al governo e all\'esercito israeliani'),
    ('Amazon', ['Ring'], 'tecnologia', 'pressione', 'il progetto Nimbus: servizi cloud e di intelligenza artificiale al governo e all\'esercito israeliani'),
    ('Booking Holdings', ['Booking.com'], 'turismo', 'pressione', 'gli alloggi offerti negli insediamenti israeliani (impresa presente nella banca dati ONU)'),
    ('Airbnb', [], 'turismo', 'pressione', 'gli alloggi offerti negli insediamenti israeliani (impresa presente nella banca dati ONU)'),
    ('Expedia', ['Expedia Group'], 'turismo', 'pressione', 'gli alloggi offerti negli insediamenti israeliani (impresa presente nella banca dati ONU)'),
]

# imprese ONU che sono la stessa voce del BDS (nome ONU -> nome della voce)
STESSA = {
    'Airbnb Inc.': 'Airbnb',
    'Booking Holdings Inc.': 'Booking Holdings',
    'Expedia Group Inc.': 'Expedia',
    'Re/Max Holdings, Inc.': 'RE/MAX',
}


def leggi_onu():
    righe = []
    with open(os.path.join(QUI, 'onu_2026.tsv'), encoding='utf-8') as f:
        for r in f:
            if not r.strip() or r.startswith('#'):
                continue
            num, nome, lettere, paese, settore = r.rstrip('\n').split('\t')
            righe.append((int(num), nome, [] if lettere == '-' else lettere.split(','), paese, settore))
    assert len(righe) == 214 and [r[0] for r in righe] == list(range(1, 215)), 'elenco ONU incompleto'
    return righe


def motivo_onu(lettere):
    base = 'attività legate agli insediamenti israeliani nel Territorio palestinese occupato'
    if not lettere:
        return base
    return base + ': ' + '; '.join(ATTIVITA[x] for x in lettere)


def genera():
    settori = dict(SETTORI)
    voci, per_nome = [], {}
    for nome, marchi, settore, tipo, per in BDS:
        assert settore in settori and tipo in TIPI
        v = {'azienda': nome, 'settore': settore, 'segnalazioni': [{'fonte': 'bds-2024', 'tema': T, 'tipo': tipo, 'per': per}]}
        if marchi:
            v['marchi'] = marchi
        voci.append(v); per_nome[nome] = v
    for num, nome, lettere, paese, settore in leggi_onu():
        assert settore in settori, nome
        s = {'fonte': 'onu-2026', 'tema': T, 'tipo': 'onu', 'per': motivo_onu(lettere)}
        if nome in STESSA:
            v = per_nome[STESSA[nome]]
            v['segnalazioni'].append(s)
            v.setdefault('marchi', []).append(nome)
            v['paese'] = paese
            continue
        voci.append({'azienda': nome, 'paese': paese, 'settore': settore, 'segnalazioni': [s]})
    voci.sort(key=lambda v: v['azienda'].casefold())
    return {
        'versione_schema': 2,
        'nota': 'Generato da strumenti/acquisti/genera_acquisti.py: non modificare a mano. REQUISITI.md §5.8.',
        'temi': TEMI,
        'settori': [{'id': k, 'nome': n} for k, n in SETTORI],
        'tipi': TIPI,
        'fonti': FONTI,
        'voci': voci,
    }


if __name__ == '__main__':
    d = genera()
    with open(USCITA, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(len(d['voci']), 'voci scritte in', os.path.normpath(USCITA))
