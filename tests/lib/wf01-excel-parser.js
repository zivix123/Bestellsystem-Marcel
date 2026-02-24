/**
 * Extracted business logic from Workflow 01: "Artikel extrahieren" Code Node
 * Parses Excel rows into structured article data.
 */

function parseExcelRows(rows) {
  let artikel = [];
  let kategorie = 'Allgemein';
  let id = 1;
  let startParsing = false;
  let datumMatch = null;

  for (const row of rows) {
    const values = Object.values(row);
    const joined = values.join(' ').trim();

    if (!joined) continue;

    // Lieferdatum suchen
    if (!datumMatch) {
      const dMatch = joined.match(/(\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4})/);
      if (dMatch) datumMatch = dMatch[1];
    }

    // Spaltenheader erkennen → ab nächster Zeile parsen
    const lower = joined.toLowerCase();
    if (lower.includes('artikel') && lower.includes('preis')) {
      startParsing = true;
      continue;
    }

    if (!startParsing) continue;

    // Ende erkennen
    if (lower.includes('gesamt zu zahlen') || lower.includes('gesamtsumme')) break;

    // Kategorie-Wechsel: Tagesangebote
    if (lower.includes('tagesangebote')) {
      kategorie = 'Tagesangebote';
      continue;
    }

    // Weitere Kategorie-Marker erkennen (Zeilen die mit ":" enden, kein Preis)
    const col_B = values[1];
    const col_D = values[3];
    const textOnly = col_B && String(col_B).trim() !== '' && (!col_D || String(col_D).trim() === '');
    const col_A = values[0];
    const hasNoQty = !col_A || String(col_A).trim() === '';
    if (textOnly && hasNoQty && String(col_B).trim().endsWith(':')) {
      kategorie = String(col_B).trim().replace(/:$/, '');
      continue;
    }

    // Leere Artikelzeile überspringen
    if (!col_B || String(col_B).trim() === '') continue;

    const preis = parseFloat(String(col_D || '0').replace(',', '.'));
    if (isNaN(preis) || preis <= 0) continue;

    const col_C = values[2];
    artikel.push({
      id: id++,
      name: String(col_B).trim(),
      einheit: String(col_C || '').trim() || 'Stück',
      preis: Math.round(preis * 100) / 100,
      kategorie: kategorie
    });
  }

  return {
    artikel,
    datumMatch
  };
}

/**
 * Extracted logic from "Käufer laden" Code Node
 */
function loadKaeufer(staticData) {
  const kaeufer = staticData.kaeufer || [];

  if (kaeufer.length === 0) {
    return { skip: true, items: [] };
  }

  return {
    skip: false,
    items: kaeufer.map(chatId => ({
      chatId: String(chatId),
      datum: staticData.angebot_datum,
      artikelCount: (staticData.artikel || []).length,
      webapp_url: staticData.webapp_url || 'https://jade-alfajores-4f3440.netlify.app'
    }))
  };
}

/**
 * Extracted logic from "Admin Artikeldaten" Code Node
 */
function getAdminArtikelData(staticData) {
  return {
    artikel: staticData.artikel || [],
    bestellung_aktiv: staticData.bestellung_aktiv !== false,
    angebot_datum: staticData.angebot_datum || '',
    kaeufer: staticData.kaeufer || [],
    webapp_url: staticData.webapp_url || 'https://jade-alfajores-4f3440.netlify.app'
  };
}

module.exports = { parseExcelRows, loadKaeufer, getAdminArtikelData };
