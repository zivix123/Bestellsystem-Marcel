#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert/aktualisiert den Komplett-Workflow in n8n.
#
# Ausführen auf dem n8n-Server:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

N8N_URL="http://localhost:5678"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WF_FILE="$SCRIPT_DIR/workflows/workflow_komplett.json"
WF_NAME="Yauno Bestellsystem"

echo ""
echo "=========================================="
echo "  Yauno Bestellsystem – Workflow Import"
echo "=========================================="
echo ""

# Workflow-Datei prüfen
if [ ! -f "$WF_FILE" ]; then
  echo -e "${RED}FEHLER:${NC} workflow_komplett.json nicht gefunden!"
  exit 1
fi

# API-Verbindung testen
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo ""
  echo "Mögliche Ursachen:"
  echo "  - n8n läuft nicht"
  echo "  - API Key ist ungültig"
  echo "  - N8N_URL falsch (aktuell: $N8N_URL)"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# Bestehenden Workflow suchen
echo -n "Suche bestehenden Workflow '$WF_NAME'... "
EXISTING=$(curl -s \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

# Robust JSON parsing mit python3
WF_ID=$(echo "$EXISTING" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    workflows = data.get('data', data) if isinstance(data, dict) else data
    if isinstance(workflows, dict):
        workflows = workflows.get('data', [])
    for wf in workflows:
        if wf.get('name') == '$WF_NAME':
            print(wf['id'])
            break
except: pass
" 2>/dev/null)

if [ -n "$WF_ID" ]; then
  echo -e "gefunden (ID: $WF_ID)"
  echo -n "Aktualisiere Workflow... "
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
else
  echo "nicht gefunden, erstelle neu..."
  echo -n "Importiere Workflow... "
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_URL/api/v1/workflows" 2>/dev/null)
fi

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  NEW_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}OK${NC} (ID: $NEW_ID)"

  # Workflow aktivieren
  echo -n "Aktiviere Workflow... "
  curl -s -o /dev/null \
    -X PATCH \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"active": true}' \
    "$N8N_URL/api/v1/workflows/$NEW_ID" 2>/dev/null
  echo -e "${GREEN}OK${NC}"

  echo ""
  echo "=========================================="
  echo -e "${GREEN}Workflow importiert und aktiviert!${NC}"
  echo "=========================================="
  echo ""
  echo "Jetzt testen: Sende eine Excel-Datei an den Telegram Bot"
else
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "$BODY" | head -3
  echo ""
  echo "=========================================="
  echo -e "${RED}Import fehlgeschlagen.${NC}"
  echo "=========================================="
fi
echo ""
