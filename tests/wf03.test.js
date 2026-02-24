/**
 * Tests für WF03 – "Bestellung speichern"
 * (Code-Node aus workflow_03_bestellung_v2.json)
 */
const { runN8nCode } = require('./helpers/n8n-mock');

// JS-Code direkt aus dem workflow_03_bestellung_v2.json Code-Node
const SAVE_ORDER_CODE = `
const body = $input.first().json.body || $input.first().json;
const staticData = $getWorkflowStaticData('global');

if (staticData.bestellung_aktiv === false) {
  return [{ json: { error: 'Bestellfenster geschlossen', status: 403 } }];
}

const chatId = body.chatId;
if (!chatId) {
  return [{ json: { error: 'Chat-ID fehlt', status: 400 } }];
}

let token = body.token;
const bestellungen = staticData.bestellungen || {};
const tokens = staticData.tokens || {};

if (!token || !tokens[token]) {
  token = 'ord_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

bestellungen[chatId] = {
  chatId: chatId,
  userName: body.userName || 'Unbekannt',
  positionen: body.positionen || [],
  gesamtpreis: body.gesamtpreis || 0,
  token: token,
  zeitpunkt: body.zeitpunkt || new Date().toISOString(),
  aktualisiert: new Date().toISOString()
};

tokens[token] = chatId;

const kaeufer = staticData.kaeufer || [];
if (!kaeufer.includes(String(chatId))) {
  kaeufer.push(String(chatId));
}

staticData.bestellungen = bestellungen;
staticData.tokens = tokens;
staticData.kaeufer = kaeufer;

const isUpdate = !!body.token;

const highQtyItems = (body.positionen || []).filter(p => p.menge > 50);

return [{ json: {
  success: true,
  token: token,
  chatId: String(chatId),
  userName: body.userName,
  gesamtpreis: body.gesamtpreis,
  isUpdate: isUpdate,
  highQtyWarning: highQtyItems.length > 0,
  highQtyItems: highQtyItems.map(p => p.name + ' (' + p.menge + 'x)').join(', '),
  webapp_url: staticData.webapp_url || 'https://jade-alfajores-4f3440.netlify.app',
  status: 200
}}];
`;

// ============================================================
// Hilfsfunktion
// ============================================================
function run(inputJson, staticData) {
  return runN8nCode(SAVE_ORDER_CODE, { inputJson, staticData });
}

function freshStaticData() {
  return { bestellung_aktiv: true, bestellungen: {}, tokens: {}, kaeufer: [] };
}

// ============================================================
// Fehlerfälle
// ============================================================
describe('WF03 – Fehlerfälle', () => {
  test('403 wenn Bestellfenster geschlossen (bestellung_aktiv = false)', () => {
    const sd = freshStaticData();
    sd.bestellung_aktiv = false;
    const result = run({ chatId: '123' }, sd);
    expect(result[0].json.status).toBe(403);
    expect(result[0].json.error).toBe('Bestellfenster geschlossen');
  });

  test('400 wenn chatId fehlt', () => {
    const result = run({}, freshStaticData());
    expect(result[0].json.status).toBe(400);
    expect(result[0].json.error).toBe('Chat-ID fehlt');
  });

  test('400 wenn chatId null ist', () => {
    const result = run({ chatId: null }, freshStaticData());
    expect(result[0].json.status).toBe(400);
  });
});

