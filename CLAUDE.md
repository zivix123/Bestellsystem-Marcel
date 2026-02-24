# Claude Code Prompt – Yauno Bestellsystem

## Kontext für Claude Code

Du arbeitest am **Yauno Lebensmittel Bestellsystem** – einem vollautomatischen Telegram-Bestellsystem mit n8n Workflows und einer Telegram Mini WebApp.

---

## Systemarchitektur

```
[Admin] Excel hochladen → Telegram Bot (@Mamos158_bot)
    → n8n Komplett-Workflow (yvozoxStMSTousBN): Artikel parsen
    → Käufer bekommen persönliche Nachricht mit Shop-Button
    → Kanal (-1003713291834) bekommt öffentliche Ankündigung mit URL-Button
    → Käufer öffnen Telegram Mini WebApp (index.html auf Netlify)
    → GET /webhook/artikel → Artikelliste
    → POST /webhook/bestellung → Bestellung speichern + Token
    → Käufer erhalten Bearbeitungslink per Telegram (nur Telegram-User)
    → GET /webhook/bestellung-get?token= → Bestellung laden
    → Mittwoch 20:00 Uhr: Cron → Excel-Auswertung an Admin
```

**Wichtig:** Es gibt NUR EINEN aktiven Workflow (`yvozoxStMSTousBN` – "Yauno Bestellsystem").
Die 5 einzelnen Workflow-JSON-Dateien im `/workflows/`-Ordner sind **archiviert/veraltet**.
Alle Änderungen immer am Komplett-Workflow vornehmen (direkt in n8n oder per DB-Edit).

---

## Infrastruktur (produktiv, stabil)

```
Server:         Hetzner VPS (46.225.80.178)
n8n:            Docker Container, Port 5678
                docker-compose: /root/docker-compose.yml
HTTPS:          Caddy Reverse Proxy → yauno-n8n.duckdns.org (automatisch Let's Encrypt)
DNS:            DuckDNS (dynamisch, aber in der Praxis stabil)
WebApp:         Netlify → jade-alfajores-4f3440.netlify.app
                Auto-Deploy aus GitHub Branch: claude/continue-class-0fVMl
Bot:            @Mamos158_bot
```

**KEIN cloudflared nötig** – Caddy + DuckDNS übernimmt HTTPS. Cloudflared-Prozesse sind gestoppt.

---

## Konfiguration (aktuelle Werte)

```
n8n URL:          https://yauno-n8n.duckdns.org
WebApp URL:       https://jade-alfajores-4f3440.netlify.app
Telegram Bot:     @Mamos158_bot (Token in Credential "Telegram account", ID: xb5gkCUgy5gUS2OJ)
Admin Chat ID:    1121266642
Telegram Kanal:   -1003713291834
Workflow ID:      yvozoxStMSTousBN
```

---

## Docker & Deployment

```bash
# n8n starten / neustarten:
docker compose -f /root/docker-compose.yml up -d
docker restart n8n

# Logs:
docker logs n8n --tail 50

# Umgebungsvariablen (in /root/docker-compose.yml):
N8N_BASE_URL=https://yauno-n8n.duckdns.org
WEBHOOK_URL=https://yauno-n8n.duckdns.org/
N8N_EDITOR_BASE_URL=https://yauno-n8n.duckdns.org/
```

**Nach DB-Änderungen am Workflow immer `docker restart n8n`** – n8n cached Workflows im RAM.

---

## Workflow-Änderungen (wichtig!)

Die n8n API (PUT /workflows/:id) ist durch abgelaufene API-Keys eingeschränkt.
Workflow-Änderungen daher direkt in der SQLite-Datenbank:

```bash
# Datenbank-Pfad auf dem Host:
/root/n8n-data/database.sqlite

# Workflow-Nodes lesen:
python3 -c "
import sqlite3, json
conn = sqlite3.connect('/root/n8n-data/database.sqlite')
cur = conn.cursor()
cur.execute(\"SELECT nodes FROM workflow_entity WHERE id='yvozoxStMSTousBN'\")
nodes = json.loads(cur.fetchone()[0])
for n in nodes: print(n['name'], '|', n['type'].split('.')[-1])
"

# Nach Änderungen immer:
docker restart n8n
```

---

## Webhook-Endpunkte (alle im Komplett-Workflow)

