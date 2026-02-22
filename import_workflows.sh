#!/bin/bash
# ============================================
# Yauno Bestellsystem – n8n Workflow Import
# ============================================
# Importiert/aktualisiert den Komplett-Workflow in n8n.
# Speichert die Workflow-ID in .wf_id für Updates.
#
# Ausführen auf dem n8n-Server:
#   chmod +x import_workflows.sh
#   ./import_workflows.sh
# ============================================

N8N_URL="http://localhost:5678"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNDFlYjNkYi1mOGRkLTRhZmEtODEzZS1lYzRmNTBhZGZmN2MiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzgwYTE0YzItNmYyYi00MjI4LTgzN2YtYTdhMDc1MjI5NTM1IiwiaWF0IjoxNzcxNzUyOTg0LCJleHAiOjE3NzQzMDY4MDB9.7zyzXBWexrzZGy7Mj7eLwwbN6fuNBqck4M_W5Qz4FSo"

GREEN='\033[0;32m'
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
echo -n "Teste n8n API-Verbindung... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/workflows" 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# Gespeicherte Workflow-ID laden (falls vorhanden)
WF_ID=""
if [ -f "$ID_FILE" ]; then
  WF_ID=$(cat "$ID_FILE" | tr -d '[:space:]')
  # Prüfe ob die ID noch existiert
  CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-N8N-API-KEY: $API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
  if [ "$CHECK" != "200" ]; then
    echo "  Gespeicherte ID $WF_ID existiert nicht mehr, erstelle neu..."
    WF_ID=""
  fi
fi

if [ -n "$WF_ID" ]; then
  echo -n "Aktualisiere Workflow (ID: $WF_ID)... "
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$WF_FILE" \
    "$N8N_URL/api/v1/workflows/$WF_ID" 2>/dev/null)
else
  echo -n "Erstelle neuen Workflow... "
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
  NEW_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  echo -e "${GREEN}OK${NC} (ID: $NEW_ID)"

  # ID speichern für nächstes Update
  echo "$NEW_ID" > "$ID_FILE"

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
  echo -e "${GREEN}Workflow importiert und aktiviert!${NC}"
  echo "Jetzt testen: Sende eine Excel-Datei an den Telegram Bot"
else
  echo -e "${RED}FEHLER${NC} (HTTP $HTTP_CODE)"
  echo "$BODY" | head -3
fi
echo ""
