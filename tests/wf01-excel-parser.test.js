const { parseExcelRows, loadKaeufer, getAdminArtikelData } = require('./lib/wf01-excel-parser');

describe('WF01: Excel Parser - Artikel extrahieren', () => {

  // ---- Date extraction ----
  describe('Datum-Erkennung', () => {
    test('erkennt Datum im Format DD.MM.YY', () => {
      const rows = [
        { A: '', B: 'Lieferung 18.02.26', C: '', D: '' },
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.datumMatch).toBe('18.02.26');
    });

    test('erkennt Datum im Format DD/MM/YYYY', () => {
      const rows = [
        { A: '', B: 'Lieferung 18/02/2026', C: '', D: '' },
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Gurke', C: 'Stück', D: '1.20' },
      ];
      const result = parseExcelRows(rows);
      expect(result.datumMatch).toBe('18/02/2026');
    });

    test('gibt null zurück wenn kein Datum vorhanden', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.datumMatch).toBeNull();
    });

    test('erkennt nur das erste Datum', () => {
      const rows = [
        { A: '', B: 'Datum 01.01.26', C: '', D: '' },
        { A: '', B: 'Zweites Datum 02.02.26', C: '', D: '' },
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.datumMatch).toBe('01.01.26');
    });
  });

  // ---- Header detection ----
  describe('Header-Erkennung', () => {
    test('beginnt Parsing erst nach Spaltenheader (Artikel + Preis)', () => {
      const rows = [
        { A: '', B: 'Nicht parsen', C: '', D: '99.99' },
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel).toHaveLength(1);
      expect(result.artikel[0].name).toBe('Tomaten');
    });

    test('ignoriert Zeilen ohne Header komplett', () => {
      const rows = [
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
        { A: '', B: 'Gurke', C: 'Stück', D: '1.20' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel).toHaveLength(0);
    });
  });

  // ---- End detection ----
  describe('Ende-Erkennung', () => {
    test('stoppt bei "Gesamt zu zahlen:"', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
        { A: '', B: 'Gesamt zu zahlen:', C: '', D: '' },
        { A: '', B: 'Sollte ignoriert werden', C: 'x', D: '1.00' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel).toHaveLength(1);
    });

    test('stoppt bei "Gesamtsumme"', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
        { A: '', B: 'Gesamtsumme', C: '', D: '100' },
        { A: '', B: 'Danach', C: 'x', D: '5.00' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel).toHaveLength(1);
    });
  });

  // ---- Category detection ----
  describe('Kategorie-Erkennung', () => {
    test('Standard-Kategorie ist "Allgemein"', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].kategorie).toBe('Allgemein');
    });

    test('wechselt zu "Tagesangebote" bei Tagesangebote-Zeile', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
        { A: '', B: 'Tagesangebote:', C: '', D: '' },
        { A: '', B: 'Baguette', C: 'Stück', D: '2.40' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].kategorie).toBe('Allgemein');
      expect(result.artikel[1].kategorie).toBe('Tagesangebote');
    });

    test('erkennt benutzerdefinierte Kategorien (Zeile endet mit ":")', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Obst:', C: '', D: '' },
        { A: '', B: 'Äpfel', C: '1kg', D: '3.20' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].kategorie).toBe('Obst');
    });
  });

  // ---- Price parsing ----
  describe('Preis-Parsing', () => {
    test('parst Dezimalpunkt-Preise', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].preis).toBe(4.50);
    });

    test('parst Komma-Dezimal-Preise', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4,50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].preis).toBe(4.50);
    });

    test('überspringt Zeilen mit Preis 0 oder ungültig', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Gratis', C: 'Stück', D: '0' },
        { A: '', B: 'Kaputt', C: 'Stück', D: 'abc' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel).toHaveLength(1);
      expect(result.artikel[0].name).toBe('Tomaten');
    });

    test('rundet Preise auf 2 Dezimalstellen', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.555' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].preis).toBe(4.56);
    });
  });

  // ---- Article structure ----
  describe('Artikel-Struktur', () => {
    test('erstellt korrekte Artikelobjekte', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Bio-Tomaten', C: 'ca 1kg', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0]).toEqual({
        id: 1,
        name: 'Bio-Tomaten',
        einheit: 'ca 1kg',
        preis: 4.50,
        kategorie: 'Allgemein'
      });
    });

    test('IDs zählen fortlaufend', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '1kg', D: '4.50' },
        { A: '', B: 'Gurke', C: 'Stück', D: '1.20' },
        { A: '', B: 'Paprika', C: '500g', D: '3.80' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel.map(a => a.id)).toEqual([1, 2, 3]);
    });

    test('setzt "Stück" als Standard-Einheit wenn keine angegeben', () => {
      const rows = [
        { A: '', B: 'Artikel', C: 'Einheit', D: 'Preis' },
        { A: '', B: 'Tomaten', C: '', D: '4.50' },
      ];
      const result = parseExcelRows(rows);
      expect(result.artikel[0].einheit).toBe('Stück');
    });
  });

  // ---- Full Excel simulation ----
  describe('Vollständige Excel-Simulation', () => {
    test('parst ein realistisches Excel-Format', () => {
      const rows = [
        { A: '', B: 'Yauno Lebensmittel', C: '', D: '' },
        { A: '', B: 'Kunde: Max', C: '', D: '' },
        { A: '', B: 'Lieferdatum: 25.02.26', C: '', D: '' },
        { A: '', B: '', C: '', D: '' },
        { A: 'Menge', B: 'Artikel', C: 'Einheit', D: 'Preis', E: 'Summe' },
        { A: '', B: 'Tomaten', C: 'ca 1kg', D: '4,50', E: '' },
        { A: '', B: 'Gurke', C: 'Stück', D: '1,20', E: '' },
        { A: '', B: 'Tagesangebote:', C: '', D: '' },
        { A: '', B: 'Baguette', C: 'Stück', D: '2,40', E: '' },
        { A: '', B: 'Gesamt zu zahlen:', C: '', D: '' },
      ];
      const result = parseExcelRows(rows);
      expect(result.datumMatch).toBe('25.02.26');
      expect(result.artikel).toHaveLength(3);
      expect(result.artikel[0]).toMatchObject({ name: 'Tomaten', kategorie: 'Allgemein' });
      expect(result.artikel[1]).toMatchObject({ name: 'Gurke', kategorie: 'Allgemein' });
      expect(result.artikel[2]).toMatchObject({ name: 'Baguette', kategorie: 'Tagesangebote' });
    });
  });
});

