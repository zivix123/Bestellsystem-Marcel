/**
 * Tests für die WebApp-Logik (webapp/index.html)
 *
 * Die reinen Logikfunktionen werden hier isoliert getestet,
 * ohne DOM-Abhängigkeiten.
 */

// ============================================================
// Extrahierte reine Funktionen aus webapp/index.html
// (identisch mit dem Original – nicht verändert)
// ============================================================

function formatCurrency(val) {
  return '€' + val.toFixed(2).replace('.', ',');
}

function changeQty(id, delta, mengen, isOffline) {
  if (isOffline) return { blocked: true };
  const current = mengen[id] || 0;
  const newQty = Math.max(0, Math.min(99, current + delta));
  return { qty: newQty };
}

function setQty(value, isOffline) {
  if (isOffline) return { blocked: true };
  return { qty: Math.max(0, Math.min(99, parseInt(value) || 0)) };
}

// updateFooter-Logik (ohne DOM)
function calculateFooter(mengen, artikel) {
  let totalItems = 0;
  let totalPrice = 0;
  Object.entries(mengen).forEach(([id, qty]) => {
    const art = artikel.find(a => a.id == id);
    if (art && qty > 0) {
      totalItems += qty;
      totalPrice += qty * art.preis;
    }
  });
  return { totalItems, totalPrice: +totalPrice.toFixed(2) };
}

// submitOrder Payload-Aufbau (ohne fetch/DOM)
function buildPayload(chatId, userName, mengen, artikel, editToken) {
  const positionen = Object.entries(mengen)
    .filter(([_, qty]) => qty > 0)
    .map(([id, menge]) => {
      const art = artikel.find(a => a.id == id);
      return {
        artikelId: parseInt(id),
        name: art.name,
        einheit: art.einheit,
        preis: art.preis,
        menge: menge,
        summe: +(menge * art.preis).toFixed(2)
      };
    });
  const gesamtpreis = +(positionen.reduce((s, p) => s + p.summe, 0)).toFixed(2);
  return {
    chatId,
    userName,
    token: editToken,
    positionen,
    gesamtpreis,
    zeitpunkt: new Date().toISOString()
  };
}

// ============================================================
// Test-Artikeldaten
// ============================================================
const ARTIKEL = [
  { id: 1, name: 'Bio-Tomaten', einheit: 'ca 1kg', preis: 4.50, kategorie: 'Gemüse' },
  { id: 2, name: 'Gurke', einheit: 'Stück', preis: 1.20, kategorie: 'Gemüse' },
  { id: 3, name: 'Äpfel Elstar', einheit: 'ca 1kg', preis: 3.20, kategorie: 'Obst' },
];

// ============================================================
// formatCurrency
// ============================================================
describe('formatCurrency', () => {
  test('0 → €0,00', () => expect(formatCurrency(0)).toBe('€0,00'));
  test('4.5 → €4,50', () => expect(formatCurrency(4.5)).toBe('€4,50'));
  test('10 → €10,00', () => expect(formatCurrency(10)).toBe('€10,00'));
  test('1.99 → €1,99', () => expect(formatCurrency(1.99)).toBe('€1,99'));
  test('Nutzt Komma statt Punkt als Dezimaltrennzeichen', () => {
    expect(formatCurrency(3.5)).toContain(',');
    expect(formatCurrency(3.5)).not.toContain('.');
  });
  test('Beginnt immer mit €', () => {
    expect(formatCurrency(5)).toMatch(/^€/);
  });
});

// ============================================================
// Mengenlogik – changeQty (Plus/Minus-Buttons)
// ============================================================
describe('changeQty – Plus/Minus-Buttons', () => {
  test('Plus erhöht Menge um 1', () => {
    expect(changeQty(1, +1, { 1: 3 }, false).qty).toBe(4);
  });

  test('Minus verringert Menge um 1', () => {
    expect(changeQty(1, -1, { 1: 3 }, false).qty).toBe(2);
  });

  test('Menge kann nicht unter 0 fallen', () => {
    expect(changeQty(1, -1, { 1: 0 }, false).qty).toBe(0);
  });

  test('Menge kann nicht über 99 steigen', () => {
    expect(changeQty(1, +1, { 1: 99 }, false).qty).toBe(99);
  });

  test('Artikel ohne bisherige Menge startet bei 0, Plus ergibt 1', () => {
    expect(changeQty(1, +1, {}, false).qty).toBe(1);
  });

  test('Artikel ohne bisherige Menge bleibt bei Minus auf 0', () => {
    expect(changeQty(1, -1, {}, false).qty).toBe(0);
  });

  test('Blockiert wenn Bestellfenster geschlossen', () => {
    expect(changeQty(1, +1, {}, true)).toEqual({ blocked: true });
  });
});

// ============================================================
// Mengenlogik – setQty (Direkteingabe)
// ============================================================
describe('setQty – Direkteingabe', () => {
  test('Gültige Zahl wird übernommen', () => {
    expect(setQty('5', false).qty).toBe(5);
  });

  test('Buchstaben werden zu 0 konvertiert', () => {
    expect(setQty('abc', false).qty).toBe(0);
  });

  test('Leere Eingabe wird zu 0', () => {
    expect(setQty('', false).qty).toBe(0);
  });

  test('Negative Zahl wird auf 0 geclippt', () => {
    expect(setQty('-5', false).qty).toBe(0);
  });

  test('Zahl über 99 wird auf 99 geclippt', () => {
    expect(setQty('200', false).qty).toBe(99);
  });

  test('Genau 99 bleibt 99', () => {
    expect(setQty('99', false).qty).toBe(99);
  });

  test('Genau 0 bleibt 0', () => {
    expect(setQty('0', false).qty).toBe(0);
  });

  test('Blockiert wenn Bestellfenster geschlossen', () => {
    expect(setQty('5', true)).toEqual({ blocked: true });
  });
});

