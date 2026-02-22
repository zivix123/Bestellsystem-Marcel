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
├── workflow_01_excel_import.json       # Telegram Trigger, Excel parsen, Käufer notify
├── workflow_02_artikel_api.json        # GET /webhook/artikel → Artikelliste
├── workflow_03_bestellung_v2.json      # POST /webhook/bestellung → Token generieren
├── workflow_04_abschluss.json          # Cron Mi 20:00 → Bestellschluss + Excel
├── workflow_05_get_order.json          # GET /webhook/bestellung?token= → Bestellung laden
├── index.html                          # Telegram Mini WebApp (Vanilla JS)
├── deploy_to_n8n.ps1                   # PowerShell Deploy-Script (lokal, nicht in Git)
├── .mcp.json                           # MCP Server Konfiguration
├── .gitignore                          # Schützt deploy_to_n8n.ps1 vor Git
└── CLAUDE.md                           # Diese Datei
```

---

## Konfiguration (aktuelle Werte)

```
n8n URL:            http://46.225.80.178:5678
n8n HTTPS URL:      [CLOUDFLARE TUNNEL URL HIER EINTRAGEN]
WebApp URL:         https://jade-alfajores-4f3440.netlify.app
Telegram Bot:       Credential "Telegram account" in n8n (ID: 1)
Admin Chat ID:      1121266642
Shared Data File:   /tmp/yauno_data.json  ← MUSS auf persistenten Pfad geändert werden!
```

---

## Aktueller Stand & erledigte Aufgaben

### Erledigt:
- [x] Alle 5 Workflows erstellt und logisch korrekt
- [x] `ADMIN_CHAT_ID_HIER` Platzhalter durch `1121266642` ersetzt (WF 01, 03, 04)
- [x] Gemeinsame JSON-Datei (`/tmp/yauno_data.json`) für Datenaustausch zwischen Workflows
- [x] Workflow 03: httpMethod Bug gefixt (POST statt dynamisch), GET-Branch entfernt
- [x] WebApp (index.html) vollständig: Bestellung, Bearbeiten-Modus, Demo-Modus, Suche
- [x] Deploy-Script (deploy_to_n8n.ps1) erstellt
- [x] .gitignore für API-Key-Schutz eingerichtet
- [x] Projekt auf GitHub gepusht (zivix123/Bestellsystem-Marcel)

---

## Release-Plan: Offene Aufgaben

### Phase 1: HTTPS einrichten (BLOCKER – ohne das kein Telegram Bot)
- [ ] Cloudflare Tunnel auf Server installieren:
  ```bash
  cloudflared tunnel --url http://localhost:5678
  ```
- [ ] Permanente Tunnel-URL erhalten (oder `cloudflared tunnel create` für stabile URL)
- [ ] Tunnel-URL in n8n eintragen: Settings → Webhook URL
- [ ] Webhook-URLs in `index.html` aktualisieren (3 Stellen oben):
  ```javascript
  const WEBHOOK_ARTIKEL        = 'https://[TUNNEL-URL]/webhook/artikel';
  const WEBHOOK_BESTELLUNG     = 'https://[TUNNEL-URL]/webhook/bestellung';
  const WEBHOOK_BESTELLUNG_GET = 'https://[TUNNEL-URL]/webhook/bestellung';
  ```
- [ ] Button-URLs in Workflows aktualisieren:
  - WF 01: Käufer-Benachrichtigung → WebApp Button-URL
  - WF 03: Bearbeitungslink → WebApp Button-URL mit Token

### Phase 2: Persistenter Datenspeicher
- [ ] Permanenten Ordner auf Server anlegen:
  ```bash
  sudo mkdir -p /opt/yauno
  sudo chown n8n:n8n /opt/yauno
  ```
- [ ] Pfad in allen 5 Workflows ändern: `/tmp/yauno_data.json` → `/opt/yauno/data.json`
  - WF 01: Artikel extrahieren (Code-Node)
  - WF 02: Artikelliste vorbereiten (Code-Node)
  - WF 03: Bestellung speichern (Code-Node)
  - WF 04: Auswertung vorbereiten + Aufräumen (2 Code-Nodes)
  - WF 05: Bestellung per Token laden (Code-Node)
- [ ] n8n Umgebungsvariable setzen: `NODE_FUNCTION_ALLOW_BUILTIN=fs`
  (damit `require('fs')` in Code-Nodes funktioniert)

### Phase 3: Telegram Bot einrichten
- [ ] Bot-Token über @BotFather erstellen (falls nicht vorhanden)
- [ ] Telegram Credential in n8n einrichten: Settings → Credentials → Telegram API
- [ ] Credential-ID in allen Telegram-Nodes prüfen (aktuell: ID "1", Name "Telegram account")

### Phase 4: Workflows deployen & testen
- [ ] Alle 5 Workflows in n8n importieren (Deploy-Script oder manuell Import from File)
- [ ] Alle Workflows aktivieren
- [ ] **Test 1:** Excel als Admin an Bot senden → Artikel werden geparsed, Admin bekommt Bestätigung
- [ ] **Test 2:** WebApp öffnen → Artikel sichtbar, Kategorien korrekt
- [ ] **Test 3:** Bestellung aufgeben → Token + Bestätigung per Telegram
- [ ] **Test 4:** Bearbeitungslink klicken → Bestellung laden + ändern
- [ ] **Test 5:** Workflow 04 manuell triggern → Excel-Auswertung an Admin
- [ ] **Test 6:** Nach Bestellschluss → WebApp zeigt "Offline"-Banner

### Phase 5: Aufräumen vor Release
- [ ] ZIP-Dateien (`files.zip`, `files2.zip`) aus Repo entfernen
- [ ] Cron-Zeitzone prüfen: `0 20 * * 3` = Mi 20:00 UTC → ggf. auf CET anpassen (= `0 19 * * 3` im Winter, `0 18 * * 3` im Sommer)
- [ ] WebApp auf stabile URL deployen (eigene Domain oder Netlify mit Custom Domain)
- [ ] CLAUDE.md mit finalen URLs aktualisieren
- [ ] Finaler Git-Commit + Push

### Nice-to-Have (nach Release)
- [ ] Admin-Dashboard (Bestellübersicht, Status-Tracking)
- [ ] Käufer-Verwaltung per Bot-Befehle (`/add_buyer`, `/remove_buyer`)
- [ ] Token-Ablauf (Tokens sollen nach Bestellschluss automatisch ungültig werden)
- [ ] Bessere Fehlerbehandlung bei ungültigen Excel-Dateien
- [ ] Backup-System für Bestelldaten (täglich nach Cloud)
- [ ] Rate-Limiting für Webhook-Endpunkte

---

## Datenaustausch zwischen Workflows

Die Workflows kommunizieren über eine **gemeinsame JSON-Datei** (nicht Static Data, da diese pro Workflow isoliert ist):

**Datei:** `/tmp/yauno_data.json` (muss auf persistenten Pfad geändert werden!)

```javascript
{
  artikel: [{ id, name, einheit, preis, kategorie }],   // aus Excel geparst (WF 01 schreibt)
  bestellungen: { [chat_id]: { ...bestellung, token } }, // alle Bestellungen (WF 03 schreibt)
  tokens: { [token]: chat_id },                          // Token → Chat-ID Mapping (WF 03 schreibt)
  bestellung_aktiv: true/false,                          // Bestellfenster offen? (WF 01/04 schreibt)
  kaeufer: [chat_id, ...],                               // registrierte Käufer (WF 03 schreibt)
  angebot_datum: "18.02.26"                              // Lieferdatum (WF 01 schreibt)
}
```

**Wer liest/schreibt was:**
| Workflow | Liest | Schreibt |
|----------|-------|----------|
| 01 - Excel Import | kaeufer | artikel, bestellung_aktiv, angebot_datum (reset: bestellungen, tokens) |
| 02 - Artikel API | artikel, bestellung_aktiv, angebot_datum | – |
| 03 - Bestellung | bestellungen, tokens, kaeufer, bestellung_aktiv | bestellungen, tokens, kaeufer |
| 04 - Abschluss | bestellungen, artikel, angebot_datum | bestellung_aktiv (reset: bestellungen, tokens) |
| 05 - Get Order | bestellungen, tokens | – |

**Voraussetzung:** n8n Umgebungsvariable `NODE_FUNCTION_ALLOW_BUILTIN=fs` muss gesetzt sein.

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

---

## Wichtige Hinweise

- **Shared Data statt Static Data**: Alle Workflows nutzen `require('fs')` um eine
  gemeinsame JSON-Datei zu lesen/schreiben. Static Data ist pro Workflow isoliert
  und funktioniert NICHT für den Datenaustausch zwischen Workflows.

- **Token-Logik**: Token wird beim ersten Bestellen generiert und bleibt
  die ganze Woche erhalten. Bei Änderungen wird der gleiche Token wiederverwendet.
  Workflow 04 (Cron) löscht alle Tokens beim Bestellschluss.

- **WebApp Demo-Modus**: Wenn kein Server erreichbar ist, lädt die WebApp
  automatisch Beispieldaten. Erkennbar am "Demo-Modus" Text im Header.

- **Bearbeiten-Modus**: WebApp erkennt `?token=xxx` in der URL und lädt
  die gespeicherte Bestellung → grüner BEARBEITEN-Banner erscheint.

- **Admin Chat ID**: `1121266642` – hardcoded in Workflows 01, 03, 04.

- **Webhook-Pfade in n8n**:
  - `GET /webhook/artikel` → Workflow 02
  - `POST /webhook/bestellung` → Workflow 03
  - `GET /webhook/bestellung?token=xxx` → Workflow 05
