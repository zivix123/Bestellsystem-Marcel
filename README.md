# 🥬 Yauno Bestellsystem – Setup-Anleitung

## Systemübersicht

```
Admin lädt Excel hoch → Telegram Bot
  → Workflow 01: Artikel parsen + Käufer benachrichtigen
  → Käufer öffnen Telegram Mini WebApp
  → Workflow 02: Artikelliste per API bereitstellen
  → Workflow 03: Bestellung speichern + Token generieren
  → Käufer erhalten Bearbeitungslink per Telegram
  → Workflow 05: Bestellung per Token laden (Bearbeiten)
  → Mittwoch 20:00: Workflow 04 → Excel-Auswertung an Admin
```

---

## 1. Voraussetzungen

- **n8n** läuft auf `https://univ-province-validity-jimmy.trycloudflare.com`
- **Telegram Bot** erstellt via @BotFather
- **Netlify** Account (oder alternatives Hosting für die WebApp)

---

## 2. Telegram Bot einrichten

1. In Telegram: `/newbot` bei @BotFather
2. Bot-Token kopieren
3. **Web App aktivieren**: Bei @BotFather → `/setmenubutton` → Bot auswählen → WebApp-URL angeben:
   ```
   https://jade-alfajores-4f3440.netlify.app
   ```

---

## 3. WebApp deployen

Die Datei `webapp/index.html` auf Netlify deployen:

1. Netlify Dashboard → "New site from upload"
2. `webapp/` Ordner hochladen
3. URL notieren (z.B. `https://jade-alfajores-4f3440.netlify.app`)

**Base-URL anpassen** (in index.html, nur diese eine Zeile ändern):
```javascript
const N8N_BASE_URL = 'https://DEINE-CLOUDFLARE-URL';
```
Die drei Webhook-URLs werden automatisch daraus abgeleitet.

---

## 4. HTTPS für Webhooks (Cloudflare Tunnel)

Telegram erfordert HTTPS. Da n8n auf HTTP läuft:

```bash
# Cloudflare Tunnel installieren
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared

# Tunnel starten
./cloudflared tunnel --url http://localhost:5678
```

Die generierte `https://xxx.trycloudflare.com` URL dann an **2 Stellen** eintragen:
1. **n8n Umgebungsvariable** `N8N_BASE_URL` setzen (z.B. in Docker: `-e N8N_BASE_URL=https://xxx.trycloudflare.com`)
2. **WebApp** `webapp/index.html` → `N8N_BASE_URL` anpassen

Die Workflows lesen die URL automatisch aus `$env.N8N_BASE_URL`.

---

## 5. WebApp-URL zentral konfigurieren

Die WebApp-URL wird über die **Static Data** der Workflows verwaltet. So musst du sie nur an **einer Stelle** ändern:

1. In n8n: Workflow **01** öffnen → **Settings** (Zahnrad) → **Static Data**
2. Im JSON den Wert von `webapp_url` anpassen:
   ```json
   "webapp_url": "https://deine-app.netlify.app"
   ```
3. Speichern – Workflow 03 liest die URL automatisch aus der geteilten Static Data.

> Falls die Workflows separate Static Data verwenden, muss `webapp_url` auch in Workflow 03 angepasst werden.

---

## 6. Workflows in n8n importieren

Für jeden Workflow in `workflows/`:

1. n8n → Workflows → Import from File
2. JSON-Datei auswählen
3. **Platzhalter ersetzen** in allen Workflows:
   - `ADMIN_CHAT_ID_HIER` → Deine Telegram Chat-ID (erfährst du via @userinfobot)
4. Telegram Credential zuweisen (falls nötig)
5. Workflows aktivieren

### Workflow-Reihenfolge:
| # | Datei | Funktion | Trigger |
|---|-------|----------|---------|
| 01 | workflow_01_excel_import.json | Excel hochladen & parsen | Telegram Nachricht |
| 02 | workflow_02_artikel_api.json | Artikelliste API | GET Webhook |
| 03 | workflow_03_bestellung_v2.json | Bestellung speichern | POST Webhook |
| 04 | workflow_04_abschluss.json | Bestellschluss + Excel | Cron Mi 20:00 |
| 05 | workflow_05_get_order.json | Bestellung laden (Edit) | GET Webhook |

> **Hinweis:** Die Workflows 01 und 03 verwenden `webapp_url` aus der Static Data für die WebApp-URL. Stelle sicher, dass die URL in Schritt 5 korrekt gesetzt ist.

---

## 7. Static Data – Wichtiger Hinweis

Die Workflows kommunizieren über `staticData`. **Alle 5 Workflows müssen Zugriff auf die gleichen Daten haben.**

### Option A: Gleiche Static Data (einfach)
Wenn alle Workflows über den gleichen n8n-Worker laufen, teilen sie sich die globale Static Data.

### Option B: Externe JSON-Datei (robust)
Für Produktionsbetrieb eine gemeinsame JSON-Datei auf dem Server nutzen:
```javascript
// Lesen
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/data/yauno-state.json', 'utf8'));

// Schreiben
fs.writeFileSync('/data/yauno-state.json', JSON.stringify(data));
```

---

## 8. Excel-Format für Angebote

Die hochgeladene Excel-Datei muss folgendem Format entsprechen:

```
Zeile 1-7:  Header (Firma, Kunde, Lieferdatum) → wird ignoriert
Zeile 8:    Spaltenheader (enthält "Artikel" und "Preis")
Zeile 9+:   Datenzeilen:
  Spalte A: Menge (leer, wird vom Kunden ausgefüllt)
  Spalte B: Artikelname
  Spalte C: Einheit (z.B. "ca 7kg", "Stück", "500g")
  Spalte D: Preis
  Spalte E: Summe (Formel)

Sonderzeilen:
  "Tagesangebote:" → Kategorie wechselt
  "Gesamt zu zahlen:" → Dateiende
```

---

## 9. Testen

1. **Bot starten**: `/start` an den Bot senden
2. **Excel hochladen**: Eine Bestelliste als Admin an den Bot senden
3. **WebApp öffnen**: Über den Menü-Button im Bot
4. **Bestellen**: Artikel auswählen und absenden
5. **Bearbeiten**: Link in der Bestätigung klicken
6. **Auswertung**: Manuell Workflow 04 ausführen (oder auf Mi 20:00 warten)

---

## 10. Käufer registrieren

Käufer werden automatisch registriert, sobald sie ihre erste Bestellung aufgeben. Ihre Chat-ID wird in der `kaeufer`-Liste gespeichert und sie werden bei neuen Angeboten benachrichtigt.

Manuell hinzufügen: In Workflow 01 → Static Data → `kaeufer` Array ergänzen.
