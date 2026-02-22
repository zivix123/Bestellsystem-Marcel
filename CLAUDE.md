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
n8n URL:        https://tracker-rubber-animation-accommodations.trycloudflare.com
WebApp URL:     https://jade-alfajores-4f3440.netlify.app
Telegram Bot:   Credential "Telegram account" in n8n
Admin Chat ID:  1121266642
```

**n8n Base-URL zentral verwaltet (Umgebungsvariable):**
Die Workflows 02, 04 und 05 lesen die n8n-URL aus der Umgebungsvariable `N8N_BASE_URL`.
Beim Docker-Start setzen:
```bash
docker run -e N8N_BASE_URL=https://tracker-rubber-animation-accommodations.trycloudflare.com ...
```
Wenn sich die Cloudflare-Tunnel-URL ändert, muss nur diese eine Variable angepasst werden.

**WebApp-URL zentral verwaltet:**
Die WebApp-URL wird über `staticData.webapp_url` in der globalen Static Data gepflegt.
Workflows 01 und 03 lesen die URL aus der Static Data und geben sie an die Telegram-Buttons weiter.
Ändern unter: **n8n → Workflow 01 → Settings → Static Data → `webapp_url`**

---

## Webhook-Endpunkte

| Workflow | Methode | Pfad (webhookId)         | Beschreibung                      |
|----------|---------|--------------------------|-----------------------------------|
| 01       | —       | Telegram Trigger         | Excel-Datei vom Admin empfangen   |
| 01       | GET     | /webhook/admin-artikel   | Interne API: Artikeldaten lesen   |
| 02       | GET     | /webhook/artikel         | Artikelliste für WebApp           |
| 03       | POST    | /webhook/bestellung      | Bestellung speichern              |
| 03       | GET     | /webhook/admin-bestellungen | Interne API: Bestelldaten lesen |
| 03       | POST    | /webhook/admin-close     | Interne API: Bestellungen schließen |
| 04       | —       | Cron (Mi 20:00)          | Bestellschluss + Auswertung       |
| 05       | GET     | /webhook/bestellung-get  | Bestellung per Token laden        |

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
  angebot_datum: "18.02.26",                             // Lieferdatum
  webapp_url: "https://..."                              // WebApp-URL (zentral gepflegt)
}
```

**Wichtig:** Jeder Workflow hat seine eigene Static Data (`$getWorkflowStaticData('global')`
ist pro Workflow isoliert). Die Daten-Workflows (01, 03) stellen interne Admin-Webhooks
bereit, über die andere Workflows per HTTP Request (`https://tracker-rubber-animation-accommodations.trycloudflare.com/webhook/...`)
auf die Daten zugreifen:
- **WF 01** → `GET /webhook/admin-artikel` (Artikeldaten, Bestellstatus, Datum)
- **WF 03** → `GET /webhook/admin-bestellungen` (alle Bestellungen, Tokens)
- **WF 03** → `POST /webhook/admin-close` (Bestellfenster schließen, Daten bereinigen)

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

In `webapp/index.html` nur die Base-URL anpassen – die Webhook-Pfade werden automatisch abgeleitet:

```javascript
const N8N_BASE_URL = 'https://tracker-rubber-animation-accommodations.trycloudflare.com';
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
   Dann die generierte URL als `N8N_BASE_URL` Umgebungsvariable setzen und in
   `webapp/index.html` als `N8N_BASE_URL` eintragen.

2. **Static Data Isolation** – ~~Gelöst!~~ Workflows 01 und 03 bieten jetzt interne
   Admin-Webhooks an (`/webhook/admin-artikel`, `/webhook/admin-bestellungen`,
   `/webhook/admin-close`). Die Consumer-Workflows (02, 04, 05) rufen diese
   per HTTP Request über `$env.N8N_BASE_URL` ab.

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
        "N8N_HOST": "https://tracker-rubber-animation-accommodations.trycloudflare.com",
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
