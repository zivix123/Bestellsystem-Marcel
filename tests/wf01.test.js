/**
 * Tests für WF01 – "Artikel extrahieren" + "Käufer laden"
 * (Code-Nodes aus workflow_01_excel_import.json)
 */
const { runN8nCode } = require('./helpers/n8n-mock');

// ============================================================
// Code-Node: Artikel extrahieren
// ============================================================
const ARTIKEL_EXTRAHIEREN_CODE = `
const rows = $input.all().map(i => i.json);
let artikel = [];
let kategorie = 'Allgemein';
let id = 1;
let startParsing = false;
let datumMatch = null;

for (const row of rows) {
  const values = Object.values(row);
  const joined = values.join(' ').trim();

  if (!joined) continue;

  if (!datumMatch) {
    const dMatch = joined.match(/(\\d{1,2}[.\\/]\\d{1,2}[.\\/]\\d{2,4})/);
    if (dMatch) datumMatch = dMatch[1];
  }

  const lower = joined.toLowerCase();
  if (lower.includes('artikel') && lower.includes('preis')) {
    startParsing = true;
    continue;
  }

  if (!startParsing) continue;

  if (lower.includes('gesamt zu zahlen') || lower.includes('gesamtsumme')) break;

  if (lower.includes('tagesangebote')) {
    kategorie = 'Tagesangebote';
    continue;
  }

  const col_B = values[1];
  const col_D = values[3];
  const textOnly = col_B && String(col_B).trim() !== '' && (!col_D || String(col_D).trim() === '');
  const col_A = values[0];
  const hasNoQty = !col_A || String(col_A).trim() === '';
  if (textOnly && hasNoQty && String(col_B).trim().endsWith(':')) {
    kategorie = String(col_B).trim().replace(/:$/, '');
    continue;
  }

  if (!col_B || String(col_B).trim() === '') continue;

  const preis = parseFloat(String(col_D || '0').replace(',', '.'));
  if (isNaN(preis) || preis <= 0) continue;

  const col_C = values[2];
  artikel.push({
    id: id++,
    name: String(col_B).trim(),
    einheit: String(col_C || '').trim() || 'Stück',
    preis: Math.round(preis * 100) / 100,
    kategorie: kategorie
  });
}

const staticData = $getWorkflowStaticData('global');
staticData.artikel = artikel;
staticData.bestellungen = {};
staticData.tokens = {};
staticData.bestellung_aktiv = true;
staticData.kaeufer = staticData.kaeufer || [];
staticData.angebot_datum = datumMatch || new Date().toLocaleDateString('de-DE');
staticData.webapp_url = staticData.webapp_url || 'https://jade-alfajores-4f3440.netlify.app';

return [{ json: {
  artikel_count: artikel.length,
  datum: staticData.angebot_datum,
  artikel: artikel
}}];
`;

// ============================================================
// Code-Node: Käufer laden
// ============================================================
const KAEUFER_LADEN_CODE = `
const staticData = $getWorkflowStaticData('global');
const kaeufer = staticData.kaeufer || [];

if (kaeufer.length === 0) {
  return [{ json: { skip: true, message: 'Keine Käufer registriert' } }];
}

return kaeufer.map(chatId => ({
  json: {
    chatId: String(chatId),
    datum: staticData.angebot_datum,
    artikelCount: (staticData.artikel || []).length,
    webapp_url: staticData.webapp_url || 'https://jade-alfajores-4f3440.netlify.app'
  }
}));
`;

// ============================================================
// Hilfsfunktionen
// ============================================================
function makeRow(colA, colB, colC, colD) {
  return { json: { A: colA, B: colB, C: colC, D: colD } };
}

