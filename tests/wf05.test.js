/**
 * Tests für WF05 – "Bestellung per Token laden"
 * (Code-Node aus workflow_05_get_order.json)
 */
const { runN8nCode } = require('./helpers/n8n-mock');

// JS-Code direkt aus dem workflow_05_get_order.json Code-Node
const GET_ORDER_CODE = `
const query = $('Webhook GET Bestellung').first().json.query || {};
const token = query.token;

if (!token) {
  return [{ json: {
    error: 'Token parameter fehlt',
    code: 400
  }}];
}

const orderData = $('Bestellungen von WF03 laden').first().json;
const tokens = orderData.tokens || {};
const chatId = tokens[token];

if (!chatId) {
  return [{ json: {
    error: 'Ungültiger oder abgelaufener Token',
    code: 404
  }}];
}

const bestellungen = orderData.bestellungen || {};
const bestellung = bestellungen[chatId];

if (!bestellung) {
  return [{ json: {
    error: 'Bestellung nicht gefunden',
    code: 404
  }}];
}

return [{ json: {
  chatId: bestellung.chatId,
  userName: bestellung.userName,
  positionen: bestellung.positionen,
  gesamtpreis: bestellung.gesamtpreis,
  token: token,
  zeitpunkt: bestellung.zeitpunkt,
  code: 200
}}];
`;

// ============================================================
// Hilfsfunktion
// ============================================================
function run(token, { tokens = {}, bestellungen = {} } = {}) {
  return runN8nCode(GET_ORDER_CODE, {
    nodeOutputs: {
      'Webhook GET Bestellung': { query: token ? { token } : {} },
      'Bestellungen von WF03 laden': { tokens, bestellungen }
    }
  });
}

const MOCK_BESTELLUNG = {
  chatId: '12345',
  userName: 'Max Mustermann',
  positionen: [
    { artikelId: 1, name: 'Bio-Tomaten', einheit: 'ca 1kg', preis: 4.50, menge: 2, summe: 9.00 }
  ],
  gesamtpreis: 9.00,
  token: 'ord_validtoken123',
  zeitpunkt: '2026-02-24T10:00:00.000Z'
};

// ============================================================
// Fehlerfälle
// ============================================================
describe('WF05 – Fehlerfälle', () => {
  test('400 wenn Token-Parameter komplett fehlt', () => {
    const result = run(null);
    expect(result[0].json.code).toBe(400);
    expect(result[0].json.error).toBe('Token parameter fehlt');
  });

  test('400 wenn Token leerer String ist', () => {
    const result = run('');
    expect(result[0].json.code).toBe(400);
  });

  test('404 bei unbekanntem Token', () => {
    const result = run('ungueltig_xyz', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: { '12345': MOCK_BESTELLUNG }
    });
    expect(result[0].json.code).toBe(404);
    expect(result[0].json.error).toBe('Ungültiger oder abgelaufener Token');
  });

  test('404 wenn Token bekannt aber Bestellung nicht vorhanden', () => {
    const result = run('ord_validtoken123', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: {} // keine Bestellungen
    });
    expect(result[0].json.code).toBe(404);
    expect(result[0].json.error).toBe('Bestellung nicht gefunden');
  });

  test('404 wenn Tokens leer (nach Bestellschluss)', () => {
    const result = run('ord_validtoken123', {
      tokens: {},
      bestellungen: {}
    });
    expect(result[0].json.code).toBe(404);
  });
});

// ============================================================
// Erfolgsfälle
// ============================================================
describe('WF05 – Erfolgsfälle', () => {
  test('200 und korrekte Bestelldaten bei gültigem Token', () => {
    const result = run('ord_validtoken123', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: { '12345': MOCK_BESTELLUNG }
    });
    expect(result[0].json.code).toBe(200);
    expect(result[0].json.chatId).toBe('12345');
    expect(result[0].json.userName).toBe('Max Mustermann');
    expect(result[0].json.gesamtpreis).toBe(9.00);
  });

  test('Alle Positionen werden zurückgegeben', () => {
    const bestellung = {
      ...MOCK_BESTELLUNG,
      positionen: [
        { artikelId: 1, name: 'Tomaten', menge: 2, preis: 4.50, summe: 9.00 },
        { artikelId: 2, name: 'Gurke', menge: 3, preis: 1.20, summe: 3.60 }
      ],
      gesamtpreis: 12.60
    };
    const result = run('ord_validtoken123', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: { '12345': bestellung }
    });
    expect(result[0].json.positionen).toHaveLength(2);
    expect(result[0].json.gesamtpreis).toBe(12.60);
  });

  test('Token wird in der Antwort zurückgegeben', () => {
    const result = run('ord_validtoken123', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: { '12345': MOCK_BESTELLUNG }
    });
    expect(result[0].json.token).toBe('ord_validtoken123');
  });

  test('Zeitpunkt wird korrekt zurückgegeben', () => {
    const result = run('ord_validtoken123', {
      tokens: { 'ord_validtoken123': '12345' },
      bestellungen: { '12345': MOCK_BESTELLUNG }
    });
    expect(result[0].json.zeitpunkt).toBe('2026-02-24T10:00:00.000Z');
  });

  test('Verschiedene Token für verschiedene Käufer geben jeweils die richtige Bestellung zurück', () => {
    const tokens = {
      'ord_token_max': '111',
      'ord_token_lisa': '222'
    };
    const bestellungen = {
      '111': { ...MOCK_BESTELLUNG, chatId: '111', userName: 'Max', gesamtpreis: 5.00, positionen: [] },
      '222': { ...MOCK_BESTELLUNG, chatId: '222', userName: 'Lisa', gesamtpreis: 8.00, positionen: [] }
    };

    const resultMax = run('ord_token_max', { tokens, bestellungen });
    expect(resultMax[0].json.userName).toBe('Max');
    expect(resultMax[0].json.gesamtpreis).toBe(5.00);

    const resultLisa = run('ord_token_lisa', { tokens, bestellungen });
    expect(resultLisa[0].json.userName).toBe('Lisa');
    expect(resultLisa[0].json.gesamtpreis).toBe(8.00);
  });
});
