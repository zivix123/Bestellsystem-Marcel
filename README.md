# Yauno Bestellsystem – Setup-Anleitung

## Systemuebersicht

```
Admin laedt Excel hoch → Telegram Bot
  → Komplett-Workflow: Artikel parsen + Kaeufer benachrichtigen
  → Kaeufer oeffnen Telegram Mini WebApp
  → GET /webhook/artikel → Artikelliste
  → POST /webhook/bestellung → Bestellung speichern + Token
  → Kaeufer erhalten Bearbeitungslink per Telegram
  → GET /webhook/bestellung-get?token= → Bestellung laden
  → Mittwoch 20:00: Cron → Excel-Auswertung an Admin
```

**Ein Workflow – alles drin.** Alle 5 Funktionsbereiche laufen in einem einzigen
n8n-Workflow. Die Static Data wird direkt geteilt – keine internen HTTP-Calls noetig.

---

## 1. Voraussetzungen

- **n8n** laeuft auf `https://yauno-n8n.duckdns.org`
- **Telegram Bot** erstellt via @BotFather
- **Netlify** Account fuer die WebApp (oder alternatives Hosting)

---

## 2. HTTPS einrichten (DuckDNS + Caddy)

n8n laeuft auf HTTP (Port 5678). Fuer Telegram Webhooks wird HTTPS benoetigt.

```bash
# Caddy installieren
sudo apt install -y caddy

# Konfiguration: /etc/caddy/Caddyfile
yauno-n8n.duckdns.org {
    reverse_proxy localhost:5678
}

# Starten
sudo systemctl enable --now caddy
```

Caddy kuemmert sich automatisch um Let's Encrypt Zertifikate.

---

## 3. Telegram Bot einrichten

1. In Telegram: `/newbot` bei @BotFather
2. Bot-Token kopieren
3. **Web App aktivieren**: Bei @BotFather → `/setmenubutton` → Bot auswaehlen → WebApp-URL angeben:
   ```
   https://jade-alfajores-4f3440.netlify.app
   ```

---

## 4. WebApp deployen

Die Datei `webapp/index.html` auf Netlify deployen:

1. Netlify Dashboard → "New site from upload"
2. `webapp/` Ordner hochladen
3. URL notieren (z.B. `https://jade-alfajores-4f3440.netlify.app`)

**Base-URL** ist bereits gesetzt in index.html:
```javascript
const N8N_BASE_URL = 'https://yauno-n8n.duckdns.org';
```
Die drei Webhook-URLs werden automatisch daraus abgeleitet.

---

## 5. Workflow in n8n importieren

Es gibt nur **einen** Workflow: `workflows/workflow_komplett.json`

### Per Skript (empfohlen):
```bash
export N8N_API_KEY="dein-api-key"
export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
./import_workflows.sh
```

### Manuell:
1. n8n → Workflows → Import from File
2. `workflow_komplett.json` auswaehlen
3. Telegram Credential zuweisen (falls noetig)
4. Workflow aktivieren (Toggle oben rechts)

### Workflow aktualisieren (nach Aenderungen):
```bash
export N8N_API_KEY="dein-api-key"
export N8N_BASE_URL="https://yauno-n8n.duckdns.org"
./update_workflows.sh
```

**Bestehende andere Workflows in n8n werden NICHT angefasst.**

---

## 6. WebApp-URL zentral konfigurieren

Die WebApp-URL wird ueber die **Static Data** des Workflows verwaltet:

1. In n8n: Workflow oeffnen → **Settings** (Zahnrad) → **Static Data**
2. Im JSON den Wert von `webapp_url` anpassen:
   ```json
   "webapp_url": "https://deine-app.netlify.app"
   ```
3. Speichern – alle Workflow-Bereiche lesen die URL automatisch.

---

## 7. Excel-Format fuer Angebote

Die hochgeladene Excel-Datei muss folgendem Format entsprechen:

```
Zeile 1-7:  Header (Firma, Kunde, Lieferdatum) → wird ignoriert
Zeile 8:    Spaltenheader (enthaelt "Artikel" und "Preis")
Zeile 9+:   Datenzeilen:
  Spalte A: Menge (leer, wird vom Kunden ausgefuellt)
  Spalte B: Artikelname
  Spalte C: Einheit (z.B. "ca 7kg", "Stueck", "500g")
  Spalte D: Preis
  Spalte E: Summe (Formel)

Sonderzeilen:
  "Tagesangebote:" → Kategorie wechselt zu "Tagesangebote"
  "Gesamt zu zahlen:" → Dateiende

Wenn keine "Tagesangebote:"-Zeile vorhanden ist, werden alle Artikel
als Kategorie "Allgemein" eingeordnet.
```

---

## 8. Testen

1. **Bot starten**: `/start` an den Bot senden
2. **Excel hochladen**: Eine Bestelliste als Admin an den Bot senden
3. **WebApp oeffnen**: Ueber den Menue-Button im Bot
4. **Bestellen**: Artikel auswaehlen und absenden
5. **Bearbeiten**: Link in der Bestaetigung klicken
6. **Auswertung**: Manuell Cron-Trigger ausfuehren (oder auf Mi 20:00 warten)

---

## 9. Kaeufer registrieren

Kaeufer werden automatisch registriert, sobald sie ihre erste Bestellung aufgeben.
Ihre Chat-ID wird in der `kaeufer`-Liste gespeichert und sie werden bei neuen
Angeboten per Telegram benachrichtigt.

Manuell hinzufuegen: In n8n → Workflow → Settings → Static Data → `kaeufer` Array ergaenzen.
