# Claude Code Prompt – Yauno Bestellsystem

## Kontext für Claude Code

Du arbeitest am **Yauno Lebensmittel Bestellsystem** – einem vollautomatischen Telegram-Bestellsystem mit einem n8n Komplett-Workflow und einer Telegram Mini WebApp.

---

## Systemarchitektur

```
[Admin] Excel hochladen → Telegram Bot
    → Komplett-Workflow: Artikel parsen + Käufer benachrichtigen
    → Käufer öffnen Telegram Mini WebApp (index.html auf Netlify)
    → GET /webhook/artikel → Artikelliste
    → POST /webhook/bestellung → Bestellung speichern + Token
    → Käufer erhalten Bearbeitungslink per Telegram
    → GET /webhook/bestellung-get?token= → Bestellung laden
    → Mittwoch 20:00 Uhr: Cron-Trigger → Excel-Auswertung an Admin
```

**Ein Workflow – alles drin:** Alle Funktionen (Excel-Import, Artikel-API, Bestellungen,
Cron-Abschluss, Token-Laden) laufen in einem einzigen n8n-Workflow. Dadurch teilen alle
Trigger-Pfade die gleiche Static Data – keine internen Admin-Webhooks oder HTTP-Calls
zwischen Workflows nötig.

---

## Projektdateien

```
/project
├── workflows/
│   └── workflow_komplett.json          # Komplett-Workflow (alle Funktionen)
├── webapp/
│   └── index.html                      # Telegram Mini WebApp (Vanilla JS)
├── import_workflows.sh                 # Workflow in n8n importieren
├── update_workflows.sh                 # Bestehenden Workflow aktualisieren
├── .mcp.json.example                   # MCP-Konfiguration (Template)
├── netlify.toml                        # Netlify Deployment Config
├── README.md                           # Setup-Anleitung
└── CLAUDE.md                           # Diese Datei
```

---

## Konfiguration (aktuelle Werte)

```
n8n URL:        https://yauno-n8n.duckdns.org
WebApp URL:     https://jade-alfajores-4f3440.netlify.app
Telegram Bot:   Credential "Telegram account" in n8n (ID: "1")
Admin Chat ID:  1121266642
```

**WebApp-URL zentral verwaltet:**
Die WebApp-URL wird über `staticData.webapp_url` in der globalen Static Data gepflegt.
Der Workflow liest die URL aus der Static Data und gibt sie an die Telegram-Buttons weiter.
Ändern unter: **n8n → Workflow → Settings → Static Data → `webapp_url`**

---

## Webhook-Endpunkte

Alle Endpunkte laufen im selben Komplett-Workflow:

| Trigger         | Methode | Pfad (webhookId)         | Beschreibung                      |
|-----------------|---------|--------------------------|-----------------------------------|
| Telegram        | —       | Telegram Trigger         | Excel-Datei vom Admin empfangen   |
| Webhook         | GET     | /webhook/artikel         | Artikelliste für WebApp           |
| Webhook         | POST    | /webhook/bestellung      | Bestellung speichern              |
| Webhook         | GET     | /webhook/bestellung-get  | Bestellung per Token laden        |
| Cron            | —       | Mi 20:00 (0 20 * * 3)   | Bestellschluss + Auswertung       |

---

## n8n Datenstruktur (Static Data)

Alle Trigger-Pfade im Workflow teilen die gleiche Static Data via `$getWorkflowStaticData('global')`:

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

**Vorteil Komplett-Workflow:** Da alles in einem Workflow läuft, ist die Static Data
automatisch geteilt. Kein Umweg über interne Webhooks oder HTTP-Calls nötig.
Code-Nodes lesen und schreiben direkt in `$getWorkflowStaticData('global')`.

---

## Workflow-Bereiche im Komplett-Workflow

Der Workflow ist in 5 logische Bereiche unterteilt:

