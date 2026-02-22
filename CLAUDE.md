# Claude Code Prompt – Yauno Bestellsystem

## Kontext für Claude Code

Du arbeitest am **Yauno Lebensmittel Bestellsystem** – einem vollautomatischen Telegram-Bestellsystem mit n8n Workflows und einer Telegram Mini WebApp.

---

## Systemarchitektur

```
[Admin] Excel hochladen → Telegram Bot
    → n8n Workflow 01: Artikel parsen + Käufer benachrichtigen
    → Käufer öffnen Telegram Mini WebApp (index.html auf Netlify)
    → n8n Workflow 03: Bestellung speichern + Token generieren
    → Käufer erhalten Bearbeitungslink per Telegram
    → n8n Workflow 05: Bestellung per Token laden (Bearbeiten-Modus)
    → Mittwoch 20:00 Uhr: Workflow 04 (Cron) → Excel-Auswertung an Admin
```

---

## Projektdateien

```
/project
├── workflows/
│   ├── workflow_01_excel_import.json       # Telegram Trigger, Excel parsen, Käufer notify
│   ├── workflow_02_artikel_api.json        # GET /webhook/artikel → Artikelliste
│   ├── workflow_03_bestellung_v2.json      # POST /webhook/bestellung → Token generieren
│   ├── workflow_04_abschluss.json          # Cron Mi 20:00 → Bestellschluss + Excel
│   └── workflow_05_get_order.json          # GET /webhook/bestellung?token= → Bestellung laden
├── webapp/
│   └── index.html                          # Telegram Mini WebApp (Vanilla JS)
└── CLAUDE.md                               # Diese Datei
```

---

## Konfiguration (aktuelle Werte)

```
n8n URL:        http://46.225.80.178:5678
WebApp URL:     https://jade-alfajores-4f3440.netlify.app
Telegram Bot:   Credential "Telegram account" in n8n
Admin Chat ID:  [DEINE CHAT-ID HIER EINTRAGEN]
```

---

## n8n Datenstruktur (Static Data)

Die Workflows kommunizieren über `$execution.workflow.staticData`:

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
```

---

## Bekannte offene Punkte

1. **HTTPS für Telegram Webhook fehlt** – n8n läuft auf HTTP. Lösung: Cloudflare Tunnel
   ```bash
   cloudflared tunnel --url http://localhost:5678
   ```
   Dann in n8n: Settings → Webhook URL → Cloudflare-URL eintragen

2. **Umgebungsvariablen** – n8n Free Plan hat keine Variables.
   Stattdessen `$env.ADMIN_CHAT_ID` und `$env.WEBAPP_URL` direkt in den Nodes durch echte Werte ersetzen.

3. **WebApp Webhook-URLs** – in `index.html` oben eintragen:
   ```javascript
   const WEBHOOK_ARTIKEL         = 'http://46.225.80.178:5678/webhook/artikel';
   const WEBHOOK_BESTELLUNG      = 'http://46.225.80.178:5678/webhook/bestellung';
   const WEBHOOK_BESTELLUNG_GET  = 'http://46.225.80.178:5678/webhook/bestellung';
   ```

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

### Webhook-URLs eintragen
```
Ersetze in allen 5 Workflow-JSONs alle Vorkommen von $env.ADMIN_CHAT_ID 
durch "123456789" und $env.WEBAPP_URL durch 
"https://jade-alfajores-4f3440.netlify.app"
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

- **Static Data Scope**: Jeder n8n Workflow hat seine eigene Static Data.
  Wenn Workflow 02 auf die Artikel von Workflow 01 zugreifen soll,
  müssen alle 5 Workflows im selben n8n-Projekt sein – oder du nutzt
  eine externe JSON-Datei als gemeinsamen Speicher.

- **Token-Logik**: Token wird beim ersten Bestellen generiert und bleibt
  die ganze Woche erhalten. Bei Änderungen wird der gleiche Token wiederverwendet.
  Workflow 04 (Cron) löscht alle Tokens beim Bestellschluss.

- **WebApp Demo-Modus**: Wenn kein Server erreichbar ist, lädt die WebApp
  automatisch Beispieldaten. Erkennbar am "Demo-Modus" Text im Header.

- **Bearbeiten-Modus**: WebApp erkennt `?token=xxx` in der URL und lädt
  die gespeicherte Bestellung → grüner BEARBEITEN-Banner erscheint.
