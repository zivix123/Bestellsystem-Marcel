# Claude Code Prompt – Yauno Bestellsystem

## Kontext für Claude Code

Du arbeitest am **Yauno Lebensmittel Bestellsystem** – einem vollautomatischen Telegram-Bestellsystem mit n8n Workflows und einer Telegram Mini WebApp.

---

## Systemarchitektur

```
[Admin] Excel hochladen → Telegram Bot
    → n8n Workflow 01: Artikel parsen + Käufer benachrichtigen
    → Käufer öffnen Telegram Mini WebApp (index.html auf Netlify)
    → n8n Workflow 02: GET /webhook/artikel → Artikelliste
    → n8n Workflow 03: POST /webhook/bestellung → Bestellung speichern + Token
    → Käufer erhalten Bearbeitungslink per Telegram
    → n8n Workflow 05: GET /webhook/bestellung-get?token= → Bestellung laden
    → Mittwoch 20:00 Uhr: Workflow 04 (Cron) → Excel-Auswertung an Admin
```

---

## Projektdateien

```
/project
├── workflows/
│   ├── workflow_01_excel_import.json       # Telegram Trigger, Excel parsen, Käufer notify
│   ├── workflow_02_artikel_api.json        # GET /webhook/artikel → Artikelliste
│   ├── workflow_03_bestellung_v2.json      # POST /webhook/bestellung → Bestellung speichern
│   ├── workflow_04_abschluss.json          # Cron Mi 20:00 → Bestellschluss + Excel
│   └── workflow_05_get_order.json          # GET /webhook/bestellung-get?token= → Bestellung laden
├── webapp/
│   └── index.html                          # Telegram Mini WebApp (Vanilla JS)
├── README.md                               # Setup-Anleitung
└── CLAUDE.md                               # Diese Datei
```

---

## Konfiguration (aktuelle Werte)

```
n8n URL:        http://46.225.80.178:5678
WebApp URL:     https://jade-alfajores-4f3440.netlify.app
Telegram Bot:   Credential "Telegram account" in n8n
Admin Chat ID:  1121266642
```

---

## Webhook-Endpunkte

| Workflow | Methode | Pfad (webhookId)       | Beschreibung                    |
|----------|---------|------------------------|---------------------------------|
| 01       | —       | Telegram Trigger       | Excel-Datei vom Admin empfangen |
| 02       | GET     | /webhook/artikel       | Artikelliste für WebApp         |
| 03       | POST    | /webhook/bestellung    | Bestellung speichern            |
| 04       | —       | Cron (Mi 20:00)        | Bestellschluss + Auswertung     |
| 05       | GET     | /webhook/bestellung-get| Bestellung per Token laden      |

---

## n8n Datenstruktur (Static Data)

Die Workflows kommunizieren über `$getWorkflowStaticData('global')`:

```javascript
{
  artikel: [{ id, name, einheit, preis, kategorie }],   // aus Excel geparst
  bestellungen: { [chat_id]: { ...bestellung, token } }, // alle Bestellungen
  tokens: { [token]: chat_id },                          // Token → Chat-ID Mapping
  bestellung_aktiv: true/false,                          // Bestellfenster offen?
  kaeufer: [chat_id, ...],                               // registrierte Käufer
  angebot_datum: "18.02.26"                              // Lieferdatum
}
```

**Wichtig:** Jeder Workflow hat seine eigene Static Data. Damit die Workflows
Daten teilen können, müssen alle im selben n8n-Projekt laufen – oder eine
externe JSON-Datei als gemeinsamen Speicher nutzen.

---

## Excel-Format (Bestelliste_DD_MM_YY.xlsx)

```
Zeile 1-7:  Header (Firma, Kunde, Lieferdatum etc.) → ignorieren
Zeile 8:    Spaltenheader (Artikel, Preis, Summe)
Zeile 9+:   Datenzeilen:
  Spalte A: Menge (Eingabefeld für Kunden)
  Spalte B: Artikelname
  Spalte C: Einheit (z.B. "ca 7kg", "Stück", "500g")
  Spalte D: Preis (Zahl)
  Spalte E: Summe (Formel =A*D)

Sonderzeilen:
  "Tagesangebote:" → Kategorie wechselt zu "Tagesangebote"
  "Gesamt zu zahlen:" → Dateiende

Wenn keine "Tagesangebote:"-Zeile vorhanden ist, werden alle Artikel
als Kategorie "Allgemein" eingeordnet.
```