| Node                    | Methode | Pfad                        | Beschreibung                        |
|-------------------------|---------|-----------------------------|-------------------------------------|
| Telegram Trigger        | —       | Telegram Bot                | Excel vom Admin empfangen           |
| Webhook Artikel         | GET     | /webhook/artikel            | Artikelliste für WebApp             |
| Webhook Bestellung      | POST    | /webhook/bestellung         | Bestellung speichern                |
| Webhook GET Bestellung  | GET     | /webhook/bestellung-get     | Bestellung per Token laden          |
| Mittwoch 20:00          | —       | Cron                        | Bestellschluss + Excel-Auswertung   |
| Manueller Abschluss     | POST    | /webhook/...                | Workflow 04 manuell triggern        |
| Admin Reset             | POST    | /webhook/...                | Bestellsystem zurücksetzen          |
| Admin Status            | GET     | /webhook/...                | Status & Bestellübersicht           |

---

## n8n Datenstruktur (Static Data des Komplett-Workflows)

```javascript
{
  artikel: [{ id, name, einheit, preis, kategorie }],
  bestellungen: { [chat_id]: { chatId, userName, positionen, gesamtpreis, token, zeitpunkt } },
  tokens: { [token]: chat_id },
  bestellung_aktiv: true/false,
  kaeufer: [chat_id, ...],       // Telegram-User die Benachrichtigungen bekommen
  angebot_datum: "18.2.26",
  webapp_url: "https://jade-alfajores-4f3440.netlify.app"
}
```

---

## WebApp (webapp/index.html)

Deployed auf Netlify. Auto-Deploy bei Push auf Branch `claude/continue-class-0fVMl`.

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
- **Externer Modus**: Namensfeld wenn kein Telegram-Kontext (WhatsApp/Browser)

**Externer Bestellmodus (neu):**
- Wenn `tg.initDataUnsafe.user.id` fehlt → Namensfeld wird eingeblendet (Pflichtfeld)
- Fallback-chatId: `ext_<timestamp>` (kein Telegram-User)
- `isTelegramUser: false` → Bestätigung-an-Käufer Node wird übersprungen (continueOnFail)
- Bestellung wird trotzdem gespeichert und ist für Admin sichtbar

---

## Tests

```bash
cd /root/Bestellsystem-Marcel/tests
npm test
# Ergebnis: 96/96 Tests grün

# Test-Dateien:
# webapp.test.js  – formatCurrency, changeQty, setQty, calculateFooter, buildPayload
# wf03.test.js    – Bestellung speichern (Fehler, Neu, Update, Käufer, Mengenwarnung)
# wf05.test.js    – Token laden (Fehler, Erfolg)
# wf01.test.js    – Excel-Parser, Datumsextraktion, Käufer laden, Static Data
```

---

## Bekannte Bugs & Einschränkungen

1. **isUpdate-Bug (WF03):** `const isUpdate = !!body.token` prüft nur ob Token gesendet wurde,
   nicht ob er gültig ist. Bei ungültigem Token → isUpdate=true obwohl neue Bestellung.
   **Fix:** `const isUpdate = !!body.token && !!tokens[body.token];`

2. **Telegram web_app-Button in Kanälen verboten:** Kanalbenachrichtigung nutzt URL-Button
   (nicht web_app). Persönliche Käufer-Nachrichten nutzen web_app-Button (erlaubt).

3. **Käufer-Liste manuell pflegen:** Käufer werden automatisch bei erster Bestellung
   registriert. Neue Käufer können alternativ manuell in der Static Data eingetragen werden.

4. **API-Key Ablauf:** n8n API-Keys haben Ablaufdatum. Bei 401-Fehlern neuen Key erstellen
   unter: n8n → Settings → API → Create API Key.

---

## Tagesprotokoll 24.02.2026

### Was heute erledigt wurde:

- **HTTPS-Setup:** cloudflared war unnötig – Caddy + DuckDNS war bereits eingerichtet.
  `yauno-n8n.duckdns.org` ist die stabile, produktive URL. Cloudflared-Prozesse gestoppt.

- **docker-compose.yml erstellt** (`/root/docker-compose.yml`) mit `N8N_BASE_URL`,
  `WEBHOOK_URL` und allen bestehenden Env-Vars. n8n läuft jetzt sauber über Compose.

- **Telegram Credential** (`xb5gkCUgy5gUS2OJ`) mit Bot-Token für @Mamos158_bot befüllt.

- **Channel-Ankündigung repariert:**
  - Channel-ID `-1003713291834` eingetragen
  - `web_app`-Button → `url`-Button (web_app ist in Kanälen nicht erlaubt)

