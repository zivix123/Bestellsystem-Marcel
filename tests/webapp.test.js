const {
  formatCurrency,
  calculateFooter,
  buildPositionen,
  clampQty,
  getButtonText,
  isButtonDisabled,
  extractCategories,
  filterArticles
} = require('./lib/webapp-logic');

const SAMPLE_ARTIKEL = [
  { id: 1, name: 'Bio-Tomaten', einheit: 'ca 1kg', preis: 4.50, kategorie: 'Gemüse' },
  { id: 2, name: 'Gurke', einheit: 'Stück', preis: 1.20, kategorie: 'Gemüse' },
  { id: 3, name: 'Äpfel Elstar', einheit: 'ca 1kg', preis: 3.20, kategorie: 'Obst' },
  { id: 4, name: 'Baguette', einheit: 'Stück', preis: 2.40, kategorie: 'Tagesangebote' },
];

describe('WebApp: formatCurrency', () => {
  test('formatiert ganzzahlige Beträge', () => {
    expect(formatCurrency(10)).toBe('€10,00');
  });

  test('formatiert Dezimalbeträge', () => {
    expect(formatCurrency(4.50)).toBe('€4,50');
  });

  test('formatiert Null', () => {
    expect(formatCurrency(0)).toBe('€0,00');
  });

  test('verwendet Komma als Dezimaltrennzeichen', () => {
    expect(formatCurrency(1234.56)).toBe('€1234,56');
  });
});

describe('WebApp: calculateFooter', () => {
  test('berechnet Gesamtmenge und Preis', () => {
    const mengen = { 1: 2, 2: 3 };
    const result = calculateFooter(mengen, SAMPLE_ARTIKEL);
    expect(result.totalItems).toBe(5);
    expect(result.totalPrice).toBeCloseTo(2 * 4.50 + 3 * 1.20, 2);
  });

  test('gibt 0 bei leeren Mengen', () => {
    const result = calculateFooter({}, SAMPLE_ARTIKEL);
    expect(result.totalItems).toBe(0);
    expect(result.totalPrice).toBe(0);
  });

  test('ignoriert Artikel-IDs die nicht existieren', () => {
    const mengen = { 999: 5 };
    const result = calculateFooter(mengen, SAMPLE_ARTIKEL);
    expect(result.totalItems).toBe(0);
    expect(result.totalPrice).toBe(0);
  });

  test('ignoriert Mengen von 0', () => {
    const mengen = { 1: 0, 2: 3 };
    const result = calculateFooter(mengen, SAMPLE_ARTIKEL);
    expect(result.totalItems).toBe(3);
  });
});

describe('WebApp: buildPositionen', () => {
  test('erstellt Positionen-Array aus Mengen', () => {
    const mengen = { 1: 2 };
    const result = buildPositionen(mengen, SAMPLE_ARTIKEL);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      artikelId: 1,
      name: 'Bio-Tomaten',
      einheit: 'ca 1kg',
      preis: 4.50,
      menge: 2,
      summe: 9.00
    });
  });

  test('filtert Mengen von 0 heraus', () => {
    const mengen = { 1: 0, 2: 3 };
    const result = buildPositionen(mengen, SAMPLE_ARTIKEL);
    expect(result).toHaveLength(1);
    expect(result[0].artikelId).toBe(2);
  });

  test('berechnet Summe pro Position', () => {
    const mengen = { 3: 5 };
    const result = buildPositionen(mengen, SAMPLE_ARTIKEL);
    expect(result[0].summe).toBe(16.00);
  });
});

describe('WebApp: clampQty', () => {
  test('begrenzt auf Minimum 0', () => {
    expect(clampQty(-5)).toBe(0);
  });

  test('begrenzt auf Maximum 99', () => {
    expect(clampQty(150)).toBe(99);
  });

  test('akzeptiert Werte im Bereich', () => {
    expect(clampQty(42)).toBe(42);
  });

  test('konvertiert String zu Zahl', () => {
    expect(clampQty('15')).toBe(15);
  });

  test('gibt 0 bei ungültigem Input', () => {
    expect(clampQty('abc')).toBe(0);
    expect(clampQty(NaN)).toBe(0);
    expect(clampQty(undefined)).toBe(0);
  });
});

describe('WebApp: getButtonText', () => {
  test('zeigt "Bestellung absenden" bei Artikeln ohne Token', () => {
    expect(getButtonText(null, 3, false)).toBe('Bestellung absenden');
  });

  test('zeigt "Wähle Artikel aus" ohne Artikel und ohne Token', () => {
    expect(getButtonText(null, 0, false)).toBe('Wähle Artikel aus');
  });

  test('zeigt "Bestellung aktualisieren" im Edit-Modus mit Artikeln', () => {
    expect(getButtonText('tok_abc', 3, false)).toBe('Bestellung aktualisieren');
  });

  test('zeigt "Keine Artikel gewählt" im Edit-Modus ohne Artikel', () => {
    expect(getButtonText('tok_abc', 0, false)).toBe('Keine Artikel gewählt');
  });
});

describe('WebApp: isButtonDisabled', () => {
  test('deaktiviert bei 0 Artikeln', () => {
    expect(isButtonDisabled(0, false)).toBe(true);
  });

  test('deaktiviert im Offline-Modus', () => {
    expect(isButtonDisabled(5, true)).toBe(true);
  });

  test('aktiviert bei Artikeln und Online', () => {
    expect(isButtonDisabled(3, false)).toBe(false);
  });
});

describe('WebApp: extractCategories', () => {
  test('extrahiert einzigartige Kategorien', () => {
    const cats = extractCategories(SAMPLE_ARTIKEL);
    expect(cats).toContain('Gemüse');
    expect(cats).toContain('Obst');
    expect(cats).toContain('Tagesangebote');
    expect(cats).toHaveLength(3);
  });

  test('gibt leeres Array bei leerer Artikelliste', () => {
    expect(extractCategories([])).toEqual([]);
  });
});

describe('WebApp: filterArticles', () => {
  test('gibt alle Artikel bei Kategorie "all" und leerem Suchbegriff', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, '', 'all');
    expect(result).toHaveLength(4);
  });

  test('filtert nach Kategorie', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, '', 'Gemüse');
    expect(result).toHaveLength(2);
    expect(result.every(a => a.kategorie === 'Gemüse')).toBe(true);
  });

  test('filtert nach Suchbegriff (case-insensitive)', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, 'tomaten', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bio-Tomaten');
  });

  test('kombiniert Kategorie- und Suchfilter', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, 'gurke', 'Gemüse');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Gurke');
  });

  test('gibt leeres Array wenn nichts passt', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, 'xyz', 'all');
    expect(result).toHaveLength(0);
  });

  test('Suchbegriff mit Leerzeichen wird getrimmt', () => {
    const result = filterArticles(SAMPLE_ARTIKEL, '  tomaten  ', 'all');
    expect(result).toHaveLength(1);
  });
});