// ============================================================
// Neue Bestellung
// ============================================================
describe('WF03 – Neue Bestellung', () => {
  test('Erfolgreiche Bestellung gibt success: true zurück', () => {
    const result = run(
      { chatId: '12345', userName: 'Max', positionen: [], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.success).toBe(true);
    expect(result[0].json.status).toBe(200);
  });

  test('Token wird generiert und beginnt mit "ord_"', () => {
    const result = run(
      { chatId: '12345', userName: 'Max', positionen: [], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.token).toMatch(/^ord_/);
  });

  test('isUpdate ist false bei neuer Bestellung (kein Token mitgeschickt)', () => {
    const result = run(
      { chatId: '12345', userName: 'Max', positionen: [], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.isUpdate).toBe(false);
  });

  test('Bestellung wird in staticData.bestellungen gespeichert', () => {
    const sd = freshStaticData();
    run({ chatId: '99', userName: 'Erika', positionen: [], gesamtpreis: 5.00 }, sd);
    expect(sd.bestellungen['99']).toBeDefined();
    expect(sd.bestellungen['99'].userName).toBe('Erika');
    expect(sd.bestellungen['99'].gesamtpreis).toBe(5.00);
  });

  test('Token → chatId Mapping wird in staticData.tokens gespeichert', () => {
    const sd = freshStaticData();
    const result = run({ chatId: '42', userName: 'Klaus', positionen: [], gesamtpreis: 0 }, sd);
    const token = result[0].json.token;
    expect(sd.tokens[token]).toBe('42');
  });

  test('userName "Unbekannt" wenn nicht mitgeschickt', () => {
    const sd = freshStaticData();
    run({ chatId: '77' }, sd);
    expect(sd.bestellungen['77'].userName).toBe('Unbekannt');
  });
});

// ============================================================
// Bestellung aktualisieren (Edit-Modus)
// ============================================================
describe('WF03 – Bestellung aktualisieren', () => {
  test('isUpdate ist true wenn bekannter Token mitgeschickt wird', () => {
    const sd = freshStaticData();
    const existingToken = 'ord_existingtoken123';
    sd.tokens[existingToken] = '777';
    sd.bestellungen['777'] = { chatId: '777', userName: 'Lisa', positionen: [], gesamtpreis: 0, token: existingToken };

    const result = run(
      { chatId: '777', userName: 'Lisa', token: existingToken, positionen: [], gesamtpreis: 2.50 },
      sd
    );
    expect(result[0].json.isUpdate).toBe(true);
    expect(result[0].json.token).toBe(existingToken);
  });

  test('Unbekannter Token → neuer Token wird generiert (neuer ord_-Token)', () => {
    const sd = freshStaticData();
    const result = run(
      { chatId: '888', userName: 'Bob', token: 'token_existiert_nicht', positionen: [], gesamtpreis: 0 },
      sd
    );
    expect(result[0].json.token).toMatch(/^ord_/);
  });

  // BUG-DOKUMENTATION: isUpdate basiert nur auf !!body.token, nicht auf Token-Gültigkeit.
  // Wenn ein ungültiger Token gesendet wird, meldet WF03 dem Käufer "Bestellung aktualisiert"
  // obwohl in Wirklichkeit eine neue Bestellung angelegt wurde.
  test('[BUG] isUpdate ist true auch bei ungültigem Token (da nur body.token geprüft wird)', () => {
    const sd = freshStaticData();
    const result = run(
      { chatId: '888', userName: 'Bob', token: 'token_existiert_nicht', positionen: [], gesamtpreis: 0 },
      sd
    );
    // Aktuelles Verhalten (Bug): isUpdate = true weil body.token gesetzt ist
    expect(result[0].json.isUpdate).toBe(true);
    // Korrektes Verhalten wäre: isUpdate = false (Token war ungültig → neue Bestellung)
  });

  test('Zweite Bestellung desselben Käufers überschreibt die erste', () => {
    const sd = freshStaticData();
    run({ chatId: '55', userName: 'Tina', positionen: [], gesamtpreis: 3.00 }, sd);
    run({ chatId: '55', userName: 'Tina', positionen: [], gesamtpreis: 7.00 }, sd);
    expect(sd.bestellungen['55'].gesamtpreis).toBe(7.00);
  });
});

// ============================================================
// Käufer-Registrierung
// ============================================================
describe('WF03 – Käufer-Registrierung', () => {
  test('Neuer Käufer wird in kaeufer[] eingetragen', () => {
    const sd = freshStaticData();
    run({ chatId: '1001', userName: 'Neu', positionen: [], gesamtpreis: 0 }, sd);
    expect(sd.kaeufer).toContain('1001');
  });

  test('Bestehender Käufer wird nicht doppelt eingetragen', () => {
    const sd = freshStaticData();
    sd.kaeufer = ['1001'];
    run({ chatId: '1001', userName: 'Wieder', positionen: [], gesamtpreis: 0 }, sd);
    expect(sd.kaeufer.filter(id => id === '1001')).toHaveLength(1);
  });

  test('Numerische chatId wird als String gespeichert', () => {
    const sd = freshStaticData();
    run({ chatId: 12345, userName: 'Test', positionen: [], gesamtpreis: 0 }, sd);
    expect(sd.kaeufer).toContain('12345');
  });
});

// ============================================================
// Mengenwarnung
// ============================================================
describe('WF03 – Mengenwarnung (>50 Einheiten)', () => {
  test('Keine Warnung bei Menge genau 50', () => {
    const result = run(
      { chatId: '200', positionen: [{ name: 'Tomaten', menge: 50 }], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.highQtyWarning).toBe(false);
  });

  test('Warnung bei Menge 51', () => {
    const result = run(
      { chatId: '201', positionen: [{ name: 'Tomaten', menge: 51 }], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.highQtyWarning).toBe(true);
    expect(result[0].json.highQtyItems).toContain('Tomaten');
  });

  test('Mehrere Artikel mit hoher Menge werden alle gemeldet', () => {
    const result = run(
      {
        chatId: '202',
        positionen: [
          { name: 'Tomaten', menge: 100 },
          { name: 'Karotten', menge: 200 },
          { name: 'Gurke', menge: 1 }
        ],
        gesamtpreis: 0
      },
      freshStaticData()
    );
    expect(result[0].json.highQtyWarning).toBe(true);
    expect(result[0].json.highQtyItems).toContain('Tomaten');
    expect(result[0].json.highQtyItems).toContain('Karotten');
    expect(result[0].json.highQtyItems).not.toContain('Gurke');
  });

  test('Keine Warnung bei leeren Positionen', () => {
    const result = run(
      { chatId: '203', positionen: [], gesamtpreis: 0 },
      freshStaticData()
    );
    expect(result[0].json.highQtyWarning).toBe(false);
  });
});