// Minimal-Excel: Header + Datenzeilen
function makeExcel(dataRows) {
  return [
    { json: { A: 'Firma XY', B: '', C: '', D: '' } },
    { json: { A: 'Lieferdatum: 25.02.26', B: '', C: '', D: '' } },
    { json: { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' } }, // trigger startParsing
    ...dataRows
  ];
}

function runArtikel(inputRows, staticData = {}) {
  const vm = require('vm');
  const sd = { kaeufer: [], ...staticData };
  const sandbox = {
    $input: { all: () => inputRows },
    $getWorkflowStaticData: () => sd,
    console, Date, Math,
    staticDataRef: sd
  };
  const wrapped = `(function() { ${ARTIKEL_EXTRAHIEREN_CODE} })()`;
  const result = vm.runInNewContext(wrapped, sandbox);
  return { result, staticData: sd };
}

function runKaeufer(staticData) {
  return require('./helpers/n8n-mock').runN8nCode(KAEUFER_LADEN_CODE, { staticData });
}

// ============================================================
// WF01 – Artikel extrahieren: Grundfunktion
// ============================================================
describe('WF01 – Artikel extrahieren: Grundfunktion', () => {
  test('Gibt artikel_count, datum und artikel zurück', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Bio-Tomaten', 'ca 1kg', '4.50'),
    ]));
    expect(result[0].json).toHaveProperty('artikel_count');
    expect(result[0].json).toHaveProperty('datum');
    expect(result[0].json).toHaveProperty('artikel');
  });

  test('Parst einen normalen Artikel korrekt', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Bio-Tomaten', 'ca 1kg', '4.50'),
    ]));
    expect(result[0].json.artikel_count).toBe(1);
    const art = result[0].json.artikel[0];
    expect(art.name).toBe('Bio-Tomaten');
    expect(art.einheit).toBe('ca 1kg');
    expect(art.preis).toBe(4.50);
    expect(art.kategorie).toBe('Allgemein');
    expect(art.id).toBe(1);
  });

  test('Mehrere Artikel erhalten aufsteigende IDs', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
      makeRow('', 'Gurke', 'Stück', '1.20'),
      makeRow('', 'Äpfel', 'ca 1kg', '3.20'),
    ]));
    expect(result[0].json.artikel_count).toBe(3);
    expect(result[0].json.artikel.map(a => a.id)).toEqual([1, 2, 3]);
  });

  test('Preis mit Komma als Dezimaltrennzeichen wird korrekt geparst', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Käse', '200g', '3,90'),
    ]));
    expect(result[0].json.artikel[0].preis).toBe(3.90);
  });

  test('Preis wird auf 2 Dezimalstellen gerundet', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Nüsse', '100g', '2.999'),
    ]));
    expect(result[0].json.artikel[0].preis).toBe(3.00);
  });

  test('Fehlende Einheit → Fallback "Stück"', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Artikel ohne Einheit', '', '2.00'),
    ]));
    expect(result[0].json.artikel[0].einheit).toBe('Stück');
  });

  test('Zeilen ohne Preis (0 oder leer) werden ignoriert', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Kein Preis', 'kg', '0'),
      makeRow('', 'Auch kein Preis', 'kg', ''),
      makeRow('', 'Echter Artikel', 'kg', '2.00'),
    ]));
    expect(result[0].json.artikel_count).toBe(1);
  });

  test('Zeilen ohne Artikelname werden ignoriert', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', '', 'kg', '2.00'),
      makeRow('', 'Gültiger Artikel', 'kg', '3.00'),
    ]));
    expect(result[0].json.artikel_count).toBe(1);
  });

  test('Parsing stoppt bei "Gesamt zu zahlen"', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Artikel A', 'kg', '1.00'),
      makeRow('', 'Gesamt zu zahlen:', '', ''),
      makeRow('', 'Artikel B (nach Ende)', 'kg', '2.00'),
    ]));
    expect(result[0].json.artikel_count).toBe(1);
    expect(result[0].json.artikel[0].name).toBe('Artikel A');
  });

  test('Parsing stoppt bei "Gesamtsumme"', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Artikel A', 'kg', '1.00'),
      makeRow('', 'Gesamtsumme', '', ''),
      makeRow('', 'Artikel B', 'kg', '2.00'),
    ]));
    expect(result[0].json.artikel_count).toBe(1);
  });
});

// ============================================================
// WF01 – Kategorie-Erkennung
// ============================================================
describe('WF01 – Kategorie-Erkennung', () => {
  test('Ohne Kategorie-Marker → alle Artikel in "Allgemein"', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
      makeRow('', 'Gurke', 'Stück', '1.20'),
    ]));
    result[0].json.artikel.forEach(a => {
      expect(a.kategorie).toBe('Allgemein');
    });
  });

  test('Nach "Tagesangebote:"-Zeile → Kategorie wechselt', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
      makeRow('', 'Tagesangebote:', '', ''),
      makeRow('', 'Sonderangebot', 'Stück', '0.99'),
    ]));
    expect(result[0].json.artikel[0].kategorie).toBe('Allgemein');
    expect(result[0].json.artikel[1].kategorie).toBe('Tagesangebote');
  });

  test('Kategorie "Tagesangebote" (ohne Doppelpunkt) wird erkannt', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tagesangebote', '', ''),
      makeRow('', 'Sonderangebot', 'Stück', '0.99'),
    ]));
    expect(result[0].json.artikel[0].kategorie).toBe('Tagesangebote');
  });

  test('Benutzerdefinierte Kategorie mit Doppelpunkt wird erkannt', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Obst:', '', ''),
      makeRow('', 'Äpfel', 'ca 1kg', '2.50'),
    ]));
    expect(result[0].json.artikel[0].kategorie).toBe('Obst');
  });

  test('Doppelpunkt wird vom Kategorienamen entfernt', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Gemüse:', '', ''),
      makeRow('', 'Karotte', 'Bund', '1.50'),
    ]));
    expect(result[0].json.artikel[0].kategorie).toBe('Gemüse');
    expect(result[0].json.artikel[0].kategorie).not.toContain(':');
  });

  test('Mehrere Kategorien werden korrekt zugeordnet', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
      makeRow('', 'Tagesangebote:', '', ''),
      makeRow('', 'Sonderangebot 1', 'Stück', '0.99'),
      makeRow('', 'Sonderangebot 2', 'Stück', '1.49'),
    ]));
    expect(result[0].json.artikel[0].kategorie).toBe('Allgemein');
    expect(result[0].json.artikel[1].kategorie).toBe('Tagesangebote');
    expect(result[0].json.artikel[2].kategorie).toBe('Tagesangebote');
  });
});