### Bereich 1: Excel Import & Benachrichtigung (Y=300)
- **Trigger:** Telegram Trigger (empfängt Excel-Datei)
- **Ablauf:** Ist Excel? → Ist Admin? → Datei herunterladen → Parsen → Artikel in Static Data speichern → Admin bestätigen + Käufer benachrichtigen

### Bereich 2: Artikel API (Y=700)
- **Trigger:** Webhook GET `/webhook/artikel`
- **Ablauf:** Static Data lesen → Artikelliste + Status zurückgeben

### Bereich 3: Bestellung speichern (Y=1000)
- **Trigger:** Webhook POST `/webhook/bestellung`
- **Ablauf:** Bestellung validieren → Token generieren → In Static Data speichern → Käufer + Admin benachrichtigen → Mengenwarnung bei >50

### Bereich 4: Bestellschluss & Auswertung (Y=1500)
- **Trigger:** Cron Mi 20:00
- **Ablauf:** Bestelldaten aus Static Data lesen → Excel generieren → An Admin senden → Static Data bereinigen (Bestellfenster schließen)

### Bereich 5: Bestellung laden per Token (Y=1900)
- **Trigger:** Webhook GET `/webhook/bestellung-get`
- **Ablauf:** Token validieren → Bestellung aus Static Data laden → Zurückgeben

---

## Aktueller Stand & erledigte Aufgaben

### Erledigt:
- [x] Komplett-Workflow erstellt (alle 5 Funktionsbereiche in einem)
- [x] Static Data wird direkt geteilt (keine internen Admin-Webhooks nötig)
- [x] Admin Chat ID korrekt gesetzt: `1121266642`
- [x] WebApp (index.html) vollständig: Bestellung, Bearbeiten-Modus, Demo-Modus, Suche
- [x] Mengenwarnung: Prüft auf >50 Einheiten und warnt Admin
- [x] Käufer-Registrierung: Automatisch bei erster Bestellung
- [x] Import/Update-Skripte: Nutzen Umgebungsvariablen (keine hartcodierten API-Keys)
- [x] Projekt auf GitHub gepusht (zivix123/Bestellsystem-Marcel)
- [x] Feste URL: `yauno-n8n.duckdns.org` in allen Dateien eingetragen
- [x] Einzel-Workflows entfernt, nur noch `workflow_komplett.json`

---

## Release-Plan: Offene Aufgaben

### Phase 1: HTTPS einrichten (BLOCKER – ohne das kein Telegram Bot)
- [x] DuckDNS-Domain eingerichtet: `yauno-n8n.duckdns.org`
- [x] URL in allen Projektdateien eingetragen
- [ ] Caddy als Reverse Proxy auf dem Server installieren:
  ```bash
  sudo apt install -y caddy
  # /etc/caddy/Caddyfile:
  # yauno-n8n.duckdns.org {
  #     reverse_proxy localhost:5678
  # }
  sudo systemctl enable --now caddy
  ```
- [ ] Pruefen: `https://yauno-n8n.duckdns.org` erreichbar + HTTPS-Zertifikat aktiv

### Phase 2: Telegram Bot einrichten
- [ ] Bot-Token über @BotFather erstellen (falls nicht vorhanden)
- [ ] Telegram Credential in n8n einrichten: Settings → Credentials → Telegram API
- [ ] Credential-ID im Workflow prüfen (aktuell: ID "1", Name "Telegram account")

### Phase 3: Workflow deployen & testen
- [ ] Workflow in n8n importieren:
  ```bash
  export N8N_API_KEY="dein-key"
  export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
  ./import_workflows.sh
  ```
- [ ] Workflow aktivieren (Toggle oben rechts in n8n)
- [ ] **Test 1:** Excel als Admin an Bot senden → Artikel werden geparsed
- [ ] **Test 2:** WebApp öffnen → Artikel sichtbar, Kategorien korrekt
- [ ] **Test 3:** Bestellung aufgeben → Token + Bestätigung per Telegram
- [ ] **Test 4:** Bearbeitungslink klicken → Bestellung laden + ändern
- [ ] **Test 5:** Cron manuell triggern → Excel-Auswertung an Admin
- [ ] **Test 6:** Nach Bestellschluss → WebApp zeigt "Offline"-Banner

