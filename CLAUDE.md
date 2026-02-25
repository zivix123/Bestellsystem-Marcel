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

## Tagesprotokoll 25.02.2026

### Was heute erledigt wurde:

- **WhatsApp-Modus:** System vollständig auf externe Bestellungen (WhatsApp-Link) umgestellt.
  Kein Telegram-Kontext mehr auf Besteller-Seite.

- **Datenstruktur geändert:** `bestellungen` von Object (`{chatId: {...}}`) zu Array (`[...]`).
  Jede Bestellung ist ein eigener Eintrag — kein Überschreiben, auch bei gleichem Namen.

- **Bestellung speichern (Workflow):** Nur noch `name` als Identifier. Kein Token-System mehr.
  Jede Bestellung bekommt eine eindeutige `id` (`ord_...`).

- **WebApp (index.html):** Namensfeld immer sichtbar und Pflichtfeld. Edit-Modus, Token-Handling
  und Telegram-Kontext komplett entfernt. Formular wird nach Absenden zurückgesetzt.

- **Tagesabschluss (WF04):** Excel enthält jetzt zwei Sektionen:
  1. **SAMMELBESTELLUNG** – alle Artikel über alle Bestellungen summiert (für Einkauf)
  2. **PACKLISTE** – pro Besteller mit Artikeln, Mengen und Preisen
  Telegram-Nachricht zeigt Sammelbestellung als Text.

- **Bot-Befehle:** Zwei neue Nodes im Workflow. Über Telegram-Bot abrufbar:
  - `/bestellungen` – alle Einzelbestellungen mit Positionen und Preisen
  - `/sammelbestellung` – alle Artikel summiert für Bestellung

- **Bestätigung an Käufer:** Node aus dem aktiven Flow entfernt (kein Telegram-Käufer mehr).
  Admin bekommt weiterhin Benachrichtigung bei jeder neuen Bestellung.

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

## TODO

### 🔴 Kritisch – End-to-End Tests

- [ ] **Test WebApp:** Link öffnen → Namensfeld sichtbar, Artikel auswählbar, Bestellung absenden
      → Formular leert sich, Toast erscheint, Eintrag in n8n Static Data vorhanden

- [ ] **Test mehrfache Bestellung:** Gleichem Namen nochmal bestellen → zweiter Eintrag
      im Array (kein Überschreiben)

- [ ] **Test Bot-Befehle:** Im Telegram-Bot `/bestellungen` und `/sammelbestellung` senden
      → korrekte Antworten

- [ ] **Test Tagesabschluss:** Manuellen Abschluss-Trigger auslösen → Excel mit
      SAMMELBESTELLUNG + PACKLISTE + Telegram-Nachricht mit Sammelbestellung kommt an

- [ ] **Test Bestellfenster schließen:** WebApp zeigt roten Offline-Banner

### ⚪ Optional / Nice-to-Have

- [ ] Rate-Limiting (max. N Bestellungen pro Name pro Tag)
- [ ] Admin-Dashboard: Status-Webhook testen (`/webhook/admin-status`)
- [ ] Backup der Static Data vor Workflow 04 Ausführung

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
