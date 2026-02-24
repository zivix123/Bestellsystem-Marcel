/**
 * Extracted business logic from Workflow 05: "Bestellung per Token laden" Code Node
 */

function getOrderByToken(query, orderData) {
  const token = query.token;

  if (!token) {
    return { error: 'Token parameter fehlt', code: 400 };
  }

  const tokens = orderData.tokens || {};
  const chatId = tokens[token];

  if (!chatId) {
    return { error: 'Ungültiger oder abgelaufener Token', code: 404 };
  }

  const bestellungen = orderData.bestellungen || {};
  const bestellung = bestellungen[chatId];

  if (!bestellung) {
    return { error: 'Bestellung nicht gefunden', code: 404 };
  }

  return {
    chatId: bestellung.chatId,
    userName: bestellung.userName,
    positionen: bestellung.positionen,
    gesamtpreis: bestellung.gesamtpreis,
    token: token,
    zeitpunkt: bestellung.zeitpunkt,
    code: 200
  };
}

module.exports = { getOrderByToken };