describe('WF01: Käufer laden', () => {
  test('gibt skip=true bei leerer Käufer-Liste', () => {
    const result = loadKaeufer({ kaeufer: [] });
    expect(result.skip).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  test('gibt skip=true bei fehlender Käufer-Liste', () => {
    const result = loadKaeufer({});
    expect(result.skip).toBe(true);
  });

  test('mappt Käufer-IDs zu Einzelitems', () => {
    const staticData = {
      kaeufer: [12345, 67890],
      angebot_datum: '25.02.26',
      artikel: [{ id: 1 }, { id: 2 }],
      webapp_url: 'https://example.com'
    };
    const result = loadKaeufer(staticData);
    expect(result.skip).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].chatId).toBe('12345');
    expect(result.items[0].artikelCount).toBe(2);
    expect(result.items[0].webapp_url).toBe('https://example.com');
  });
});

describe('WF01: Admin Artikeldaten', () => {
  test('gibt Standardwerte bei leerem Static Data', () => {
    const result = getAdminArtikelData({});
    expect(result.artikel).toEqual([]);
    expect(result.bestellung_aktiv).toBe(true);
    expect(result.angebot_datum).toBe('');
    expect(result.kaeufer).toEqual([]);
  });

  test('bestellung_aktiv ist true bei undefined', () => {
    const result = getAdminArtikelData({ bestellung_aktiv: undefined });
    expect(result.bestellung_aktiv).toBe(true);
  });

  test('bestellung_aktiv ist false nur bei explizit false', () => {
    const result = getAdminArtikelData({ bestellung_aktiv: false });
    expect(result.bestellung_aktiv).toBe(false);
  });
});
