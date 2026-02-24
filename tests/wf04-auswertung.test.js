const { prepareAuswertung, splitRows } = require('./lib/wf04-auswertung');

describe('WF04: Auswertung vorbereiten', () => {

  // ---- Leere Bestellungen ----
  test('gibt leer=true bei keinen Bestellungen', () => {
    const result = prepareAuswertung({}, [], '25.02.26');
    expect(result.leer).toBe(true);
    expect(result.message).toContain('Keine Bestellungen');
    expect(result.datum).toBe('25.02.26');
  });

  // ---- Artikel-Aggregation ----
  test('aggregiert Artikelmengen über mehrere Bestellungen', () => {
    const bestellungen = {
      '111': {
        chatId: '111', userName: 'Alice', gesamtpreis: 9.0,
        positionen: [{ artikelId: 1, name: 'Tomaten', einheit: '1kg', preis: 4.5, menge: 2, summe: 9.0 }]
      },
      '222': {
        chatId: '222', userName: 'Bob', gesamtpreis: 4.5,
        positionen: [{ artikelId: 1, name: 'Tomaten', einheit: '1kg', preis: 4.5, menge: 1, summe: 4.5 }]
      }
    };
    const result = prepareAuswertung(bestellungen, [], '25.02.26');
    expect(result.leer).toBe(false);
    expect(result.anzahlBestellungen).toBe(2);

    // Finde Tomaten-Zeile in Excel-Rows
    const tomatenRow = result.rows.find(r => r.A === 'Tomaten');
    expect(tomatenRow).toBeDefined();
    expect(tomatenRow.D).toBe(3); // 2 + 1 = 3 Gesamt-Menge
    expect(tomatenRow.E).toBe(13.5); // 9.0 + 4.5 = 13.5
  });

  test('aggregiert verschiedene Artikel getrennt', () => {
    const bestellungen = {
      '111': {
        chatId: '111', userName: 'Alice', gesamtpreis: 5.7,
        positionen: [
          { artikelId: 1, name: 'Tomaten', einheit: '1kg', preis: 4.5, menge: 1, summe: 4.5 },
          { artikelId: 2, name: 'Gurke', einheit: 'Stück', preis: 1.2, menge: 1, summe: 1.2 }
        ]
      }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    const artikelRows = result.rows.filter(r => r.A === 'Gurke' || r.A === 'Tomaten');
    expect(artikelRows).toHaveLength(2);
  });

  // ---- Umsatzberechnung ----
  test('berechnet Gesamtumsatz korrekt', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10.50, positionen: [] },
      '222': { chatId: '222', userName: 'B', gesamtpreis: 5.25, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    expect(result.gesamtUmsatz).toBe(15.75);
  });

  test('rundet Gesamtumsatz auf 2 Dezimalstellen', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10.333, positionen: [] },
      '222': { chatId: '222', userName: 'B', gesamtpreis: 5.111, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    expect(result.gesamtUmsatz).toBe(15.44);
  });

  // ---- Excel-Zeilen-Struktur ----
  test('Excel enthält Header-Zeile mit "Yauno Bestellauswertung"', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '25.02.26');
    expect(result.rows[0].A).toBe('Yauno Bestellauswertung');
  });

  test('Excel enthält Lieferdatum', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '25.02.26');
    expect(result.rows[1].A).toContain('25.02.26');
  });

  test('Excel enthält ARTIKELÜBERSICHT-Sektion', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    const artikelHeader = result.rows.find(r => r.A === 'ARTIKELÜBERSICHT');
    expect(artikelHeader).toBeDefined();
  });

  test('Excel enthält EINZELBESTELLUNGEN-Sektion', () => {
    const bestellungen = {
      '111': { chatId: '111', userName: 'A', gesamtpreis: 10, positionen: [] }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    const einzelHeader = result.rows.find(r => r.A === 'EINZELBESTELLUNGEN');
    expect(einzelHeader).toBeDefined();
  });

  test('Artikel werden alphabetisch sortiert', () => {
    const bestellungen = {
      '111': {
        chatId: '111', userName: 'A', gesamtpreis: 20,
        positionen: [
          { artikelId: 1, name: 'Zwiebeln', einheit: '1kg', preis: 2, menge: 1, summe: 2 },
          { artikelId: 2, name: 'Äpfel', einheit: '1kg', preis: 3, menge: 1, summe: 3 }
        ]
      }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    const artikelRows = result.rows.filter(r =>
      r.A === 'Äpfel' || r.A === 'Zwiebeln'
    );
    // Äpfel should come before Zwiebeln alphabetically
    const aepfelIdx = result.rows.findIndex(r => r.A === 'Äpfel');
    const zwiebelnIdx = result.rows.findIndex(r => r.A === 'Zwiebeln');
    expect(aepfelIdx).toBeLessThan(zwiebelnIdx);
  });

  // ---- Fallback bei fehlender summe ----
  test('berechnet summe aus menge * preis wenn summe fehlt', () => {
    const bestellungen = {
      '111': {
        chatId: '111', userName: 'A', gesamtpreis: 9,
        positionen: [{ artikelId: 1, name: 'Tomaten', einheit: '1kg', preis: 4.5, menge: 2 }]
      }
    };
    const result = prepareAuswertung(bestellungen, [], '');
    const tomatenRow = result.rows.find(r => r.A === 'Tomaten');
    expect(tomatenRow.E).toBe(9);
  });
});

describe('WF04: Zeilen aufteilen', () => {
  test('konvertiert Array zu items mit json-Wrapper', () => {
    const rows = [{ A: 'a' }, { A: 'b' }];
    const result = splitRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ json: { A: 'a' } });
  });

  test('gibt leeres Array bei leerem Input', () => {
    expect(splitRows([])).toEqual([]);
  });
});