- **Käufer-Benachrichtigung repariert:** Die 3 Nodes (`Käufer laden`, `Käufer vorhanden?`,
  `Käufer benachrichtigen`) fehlten im Komplett-Workflow komplett. Hinzugefügt und verdrahtet.
  Käufer bekommen persönliche Nachricht mit `web_app`-Button (in privaten Chats erlaubt).

- **Externe Bestellungen ermöglicht:** WebApp zeigt Namensfeld wenn kein Telegram-Kontext
  (z.B. Link aus WhatsApp geteilt). UUID-Fallback als chatId. Workflow überbrückt fehlende
  Telegram-Bestätigung via `continueOnFail`.

- **Tests erweitert:** `wf01.test.js` mit 31 neuen Tests für Excel-Parser + Käufer laden.
  Gesamt: 96/96 grün.

---

## TODO für morgen

### 🔴 Kritisch – End-to-End Tests

- [ ] **Test 2:** Bestellung aufgeben (aus Telegram heraus) → Bestätigung + Bearbeitungslink
      per Telegram kommt an. chatId und Token werden korrekt gesetzt.

- [ ] **Test 3:** Bearbeitungslink klicken → grüner BEARBEITEN-Banner, alte Mengen geladen,
      Änderung speichern → Token bleibt gleich.

- [ ] **Test 4:** Bestellfenster schließen (WF04 manuell oder Admin-Close-Webhook) →
      roter Offline-Banner in WebApp erscheint, keine neuen Bestellungen möglich.

- [ ] **Test 5:** WF04 manuell triggern → Excel-Auswertung kommt per Telegram an Admin.
      Webhook: POST /webhook/... (Manueller Abschluss-Trigger – genaue URL prüfen).

### 🟡 Bugs fixen

- [ ] **isUpdate-Bug fixen:** In Workflow "Bestellung speichern" (Code-Node):
  ```javascript
  // ALT (fehlerhaft):
  const isUpdate = !!body.token;
  // NEU (korrekt):
  const isUpdate = !!body.token && !!(staticData.tokens || {})[body.token];
  ```

- [ ] **webapp_url in Static Data prüfen:** Steht in der Static Data des Workflows
  die korrekte Netlify-URL? Käufer-Benachrichtigung nutzt `staticData.webapp_url`.
  Prüfen via: n8n → Workflow → Settings → Static Data → `webapp_url`

### 🟢 Käufer verwalten

- [ ] **Echte Käufer eintragen:** Aktuell ist nur Admin-ID `1121266642` in der Käufer-Liste.
  Weitere Käufer-IDs hinzufügen (Static Data → `kaeufer`-Array) oder
  Bot-Befehl `/add_buyer` implementieren.

- [ ] **Käufer-Registrierung testen:** Neue Bestellung von unbekannter Chat-ID →
  wird automatisch in `kaeufer[]` eingetragen?

### 🔵 Workflow-Export aktualisieren

- [ ] **workflow_komplett.json exportieren:** Der aktive Workflow in n8n ist weiterentwickelt
  worden (3 neue Nodes, Bugfixes). Die Datei `workflows/workflow_komplett.json` ist veraltet.
  Export via: n8n → Workflow → Download → als `workflow_komplett.json` speichern.

### ⚪ Optional / Nice-to-Have

- [ ] Käufer-Verwaltung per Bot-Befehle (`/add_buyer <chat_id>`, `/remove_buyer <chat_id>`)
- [ ] Admin-Dashboard: Status-Webhook testen (`/webhook/admin-status`)
- [ ] Rate-Limiting für Bestellungen (max. 1 Bestellung pro Chat-ID pro Stunde)
- [ ] Backup der Static Data (Bestellungen) vor Workflow 04 Ausführung

---

## Wichtige Hinweise

- **Token-Logik**: Token wird beim ersten Bestellen generiert und bleibt die ganze Woche.
  Bei Änderungen wird der gleiche Token wiederverwendet. WF04 (Cron) löscht alle Tokens.

- **WebApp Demo-Modus**: Wenn kein Server erreichbar ist, lädt die WebApp automatisch
  Beispieldaten. Erkennbar am "Demo-Modus" Text im Header.

- **Mengenwarnung**: Workflow prüft ob ein Käufer mehr als 50 Einheiten eines Artikels
  bestellt und sendet eine Warnung an den Admin.

- **DB-Änderungen**: Workflow-Nodes immer per Python-Script in SQLite ändern, danach
  `docker restart n8n`. Die n8n-UI zeigt Änderungen erst nach Reload.