---

## WebApp Konfiguration

In `webapp/index.html` oben die Webhook-URLs eintragen:

```javascript
const WEBHOOK_ARTIKEL        = 'http://46.225.80.178:5678/webhook/artikel';
const WEBHOOK_BESTELLUNG     = 'http://46.225.80.178:5678/webhook/bestellung';
const WEBHOOK_BESTELLUNG_GET = 'http://46.225.80.178:5678/webhook/bestellung-get';
```

**Features:**
- Artikelliste mit Suche und Kategorie-Filter
- Mengen-Eingabe mit +/- Buttons
- Bestellübersicht im Footer
- Edit-Modus: `?token=xxx` in der URL → grüner BEARBEITEN-Banner
- Demo-Modus: Automatische Beispieldaten wenn Server nicht erreichbar
- Offline-Modus: Banner wenn Bestellfenster geschlossen

---

## Bekannte offene Punkte

1. **HTTPS für Telegram Webhook fehlt** – n8n läuft auf HTTP. Lösung: Cloudflare Tunnel
   ```bash
   cloudflared tunnel --url http://localhost:5678
   ```
   Dann in n8n: Settings → Webhook URL → Cloudflare-URL eintragen

2. **Static Data Isolation** – Jeder n8n Workflow hat seine eigene Static Data.
   Workflow 02 und 05 können nicht direkt auf die Daten von Workflow 01/03 zugreifen.
   Lösung: Alle Workflows im selben Projekt halten, oder externe JSON-Datei nutzen.

---

## MCP Server Konfiguration

Für direkten n8n-Zugriff aus Claude Code heraus – in `.mcp.json` im Projektroot:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "@illuminaresystems/n8n-mcp-server"],
      "env": {
        "N8N_HOST": "http://46.225.80.178:5678",
        "N8N_API_KEY": "DEIN_N8N_API_KEY"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  }
}
```

### n8n API Key erstellen
In n8n: **Settings → API → Create API Key** → Key in `.mcp.json` eintragen.

### Mit MCP kannst du dann direkt:
- Workflows lesen und bearbeiten ohne JSON manuell zu editieren
- Workflow-Executions einsehen (Fehleranalyse)
- Nodes suchen und updaten
- Webhooks testen

---

## Typische Aufgaben für Claude Code

### Workflow debuggen
```
Schau dir die letzten Executions von Workflow 01 an und erkläre warum der
Telegram Trigger fehlschlägt.
```

### WebApp updaten
```
In webapp/index.html: Trage die korrekten n8n Webhook-URLs ein und
stelle sicher dass der Edit-Modus korrekt funktioniert wenn ?token=
in der URL steht.
```

### Neues Feature
```
Füge in Workflow 03 eine Validierung hinzu: Wenn ein Käufer mehr als
50 Einheiten eines einzelnen Artikels bestellt, soll eine Warnung
per Telegram an den Admin gesendet werden.
```

### Excel-Parser verbessern
```
Der Excel-Parser in Workflow 01 (Code-Node "Artikel extrahieren")
soll auch mit Dateien umgehen können wo die Tagesangebote-Zeile
fehlt – dann alle Artikel als Kategorie "Allgemein" einordnen.
```

---

## Wichtige Hinweise

- **Token-Logik**: Token wird beim ersten Bestellen generiert und bleibt
  die ganze Woche erhalten. Bei Änderungen wird der gleiche Token wiederverwendet.
  Workflow 04 (Cron) löscht alle Tokens beim Bestellschluss.

- **WebApp Demo-Modus**: Wenn kein Server erreichbar ist, lädt die WebApp
  automatisch Beispieldaten. Erkennbar am "Demo-Modus" Text im Header.

- **Bearbeiten-Modus**: WebApp erkennt `?token=xxx` in der URL und lädt
  die gespeicherte Bestellung → grüner BEARBEITEN-Banner erscheint.

- **Mengenwarnung**: Workflow 03 prüft ob ein Käufer mehr als 50 Einheiten
  eines Artikels bestellt und sendet eine Warnung an den Admin.

- **Käufer-Registrierung**: Käufer werden automatisch bei der ersten
  Bestellung in der `kaeufer`-Liste registriert und bei neuen Angeboten
  per Telegram benachrichtigt.
