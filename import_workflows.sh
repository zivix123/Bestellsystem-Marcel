#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert/aktualisiert den Komplett-Workflow in n8n.
# Löscht automatisch Duplikate.
# Speichert die Workflow-ID in .wf_id für Updates.
#
# Ausführen auf dem n8n-Server:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

N8N_URL="http://localhost:5678"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZDkwMmRkN2MtZDVjNC00NjVjLTk5MzEtOTU5YTc4MjBmZjkzIiwiaWF0IjoxNzcxNzk0MzkxLCJleHAiOjE3NzQzMjQ4MDB9.vM7_ldZU0XtPC0wtNnFMJTnkgVUqU2ihSegeGn-ge7M"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$SCRIPT_DIR/workflows/workflow_komplett.json"
ID_FILE="$SCRIPT_DIR/.wf_id"

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Import"
echo "=========================================="
echo ""

if [ ! -f "$WF_FILE" ]; then
  echo -e "${RED}FEHLER:${NC} workflow_komplett.json nicht gefunden!"
  exit 1
fi

# API-Verbindung testen
echo -n "1. Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "   Ist n8n gestartet? Läuft es auf Port 5678?"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# ============================================
# Schritt 2: Duplikate finden und aufräumen
# ============================================
echo -n "2. Suche bestehende 'Yauno Bestellsystem' Workflows... "
ALL_WFS=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

# Alle Workflow-IDs mit dem Namen "Yauno Bestellsystem" finden
YAUNO_IDS=$(echo "$ALL_WFS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    wfs = data.get('data', data) if isinstance(data, dict) else data
    if isinstance(wfs, dict):
        wfs = wfs.get('data', [])
    ids = [w['id'] for w in wfs if 'Yauno' in w.get('name', '')]
    print('\n'.join(ids))
except:
    pass
" 2>/dev/null)

YAUNO_COUNT=$(echo "$YAUNO_IDS" | grep -c .)

if [ "$YAUNO_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}Keine gefunden${NC} (wird neu erstellt)"
elif [ "$YAUNO_COUNT" -eq 1 ]; then
  echo -e "${GREEN}1 gefunden${NC} (ID: $(echo "$YAUNO_IDS" | head -1))"
else
  echo -e "${YELLOW}${YAUNO_COUNT} Duplikate gefunden!${NC}"
  echo ""

  # Gespeicherte ID bevorzugen
  KEEP_ID=""
  if [ -f "$ID_FILE" ]; then
    SAVED_ID=$(cat "$ID_FILE" | tr -d '[:space:]')
    if echo "$YAUNO_IDS" | grep -q "$SAVED_ID"; then
      KEEP_ID="$SAVED_ID"
    fi
  fi

  # Wenn keine gespeicherte ID, den ersten behalten
  if [ -z "$KEEP_ID" ]; then
    KEEP_ID=$(echo "$YAUNO_IDS" | head -1)
  fi

  echo "   Behalte Workflow: $KEEP_ID"

  # Alle anderen löschen
  while IFS= read -r WF_ID_DEL; do
    if [ "$WF_ID_DEL" != "$KEEP_ID" ] && [ -n "$WF_ID_DEL" ]; then
      echo -n "   Lösche Duplikat $WF_ID_DEL... "
      DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X DELETE \
        -H "X-N8N-API-KEY: $API_KEY" \
        "$N8N_URL/api/v1/workflows/$WF_ID_DEL" 2>/dev/null)
      if [ "$DEL_CODE" = "200" ]; then
        echo -e "${GREEN}gelöscht${NC}"
      else
        echo -e "${RED}Fehler (HTTP $DEL_CODE)${NC}"
      fi
    fi
  done <<< "$YAUNO_IDS"

  # Den behaltenen als aktuelle ID setzen
  echo "$KEEP_ID" > "$ID_FILE"
fi

# ============================================
# Schritt 3: Workflow importieren/aktualisieren
# ============================================
WF_ID=""
if [ -f "$ID_FILE" ]; then
  WF_ID=$(cat "$ID_FILE" | tr -d '[:space:]')
  # Prüfe ob die ID noch existiert
  CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-N8N-API-KEY: $API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
  if [ "$CHECK" != "200" ]; then
    echo "   Gespeicherte ID $WF_ID existiert nicht mehr, erstelle neu..."
    WF_ID=""
  fi
fi

if [ -n "$WF_ID" ]; then
  # Versuche zuerst zu entarchivieren (falls archiviert)
  curl -s -o /dev/null \
    -X PATCH \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"archived": false}' \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null

  echo -n "3. Aktualisiere Workflow (ID: $WF_ID)... "
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)

  # Wenn Update fehlschlägt (z.B. archiviert), Workflow löschen und neu erstellen
  UPDATE_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$UPDATE_CODE" = "400" ]; then
    echo -e "${YELLOW}Archiviert – lösche und erstelle neu${NC}"
    curl -s -o /dev/null \
      -X DELETE \
      -H "X-N8N-API-KEY: $API_KEY" \
      "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null
    rm -f "$ID_FILE"
    WF_ID=""
  fi
