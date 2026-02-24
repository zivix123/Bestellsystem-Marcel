const { getOrderByToken } = require('./lib/wf05-get-order');

describe('WF05: Bestellung per Token laden', () => {

  const sampleOrderData = {
    tokens: { 'ord_abc123': '12345' },
    bestellungen: {
      '12345': {
        chatId: '12345',
        userName: 'Max',
        positionen: [
          { artikelId: 1, name: 'Tomaten', menge: 3, preis: 4.5, summe: 13.5 }
        ],
        gesamtpreis: 13.5,
        token: 'ord_abc123',
        zeitpunkt: '2026-02-24T10:00:00Z'
      }
    }
  };

  // ---- Token-Validierung ----
  test('gibt 400 wenn Token-Parameter fehlt', () => {
    const result = getOrderByToken({}, sampleOrderData);
    expect(result.code).toBe(400);
    expect(result.error).toContain('Token');
  });

  test('gibt 400 bei leerem Token', () => {
    const result = getOrderByToken({ token: '' }, sampleOrderData);
    expect(result.code).toBe(400);
  });

  test('gibt 404 bei ungültigem Token', () => {
    const result = getOrderByToken({ token: 'invalid_token' }, sampleOrderData);
    expect(result.code).toBe(404);
    expect(result.error).toContain('Ungültiger');
  });

  // ---- Erfolgreicher Abruf ----
  test('gibt Bestellung bei gültigem Token zurück', () => {
    const result = getOrderByToken({ token: 'ord_abc123' }, sampleOrderData);
    expect(result.code).toBe(200);
    expect(result.chatId).toBe('12345');
    expect(result.userName).toBe('Max');
    expect(result.gesamtpreis).toBe(13.5);
    expect(result.token).toBe('ord_abc123');
  });

  test('gibt Positionen korrekt zurück', () => {
    const result = getOrderByToken({ token: 'ord_abc123' }, sampleOrderData);
    expect(result.positionen).toHaveLength(1);
    expect(result.positionen[0].name).toBe('Tomaten');
    expect(result.positionen[0].menge).toBe(3);
  });

  test('gibt Zeitpunkt zurück', () => {
    const result = getOrderByToken({ token: 'ord_abc123' }, sampleOrderData);
    expect(result.zeitpunkt).toBe('2026-02-24T10:00:00Z');
  });

  // ---- Edge Cases ----
  test('gibt 404 wenn Token existiert aber Bestellung fehlt', () => {
    const orderData = {
      tokens: { 'ord_orphan': '99999' },
      bestellungen: {}
    };
    const result = getOrderByToken({ token: 'ord_orphan' }, orderData);
    expect(result.code).toBe(404);
    expect(result.error).toContain('nicht gefunden');
  });

  test('funktioniert mit leerem orderData', () => {
    const result = getOrderByToken({ token: 'test' }, {});
    expect(result.code).toBe(404);
  });
});