// ============================================================
// Footer-Berechnung (Artikelanzahl + Gesamtpreis)
// ============================================================
describe('calculateFooter – Warenkorb-Summe', () => {
  test('Leerer Warenkorb → 0 Artikel und €0,00', () => {
    const { totalItems, totalPrice } = calculateFooter({}, ARTIKEL);
    expect(totalItems).toBe(0);
    expect(totalPrice).toBe(0);
  });

  test('1 Artikel mit Menge 1', () => {
    const { totalItems, totalPrice } = calculateFooter({ 1: 1 }, ARTIKEL);
    expect(totalItems).toBe(1);
    expect(totalPrice).toBe(4.50);
  });

  test('1 Artikel mit Menge 2 → Preis verdoppelt', () => {
    const { totalItems, totalPrice } = calculateFooter({ 1: 2 }, ARTIKEL);
    expect(totalItems).toBe(2);
    expect(totalPrice).toBe(9.00);
  });

  test('Mehrere verschiedene Artikel werden summiert', () => {
    // 1 * 4.50 + 3 * 1.20 + 2 * 3.20 = 4.50 + 3.60 + 6.40 = 14.50
    const { totalItems, totalPrice } = calculateFooter({ 1: 1, 2: 3, 3: 2 }, ARTIKEL);
    expect(totalItems).toBe(6);
    expect(totalPrice).toBe(14.50);
  });

  test('Artikel mit Menge 0 werden ignoriert', () => {
    const { totalItems, totalPrice } = calculateFooter({ 1: 2, 2: 0 }, ARTIKEL);
    expect(totalItems).toBe(2);
    expect(totalPrice).toBe(9.00);
  });

  test('Unbekannte Artikel-ID wird ignoriert', () => {
    const { totalItems, totalPrice } = calculateFooter({ 999: 5 }, ARTIKEL);
    expect(totalItems).toBe(0);
    expect(totalPrice).toBe(0);
  });
});

// ============================================================
// Bestell-Payload (submitOrder)
// ============================================================
describe('buildPayload – Bestell-Payload', () => {
  test('Payload enthält alle Pflichtfelder', () => {
    const payload = buildPayload('12345', 'Max', { 1: 2 }, ARTIKEL, null);
    expect(payload).toHaveProperty('chatId', '12345');
    expect(payload).toHaveProperty('userName', 'Max');
    expect(payload).toHaveProperty('positionen');
    expect(payload).toHaveProperty('gesamtpreis');
    expect(payload).toHaveProperty('zeitpunkt');
  });

  test('Positionen enthalten alle Pflichtfelder', () => {
    const payload = buildPayload('12345', 'Max', { 1: 2 }, ARTIKEL, null);
    const pos = payload.positionen[0];
    expect(pos).toHaveProperty('artikelId', 1);
    expect(pos).toHaveProperty('name', 'Bio-Tomaten');
    expect(pos).toHaveProperty('einheit', 'ca 1kg');
    expect(pos).toHaveProperty('preis', 4.50);
    expect(pos).toHaveProperty('menge', 2);
    expect(pos).toHaveProperty('summe', 9.00);
  });

  test('summe pro Position = menge * preis (gerundet auf 2 Dezimalstellen)', () => {
    const payload = buildPayload('1', 'X', { 2: 3 }, ARTIKEL, null);
    // 3 * 1.20 = 3.60
    expect(payload.positionen[0].summe).toBe(3.60);
  });

  test('Gesamtpreis = Summe aller Positionen', () => {
    // 1 * 4.50 + 3 * 1.20 = 4.50 + 3.60 = 8.10
    const payload = buildPayload('1', 'X', { 1: 1, 2: 3 }, ARTIKEL, null);
    expect(payload.gesamtpreis).toBe(8.10);
  });

  test('Artikel mit Menge 0 erscheinen nicht in den Positionen', () => {
    const payload = buildPayload('1', 'X', { 1: 2, 2: 0, 3: 1 }, ARTIKEL, null);
    expect(payload.positionen).toHaveLength(2);
    expect(payload.positionen.every(p => p.menge > 0)).toBe(true);
  });

  test('Edit-Token wird im Payload gesetzt', () => {
    const payload = buildPayload('1', 'X', { 1: 1 }, ARTIKEL, 'ord_abc123');
    expect(payload.token).toBe('ord_abc123');
  });

  test('token ist null bei neuer Bestellung', () => {
    const payload = buildPayload('1', 'X', { 1: 1 }, ARTIKEL, null);
    expect(payload.token).toBeNull();
  });

  test('zeitpunkt ist ein gültiges ISO-8601-Datum', () => {
    const payload = buildPayload('1', 'X', { 1: 1 }, ARTIKEL, null);
    expect(() => new Date(payload.zeitpunkt)).not.toThrow();
    expect(new Date(payload.zeitpunkt).toISOString()).toBe(payload.zeitpunkt);
  });
});