fi

if [ -z "$WF_ID" ]; then
  echo -n "3. Erstelle neuen Workflow... "
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_URL/api/v1/workflows" 2>/dev/null)
fi

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('   Grund:', d.get('message', str(d)))
except:
    print(sys.stdin.read()[:200])
" 2>/dev/null
  exit 1
fi

NEW_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo -e "${GREEN}OK${NC} (ID: $NEW_ID)"

# ID speichern für nächstes Update
echo "$NEW_ID" > "$ID_FILE"

# ============================================
# Schritt 4: Workflow aktivieren
# ============================================
echo -n "4. Aktiviere Workflow... "
ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows/$NEW_ID/activate" 2>/dev/null)

ACT_CODE=$(echo "$ACTIVATE_RESPONSE" | tail -1)
ACT_BODY=$(echo "$ACTIVATE_RESPONSE" | sed '$d')

if [ "$ACT_CODE" = "200" ]; then
  IS_ACTIVE=$(echo "$ACT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('active', False))" 2>/dev/null)
  if [ "$IS_ACTIVE" = "True" ]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}Antwort OK, aber Workflow nicht aktiv!${NC}"
    echo "   Bitte manuell in n8n aktivieren."
    echo "   Mögliche Ursache: Telegram-Credentials fehlen oder sind ungültig."
  fi
else
  echo -e "${RED}FEHLER${NC} (HTTP $ACT_CODE)"
  echo "$ACT_BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    msg = d.get('message', '')
    if msg:
        print('   Grund:', msg)
    else:
        print('   ', str(d)[:200])
except:
    for line in sys.stdin:
        print('   ', line.strip()[:200])
        break
" 2>/dev/null
  echo ""
  echo -e "${YELLOW}Häufige Ursachen:${NC}"
  echo "   - Telegram Credentials nicht konfiguriert (n8n → Credentials → Telegram)"
  echo "   - WEBHOOK_URL in Docker falsch (muss die aktuelle Cloudflare-Tunnel-URL sein)"
  echo "   - Alter Webhook-Konflikt (anderer Workflow nutzt denselben Telegram Bot)"
fi

# ============================================
# Schritt 5: Status prüfen
# ============================================
echo ""
echo "=========================================="
echo -n "  Status: "
STATUS_RESP=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows/$NEW_ID" 2>/dev/null)
FINAL_ACTIVE=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('active', False))" 2>/dev/null)

if [ "$FINAL_ACTIVE" = "True" ]; then
  echo -e "${GREEN}Workflow aktiv und bereit!${NC}"
  echo ""
  echo "  Jetzt testen: Sende eine Excel-Datei an den Telegram Bot"
else
  echo -e "${RED}Workflow NICHT aktiv${NC}"
  echo ""
  echo "  Prüfe in n8n:"
  echo "  1. Öffne $N8N_URL/workflow/$NEW_ID"
  echo "  2. Klicke auf 'Activate' und lies die Fehlermeldung"
  echo "  3. Stelle sicher, dass Telegram-Credentials korrekt sind"
fi
echo "=========================================="
echo ""
