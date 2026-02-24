/**
 * Extracted business logic from Workflow 03: "Bestellung speichern" Code Node
 */

function generateToken() {
  return 'ord_' + Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

function saveBestellung(body, staticData) {
  // Prüfe ob Bestellung aktiv
  if (staticData.bestellung_aktiv === false) {
    return { error: 'Bestellfenster geschlossen', status: 403 };
  }

  const chatId = body.chatId;
  if (!chatId) {
    return { error: 'Chat-ID fehlt', status: 400 };
  }

  // Token generieren oder bestehenden verwenden
  let token = body.token;
  const bestellungen = staticData.bestellungen || {};
  const tokens = staticData.tokens || {};

  if (!token || !tokens[token]) {
    token = generateToken();
  }

  // Bestellung speichern
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

  // Käufer registrieren
  const kaeufer = staticData.kaeufer || [];
  if (!kaeufer.includes(String(chatId))) {
    kaeufer.push(String(chatId));
  }

  staticData.bestellungen = bestellungen;
  staticData.tokens = tokens;
  staticData.kaeufer = kaeufer;

  const isUpdate = !!body.token && !!tokens[body.token];

  // Prüfe auf ungewöhnlich hohe Mengen
  const highQtyItems = (body.positionen || []).filter(p => p.menge > 50);

  return {
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
  };
}

/**
 * Extracted from "Admin Bestelldaten" Code Node
 */
function getAdminBestelldaten(staticData) {
  return {
    bestellungen: staticData.bestellungen || {},
    tokens: staticData.tokens || {},
    kaeufer: staticData.kaeufer || [],
    bestellung_aktiv: staticData.bestellung_aktiv !== false
  };
}

/**
 * Extracted from "Bestellungen schließen" Code Node
 */
function closeBestellungen(staticData) {
  staticData.bestellungen = {};
  staticData.tokens = {};
  staticData.bestellung_aktiv = false;
  // Käufer bleiben erhalten
  return { success: true, message: 'Bestellungen geschlossen und bereinigt' };
}

module.exports = { generateToken, saveBestellung, getAdminBestelldaten, closeBestellungen };