// ============================================================
// WF01 – Datumsextraktion
// ============================================================
describe('WF01 – Datumsextraktion', () => {
  test('Datum im Format TT.MM.JJ wird erkannt', () => {
    const { result } = runArtikel([
      { json: { A: 'Lieferdatum: 25.02.26', B: '', C: '', D: '' } },
      { json: { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' } },
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]);
    expect(result[0].json.datum).toBe('25.02.26');
  });

  test('Datum im Format TT.MM.JJJJ wird erkannt', () => {
    const { result } = runArtikel([
      { json: { A: 'Lieferdatum: 25.02.2026', B: '', C: '', D: '' } },
      { json: { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' } },
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]);
    expect(result[0].json.datum).toBe('25.02.2026');
  });

  test('Kein Datum → Fallback auf heutiges Datum (nicht leer)', () => {
    const { result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]));
    expect(result[0].json.datum).toBeTruthy();
    expect(result[0].json.datum.length).toBeGreaterThan(0);
  });
});

// ============================================================
// WF01 – Static Data nach dem Import
// ============================================================
describe('WF01 – Static Data wird korrekt gesetzt', () => {
  test('bestellung_aktiv wird auf true gesetzt', () => {
    const { staticData } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]));
    expect(staticData.bestellung_aktiv).toBe(true);
  });

  test('bestellungen und tokens werden geleert (Reset)', () => {
    const sd = {
      bestellungen: { '123': { userName: 'Alt' } },
      tokens: { 'ord_abc': '123' },
    };
    const { staticData } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]), sd);
    expect(Object.keys(staticData.bestellungen)).toHaveLength(0);
    expect(Object.keys(staticData.tokens)).toHaveLength(0);
  });

  test('Bestehende Käufer-Liste bleibt erhalten', () => {
    const sd = { kaeufer: ['111', '222', '333'] };
    const { staticData } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]), sd);
    expect(staticData.kaeufer).toEqual(['111', '222', '333']);
  });

  test('Artikel werden in staticData gespeichert', () => {
    const { staticData, result } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
      makeRow('', 'Gurke', 'Stück', '1.20'),
    ]));
    expect(staticData.artikel).toHaveLength(2);
    expect(staticData.artikel).toEqual(result[0].json.artikel);
  });

  test('webapp_url bleibt erhalten wenn schon gesetzt', () => {
    const sd = { webapp_url: 'https://meine-app.netlify.app' };
    const { staticData } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]), sd);
    expect(staticData.webapp_url).toBe('https://meine-app.netlify.app');
  });

  test('webapp_url bekommt Fallback wenn nicht gesetzt', () => {
    const { staticData } = runArtikel(makeExcel([
      makeRow('', 'Tomaten', 'kg', '4.50'),
    ]));
    expect(staticData.webapp_url).toBeTruthy();
  });
});

// ============================================================
// WF01 – Käufer laden
// ============================================================
describe('WF01 – Käufer laden', () => {
  test('Leere Käufer-Liste → skip: true zurückgeben', () => {
    const result = runKaeufer({ kaeufer: [] });
    expect(result[0].json.skip).toBe(true);
    expect(result[0].json.message).toBeTruthy();
  });

  test('Fehlende kaeufer-Key → skip: true zurückgeben', () => {
    const result = runKaeufer({});
    expect(result[0].json.skip).toBe(true);
  });

  test('3 Käufer → 3 Einträge zurückgeben', () => {
    const result = runKaeufer({
      kaeufer: ['111', '222', '333'],
      artikel: [],
      angebot_datum: '25.02.26',
      webapp_url: 'https://test.app'
    });
    expect(result).toHaveLength(3);
  });

  test('Jeder Eintrag enthält chatId, datum, artikelCount, webapp_url', () => {
    const result = runKaeufer({
      kaeufer: ['12345'],
      artikel: [{ id: 1 }, { id: 2 }],
      angebot_datum: '25.02.26',
      webapp_url: 'https://test.app'
    });
    expect(result[0].json.chatId).toBe('12345');
    expect(result[0].json.datum).toBe('25.02.26');
    expect(result[0].json.artikelCount).toBe(2);
    expect(result[0].json.webapp_url).toBe('https://test.app');
  });

  test('Numerische chatId wird als String zurückgegeben', () => {
    const result = runKaeufer({
      kaeufer: [99999],
      artikel: [],
      angebot_datum: '25.02.26'
    });
    expect(typeof result[0].json.chatId).toBe('string');
    expect(result[0].json.chatId).toBe('99999');
  });

  test('Webapp_url Fallback wenn nicht gesetzt', () => {
    const result = runKaeufer({
      kaeufer: ['123'],
      artikel: [],
      angebot_datum: '25.02.26'
    });
    expect(result[0].json.webapp_url).toBeTruthy();
  });
});