### Nice-to-Have (nach Release)
- [ ] Admin-Dashboard (Bestellübersicht, Status-Tracking)
- [ ] Käufer-Verwaltung per Bot-Befehle (`/add_buyer`, `/remove_buyer`)
- [ ] Backup-System für Bestelldaten
- [ ] Rate-Limiting für Webhook-Endpunkte

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
const N8N_BASE_URL = 'https://yauno-n8n.duckdns.org';
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

1. **HTTPS auf dem Server einrichten** – Caddy als Reverse Proxy installieren,
   damit `https://yauno-n8n.duckdns.org` mit gueltigem Zertifikat erreichbar ist.
   Port 80 + 443 muessen offen sein (fuer Let's Encrypt).

---

## Deploy-Skripte

### Workflow importieren (erstmalig)
```bash
export N8N_API_KEY="dein-api-key"
export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
./import_workflows.sh
```

### Workflow aktualisieren (nach Änderungen)
```bash
export N8N_API_KEY="dein-api-key"
export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
./update_workflows.sh
```

**Wichtig:** Bestehende andere Workflows in n8n werden nicht angetastet.
Das Update-Skript sucht den Workflow anhand des Namens "Yauno Bestellsystem".

---

## MCP Server Konfiguration

Für direkten n8n-Zugriff aus Claude Code heraus – `.mcp.json.example` als Vorlage nutzen:

```bash
cp .mcp.json.example .mcp.json
# Dann N8N_HOST und N8N_API_KEY in .mcp.json eintragen
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
Schau dir die letzten Executions des Yauno Bestellsystem Workflows an
und erkläre warum der Telegram Trigger fehlschlägt.
```

### WebApp updaten
```
In webapp/index.html: Trage die korrekten n8n Webhook-URLs ein und
stelle sicher dass der Edit-Modus korrekt funktioniert wenn ?token=
in der URL steht.
```

### Neues Feature
```
Füge im Komplett-Workflow eine Validierung hinzu: Wenn ein Käufer mehr als
50 Einheiten eines einzelnen Artikels bestellt, soll eine Warnung
per Telegram an den Admin gesendet werden.
```

### Excel-Parser verbessern
```
Der Excel-Parser im Komplett-Workflow (Code-Node "Artikel extrahieren")
soll auch mit Dateien umgehen können wo die Tagesangebote-Zeile
fehlt – dann alle Artikel als Kategorie "Allgemein" einordnen.
```

---

## Wichtige Hinweise

- **Token-Logik**: Token wird beim ersten Bestellen generiert und bleibt
  die ganze Woche erhalten. Bei Änderungen wird der gleiche Token wiederverwendet.
  Der Cron-Trigger (Mi 20:00) löscht alle Tokens beim Bestellschluss.

- **WebApp Demo-Modus**: Wenn kein Server erreichbar ist, lädt die WebApp
  automatisch Beispieldaten. Erkennbar am "Demo-Modus" Text im Header.

- **Bearbeiten-Modus**: WebApp erkennt `?token=xxx` in der URL und lädt
  die gespeicherte Bestellung → grüner BEARBEITEN-Banner erscheint.

- **Mengenwarnung**: Prüft ob ein Käufer mehr als 50 Einheiten eines
  Artikels bestellt und sendet eine Warnung an den Admin.

- **Käufer-Registrierung**: Käufer werden automatisch bei der ersten
  Bestellung in der `kaeufer`-Liste registriert und bei neuen Angeboten
  per Telegram benachrichtigt.

- **Bestehende n8n Workflows**: Die Import/Update-Skripte erstellen nur
  den "Yauno Bestellsystem" Workflow. Andere bestehende Workflows werden
  NICHT verändert oder gelöscht.
