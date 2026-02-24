const { generateToken, saveBestellung, getAdminBestelldaten, closeBestellungen } = require('./lib/wf03-bestellung');

describe('WF03: Token-Generierung', () => {
  test('Token beginnt mit "ord_"', () => {
    const token = generateToken();
    expect(token).toMatch(/^ord_/);
  });

  test('Token ist mindestens 15 Zeichen lang', () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(15);
  });

  test('jedes Token ist einzigartig', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('WF03: Bestellung speichern', () => {
  let staticData;

  beforeEach(() => {
    staticData = {
      bestellung_aktiv: true,
      bestellungen: {},
      tokens: {},
      kaeufer: []
    };
  });

  // ---- Validierung ----
  test('gibt 403 wenn Bestellfenster geschlossen', () => {
    staticData.bestellung_aktiv = false;
    const result = saveBestellung({ chatId: '123' }, staticData);
    expect(result.status).toBe(403);
    expect(result.error).toContain('geschlossen');
  });

  test('gibt 400 wenn Chat-ID fehlt', () => {
    const result = saveBestellung({}, staticData);
    expect(result.status).toBe(400);
    expect(result.error).toContain('Chat-ID');
  });

  test('gibt 400 wenn chatId null ist', () => {
    const result = saveBestellung({ chatId: null }, staticData);
    expect(result.status).toBe(400);
  });

  // ---- Erfolgreiche Bestellung ----
  test('speichert neue Bestellung erfolgreich', () => {
    const body = {
      chatId: '12345',
      userName: 'Max',
      positionen: [{ artikelId: 1, name: 'Tomaten', menge: 3, preis: 4.5, summe: 13.5 }],
      gesamtpreis: 13.5
    };
    const result = saveBestellung(body, staticData);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.token).toMatch(/^ord_/);
    expect(result.chatId).toBe('12345');
    expect(result.isUpdate).toBe(false);
  });

  test('speichert Bestellung in Static Data', () => {
    saveBestellung({ chatId: '12345', userName: 'Max' }, staticData);
    expect(staticData.bestellungen['12345']).toBeDefined();
    expect(staticData.bestellungen['12345'].userName).toBe('Max');
  });

  test('Token wird in tokens-Map gespeichert', () => {
    const result = saveBestellung({ chatId: '12345' }, staticData);
    expect(staticData.tokens[result.token]).toBe('12345');
  });

  // ---- Token-Wiederverwendung ----
  test('generiert neuen Token bei Erstbestellung', () => {
    const result = saveBestellung({ chatId: '12345' }, staticData);
    expect(result.token).toMatch(/^ord_/);
    expect(result.isUpdate).toBe(false);
  });

  test('verwendet bestehenden Token bei Update', () => {
    // Erste Bestellung
    const first = saveBestellung({ chatId: '12345' }, staticData);
    const existingToken = first.token;

    // Update mit bestehendem Token
    const result = saveBestellung({ chatId: '12345', token: existingToken }, staticData);
    expect(result.token).toBe(existingToken);
    expect(result.isUpdate).toBe(true);
  });

  test('generiert neuen Token wenn übergebener Token ungültig ist', () => {
    const result = saveBestellung({ chatId: '12345', token: 'invalid_token' }, staticData);
    expect(result.token).not.toBe('invalid_token');
    expect(result.token).toMatch(/^ord_/);
  });

  test('[BUG-FIX] isUpdate ist false bei ungültigem Token', () => {
    // Regression: !!body.token war true auch bei ungültigem Token
    const result = saveBestellung({ chatId: '12345', token: 'fake_token_123' }, staticData);
    expect(result.isUpdate).toBe(false);
  });

  test('[BUG-FIX] isUpdate ist true nur bei gültigem Token', () => {
    // Erste Bestellung → Token generieren
    const first = saveBestellung({ chatId: '12345' }, staticData);
    // Update mit gültigem Token
    const update = saveBestellung({ chatId: '12345', token: first.token }, staticData);
    expect(update.isUpdate).toBe(true);
  });

  // ---- Käufer-Registrierung ----
  test('registriert neuen Käufer automatisch', () => {
    saveBestellung({ chatId: '12345' }, staticData);
    expect(staticData.kaeufer).toContain('12345');
  });

  test('registriert Käufer nicht doppelt', () => {
    staticData.kaeufer = ['12345'];
    saveBestellung({ chatId: '12345' }, staticData);
    expect(staticData.kaeufer.filter(k => k === '12345')).toHaveLength(1);
  });

  test('speichert chatId als String in Käufer-Liste', () => {
    saveBestellung({ chatId: 12345 }, staticData);
    expect(staticData.kaeufer).toContain('12345');
    expect(typeof staticData.kaeufer[0]).toBe('string');
  });

  // ---- Mengenwarnung ----
  test('setzt highQtyWarning bei >50 Einheiten', () => {
    const body = {
      chatId: '12345',
      positionen: [
        { artikelId: 1, name: 'Tomaten', menge: 51, preis: 4.5 }
      ]
    };
    const result = saveBestellung(body, staticData);
    expect(result.highQtyWarning).toBe(true);
    expect(result.highQtyItems).toContain('Tomaten (51x)');
  });

  test('keine Warnung bei genau 50 Einheiten', () => {
    const body = {
      chatId: '12345',
      positionen: [
        { artikelId: 1, name: 'Tomaten', menge: 50, preis: 4.5 }
      ]
    };
    const result = saveBestellung(body, staticData);
    expect(result.highQtyWarning).toBe(false);
  });

  test('keine Warnung bei normalen Mengen', () => {
    const body = {
      chatId: '12345',
      positionen: [
        { artikelId: 1, name: 'Tomaten', menge: 5, preis: 4.5 },
        { artikelId: 2, name: 'Gurke', menge: 10, preis: 1.2 }
      ]
    };
    const result = saveBestellung(body, staticData);
    expect(result.highQtyWarning).toBe(false);
    expect(result.highQtyItems).toBe('');
  });

  // ---- Standardwerte ----
  test('setzt "Unbekannt" als Standard-Username', () => {
    saveBestellung({ chatId: '12345' }, staticData);
    expect(staticData.bestellungen['12345'].userName).toBe('Unbekannt');
  });

  test('setzt leeres Array als Standard-Positionen', () => {
    saveBestellung({ chatId: '12345' }, staticData);
    expect(staticData.bestellungen['12345'].positionen).toEqual([]);
  });
});

describe('WF03: Admin Bestelldaten', () => {
  test('gibt Standardwerte bei leerem Static Data', () => {
    const result = getAdminBestelldaten({});
    expect(result.bestellungen).toEqual({});
    expect(result.tokens).toEqual({});
    expect(result.kaeufer).toEqual([]);
    expect(result.bestellung_aktiv).toBe(true);
  });

  test('gibt vorhandene Daten korrekt zurück', () => {
    const staticData = {
      bestellungen: { '123': { chatId: '123' } },
      tokens: { 'tok_abc': '123' },
      kaeufer: ['123'],
      bestellung_aktiv: false
    };
    const result = getAdminBestelldaten(staticData);
    expect(result.bestellungen).toHaveProperty('123');
    expect(result.bestellung_aktiv).toBe(false);
  });
});

describe('WF03: Bestellungen schließen', () => {
  test('löscht Bestellungen und Tokens', () => {
    const staticData = {
      bestellungen: { '123': {} },
      tokens: { 'tok': '123' },
      bestellung_aktiv: true,
      kaeufer: ['123']
    };
    const result = closeBestellungen(staticData);
    expect(result.success).toBe(true);
    expect(staticData.bestellungen).toEqual({});
    expect(staticData.tokens).toEqual({});
    expect(staticData.bestellung_aktiv).toBe(false);
  });

  test('behält Käufer-Liste bei', () => {
    const staticData = {
      bestellungen: {},
      tokens: {},
      bestellung_aktiv: true,
      kaeufer: ['123', '456']
    };
    closeBestellungen(staticData);
    expect(staticData.kaeufer).toEqual(['123', '456']);
  });
});
