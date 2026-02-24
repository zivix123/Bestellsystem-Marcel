/**
 * Extracted business logic from Workflow 04: "Auswertung vorbereiten" Code Node
 */

function prepareAuswertung(bestellungen, artikel, datum) {
  const alleBestellungen = Object.values(bestellungen);

  if (alleBestellungen.length === 0) {
    return {
      leer: true,
      message: 'Keine Bestellungen eingegangen',
      datum: datum
    };
  }

  // Zusammenfassung erstellen
  let artikelSummen = {};
  let gesamtUmsatz = 0;

  alleBestellungen.forEach(best => {
    (best.positionen || []).forEach(pos => {
      const key = pos.artikelId || pos.name;
      if (!artikelSummen[key]) {
        artikelSummen[key] = {
          name: pos.name,
          einheit: pos.einheit,
          preis: pos.preis,
          gesamtMenge: 0,
          gesamtSumme: 0
        };
      }
      artikelSummen[key].gesamtMenge += pos.menge;
      artikelSummen[key].gesamtSumme += pos.summe || (pos.menge * pos.preis);
    });
    gesamtUmsatz += best.gesamtpreis || 0;
  });

  // Daten für Excel vorbereiten
  const excelRows = [];

  // Header
  excelRows.push({ A: 'Yauno Bestellauswertung', B: '', C: '', D: '', E: '' });
  excelRows.push({
    A: 'Lieferdatum: ' + datum,
    B: '',
    C: 'Erstellt: ' + new Date().toLocaleString('de-DE'),
    D: '',
    E: ''
  });
  excelRows.push({ A: '', B: '', C: '', D: '', E: '' });

  // TEIL 1: Artikel-Zusammenfassung
  excelRows.push({ A: 'ARTIKELÜBERSICHT', B: '', C: '', D: '', E: '' });
  excelRows.push({ A: 'Artikel', B: 'Einheit', C: 'Einzelpreis', D: 'Gesamt Menge', E: 'Gesamt Summe' });

  Object.values(artikelSummen)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(art => {
      excelRows.push({
        A: art.name,
        B: art.einheit,
        C: art.preis,
        D: art.gesamtMenge,
        E: Math.round(art.gesamtSumme * 100) / 100
      });
    });

  excelRows.push({ A: '', B: '', C: '', D: 'GESAMT:', E: Math.round(gesamtUmsatz * 100) / 100 });
  excelRows.push({ A: '', B: '', C: '', D: '', E: '' });

  // TEIL 2: Einzelbestellungen
  excelRows.push({ A: 'EINZELBESTELLUNGEN', B: '', C: '', D: '', E: '' });

  alleBestellungen.forEach(best => {
    excelRows.push({
      A: '👤 ' + (best.userName || 'Unbekannt'),
      B: 'Chat: ' + best.chatId,
      C: '',
      D: 'Summe:',
      E: best.gesamtpreis
    });
    (best.positionen || []).forEach(pos => {
      excelRows.push({
        A: '  ' + pos.name,
        B: pos.einheit,
        C: pos.preis,
        D: pos.menge,
        E: pos.summe || (pos.menge * pos.preis)
      });
    });
    excelRows.push({ A: '', B: '', C: '', D: '', E: '' });
  });

  return {
    leer: false,
    rows: excelRows,
    datum: datum,
    anzahlBestellungen: alleBestellungen.length,
    gesamtUmsatz: Math.round(gesamtUmsatz * 100) / 100
  };
}

/**
 * Extracted from "Zeilen aufteilen" Code Node
 */
function splitRows(rows) {
  return rows.map(row => ({ json: row }));
}

module.exports = { prepareAuswertung, splitRows };
